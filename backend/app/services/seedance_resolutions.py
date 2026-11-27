# -*- coding: utf-8 -*-
"""Seedance / TokenFree 视频模型允许的清晰度（预设表优先，其余启发式）。"""
from __future__ import annotations

from app.services.model_routing_config import normalize_model_name


def project_video_resolution(project, settings=None) -> str:
    from app.config import get_settings
    chosen = str(getattr(project, "video_resolution", "") or "").strip().lower()
    if chosen:
        return chosen
    config = settings or get_settings()
    fallback = str(config.ark_video_resolution or "480p").strip().lower()
    return "720p" if getattr(project, "resolution_mode", "") == "hd" and fallback == "480p" else fallback

# 全量 UI / 白名单（含 MiniMax 的 768p；4k 仅 kie 渠道的 Seedance 2.0 提供）
ALL_VIDEO_RESOLUTIONS: tuple[str, ...] = ("480p", "720p", "768p", "1080p", "4k")
# 清晰度从低到高的排序基准
_RES_ORDER = {res: idx for idx, res in enumerate(ALL_VIDEO_RESOLUTIONS)}
# mini / fast：渠道明确仅两档
SAFE_VIDEO_RESOLUTIONS: tuple[str, ...] = ("480p", "720p")
FULL_VIDEO_RESOLUTIONS: tuple[str, ...] = ("480p", "720p", "1080p")
MINIMAX_H3_VIDEO_RESOLUTIONS: tuple[str, ...] = ("480p", "768p")


def allowed_video_resolutions(model_id: str | None) -> list[str]:
    """按模型 id 返回允许的清晰度列表（从低到高）。

    在模型自身档位之外，并上该逻辑模型绑定的 kie 渠道额外支持的档位
    （如 kie 的 Seedance 2.0 可出 1080p / 4k，TokenFree 同名模型只有 480p / 720p）。
    """
    base = _model_video_resolutions(model_id)
    extra = [res for res in _kie_route_resolutions(model_id) if res not in base]
    if not extra:
        return base
    return sorted([*base, *extra], key=lambda res: _RES_ORDER.get(res, 99))


def _kie_route_resolutions(model_id: str | None) -> list[str]:
    """该逻辑模型的 kie 路由可出的清晰度；未配置路由 / 解析失败返回空。"""
    if not (model_id or "").strip():
        return []
    try:
        from app.services.logical_model_router import resolve_logical_model_candidates

        routes = resolve_logical_model_candidates("video", str(model_id))
    except Exception:  # noqa: BLE001 — 路由快照未加载（单测 / 启动早期）时只用模型自身档位
        return []
    out: list[str] = []
    for route in routes:
        for res in route_video_resolutions(route):
            if res not in out:
                out.append(res)
    return out if any(is_kie_route_like(route) for route in routes) else []


def is_kie_route_like(route) -> bool:
    """路由（对象或 dict）是否指向 kie.ai。"""
    from types import SimpleNamespace

    from app.services.kie_models import is_kie_route

    if isinstance(route, dict):
        route = SimpleNamespace(protocol=route.get("protocol"), base_url=route.get("base_url"))
    return is_kie_route(route)


def _route_upstream(route) -> str:
    """路由的上游模型 id（对象或 dict）。"""
    if isinstance(route, dict):
        return str(route.get("upstream_model") or "")
    return str(getattr(route, "upstream_model", "") or "")


def route_video_resolutions(route) -> list[str]:
    """某条具体路由（渠道 + 上游模型）实际可出的清晰度。"""
    upstream = _route_upstream(route)
    if is_kie_route_like(route):
        from app.services.kie_models import kie_video_allowed_resolutions

        return list(kie_video_allowed_resolutions(upstream))
    return _model_video_resolutions(upstream)


def pick_route_for_resolution(routes: list, resolution: str | None):
    """在 failover 候选里挑第一条支持该清晰度的路由；都不支持返回 None，空候选返回 None。

    480p / 720p 这类所有渠道都支持的档位仍按渠道顺序选第一条，不改变既有优先级。
    """
    res = (resolution or "").strip().lower()
    if not routes:
        return None
    if not res:
        return routes[0]
    return next((route for route in routes if res in route_video_resolutions(route)), None)


