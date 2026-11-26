"""Kie.ai 模型目录、能力规则与价目表（唯一真相源）。

- 模型 id 以 kie.ai 文档为准（``bytedance/seedance-2`` 等），渠道 models 里原样保存，不做 TokenFree 别名折叠
- 价目单位是 kie credit（1 credit ≈ $0.005）；换成钱包最小单位统一走
  ``billing.pricing.kie_credits_to_cost_fen``（按后台 ``billing_kie_fen_per_credit`` 配置）
- 逻辑模型友好 id：同步渠道模型时把 kie 上游并到 ``seedance-2.0`` / ``seedance-2.0-fast`` 等逻辑模型，
  与 TokenFree 同款模型自动组成 failover（渠道顺序即优先级）
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlsplit

logger = logging.getLogger(__name__)

KIE_BASE_URL = "https://api.kie.ai"
KIE_HOST_SUFFIX = "kie.ai"
KIE_CONSOLE_URL = "https://kie.ai/api-key"
# 1 credit 的美元价（kie.ai/pricing）；钱包换算以后台 billing_kie_fen_per_credit 为准
KIE_USD_PER_CREDIT = 0.005

SEEDANCE_2 = "bytedance/seedance-2"
SEEDANCE_2_FAST = "bytedance/seedance-2-fast"
SEEDANCE_2_MINI = "bytedance/seedance-2-mini"
SEEDREAM_45_T2I = "seedream/4.5-text-to-image"
SEEDREAM_45_EDIT = "seedream/4.5-edit"
SEEDREAM_55_T2I = "seedream/5-5-text-to-image"
SEEDREAM_55_I2I = "seedream/5-5-image-to-image"

# 视频：credit/秒（不含参考视频的档位）
KIE_VIDEO_CREDITS_PER_SEC: dict[str, dict[str, float]] = {
    SEEDANCE_2: {"480p": 19.0, "720p": 41.0, "1080p": 102.0},
    SEEDANCE_2_FAST: {"480p": 11.7, "720p": 24.8},
    SEEDANCE_2_MINI: {"480p": 3.8, "720p": 8.2},
}
# 生图：credit/张，按清晰度档
KIE_IMAGE_CREDITS: dict[str, dict[str, float]] = {
    SEEDREAM_45_T2I: {"2K": 6.5, "4K": 6.5},
    SEEDREAM_45_EDIT: {"2K": 6.5, "4K": 6.5},
    SEEDREAM_55_T2I: {"1K": 3.6, "1.5K": 3.6, "2K": 6.3},
    SEEDREAM_55_I2I: {"1K": 3.6, "1.5K": 3.6, "2K": 6.3},
}
# 文生图 id → 有参考图时改用的图生图 id
KIE_IMAGE_EDIT_VARIANT: dict[str, str] = {
    SEEDREAM_45_T2I: SEEDREAM_45_EDIT,
    SEEDREAM_55_T2I: SEEDREAM_55_I2I,
}
KIE_IMAGE_MAX_REFS: dict[str, int] = {SEEDREAM_45_EDIT: 14, SEEDREAM_55_I2I: 10}

# kie 上游 id → 站点媒体策略 / 逻辑模型友好 id
KIE_LOGICAL_IDS: dict[str, str] = {
    SEEDANCE_2: "seedance-2.0",
    SEEDANCE_2_FAST: "seedance-2.0-fast",
    SEEDANCE_2_MINI: "seedance-2.0-mini",
    SEEDREAM_45_T2I: "seedream-4.5",
    SEEDREAM_45_EDIT: "seedream-4.5",
    SEEDREAM_55_T2I: "seedream-5.5",
    SEEDREAM_55_I2I: "seedream-5.5",
}

# 管理端「拉取模型」时返回的静态目录（kie 没有 /models 接口）
KIE_CATALOG: tuple[dict[str, str], ...] = (
    {"id": SEEDANCE_2, "label": "Seedance 2.0 (Kie)", "capability": "video"},
    {"id": SEEDANCE_2_FAST, "label": "Seedance 2.0 Fast (Kie)", "capability": "video"},
    {"id": SEEDANCE_2_MINI, "label": "Seedance 2.0 Mini (Kie)", "capability": "video"},
    {"id": SEEDREAM_45_T2I, "label": "Seedream 4.5 (Kie)", "capability": "image"},
    {"id": SEEDREAM_55_T2I, "label": "Seedream 5.5 (Kie)", "capability": "image"},
)

VIDEO_DURATION_MIN = 4
VIDEO_DURATION_MAX = 15
VIDEO_ASPECT_RATIOS = ("1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "adaptive")
IMAGE_ASPECT_RATIOS = ("1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9")


def _norm(model: str | None) -> str:
    """模型 id 小写去空白。"""
    return "".join((model or "").split()).lower()


def is_kie_model_id(model: str | None) -> bool:
    """是否 kie 命名空间模型 id（bytedance/… · seedream/…）。"""
    mid = _norm(model)
    return mid in KIE_LOGICAL_IDS or mid.startswith(("bytedance/seedance", "seedream/"))


def is_kie_base_url(base_url: str | None) -> bool:
    """Base URL 主机是否 kie.ai。"""
    host = (urlsplit((base_url or "").strip()).hostname or "").lower()
    return host == KIE_HOST_SUFFIX or host.endswith("." + KIE_HOST_SUFFIX)


def is_kie_route(route: Any) -> bool:
    """路由 / 渠道对象是否指向 kie（protocol=kie 或 Base URL 主机为 kie.ai）。"""
    if route is None:
        return False
    protocol = str(getattr(route, "protocol", "") or "").lower()
    return protocol == "kie" or is_kie_base_url(getattr(route, "base_url", ""))


def kie_logical_id(model: str | None) -> str:
    """kie 上游 id 对应的站点逻辑模型 / 策略 id；非 kie 返回空串。"""
    return KIE_LOGICAL_IDS.get(_norm(model), "")


def kie_video_allowed_resolutions(model: str | None) -> tuple[str, ...]:
    """该视频模型可用清晰度（不开放 4k）。"""
    table = KIE_VIDEO_CREDITS_PER_SEC.get(_norm(model)) or KIE_VIDEO_CREDITS_PER_SEC[SEEDANCE_2_FAST]
    return tuple(table)


def clamp_kie_video_resolution(model: str | None, resolution: str | None) -> str:
    """清晰度钳到模型允许档；越界时降到最高可用档并记日志。"""
    allowed = kie_video_allowed_resolutions(model)
    raw = (resolution or "").strip().lower()
    if raw in allowed:
        return raw
    chosen = allowed[-1] if raw not in {"", "360p", "480p"} else allowed[0]
    logger.info("kie 视频清晰度 %s 不被 %s 支持，钳到 %s", raw or "(空)", model, chosen)
    return chosen


def clamp_kie_video_duration(seconds: Any) -> int:
    """时长钳到 4–15 秒整数。"""
    try:
        value = int(round(float(seconds)))
    except (TypeError, ValueError):
        value = 5
    clamped = max(VIDEO_DURATION_MIN, min(VIDEO_DURATION_MAX, value))
    if clamped != value:
        logger.info("kie 视频时长 %s 秒越界，钳到 %s 秒", value, clamped)
    return clamped


def normalize_kie_video_ratio(ratio: str | None) -> str:
    """画幅：kie 必填，未知值落到 adaptive。"""
    raw = (ratio or "").strip()
    return raw if raw in VIDEO_ASPECT_RATIOS else "adaptive"


def kie_video_credits(model: str | None, resolution: str | None, seconds: float) -> float:
    """视频预估 credit = 秒价 × 时长。"""
    mid = _norm(model)
    table = KIE_VIDEO_CREDITS_PER_SEC.get(mid) or KIE_VIDEO_CREDITS_PER_SEC[SEEDANCE_2]
    res = clamp_kie_video_resolution(mid, resolution) if mid in KIE_VIDEO_CREDITS_PER_SEC else "720p"
    return float(table.get(res, max(table.values()))) * clamp_kie_video_duration(seconds)


def kie_image_tier(model: str | None, resolution: str | None) -> str:
    """生图清晰度档：4.5 → 2K / 4K；5.5 → 1K / 1.5K / 2K。"""
    mid = _norm(model)
    raw = (resolution or "").strip().upper()
    if mid in {SEEDREAM_45_T2I, SEEDREAM_45_EDIT}:
        return "4K" if raw in {"3K", "4K"} else "2K"
    if raw in {"1K", "1.5K"}:
        return raw
    return "2K"


def kie_image_credits(model: str | None, resolution: str | None) -> float:
    """生图预估 credit / 张。"""
    mid = _norm(model)
    table = KIE_IMAGE_CREDITS.get(mid) or KIE_IMAGE_CREDITS[SEEDREAM_45_T2I]
    return float(table.get(kie_image_tier(mid, resolution), max(table.values())))


def kie_video_cost_fen(model: str | None, resolution: str | None, seconds: float, settings=None) -> int:
    """视频上游成本（钱包最小单位，未加价）。"""
    from app.services.billing.pricing import kie_credits_to_cost_fen

    return kie_credits_to_cost_fen(kie_video_credits(model, resolution, seconds), settings) or 1


def kie_image_cost_fen(model: str | None, resolution: str | None, settings=None) -> int:
    """生图上游成本（钱包最小单位，未加价）。"""
    from app.services.billing.pricing import kie_credits_to_cost_fen

    return kie_credits_to_cost_fen(kie_image_credits(model, resolution), settings) or 1


def resolve_kie_upstream(capability: str, model: str | None) -> str:
    """预估用：model 是 kie id 直接返回；否则按当前路由首选渠道判断是否 kie，返回其上游 id。"""
    raw = (model or "").strip()
    if is_kie_model_id(raw):
        return _norm(raw)
    if not raw:
        return ""
    try:
        from app.services.logical_model_router import resolve_logical_model, resolve_logical_model_id

        route = resolve_logical_model(capability, resolve_logical_model_id(capability, raw))  # type: ignore[arg-type]
    except Exception:  # noqa: BLE001 — 预估不能因路由异常失败
        return ""
    if route is not None and is_kie_route(route):
        return _norm(route.upstream_model)
    return ""


def kie_credits_to_retail_major(credits: float, settings=None) -> float:
    """credit → 用户价（计费币种主单位，含加价倍率，不取整）。"""
    from app.services.billing.currency import billing_markup, cny_fen_to_minor
    from app.services.billing.pricing import kie_fen_per_credit

    minor = cny_fen_to_minor(float(credits) * kie_fen_per_credit(settings), settings)
    return minor * billing_markup(settings) / 100.0


def kie_price_hint(model: str | None, settings=None) -> str:
    """模型卡片价格提示（用户价，含加价）；文案模板经 i18n 翻译。"""
    from app.i18n import _
    from app.services.billing.currency import currency_symbol

    mid = _norm(model)
    symbol = currency_symbol(settings)
    video = KIE_VIDEO_CREDITS_PER_SEC.get(mid)
    if video:
        parts = [f"{res} {symbol}{kie_credits_to_retail_major(credits, settings):.3f}" for res, credits in video.items()]
        return _("约 {prices} / 秒", prices=" · ".join(parts))
    image = KIE_IMAGE_CREDITS.get(mid)
    if image:
        low = kie_credits_to_retail_major(min(image.values()), settings)
        return _("约 {price} / 张起", price=f"{symbol}{low:.3f}")
    return ""


def kie_catalog_rows(capability: str = "all") -> list[dict[str, str]]:
    """管理端模型目录（静态）。"""
    rows = [dict(row) for row in KIE_CATALOG]
    if capability in {"image", "video"}:
        rows = [row for row in rows if row["capability"] == capability]
    elif capability not in {"", "all"}:
        rows = []
    return rows
