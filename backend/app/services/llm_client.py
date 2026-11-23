"""OpenAI 兼容文字模型客户端（任意兼容上游：Kimi / DeepSeek / OpenAI 等）。"""

from __future__ import annotations

from app.i18n import _

import json
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.services.logical_model_router import (
    resolve_logical_model,
    resolve_logical_model_candidates,
    resolve_logical_model_id,
)
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


# 调用 OpenAI 兼容 chat/completions（多渠道按优先级 failover）
async def chat_completions(
    system: str,
    user: str,
    *,
    temperature: float = 0.6,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    timeout: float = 300.0,
    response_format: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()
    logical_id = resolve_logical_model_id("text", None)
    routes = resolve_logical_model_candidates("text", logical_id)
    if not routes:
        single = resolve_logical_model("text", logical_id)
        routes = [single] if single else []
    attempts: list[tuple[str, str, str, str]] = [
        (
            route.api_key,
            (route.upstream_model or "").strip(),
            route.base_url.rstrip("/") or resolve_llm_base_url(),
            route.channel_id,
        )
        for route in routes
    ]
    if not attempts:
        model = (settings.model_llm or "").strip()
        if model:
            attempts = [(resolve_llm_api_key(), model, resolve_llm_base_url(), "")]
    if not attempts or not attempts[0][1]:
        raise LlmUnavailableError(
            _("未解析到可用文字模型。请在管理后台填写 TokenFree API Key，拉取并选择文本模型。")
        )
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
) -> str:
    """单渠道单次调用；渠道级故障抛 _ChannelFailover，业务错误抛 RuntimeError。"""
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

    logger.info(
        "调用文字 LLM model=%s base=%s user_len=%s max_tokens=%s",
        model,
        base,
        len(user or ""),
        max_tokens,
    )
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            res = await client.post(
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
        if is_failover_status(res.status_code):
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
    content = _message_content(data)
    logger.info("文字 LLM 返回 content_len=%s", len(content))
    return content
