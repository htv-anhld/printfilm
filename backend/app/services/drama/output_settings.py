"""漫剧输出规格：分集 params 优先，回退项目 params。"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

VALID_RATIOS = frozenset({"9:16", "16:9", "1:1"})
VALID_RESOLUTIONS = frozenset({"480p", "720p", "768p", "1080p"})


def _pick_ratio(raw: Any) -> str | None:
    value = str(raw or "").strip()
    return value if value in VALID_RATIOS else None


def _pick_resolution(raw: Any) -> str | None:
    value = str(raw or "").strip()
    return value if value in VALID_RESOLUTIONS else None


# 解析分集画幅与清晰度（分集 → 项目 → 默认）
def resolve_episode_video_output(
    episode_params: dict | None,
    project_params: dict | None,
) -> tuple[str, str]:
    ep = episode_params if isinstance(episode_params, dict) else {}
    proj = project_params if isinstance(project_params, dict) else {}
    ratio = _pick_ratio(ep.get("aspect_ratio")) or _pick_ratio(proj.get("aspect_ratio")) or "9:16"
    resolution = (
        _pick_resolution(ep.get("resolution"))
        or _pick_resolution(proj.get("resolution"))
        or "480p"
    )
    return ratio, resolution


# Seedance / 成片常用像素（偶数边）
_RATIO_RES_PIXELS: dict[tuple[str, str], tuple[int, int]] = {
    ("9:16", "768p"): (768, 1366),
    ("16:9", "768p"): (1366, 768),
    ("1:1", "768p"): (768, 768),
    ("9:16", "480p"): (480, 854),
    ("9:16", "720p"): (720, 1280),
    ("9:16", "1080p"): (1080, 1920),
    ("16:9", "480p"): (854, 480),
    ("16:9", "720p"): (1280, 720),
    ("16:9", "1080p"): (1920, 1080),
    ("1:1", "480p"): (480, 480),
    ("1:1", "720p"): (720, 720),
    ("1:1", "1080p"): (1080, 1080),
}


# 分集目标成片宽高（用于拼接时统一缩放）
def target_pixel_size(aspect_ratio: str, resolution: str) -> tuple[int, int]:
    key = (aspect_ratio if aspect_ratio in VALID_RATIOS else "9:16",
           resolution if resolution in VALID_RESOLUTIONS else "480p")
    return _RATIO_RES_PIXELS.get(key, (480, 854))


# 根据像素尺寸推断最接近的标准画幅标签
def infer_aspect_ratio_from_pixels(width: int, height: int) -> str:
    if width <= 0 or height <= 0:
        return "9:16"
    ratio = width / height
    candidates = (("9:16", 9 / 16), ("16:9", 16 / 9), ("1:1", 1.0))
    best = min(candidates, key=lambda item: abs(ratio - item[1]))
    if abs(ratio - best[1]) <= 0.08:
        return best[0]
    return f"{width}×{height}"


# i2v 兜底静帧：按目标画幅生成（Seedream 5.0 Pro 2K 像素，避免超 4624220 面积上限）
def seedream_still_size_for_video_ratio(aspect_ratio: str | None) -> str:
    from app.services.drama.seedream_options import SEEDREAM_SIZE_2K

    ratio = _pick_ratio(aspect_ratio) or "9:16"
    return SEEDREAM_SIZE_2K.get(ratio, SEEDREAM_SIZE_2K["9:16"])


# 项目级生成设置：校验并清洗 video_model / aspect_ratio / resolution（非法值直接丢弃，模型非法抛 ValueError）
def clean_project_generation_params(
    params: dict | None,
    previous: dict | None = None,
) -> dict | None:
    """previous 为库里旧 params：旧值里已失效的模型原样回传时只剔除（回落后台默认），不拦整次保存。"""
    if not isinstance(params, dict):
        return params
    out = dict(params)
    if "aspect_ratio" in out and not _pick_ratio(out.get("aspect_ratio")):
        out.pop("aspect_ratio", None)
    if "resolution" in out and not _pick_resolution(out.get("resolution")):
        out.pop("resolution", None)
    if "episode_duration_sec" in out:
        from app.services.drama.episode_length import normalize_episode_duration

        sec = normalize_episode_duration(out.get("episode_duration_sec"))
        if sec is None:
            out.pop("episode_duration_sec", None)
        else:
            out["episode_duration_sec"] = sec
    if "draft_mode" in out:
        out["draft_mode"] = bool(out.get("draft_mode"))
    if "video_model" in out:
        model = str(out.get("video_model") or "").strip()
        if not model:
            out.pop("video_model", None)
        else:
            from app.services.media_catalog import is_enabled_video_model

            if not is_enabled_video_model(model):
                stale = str((previous or {}).get("video_model") or "").strip() if isinstance(previous, dict) else ""
                if stale and stale == model:
                    logger.warning("项目视频模型 %s 已无可用渠道，保存时剔除并回落后台默认模型", model)
                    out.pop("video_model", None)
                    return out
                raise ValueError(model)
            out["video_model"] = model
    return out


def routable_video_model(model_id: str | None) -> str | None:
    """模型在目录且有可路由渠道则原样返回，否则 None（调用方回落后台默认模型）。"""
    mid = str(model_id or "").strip()
    if not mid:
        return None
    from app.services.media_catalog import is_enabled_video_model

    return mid if is_enabled_video_model(mid) else None


def without_unroutable_video_model(params: dict | None, *, where: str = "") -> dict | None:
    """接口出参用：剔除已失效的 video_model，让前台显示的就是实际会用的（后台默认）模型。"""
    if not isinstance(params, dict):
        return params
    model = str(params.get("video_model") or "").strip()
    if not model or routable_video_model(model):
        return params
    logger.warning("%s 保存的视频模型 %s 当前不可路由，按后台默认模型展示与生成", where or "params", model)
    out = dict(params)
    out.pop("video_model", None)
    return out
