"""TokenFree New API 渠道常量与扁平配置同步。

开源版把 TokenFree 锁成唯一上游；商业版默认解锁（UPSTREAM_LOCK_TOKENFREE=false），
TokenFree 只是渠道之一，可与任意 OpenAI 兼容 / 方舟渠道并存并 failover。
id=tokenfree 的渠道 Base URL 仍固定为官方地址（该 ID 就代表 TokenFree）。
"""

from __future__ import annotations

from typing import Any

from app.schemas_routing import SystemModelChannel

TOKENFREE_CHANNEL_ID = "tokenfree"
TOKENFREE_CHANNEL_NAME = "TokenFree New API"
# New API OpenAI 兼容根路径（/channels 是控制台，不是接口）
TOKENFREE_BASE_URL = "https://www.tokenfree.com/v1"
TOKENFREE_CONSOLE_URL = "https://www.tokenfree.com/channels"
# New API 内部额度：500000 quota = 1 USD
TOKENFREE_QUOTA_PER_USD = 500_000


def tokenfree_site_origin(base_url: str | None = None) -> str:
    """把 /v1 兼容根路径收成站点 origin，供 /api/* 与 dashboard 计费用。"""
    raw = (base_url or TOKENFREE_BASE_URL).strip().rstrip("/")
    if raw.endswith("/v1"):
        return raw[: -len("/v1")].rstrip("/")
    return raw


def resolve_tokenfree_api_key() -> str:
    """优先渠道 Key，其次运行时 overlay / 环境变量。"""
    try:
        from app.services.model_settings import get_routing_snapshot

        channels = get_routing_snapshot().channels
    except Exception:  # noqa: BLE001
        channels = []
    for channel in channels:
        if channel.id == TOKENFREE_CHANNEL_ID and (channel.api_key or "").strip():
            return (channel.api_key or "").strip()
    from app.config import get_settings

    s = get_settings()
    return (s.openai_api_key or s.ark_api_key or "").strip()


def tokenfree_channel_active() -> bool:
    """TokenFree 渠道是否在用（已启用且有 Key）。

    渠道表已加载时以渠道 enabled 为准：停用后不再调 TokenFree 用量 / 日志接口
    （否则每次结算都白白请求一次并 401）。渠道表尚未加载时退回"有 Key 即可"。
    """
    try:
        from app.services.model_settings import get_routing_snapshot

        channels = get_routing_snapshot().channels
    except Exception:  # noqa: BLE001
        channels = []
    if channels:
        for channel in channels:
            if channel.id == TOKENFREE_CHANNEL_ID:
                return bool(channel.enabled and (channel.api_key or "").strip())
        return False
    return bool(resolve_tokenfree_api_key())


def locked_tokenfree_channel(
    *,
    api_key: str = "",
    has_api_key: bool | None = None,
    models: list[str] | None = None,
    enabled: bool = True,
) -> SystemModelChannel:
    """构造不可改 Base URL / 协议的唯一渠道。"""
    key = (api_key or "").strip()
    return SystemModelChannel(
        id=TOKENFREE_CHANNEL_ID,
        name=TOKENFREE_CHANNEL_NAME,
        base_url=TOKENFREE_BASE_URL,
        api_key=key,
        has_api_key=bool(key) if has_api_key is None else bool(has_api_key),
        api_format="openai",
        protocol="auto",
        models=list(dict.fromkeys(m.strip() for m in (models or []) if m and m.strip())),
        enabled=enabled,
        sort_order=0,
    )


def pick_migratable_api_key(channels: list[SystemModelChannel]) -> str:
    """只迁 TokenFree 渠道或 base_url 含 tokenfree.com 的 Key，避免把 Moonshot/方舟 Key 写进去。"""
    for channel in channels:
        if channel.id == TOKENFREE_CHANNEL_ID and (channel.api_key or "").strip():
            return (channel.api_key or "").strip()
    for channel in channels:
        key = (channel.api_key or "").strip()
        base = (channel.base_url or "").strip().lower()
        if key and "tokenfree.com" in base:
            return key
    return ""


def upstream_locked() -> bool:
    """是否保持开源版的「仅 TokenFree」锁定。"""
    from app.config import Settings

    # 直接读 env 基础配置，避免 get_settings() overlay 递归
    return bool(Settings().upstream_lock_tokenfree)


def apply_tokenfree_flat_overlay(flat: dict[str, Any], channels: list[SystemModelChannel]) -> dict[str, Any]:
    """运行时把主渠道 Key / Base 同步到 LLM 与方舟客户端共用的扁平字段。

    锁定模式：只认 TokenFree 渠道（开源版行为）。
    解锁模式：取 sort_order 最小的已启用且有 Key 的渠道；TokenFree 渠道固定官方 Base。
    无路由命中时的兜底请求（轮询主渠道任务、下载鉴权等）都走这里写入的字段。
    """
    from app.services.upstream_channels import primary_channel

    if upstream_locked():
        channel = next((item for item in channels if item.id == TOKENFREE_CHANNEL_ID), None)
    else:
        channel = primary_channel(channels)
    if channel is None:
        return flat
    out = dict(flat)
    base = TOKENFREE_BASE_URL if channel.id == TOKENFREE_CHANNEL_ID else (channel.base_url or "").strip().rstrip("/")
    if base:
        out["openai_base_url"] = base
        out["ark_base_url"] = base
    key = (channel.api_key or "").strip()
    if key:
        out["openai_api_key"] = key
        out["ark_api_key"] = key
    return out


def primary_channel_id(channels: list[SystemModelChannel] | None = None) -> str:
    """当前主渠道 ID（任务 ID 绑定渠道时，主渠道不加前缀）。"""
    from app.services.upstream_channels import primary_channel

    if channels is None:
        try:
            from app.services.model_settings import get_routing_snapshot

            channels = get_routing_snapshot().channels
        except Exception:  # noqa: BLE001
            channels = []
    if upstream_locked():
        return TOKENFREE_CHANNEL_ID
    ch = primary_channel(channels or [])
    return ch.id if ch else TOKENFREE_CHANNEL_ID
