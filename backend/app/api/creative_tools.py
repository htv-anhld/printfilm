"""额外创作工具 API（对齐 Dravelio：cinema-look、subtitle-translate、script-format、video-script、marketing/presets）。"""

from __future__ import annotations

import math
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.services import creative_tools as ct
from app.services.billing import run_billed_ephemeral
from app.services.billing.http import http_exception_for_value_error
from app.services.billing.usage import record_llm_chat_line

router = APIRouter(tags=["tools"])

Lang = Literal["vi", "en", "zh", "ja", "ko", "th", "id", "es"]


class SubtitleBody(BaseModel):
    content: str = Field(min_length=10, max_length=ct.MAX_SUBTITLE_CHARS)
    target_lang: Lang
    source_lang: Lang | None = None


class ScriptFormatBody(BaseModel):
    content: str = Field(min_length=20, max_length=30_000)
    format: Literal["screenplay", "shotlist", "narration", "episodes"] = "screenplay"
    lang: Lang = "vi"


class VideoScriptBody(BaseModel):
    url: str | None = Field(default=None, max_length=500)
    material: str | None = Field(default=None, max_length=8000)
    lang: Lang = "vi"
    duration: int = Field(default=60, ge=15, le=600)
    style: str = Field(default="", max_length=80)


async def _billed_text(db: AsyncSession, user: User, kind: str, calls: int, fn):
    """文本工具统一计费：按 LLM 调用次数预扣，执行后逐次记用量。"""

    async def _exec():
        try:
            result = await fn()
        except ValueError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=str(exc)[:300]) from exc
        for _i in range(max(1, calls)):
            await record_llm_chat_line(db, user_id=user.id, domain="studio")
        return result

    try:
        task, result = await run_billed_ephemeral(
            db, user, domain="studio", task_type="tool_text", executor=_exec, payload={"tool": kind, "llm_calls": calls}, commit=True
        )
    except ValueError as exc:
        raise http_exception_for_value_error(exc) from exc
    return task, result


@router.get("/tools/cinema-look/presets")
async def cinema_presets() -> dict:
    """调色预设 id（名称由前端 i18n）；使用时 POST /api/tools/run tool_id=cinema mode=<id>。"""
    return {"presets": list(ct.CINEMA_LOOKS)}


@router.post("/tools/subtitle-translate")
async def subtitle_translate(body: SubtitleBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    cues, _header = ct.parse_cues(body.content)
    if not cues:
        raise HTTPException(status_code=400, detail=ct._("未识别到 SRT / VTT 字幕"))
    calls = math.ceil(len(cues) / ct.BATCH)
    task, content = await _billed_text(
        db, user, "subtitle_translate", calls, lambda: ct.translate_subtitles(body.content, body.target_lang, body.source_lang)
    )
    return {"content": content, "cues": len(cues), "task_id": task.id}


@router.post("/tools/script-format")
async def script_format(body: ScriptFormatBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    task, content = await _billed_text(db, user, "script_format", 1, lambda: ct.format_script(body.content, body.format, body.lang))
    return {"content": content, "task_id": task.id}


@router.post("/tools/video-script")
async def video_script(body: VideoScriptBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    if not (body.url or "").strip() and not (body.material or "").strip():
        raise HTTPException(status_code=400, detail=ct._("请填写 YouTube 链接或素材文本"))
    if body.url and not ct.youtube_id(body.url):
        raise HTTPException(status_code=400, detail=ct._("请填写有效的 YouTube 链接"))
    task, result = await _billed_text(
        db,
        user,
        "video_script",
        1,
        lambda: ct.video_script(url=body.url, material=body.material, lang=body.lang, duration=body.duration, style=body.style),
    )
    return {**result, "task_id": task.id}


@router.get("/marketing/presets")
async def marketing_presets() -> dict:
    return {"presets": ct.marketing_presets()}


# ── 画质放大（FFmpeg，非 AI，不计费） ──────────────────


@router.get("/drama/upscale/options")
async def upscale_options() -> dict:
    from app.services.upscale import options

    return options()


@router.post("/drama/upscale")
async def upscale_media(
    kind: Literal["image", "video"] = Form(...),
    scale: int = Form(2),
    target: str = Form("1080p", max_length=8),
    url: str = Form("", max_length=1024),
    file: UploadFile | None = File(default=None),
    user: User = Depends(get_current_user),
) -> dict:
    """上传文件或本站媒体链接 → 放大后的文件地址。"""
    from app.services import upscale as up
    from app.services.studio_tools import save_upload

    upload = None
    if file is not None:
        raw = await file.read()
        if len(raw) > 200 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=ct._("文件过大"))
        if raw:
            upload = save_upload(user.id, raw, file.filename or "upload.bin")
    try:
        src = await up.resolve_source(url or None, upload)
        return await up.upscale(user, src, kind=kind, scale=scale, target=target)
    except up.UpscaleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
