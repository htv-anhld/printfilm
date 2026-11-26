import logging

from .prices import active_book, resolve_strategy
from .runtime import pin_route

logger = logging.getLogger(__name__)


async def priced_catalog(db, catalog: dict) -> dict:
    """给前台目录补价格/策略参数；停用或没有可路由渠道的模型不出现在结果里。"""
    from app.config import get_settings
    from app.services.model_availability import is_model_enabled
    from app.services.model_settings import get_routing_snapshot
    models = get_routing_snapshot().logical_models
    catalog["generation_defaults"] = {"image_resolution": "2K", "video_resolution": get_settings().ark_video_resolution}
    book = await active_book(db)
    catalog["price_version"] = book["version"] if book else None
    catalog["billing_mode"] = "fixed_media" if book else "legacy"
    for key in ("image_models", "video_models"):
        rows = []
        for row in catalog[key]:
            if not is_model_enabled("image" if key == "image_models" else "video", row["id"], models):
                continue
            try:
                strategy = resolve_strategy(row["id"])
            except ValueError:
                continue
            row.update(strategy.describe())
            prices = (book["prices"].get(strategy.model_id) or {}) if book else {}
            row["prices"] = prices
            row["price_version"] = catalog["price_version"]
            row["available_resolutions"] = [x for x in strategy.resolutions if x in prices] if book else list(strategy.resolutions)
            try:
                route = pin_route(strategy.capability, row["id"])
            except ValueError as exc:
                # 没有可路由渠道（如渠道 models 未勾选 seedance-2.0-fast）：直接隐藏，前台不可选
                logger.debug("媒体目录隐藏不可路由模型 %s：%s", row["id"], exc)
                continue
            row["available"] = bool(row["available_resolutions"])
            row["pricing_hint"] = "按张计费" if strategy.capability == "image" else "按提交时长计费"
            if _is_kie(route):
                row["provider"] = "kie"
                if not book:
                    # 无固定价目表时给出 kie 秒价 / 张价参考（含加价倍率）
                    from app.services.kie_models import kie_price_hint
                    row["pricing_hint"] = kie_price_hint(route.get("upstream_model")) or row["pricing_hint"]
            rows.append(row)
        catalog[key] = rows
    _repair_catalog_defaults(catalog)
    return catalog


def _is_kie(route: dict | None) -> bool:
    """固定路由快照是否指向 kie.ai。"""
    from types import SimpleNamespace
    from app.services.kie_models import is_kie_route
    return bool(route) and is_kie_route(SimpleNamespace(protocol=route.get("protocol"), base_url=route.get("base_url")))


def _repair_catalog_defaults(catalog: dict) -> None:
    """隐藏不可路由模型后，保证 defaults 指向目录里仍存在且可用的模型，并同步 recommended 标记。"""
    defaults = catalog.get("defaults")
    if not isinstance(defaults, dict):
        return
    for list_key, default_key in (("image_models", "image_model"), ("video_models", "video_model")):
        rows = catalog.get(list_key) or []
        current = str(defaults.get(default_key) or "").strip()
        ids = [str(row.get("id") or "") for row in rows]
        if not current or current in ids:
            continue
        usable = [row for row in rows if row.get("available") is not False] or rows
        replacement = str(usable[0].get("id") or "") if usable else ""
        logger.warning("默认%s模型 %s 不可路由，目录默认改为 %s", default_key, current, replacement or "（空）")
        defaults[default_key] = replacement
        for row in rows:
            row["recommended"] = bool(replacement) and row.get("id") == replacement
