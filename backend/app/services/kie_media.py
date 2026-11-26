"""kie.ai 媒体生成适配层：把站点 Seedance / Seedream 请求映射成 kie createTask，并把 recordInfo 收成 TaskResult。

调用方是 ``ark.ArkGateway``：路由解析到 kie 渠道时改走这里，其余流程（TaskRun、poller、
下载落盘 + OSS、结算）保持不变。任务 ID 一律写成 ``{channel_id}::{taskId}``，轮询时据此找回 kie 渠道。
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from app.i18n import _
from app.services.kie_client import KieError, KieTaskRecord, client_for_route, kie_error_message
from app.services.kie_models import (
    KIE_IMAGE_EDIT_VARIANT,
    KIE_IMAGE_MAX_REFS,
    IMAGE_ASPECT_RATIOS,
    SEEDREAM_45_EDIT,
    SEEDREAM_45_T2I,
    clamp_kie_video_duration,
    clamp_kie_video_resolution,
    kie_image_tier,
    normalize_kie_video_ratio,
)
from app.services.upstream_channels import CHANNEL_TASK_SEP, split_channel_task_id

logger = logging.getLogger(__name__)

MAX_REF_IMAGES = 9
MAX_REF_VIDEOS = 3
MAX_REF_AUDIOS = 3
PROMPT_MIN = 3
PROMPT_MAX = 20000
# 生图同步等待：kie 生图通常十几秒到一两分钟
IMAGE_POLL_TIMEOUT_SEC = 600.0
IMAGE_POLL_INTERVAL_SEC = 3.0


class KieInputError(ValueError):
    """提交前发现的参数问题（如素材不是公网链接）。"""


def tag_kie_task_id(channel_id: str, raw_task_id: str) -> str:
    """kie 任务 ID 总是带渠道前缀（即使 kie 是主渠道），轮询才能认出 kie。"""
    raw = (raw_task_id or "").strip()
    cid = (channel_id or "").strip()
    if not cid or CHANNEL_TASK_SEP in raw:
        return raw
    return f"{cid}{CHANNEL_TASK_SEP}{raw}"


def _public_url(url: str, field: str) -> str:
    """kie 只拉公网 http(s) 或 asset:// 素材；本地 /static、data URI 直接报错。"""
    value = (url or "").strip()
    if value.startswith(("https://", "http://", "asset://")):
        return value
    raise KieInputError(
        _("{field}: Kie.ai 需要公网可访问的 HTTPS 素材链接，请启用 OSS 或配置公网访问地址后重试", field=field)
    )


def _content_url(item: dict[str, Any], kind: str) -> str:
    """content 项里的 URL。"""
    block = item.get(kind)
    if isinstance(block, dict):
        return str(block.get("url") or "").strip()
    return str(block or "").strip()


def _prompt_text(body: dict[str, Any]) -> str:
    """合并 content 里的文本项（或 body.prompt），保证 3–20000 字符。"""
    parts = [
        str(item.get("text") or "").strip()
        for item in body.get("content") or []
        if isinstance(item, dict) and item.get("type") == "text"
    ]
    if not any(parts) and isinstance(body.get("prompt"), str):
        parts = [body["prompt"].strip()]
    text = "\n".join(part for part in parts if part).strip()
    if len(text) < PROMPT_MIN:
        text = (text + " " + "smooth natural motion, stable subject").strip()
    return text[:PROMPT_MAX]


