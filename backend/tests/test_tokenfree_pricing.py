"""TokenFree 官方价目解析、推荐名单与预估。"""

from __future__ import annotations

from app.config import get_settings
from app.services.tokenfree_pricing import (
    OfficialRate,
    RECOMMENDED_MODELS,
    build_official_rate_rows,
    charge_fen_official_image,
    charge_fen_official_llm,
    charge_fen_official_video,
    lookup_rate,
    parse_pricing_payload,
    set_cached_rates,
    video_catalog_id,
)


def _sample_payload() -> dict:
    return {
        "success": True,
        "data": [
            {
                "model_name": "gpt-image-2-5",
                "quota_type": 1,
                "model_price": 0.625,
                "model_ratio": 0,
                "completion_ratio": 0,
            },
            {
                "model_name": "kimi-k2.6",
                "quota_type": 0,
                "model_price": 0,
                "model_ratio": 0.727612,
                "completion_ratio": 4.15385,
            },
            {
                "model_name": "seedance-2-5",
                "quota_type": 0,
                "model_price": 0,
                "model_ratio": 37.5,
                "completion_ratio": 1,
            },
        ],
    }


def test_parse_pricing_payload_per_call_and_token() -> None:
    """按张价与 token 价按 7 汇率折人民币。"""
    settings = get_settings()
    settings.billing_usd_cny = 7.0
    rates = parse_pricing_payload(_sample_payload(), settings)
    image = rates["gpt-image-2-5"]
    assert image.billing == "per_call"
    assert image.cny_per_call == 4.375
    llm = rates["kimi-k2.6"]
    assert llm.billing == "token"
    assert abs(llm.cny_in_per_1m - 10.1866) < 0.01
    video = rates["seedance-2-5"]
    assert video.placeholder is True


def test_recommended_models_cover_text_image_video_audio() -> None:
    """短名单覆盖文字/图/视频/语音，且含默认推荐；不含 TokenFree 不可用的 Seedream。"""
    caps = {row["capability"] for row in RECOMMENDED_MODELS}
    assert caps == {"text", "image", "video", "audio"}
    ids = {row["id"] for row in RECOMMENDED_MODELS}
    assert {"kimi-k2.6", "gpt-image-2-5", "seedance-2-5", "seedance-2-0", "qwen-tts-2025-05-22", "gemini-3.1-flash-tts"} <= ids
    assert "seedream-5-0-pro" not in ids
    assert any(row["recommended"] and row["id"] == "kimi-k2.6" for row in RECOMMENDED_MODELS)


def test_charge_official_image_uses_per_call() -> None:
    """有官方按张价时，生图预估不再走 8 元/百万 token。"""
    settings = get_settings()
    settings.billing_usd_cny = 7.0
    settings.billing_markup = 1.5
    settings.billing_seedream_per_m = 8.0
    settings.billing_est_seedream_tokens = 45_000
    rates = parse_pricing_payload(_sample_payload(), settings)
    set_cached_rates(rates)
    try:
        charge = charge_fen_official_image(settings, model="seedream-5-0-pro")
        # 2K sunburst 10 积分 × 3.5 分 = 35 分（$0.05），× markup 1.5 → 53
        assert charge == 53
    finally:
        set_cached_rates(None)


def test_charge_official_image_falls_back_without_cache() -> None:
    """无价目缓存时按 2K sunburst 积分档保底，不再退回 8 元/百万 token。"""
    settings = get_settings()
    settings.billing_markup = 1.5
    settings.billing_usd_cny = 7.0
    settings.billing_seedream_per_m = 8.0
    settings.billing_est_seedream_tokens = 45_000
    set_cached_rates(None)
    # 2K sunburst 10 积分 × 3.5 分 = 35 分（$0.05），× markup 1.5 → 53
    assert charge_fen_official_image(settings) == 53


def test_charge_official_image_uses_sunburst_size_tiers() -> None:
    """Kie sunburst 1K/2K/4K 分档，不误用 OpenAI $0.625。"""
    from app.services.tokenfree_pricing import (
        kie_sunburst_credits_for_size,
        kie_sunburst_usd_for_size,
        resolve_billing_image_size,
    )

    settings = get_settings()
    settings.billing_markup = 1.0
    settings.billing_usd_cny = 7.0
    settings.billing_kie_fen_per_credit = 3.5
    set_cached_rates(None)
    assert kie_sunburst_usd_for_size("1K") == 0.03
    assert kie_sunburst_usd_for_size("2K") == 0.05
    assert kie_sunburst_usd_for_size("3K") == 0.08
    assert kie_sunburst_credits_for_size("1K") == 6
    assert kie_sunburst_credits_for_size("2K") == 10
    assert kie_sunburst_credits_for_size("4K") == 16
    assert charge_fen_official_image(settings, model="gpt-image-2", size="1K") == 21
    assert charge_fen_official_image(settings, model="gpt-image-2", size="2K") == 35
    # GPT Image 2 的 4K 钳到 2K；2.5 保留 4K
    assert charge_fen_official_image(settings, model="gpt-image-2", size="4K") == 35
    assert kie_sunburst_credits_for_size("4K") == 16
    assert resolve_billing_image_size(settings, model="seedream-5-0-pro", size="3K") == "2K"
    assert resolve_billing_image_size(settings, model="gpt-image-2", size="4K") == "2K"
    assert resolve_billing_image_size(settings, model="gpt-image-2.5", size="4K") == "4K"


