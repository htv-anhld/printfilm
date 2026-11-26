"""管理端 kie.ai 账户：查 credit 余额（类似 TokenFree 额度面板）。"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import _
from app.services.kie_client import KieClient, KieError
from app.services.kie_models import KIE_BASE_URL, KIE_CONSOLE_URL, KIE_USD_PER_CREDIT, is_kie_route


async def kie_credit_summary(
    db: AsyncSession | None,
    *,
    channel_id: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
    client_kwargs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """查询 kie 渠道剩余 credit；未指定渠道时取第一个已启用且有 Key 的 kie 渠道。

    api_key 只用于本次查询（新建未保存的渠道），不落库、不回传。失败抛 ValueError（已翻译）。
    """
    from app.services.model_settings import _load_channels

    channels = await _load_channels(db, runtime=True) if db is not None else []
    kie_channels = [ch for ch in channels if is_kie_route(ch)]
    channel = next((ch for ch in kie_channels if ch.id == (channel_id or "").strip()), None)
    if channel is None and not channel_id:
        channel = next((ch for ch in kie_channels if ch.enabled and (ch.api_key or "").strip()), None)
    key = (api_key or "").strip() or (channel.api_key if channel else "") or ""
    if not key.strip():
        raise ValueError(_("未配置 Kie.ai API Key（请先在「模型」里添加 Kie.ai 渠道并填写 Key）"))
    base = (base_url or "").strip() or (channel.base_url if channel else "") or KIE_BASE_URL
    client = KieClient(key, base, channel_id=channel.id if channel else (channel_id or ""), **(client_kwargs or {}))
    try:
        credits = await client.get_credit()
    except KieError as exc:
        raise ValueError(str(exc)) from exc
    return {
        "channel_id": channel.id if channel else (channel_id or ""),
        "credits": credits,
        "usd_estimate": round(credits * KIE_USD_PER_CREDIT, 4),
        "usd_per_credit": KIE_USD_PER_CREDIT,
        "console_url": KIE_CONSOLE_URL,
    }
