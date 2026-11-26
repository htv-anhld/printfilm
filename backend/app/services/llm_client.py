"""OpenAI 兼容文字模型客户端（任意兼容上游：Kimi / DeepSeek / OpenAI 等）。"""

from __future__ import annotations

from app.i18n import _

import json
import re
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.services.logical_model_router import (
    resolve_logical_model,
    resolve_logical_model_candidates,
    resolve_logical_model_id,
    resolve_upstream_model,
)
from app.services.tasks.upstream import observed_request
from app.services.upstream_channels import (
    is_failover_exception,
    is_failover_status,
    record_channel_failure,
    record_channel_success,
)

logger = logging.getLogger(__name__)

# DEFAULT_MAX_TOKENS 分集正文等结构化输出需要足够 completion 空间
DEFAULT_MAX_TOKENS = 32768


class LlmUnavailableError(RuntimeError):
    """文字 LLM 未配置或不可用。"""


# 解析 LLM API Key（对齐 manju resolveOpenaiApiKey）
def resolve_llm_api_key() -> str:
    key = (get_settings().openai_api_key or "").strip()
    if not key:
        raise LlmUnavailableError(
            _(
                "未配置 OPENAI_API_KEY，无法调用文字模型。"
                "请在管理后台「系统设置 → 模型」填写 TokenFree API Key 并选择文本模型。"
            )
        )
    return key


# 解析 OpenAI 兼容 Base URL
def resolve_llm_base_url() -> str:
    base = (get_settings().openai_base_url or "").strip().rstrip("/")
    if base:
        return base
    return "https://api.openai.com/v1"


# kimi / deepseek-v4 默认 thinking 会占满 token、content 常为空；结构化产出统一关闭
def _llm_extra_body(model: str) -> dict[str, Any]:
    mid = (model or "").strip().lower()
    if mid.startswith("kimi") or mid.startswith("deepseek"):
        return {"thinking": {"type": "disabled"}}
    return {}