def _kie_only_resolutions(model_id: str | None) -> tuple[str, ...]:
    """策略里标记为「仅 kie 渠道可出」的档位。"""
    from app.services.media_models import get_strategy

    try:
        return tuple(getattr(get_strategy(model_id or ""), "kie_only_resolutions", ()) or ())
    except ValueError:
        return ()


def _model_video_resolutions(model_id: str | None) -> list[str]:
    """模型自身（不看渠道）允许的清晰度。

    优先读站点预设表；否则：
    - Seedance 2.5 → 含 1080p
    - MiniMax-H3 → 480p / 768p
    - Seedance 2.0 / mini / fast / 其它 → 480p, 720p
    """
    mid = normalize_model_name(model_id or "")
    if not mid:
        return list(SAFE_VIDEO_RESOLUTIONS)

    from app.services.media_model_presets import model_generation_options

    opts = model_generation_options(model_id)
    raw = opts.get("allowed_resolutions") if isinstance(opts, dict) else None
    if isinstance(raw, list) and raw:
        filtered = [
            str(x).strip().lower()
            for x in raw
            if str(x).strip().lower() in ALL_VIDEO_RESOLUTIONS
        ]
        if filtered:
            return [res for res in filtered if res not in _kie_only_resolutions(model_id)]

    # MiniMax H3：480p / 768p（须先于其它启发式，避免被当成 mini）
    if "minimax" in mid and "h3" in mid.replace("-", "").replace("_", ""):
        return list(MINIMAX_H3_VIDEO_RESOLUTIONS)

    # 仅 Seedance 2.5 含 1080p
    if "seedance" in mid and ("2.5" in mid or "2-5" in mid):
        return list(FULL_VIDEO_RESOLUTIONS)

    return list(SAFE_VIDEO_RESOLUTIONS)


def clamp_video_resolution(model_id: str | None, resolution: str | None) -> str:
    """将分辨率钳到该模型允许列表；非法或缺省取允许列表最高档。"""
    allowed = allowed_video_resolutions(model_id)
    raw = (resolution or "").strip().lower()
    if raw in allowed:
        return raw
    # MiniMax：历史 720p/1080p 就近落到 768p
    mid = normalize_model_name(model_id or "")
    if (
        "minimax" in mid
        and "h3" in mid.replace("-", "").replace("_", "")
        and raw in {"720p", "1080p", "2k"}
        and "768p" in allowed
    ):
        return "768p"
    # 缺省 / 非法：取允许列表中最高档（通常 720p / 768p / 1080p）
    return allowed[-1]


def format_video_resolution_for_upstream(model_id: str | None, resolution: str | None) -> str:
    """提交上游的清晰度字符串。

    内部统一小写；TokenFree 不同 MiniMax 插件存在大小写差异，提交适配层处理明确的枚举拒绝。
    """
    return clamp_video_resolution(model_id, resolution)


def video_duration_bounds(model_id: str | None) -> tuple[int, int]:
    """返回 (min, max) 秒；与站点 seedance_duration_* 取交集，缺省 4–30。"""
    from app.config import get_settings
    from app.services.media_model_presets import model_generation_options

    opts = model_generation_options(model_id)
    lo = int(opts.get("duration_min") or 4) if isinstance(opts, dict) else 4
    hi = int(opts.get("duration_max") or 30) if isinstance(opts, dict) else 30
    s = get_settings()
    site_lo = int(getattr(s, "seedance_duration_min", 4) or 4)
    site_hi = int(getattr(s, "seedance_duration_max", 30) or 30)
    lo = max(lo, site_lo)
    hi = min(hi, site_hi)
    if hi < lo:
        lo, hi = hi, lo
    return max(1, lo), max(lo, hi)


def clamp_video_duration(model_id: str | None, seconds: float | int | None) -> int:
    """将时长钳到模型允许区间。"""
    lo, hi = video_duration_bounds(model_id)
    try:
        n = int(round(float(seconds or lo)))
    except (TypeError, ValueError):
        n = lo
    return min(hi, max(lo, n))