def build_kie_video_input(body: dict[str, Any], *, upstream_model: str) -> dict[str, Any]:
    """站点 Seedance 方舟格式 body（content 数组）→ kie Seedance 2.0 ``input``。

    规则：首尾帧与任何 reference_* 互斥；两者同时出现时保留参考素材（站点全能参考模式），丢弃首尾帧并记日志。
    """
    if any(isinstance(item, dict) and item.get("type") == "draft_task" for item in body.get("content") or []):
        raise KieInputError(_("Kie.ai 不支持样片转正片，请直接重新生成"))
    frames: dict[str, str] = {}
    ref_images: list[str] = []
    ref_videos: list[str] = []
    ref_audios: list[str] = []
    for item in body.get("content") or []:
        if not isinstance(item, dict):
            continue
        kind = item.get("type")
        role = str(item.get("role") or "")
        if kind == "image_url":
            url = _public_url(_content_url(item, "image_url"), "reference_images")
            if role in {"first_frame", "last_frame"}:
                if role in frames:
                    logger.warning("kie 视频：重复的 %s，只保留第一张", role)
                    continue
                frames[role] = url
            else:
                ref_images.append(url)
        elif kind == "video_url":
            ref_videos.append(_public_url(_content_url(item, "video_url"), "reference_videos"))
        elif kind == "audio_url":
            ref_audios.append(_public_url(_content_url(item, "audio_url"), "reference_audios"))

    has_refs = bool(ref_images or ref_videos or ref_audios)
    if frames and has_refs:
        logger.warning(
            "kie 视频：首尾帧不能与参考素材同时使用，按参考模式提交并丢弃 %s", ",".join(sorted(frames))
        )
        frames = {}
    if "last_frame" in frames and "first_frame" not in frames:
        logger.warning("kie 视频：只有尾帧没有首帧，尾帧按首帧提交")
        frames = {"first_frame": frames["last_frame"]}

    payload: dict[str, Any] = {
        "prompt": _prompt_text(body),
        "aspect_ratio": normalize_kie_video_ratio(body.get("ratio") or body.get("aspect_ratio")),
        "resolution": clamp_kie_video_resolution(upstream_model, body.get("resolution")),
        "duration": clamp_kie_video_duration(body.get("duration", 5)),
        "generate_audio": bool(body.get("generate_audio", False)),
    }
    if frames.get("first_frame"):
        payload["first_frame_url"] = frames["first_frame"]
    if frames.get("last_frame"):
        payload["last_frame_url"] = frames["last_frame"]
    for key, values, limit in (
        ("reference_image_urls", ref_images, MAX_REF_IMAGES),
        ("reference_video_urls", ref_videos, MAX_REF_VIDEOS),
        ("reference_audio_urls", ref_audios, MAX_REF_AUDIOS),
    ):
        if not values:
            continue
        if len(values) > limit:
            logger.warning("kie 视频：%s 超过 %s 个，截断", key, limit)
        payload[key] = values[:limit]
    if body.get("return_last_frame"):
        payload["return_last_frame"] = True
    return payload


async def submit_kie_video(route: Any, body: dict[str, Any]) -> str:
    """建 kie 视频任务，返回带渠道前缀的任务 ID。"""
    model = (route.upstream_model or body.get("model") or "").strip()
    payload = build_kie_video_input(body, upstream_model=model)
    logger.info(
        "kie video create model=%s duration=%s resolution=%s ratio=%s frames=%s refs=%s audio=%s",
        model,
        payload["duration"],
        payload["resolution"],
        payload["aspect_ratio"],
        "first_frame_url" in payload,
        len(payload.get("reference_image_urls") or []),
        payload["generate_audio"],
    )
    try:
        raw_id = await client_for_route(route).create_task(model, payload, video=True)
    except KieError as exc:
        raise RuntimeError(str(exc)) from exc
    return tag_kie_task_id(route.channel_id, raw_id)


def record_usage(record: KieTaskRecord) -> tuple[dict[str, Any], int | None]:
    """把 creditsConsumed 换成 (raw_usage, 上游成本最小单位)；失败任务不计费。"""
    from app.services.billing.pricing import kie_credits_to_cost_fen

    usage: dict[str, Any] = {"provider": "kie", "kie_state": record.state}
    if record.cost_time is not None:
        usage["costTime"] = record.cost_time
    if record.status != "succeeded":
        return usage, None
    cost = kie_credits_to_cost_fen(record.credits_consumed) if record.credits_consumed else None
    if record.credits_consumed is not None:
        usage["creditsConsumed"] = record.credits_consumed
    if cost is not None:
        usage["cost_fen"] = cost
    return usage, cost


def record_to_task_result(record: KieTaskRecord, task_id: str):
    """recordInfo → ark.TaskResult。"""
    from app.services.ark import TaskResult

    usage, cost = record_usage(record)
    if record.status == "succeeded":
        if not record.result_urls:
            return TaskResult(status="failed", error=_("Kie.ai 任务成功但未返回视频地址，请重试"),
                              raw_usage=usage, provider_task_id=task_id)
        return TaskResult(status="succeeded", url=record.result_urls[0], last_frame_url=record.last_frame_url,
                          raw_usage=usage, provider_task_id=task_id, upstream_cost_fen=cost)
    if record.status == "failed":
        return TaskResult(status="failed", error=kie_error_message(record.fail_code or 501, record.fail_msg),
                          raw_usage=usage, provider_task_id=task_id, upstream_cost_fen=None)
    return TaskResult(status="running", raw_usage=usage, provider_task_id=task_id)