# 从 chat/completions 响应提取正文
def _message_content(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    content = message.get("content")
    if content:
        return str(content)
    # 部分兼容网关把结果放在 reasoning_content
    reasoning = message.get("reasoning_content")
    return str(reasoning or "")


class _ChannelFailover(RuntimeError):
    """当前渠道故障（网络 / 5xx / 429），可以换下一个渠道重试。"""


def _build_chat_payload(
    model: str,
    system: str,
    user: str,
    *,
    temperature: float,
    max_tokens: int,
    response_format: dict[str, Any] | None,
) -> dict[str, Any]:
    """组装 chat/completions 请求体（批量与流式共用）。"""
    # kimi 系列仅允许 temperature=0.6，其它值会 400
    effective_temperature = 0.6 if model.lower().startswith("kimi") else temperature
    payload: dict[str, Any] = {
        "model": model,
        "temperature": effective_temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    extra = _llm_extra_body(model)
    if extra:
        payload.update(extra)
    if response_format:
        payload["response_format"] = response_format
    return payload


# 参数兼容规则名：drop_temperature / drop_response_format / max_completion_tokens
_PARAM_RULES = ("max_completion_tokens", "drop_temperature", "drop_response_format")
# 进程级缓存：(base_url, model) → 已确认上游不支持的参数规则，避免每次调用都先吃一次 400
_UNSUPPORTED_PARAMS: dict[tuple[str, str], set[str]] = {}


def _static_param_rules(model: str, payload: dict[str, Any]) -> set[str]:
    """已知模型族的参数限制（无需试错）。

    Claude（OpenAI 兼容层）：新模型弃用 temperature；response_format 只认 json_schema，
    不认 json_object / text。
    """
    mid = (model or "").strip().lower()
    rules: set[str] = set()
    if mid.startswith("claude") or "/claude" in mid:
        if _claude_rejects_temperature(mid):
            rules.add("drop_temperature")
        fmt = payload.get("response_format")
        if isinstance(fmt, dict) and fmt.get("type") != "json_schema":
            rules.add("drop_response_format")
    return rules


_CLAUDE_VERSION_RE = re.compile(r"claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d{1,2}))?(?!\d)")


def _claude_rejects_temperature(model: str) -> bool:
    """Claude 新一代（Fable/Mythos、5.x、Opus 4.7/4.8）不再接受 temperature；4.6 及更早仍可用。"""
    match = _CLAUDE_VERSION_RE.search(model)
    if not match:
        return False
    family, major, minor = match.group(1), int(match.group(2)), int(match.group(3) or 0)
    if family in {"fable", "mythos"} or major >= 5:
        return True
    return family == "opus" and major == 4 and minor >= 7


def _apply_param_rule(payload: dict[str, Any], rule: str) -> bool:
    """按规则就地调整 payload；有改动返回 True。"""
    if rule == "max_completion_tokens" and "max_tokens" in payload:
        payload["max_completion_tokens"] = payload.pop("max_tokens")
        return True
    if rule == "drop_temperature" and "temperature" in payload:
        payload.pop("temperature")
        return True
    if rule == "drop_response_format" and "response_format" in payload:
        payload.pop("response_format")
        return True
    return False


def apply_known_param_rules(payload: dict[str, Any], base: str) -> dict[str, Any]:
    """发送前主动套用已知 / 已学到的参数限制，返回调整后的新 payload。

    参数:
        payload: chat/completions 请求体（不会被修改）
        base: 渠道 Base URL，与 model 一起作为缓存键
    """
    model = str(payload.get("model") or "")
    out = dict(payload)
    rules = _static_param_rules(model, out) | _UNSUPPORTED_PARAMS.get(_param_cache_key(base, model), set())
    for rule in _PARAM_RULES:
        if rule in rules:
            _apply_param_rule(out, rule)
    return out


def _param_cache_key(base: str, model: str) -> tuple[str, str]:
    """参数缓存键：规范化 base 与模型名。"""
    return ((base or "").strip().rstrip("/").lower(), (model or "").strip().lower())


def remember_unsupported_param(base: str, model: str, rule: str) -> None:
    """记录某渠道+模型不支持的参数（进程级，重启清空）。"""
    _UNSUPPORTED_PARAMS.setdefault(_param_cache_key(base, model), set()).add(rule)


def clear_param_cache() -> None:
    """清空参数兼容缓存（测试 / 管理端改渠道后使用）。"""
    _UNSUPPORTED_PARAMS.clear()


def _resolve_chat_attempts(model_id: str | None = None) -> list[tuple[str, str, str, str]]:
    """解析文字模型的候选渠道 (api_key, model, base, channel_id)，按优先级排序（failover 顺序）。"""
    settings = get_settings()
    # 先应用管理端模型开关（停用的模型直接报不可用）
    try:
        resolve_upstream_model("text", model_id)
    except ValueError as exc:
        raise LlmUnavailableError(str(exc)) from exc
    logical_id = resolve_logical_model_id("text", model_id)
    routes = resolve_logical_model_candidates("text", logical_id)
    if not routes:
        single = resolve_logical_model("text", logical_id)
        routes = [single] if single else []
    attempts: list[tuple[str, str, str, str]] = [
        (
            route.api_key,
            (route.upstream_model or "").strip(),
            route.base_url.rstrip("/") or resolve_llm_base_url(),
            getattr(route, "channel_id", "") or "",
        )
        for route in routes
    ]
    if not attempts:
        model = (resolve_upstream_model("text", model_id) if model_id else settings.model_llm or "").strip()
        if model:
            attempts = [(resolve_llm_api_key(), model, resolve_llm_base_url(), "")]
    if not attempts or not attempts[0][1]:
        raise LlmUnavailableError(
            _("未解析到可用文字模型。请在管理后台填写 TokenFree API Key，拉取并选择文本模型。")
        )
    return attempts


def prepare_chat_request(
    system: str,
    user: str,
    *,
    temperature: float = 0.6,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    response_format: dict[str, Any] | None = None,
    model_id: str | None = None,
) -> tuple[str, dict[str, str], dict[str, Any]]:
    """流式调用用：取首选渠道，返回 (url, headers, payload)；与批量调用同一套模型解析。"""
    api_key, model, base, _channel_id = _resolve_chat_attempts(model_id)[0]
    payload = apply_known_param_rules(
        _build_chat_payload(
            model,
            system,
            user,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
        ),
        base,
    )
    return f"{base}/chat/completions", {
        "Authorization": f"Bearer {api_key}", "Content-Type": "application/json",
    }, payload


# 调用 OpenAI 兼容 chat/completions（多渠道按优先级 failover）
async def chat_completions(
    system: str,
    user: str,
    *,
    temperature: float = 0.6,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    timeout: float = 300.0,
    response_format: dict[str, Any] | None = None,
    model_id: str | None = None,
    strict_output: bool = False,
) -> str:
    attempts = _resolve_chat_attempts(model_id)
    last_exc: Exception | None = None
    for index, (api_key, model, base, channel_id) in enumerate(attempts):
        try:
            content = await _chat_once(
                api_key,
                model,
                base,
                system,
                user,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                response_format=response_format,
                strict_output=strict_output,
            )
        except _ChannelFailover as exc:
            record_channel_failure(channel_id)
            last_exc = exc
            if index + 1 < len(attempts):
                logger.warning("文字 LLM 渠道 %s 故障，切换下一渠道：%s", channel_id or base, exc)
                continue
            raise RuntimeError(str(exc)) from exc
        record_channel_success(channel_id)
        return content
    raise RuntimeError(str(last_exc) if last_exc else "LLM failed")


_FENCE_HEAD_RE = re.compile(r"^```[a-zA-Z]*\s*")
_FENCE_TAIL_RE = re.compile(r"\s*```\s*$")
_QUOTA_HINTS = ("insufficient_user_quota", "insufficient_quota", "额度不足", "余额不足", "credit balance is too low")


def strip_json_fence(text: str) -> str:
    """去掉首尾的 ``` / ```json 代码块标记。"""
    raw = (text or "").strip()
    if not raw.startswith("```"):
        return raw
    return _FENCE_TAIL_RE.sub("", _FENCE_HEAD_RE.sub("", raw)).strip()


def is_quota_exhausted(status_code: int, body: str) -> bool:
    """渠道余额 / 额度耗尽：换渠道可能成功，按渠道故障处理（触发 failover）。"""
    if status_code not in {401, 402, 403, 429}:
        return False
    low = (body or "").lower()
    return any(h in low for h in _QUOTA_HINTS)


def adjust_payload_for_param_error(payload: dict[str, Any], error_text: str) -> dict[str, Any] | None:
    """根据上游 400 报错去掉 / 改名不被支持的参数；无法处理返回 None。

    - temperature 被弃用或只允许默认值 → 去掉 temperature
    - 要求 max_completion_tokens → max_tokens 改名
    - response_format 类型不支持 → 去掉（提示词本身要求输出 JSON，调用方会解析）
    """
    rule = classify_param_error(payload, error_text)
    if rule is None:
        return None
    out = dict(payload)
    _apply_param_rule(out, rule)
    return out


def classify_param_error(payload: dict[str, Any], error_text: str) -> str | None:
    """把上游 400 报错映射成参数规则名；无法识别或 payload 无对应参数时返回 None。"""
    text = (error_text or "").lower()
    if "max_completion_tokens" in text and "max_tokens" in payload:
        return "max_completion_tokens"
    if "temperature" in text and "temperature" in payload:
        return "drop_temperature"
    if "response_format" in text and "response_format" in payload:
        return "drop_response_format"
    return None


async def _chat_once(
    api_key: str,
    model: str,
    base: str,
    system: str,
    user: str,
    *,
    temperature: float,
    max_tokens: int,
    timeout: float,
    response_format: dict[str, Any] | None,
    strict_output: bool = False,
) -> str:
    """单渠道单次调用；渠道级故障抛 _ChannelFailover，业务错误抛 RuntimeError。"""
    payload = apply_known_param_rules(
        _build_chat_payload(
            model,
            system,
            user,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
        ),
        base,
    )

    logger.info(
        "调用文字 LLM model=%s base=%s user_len=%s max_tokens=%s",
        model,
        base,
        len(user or ""),
        max_tokens,
    )
    async with httpx.AsyncClient(timeout=timeout) as client:
        # 不同上游对参数的支持不同（Claude 新模型弃用 temperature、不认 json_object；
        # OpenAI 推理模型要 max_completion_tokens）。遇到 400 参数错误就按提示调整重试，最多 3 次。
        for _attempt in range(4):
            try:
                res = await observed_request(
                    client,
                    "POST",
                    f"{base}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            except httpx.HTTPError as exc:
                if is_failover_exception(exc):
                    raise _ChannelFailover(f"LLM network error ({type(exc).__name__}): {exc}") from exc
                raise
            if res.status_code != 400:
                break
            rule = classify_param_error(payload, res.text or "")
            if rule is None:
                break
            logger.warning("文字 LLM model=%s 参数不被支持，调整后重试：%s", model, (res.text or "")[:200])
            # 记住该渠道+模型的限制，后续调用发送前直接套用，不再重复吃 400
            remember_unsupported_param(base, model, rule)
            payload = dict(payload)
            _apply_param_rule(payload, rule)
        if is_failover_status(res.status_code) or is_quota_exhausted(res.status_code, res.text or ""):
            raise _ChannelFailover(f"LLM error {res.status_code}: {res.text[:800]}")
        if res.status_code >= 400:
            raise RuntimeError(f"LLM error {res.status_code}: {res.text[:800]}")
        body = (res.text or "").strip()
        if not body:
            raise RuntimeError(_("LLM 返回空响应体 (HTTP {code})", code=res.status_code))
        lowered = body[:256].lower()
        if lowered.startswith("<!doctype") or lowered.startswith("<html"):
            raise RuntimeError(
                _(
                    "LLM 渠道 Base URL 配置错误（返回了网页 HTML 而非 API JSON）。"
                    "当前 base={base}，请检查管理后台「模型渠道」的 Base URL 是否为 OpenAI 兼容 API 地址"
                    "（如 https://api.deepseek.com 或 https://api.moonshot.cn/v1），而非网站首页。",
                    base=base,
                )
            )
        try:
            data = res.json()
        except json.JSONDecodeError as exc:
            raise RuntimeError(_("LLM 响应不是合法 JSON: {detail}", detail=body[:200])) from exc
    if strict_output:
        choice = (data.get("choices") or [{}])[0]
        if choice.get("finish_reason") in {"length", "content_filter", "tool_calls"}:
            raise RuntimeError(_("模型未完成正文，请调整要求后重试"))
        if not (choice.get("message") or {}).get("content"):
            raise RuntimeError(_("模型没有返回正文，请重试"))
    content = _message_content(data)
    if response_format:
        # Claude 等不支持 json_object 的模型常把 JSON 包在 ```json 代码块里
        content = strip_json_fence(content)
    logger.info("文字 LLM 返回 content_len=%s", len(content))
    return content