def test_charge_official_video_720p() -> None:
    """2.5 对齐 TF：刊例×1.5×像素 tok；1080p 高于 720p。"""
    settings = get_settings()
    settings.billing_markup = 1.0
    settings.billing_usd_cny = 7.3
    set_cached_rates(None)
    fen_480 = charge_fen_official_video(5.0, settings, model="seedance-2-5", resolution="480p")
    fen_720 = charge_fen_official_video(5.0, settings, model="seedance-2-5", resolution="720p")
    fen_1080 = charge_fen_official_video(5.0, settings, model="seedance-2-5", resolution="1080p")
    # 5s：10k/22k/49k tok × (70|77)×1.5 /1e6
    assert fen_480 == 525
    assert fen_720 == 1155
    assert fen_1080 == 2830
    assert fen_1080 > fen_720 > fen_480


def test_charge_official_video_uses_vendor_sec_not_placeholder() -> None:
    """无可用表达式时走本站兜底秒价（≥¥1.5/秒），不用 37.5 占位倍率。"""
    settings = get_settings()
    settings.billing_markup = 1.0
    settings.billing_usd_cny = 7.3
    rates = parse_pricing_payload(_sample_payload(), settings)
    set_cached_rates(rates)
    try:
        charge = charge_fen_official_video(5.0, settings, model="seedance-2-5", resolution="480p")
        # TF 对齐兜底：5s×10k tok×70×1.5 → ¥5.25 → 525 分
        assert charge == 525
    finally:
        set_cached_rates(None)


def test_charge_official_llm_uses_in_out_split() -> None:
    """LLM 预估按官方 in/out 70/30 拆。"""
    settings = get_settings()
    settings.billing_usd_cny = 7.0
    settings.billing_markup = 1.5
    settings.model_llm = "kimi-k2.6"
    rates = parse_pricing_payload(_sample_payload(), settings)
    set_cached_rates(rates)
    try:
        charge = charge_fen_official_llm(10_000, settings)
        assert charge > 1
        assert lookup_rate("kimi-k2.6") is not None
    finally:
        set_cached_rates(None)


def test_build_official_rate_rows_marks_video_vendor() -> None:
    """费率表视频行标 vendor_sec；ID 为 TokenFree 点分规范名，用户价 = 成本 × markup。"""
    settings = get_settings()
    settings.billing_usd_cny = 7.0
    settings.billing_markup = 1.5
    rates = parse_pricing_payload(_sample_payload(), settings)
    rows = build_official_rate_rows(rates, settings)
    by_id = {row["id"]: row for row in rows}
    assert by_id["gpt-image-2.5"]["official_cost_yuan"] == 0.35
    assert by_id["gpt-image-2.5"]["user_charge_yuan"] == 0.53
    assert by_id["seedance-2.5"]["basis"] == "vendor_sec"
    assert "seedance-2-5" not in by_id


def test_parse_pricing_item_skips_bad_row() -> None:
    """脏字段跳过，不让整包价目作废。"""
    from app.services.tokenfree_pricing import parse_pricing_item

    assert parse_pricing_item({"model_name": "x", "quota_type": "nope"}, usd_cny=7.0) is None


def test_video_catalog_id_from_endpoint() -> None:
    """方舟接入点名能收到 TokenFree 点分 Seedance id。"""
    assert video_catalog_id("doubao-seedance-2-5-260628") == "seedance-2.5"
    assert video_catalog_id("seedance-2-0-mini") == "seedance-2.0"  # mini 未开通→2.0
    assert video_catalog_id("doubao-seedance-2-0-260128") == "seedance-2.0"
    assert video_catalog_id("seedance-2") == "seedance-2.0"
    assert video_catalog_id("seedance-2.0-fast") == "seedance-2.0-fast"
    assert video_catalog_id("doubao-seedance-2-0-fast-260128") == "seedance-2.0-fast"


def test_canonicalize_channel_models_merges_seedance_2_aliases() -> None:
    """2.0 别名与 mini 合并到 2.0；fast / 2.5 保留。"""
    from app.services.tokenfree_pricing import canonicalize_channel_models

    assert canonicalize_channel_models(
        [
            "doubao-seedance-2-0-260128",
            "seedance-2",
            "seedance-2-0",
            "seedance-2-0-mini",
            "seedance-2.0-fast",
            "seedance-2-5",
        ]
    ) == ["seedance-2.0", "seedance-2.0-fast", "seedance-2.5"]


def test_canonicalize_keeps_unknown_seedance_id() -> None:
    """未知 Seedance 名不改写成 2.5。"""
    from app.services.tokenfree_pricing import canonicalize_channel_model_id

    assert canonicalize_channel_model_id("seedance-1.5") == "seedance-1.5"