async def fetch_kie_task(route: Any, task_id: str):
    """单次查询；网络抖动 / 429 / 5xx 视为仍在运行，由 poller 总超时收敛。"""
    from app.services.ark import TaskResult

    _cid, raw_id = split_channel_task_id(task_id)
    try:
        record = await client_for_route(route, max_retries=1).get_task(raw_id)
    except KieError as exc:
        if exc.retryable or exc.code is None:
            logger.warning("kie fetch transient task=%s code=%s", raw_id, exc.code)
            return TaskResult(status="running", provider_task_id=task_id)
        return TaskResult(status="failed", error=str(exc), provider_task_id=task_id)
    return record_to_task_result(record, task_id)


async def poll_kie_task(route: Any, task_id: str, *, timeout_sec: float, interval_sec: float):
    """阻塞轮询到终态或超时（科普流水线内联等待用）。"""
    from app.services.ark import TaskResult

    deadline = time.monotonic() + max(1.0, float(timeout_sec))
    delay = min(3.0, max(1.0, float(interval_sec)))
    while time.monotonic() < deadline:
        result = await fetch_kie_task(route, task_id)
        if result.status in {"succeeded", "failed"}:
            return result
        await asyncio.sleep(delay)
        delay = min(float(interval_sec) or 8.0, delay * 1.5)
    return TaskResult(status="failed", error="poll timeout", provider_task_id=task_id)


def build_kie_image_request(
    upstream_model: str,
    *,
    prompt: str,
    aspect_ratio: str | None,
    resolution: str | None,
    image_urls: list[str],
) -> tuple[str, dict[str, Any]]:
    """Seedream（kie）请求：有参考图时自动换成 edit / image-to-image 变体。返回 (model, input)。"""
    model = (upstream_model or SEEDREAM_45_T2I).strip().lower()
    refs = [_public_url(url, "reference_images") for url in image_urls if (url or "").strip()]
    if not refs:
        # 绑定的是 edit / image-to-image 变体但没有参考图：退回文生图
        model = next((t2i for t2i, edit in KIE_IMAGE_EDIT_VARIANT.items() if edit == model), model)
    else:
        model = KIE_IMAGE_EDIT_VARIANT.get(model, model)
        limit = KIE_IMAGE_MAX_REFS.get(model, 10)
        if len(refs) > limit:
            logger.warning("kie 生图：参考图 %s 张超过 %s，截断", len(refs), limit)
            refs = refs[:limit]
    ratio = (aspect_ratio or "").strip()
    payload: dict[str, Any] = {
        "prompt": (prompt or "").strip()[:PROMPT_MAX] or "high quality illustration",
        "aspect_ratio": ratio if ratio in IMAGE_ASPECT_RATIOS else "1:1",
    }
    tier = kie_image_tier(model, resolution)
    if model in {SEEDREAM_45_T2I, SEEDREAM_45_EDIT}:
        payload["quality"] = "high" if tier == "4K" else "basic"
    else:
        payload["size"] = tier
        payload["output_format"] = "png"
    if refs:
        payload["image_urls"] = refs
    return model, payload


async def generate_kie_image(
    route: Any,
    *,
    prompt: str,
    aspect_ratio: str | None,
    resolution: str | None,
    image_urls: list[str],
    timeout_sec: float = IMAGE_POLL_TIMEOUT_SEC,
) -> tuple[str, KieTaskRecord]:
    """建生图任务并同步等到结果；返回 (公网图片 URL, record)。失败抛 RuntimeError（已翻译）。"""
    model, payload = build_kie_image_request(
        route.upstream_model, prompt=prompt, aspect_ratio=aspect_ratio,
        resolution=resolution, image_urls=image_urls,
    )
    client = client_for_route(route)
    logger.info("kie image create model=%s refs=%s", model, len(payload.get("image_urls") or []))
    try:
        task_id = await client.create_task(model, payload)
    except KieError as exc:
        raise RuntimeError(str(exc)) from exc
    deadline = time.monotonic() + timeout_sec
    delay = 2.0
    while time.monotonic() < deadline:
        await asyncio.sleep(delay)
        delay = min(IMAGE_POLL_INTERVAL_SEC * 2, delay * 1.3)
        try:
            record = await client.get_task(task_id)
        except KieError as exc:
            if exc.retryable or exc.code is None:
                continue
            raise RuntimeError(str(exc)) from exc
        if record.status == "succeeded":
            if not record.result_urls:
                raise RuntimeError(_("出图未返回图片地址，请稍后重试"))
            return record.result_urls[0], record
        if record.status == "failed":
            raise RuntimeError(kie_error_message(record.fail_code or 501, record.fail_msg))
    raise RuntimeError(kie_error_message(408))
