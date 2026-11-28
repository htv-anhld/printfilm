"""kie.ai HTTP 客户端：建任务、查任务（recordInfo）、查 credit 余额。

约定（见 docs/KIE_API_NOTES.md）：
- 业务错误常以 **HTTP 200 + body.code≠200** 返回，必须同时看 HTTP 状态与 body.code
- ``data.resultJson`` 是 JSON 字符串，内含 ``resultUrls`` / ``lastFrameUrl``
- 429（每 10 秒 20 次建单）被拒不排队；建单只在「请求确定没被受理」时重试，避免重复扣 credit
- 绝不记录 API Key：日志只写路径与状态码，请求留痕经 observed_request 统一脱敏
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.i18n import _
from app.services.kie_models import KIE_BASE_URL

logger = logging.getLogger(__name__)

CREATE_PATH = "/api/v1/jobs/createTask"
RECORD_PATH = "/api/v1/jobs/recordInfo"
CREDIT_PATH = "/api/v1/chat/credit"

CREATE_TIMEOUT = httpx.Timeout(connect=15.0, read=60.0, write=60.0, pool=30.0)
QUERY_TIMEOUT = httpx.Timeout(connect=15.0, read=30.0, write=30.0, pool=30.0)
# 可重试：限流 / 服务端故障（body.code 同此集合）
RETRY_STATUS = {429, 500, 502, 503, 504}
# 建单仅在这些情况下重试：被拒（429）或网关明确没转发（502/503/504）
CREATE_RETRY_STATUS = {429, 502, 503, 504}


class KieError(RuntimeError):
    """kie 调用失败；message 已按当前语言翻译，code 为 kie 业务码或 HTTP 状态。"""

    def __init__(self, code: int | None, message: str, *, retryable: bool = False, raw: str = "") -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.raw = raw


@dataclass
class KieTaskRecord:
    """recordInfo 解析结果。"""

    task_id: str
    state: str
    status: str  # pending | running | succeeded | failed
    result_urls: list[str] = field(default_factory=list)
    last_frame_url: str | None = None
    fail_code: str = ""
    fail_msg: str = ""
    credits_consumed: float | None = None
    cost_time: float | None = None
    model: str = ""
    raw: dict[str, Any] = field(default_factory=dict)


# kie 业务码 → 用户可见短句（中文原文作 i18n key）
_ERROR_MESSAGES: dict[int, str] = {
    401: "Kie.ai API Key 无效或已失效，请管理员在「模型」渠道里更新 Key",
    402: "Kie.ai 账户 credit 不足，请管理员充值后重试",
    404: "Kie.ai 找不到该任务或接口",
    408: "Kie.ai 生成超时，请稍后重试",
    422: "Kie.ai 拒绝了请求参数，请调整提示词、素材或参数后重试",
    429: "Kie.ai 请求过于频繁，请稍后重试",
    455: "Kie.ai 正在维护，请稍后重试",
    500: "Kie.ai 服务暂时异常，请稍后重试",
    501: "Kie.ai 生成失败，请调整提示词或素材后重试",
    505: "Kie.ai 已关闭该功能，请换一个模型",
}


def kie_error_message(code: int | str | None, detail: str = "") -> str:
    """把 kie 业务码 / failCode 翻成用户可见文案；未知码回退通用文案并附原因。"""
    try:
        num = int(str(code).strip()) if code not in (None, "") else None
    except ValueError:
        num = None
    template = _ERROR_MESSAGES.get(num or 0)
    base = _(template) if template else _("Kie.ai 请求失败（代码 {code}）", code=code if code not in (None, "") else "?")
    tail = (detail or "").strip()
    if tail and num in {422, 501, None} or (tail and not template):
        return base + _(" 详情：{detail}", detail=tail[:300])
    return base


def map_kie_state(state: str | None) -> str:
    """kie state → 站点统一状态。"""
    raw = (state or "").strip().lower()
    if raw == "success":
        return "succeeded"
    if raw in {"fail", "failed", "error"}:
        return "failed"
    if raw == "generating":
        return "running"
    return "pending" if raw in {"waiting", "queuing", ""} else "running"


def _parse_result_json(raw: Any) -> dict[str, Any]:
    """resultJson 可能是字符串或已解析对象；坏 JSON 视为空。"""
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
        except ValueError:
            logger.warning("kie resultJson 不是合法 JSON（长度 %s）", len(raw))
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _as_float(value: Any) -> float | None:
    """数字或数字字符串 → float；其它 None。"""
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def parse_record(payload: dict[str, Any], task_id: str = "") -> KieTaskRecord:
    """解析 recordInfo 响应体（含外层 code/msg/data）。"""
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    result = _parse_result_json(data.get("resultJson"))
    urls = result.get("resultUrls") or result.get("result_urls") or []
    if isinstance(urls, str):
        urls = [urls]
    clean_urls = [str(url).strip() for url in urls if isinstance(url, str) and url.strip()]
    last_frame = result.get("lastFrameUrl") or result.get("last_frame_url")
    state = str(data.get("state") or "")
    return KieTaskRecord(
        task_id=str(data.get("taskId") or task_id or ""),
        state=state,
        status=map_kie_state(state),
        result_urls=clean_urls,
        last_frame_url=str(last_frame).strip() if isinstance(last_frame, str) and last_frame.strip() else None,
        fail_code=str(data.get("failCode") or "").strip(),
        fail_msg=str(data.get("failMsg") or "").strip(),
        credits_consumed=_as_float(data.get("creditsConsumed")),
        cost_time=_as_float(data.get("costTime")),
        model=str(data.get("model") or ""),
        raw=data,
    )


def _body_code(payload: Any) -> int:
    """body.code；缺失视为 200。"""
    if not isinstance(payload, dict) or payload.get("code") in (None, ""):
        return 200
    try:
        return int(payload["code"])
    except (TypeError, ValueError):
        return 200


def _retry_delay(resp: httpx.Response | None, attempt: int, base: float) -> float:
    """指数退避，尊重 Retry-After（≤30 秒）。"""
    if resp is not None:
        raw = resp.headers.get("Retry-After")
        if raw:
            try:
                return max(0.0, min(30.0, float(raw)))
            except ValueError:
                pass
    return min(30.0, base * (2**attempt))


class KieClient:
    """kie.ai 异步客户端；transport / sleep 可注入，便于测试。"""

    def __init__(
        self,
        api_key: str,
        base_url: str | None = None,
        *,
        channel_id: str = "",
        transport: httpx.AsyncBaseTransport | None = None,
        max_retries: int = 3,
        backoff: float = 1.0,
        sleep=asyncio.sleep,
    ) -> None:
        self._api_key = (api_key or "").strip()
        self.base_url = (base_url or KIE_BASE_URL).strip().rstrip("/") or KIE_BASE_URL
        self.channel_id = channel_id
        self._transport = transport
        self._max_retries = max(0, int(max_retries))
        self._backoff = max(0.0, float(backoff))
        self._sleep = sleep

    def __repr__(self) -> str:  # 防止调试输出带出 Key
        return f"KieClient(base_url={self.base_url!r}, channel_id={self.channel_id!r})"

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}

    def _client(self, timeout: httpx.Timeout) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=timeout, transport=self._transport)

    async def _send(self, client: httpx.AsyncClient, method: str, path: str, **kwargs: Any) -> httpx.Response:
        """单次请求：走 observed_request 留痕（脱敏）并记录渠道熔断。"""
        from app.services.tasks.upstream import observed_request
        from app.services.upstream_channels import (
            is_failover_exception,
            is_failover_status,
            record_channel_failure,
            record_channel_success,
        )

        try:
            resp = await observed_request(
                client, method, f"{self.base_url}{path}", provider="kie", headers=self._headers(), **kwargs
            )
        except httpx.HTTPError as exc:
            if is_failover_exception(exc):
                record_channel_failure(self.channel_id)
            raise
        code = resp.status_code if resp.status_code >= 400 else _body_code(_safe_json(resp))
        if is_failover_status(code):
            record_channel_failure(self.channel_id)
        elif code < 400:
            record_channel_success(self.channel_id)
        return resp

    async def _request(self, method: str, path: str, *, create: bool = False, **kwargs: Any) -> dict[str, Any]:
        """带重试的请求；返回 body.data 外层整包。失败抛 KieError。"""
        if not self._api_key:
            raise KieError(401, kie_error_message(401))
        retry_set = CREATE_RETRY_STATUS if create else RETRY_STATUS
        timeout = CREATE_TIMEOUT if create else QUERY_TIMEOUT
        last: KieError | None = None
        async with self._client(timeout) as client:
            for attempt in range(self._max_retries + 1):
                resp: httpx.Response | None = None
                try:
                    resp = await self._send(client, method, path, **kwargs)
                except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
                    # 连接没建立 → 请求必然未受理，建单也可安全重试
                    last = KieError(None, _("无法连接 Kie.ai，请检查网络后重试"), retryable=True, raw=type(exc).__name__)
                except httpx.TimeoutException as exc:
                    last = KieError(408, kie_error_message(408), retryable=not create, raw=type(exc).__name__)
                    if create:
                        # 已发出建单请求但读超时：可能已受理，不能重发（会重复扣 credit）
                        raise last from exc
                except httpx.TransportError as exc:
                    last = KieError(None, _("无法连接 Kie.ai，请检查网络后重试"), retryable=not create, raw=type(exc).__name__)
                    if create:
                        raise last from exc
                else:
                    payload = _safe_json(resp)
                    code = resp.status_code if resp.status_code >= 400 else _body_code(payload)
                    if code == 200 and isinstance(payload, dict):
                        return payload
                    msg = str(payload.get("msg") or "") if isinstance(payload, dict) else (resp.text or "")[:300]
                    last = KieError(code, kie_error_message(code, msg), retryable=code in retry_set, raw=msg[:500])
                    if code not in retry_set:
                        logger.warning("kie %s %s 失败 code=%s", method, path, code)
                        raise last
                if attempt < self._max_retries and last is not None and last.retryable:
                    delay = _retry_delay(resp, attempt, self._backoff)
                    logger.warning("kie %s %s 可重试 code=%s，%.1fs 后第 %s 次重试", method, path, last.code, delay, attempt + 1)
                    await self._sleep(delay)
                    continue
                break
        assert last is not None
        raise last

    async def create_task(
        self, model: str, input_payload: dict[str, Any], *, callback_url: str = "", video: bool = False
    ) -> str:
        """POST createTask，返回 kie taskId（不带渠道前缀）。

        video=True 时让任务留痕把 ``{channel}::{taskId}`` 回填到 TaskRun.provider_task_id（poller 据此轮询）。
        """
        body: dict[str, Any] = {"model": model, "input": input_payload}
        if callback_url:
            body["callBackUrl"] = callback_url
        prefix = f"{self.channel_id}::" if video and self.channel_id else ""
        payload = await self._request(
            "POST", CREATE_PATH, create=True, json=body, video_submit=video, provider_task_prefix=prefix
        )
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        task_id = str(data.get("taskId") or "").strip()
        if not task_id:
            raise KieError(500, _("Kie.ai 未返回任务号，请稍后重试"))
        logger.info("kie 建单成功 model=%s task=%s", model, task_id)
        return task_id

    async def get_task(self, task_id: str) -> KieTaskRecord:
        """GET recordInfo，解析状态与结果。"""
        payload = await self._request("GET", RECORD_PATH, params={"taskId": task_id})
        return parse_record(payload, task_id)

    async def get_credit(self) -> float:
        """GET 账户剩余 credit。"""
        payload = await self._request("GET", CREDIT_PATH)
        data = payload.get("data")
        if isinstance(data, dict):
            data = data.get("credit", data.get("credits", data.get("balance")))
        value = _as_float(data)
        if value is None:
            raise KieError(500, _("Kie.ai 返回的余额格式无法识别"))
        return value


def _safe_json(resp: httpx.Response) -> Any:
    """解析 JSON；失败返回 None。"""
    try:
        return resp.json()
    except ValueError:
        return None


def client_for_route(route: Any, **kwargs: Any) -> KieClient:
    """由 ResolvedModelRoute / 渠道构造客户端。"""
    return KieClient(
        getattr(route, "api_key", "") or "",
        getattr(route, "base_url", "") or KIE_BASE_URL,
        channel_id=getattr(route, "channel_id", "") or getattr(route, "id", "") or "",
        **kwargs,
    )
