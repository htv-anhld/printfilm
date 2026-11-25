"""上传剧本建漫剧项目：POST /api/drama/projects/import（multipart）。

原文逐字保留为每集剧本，只做分集；人物与梗概交给剧本摘要任务（前端大纲步骤自动触发）。
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.drama.projects import _clean_generation_params, _project_out
from app.database import get_db
from app.deps import get_current_user
from app.i18n import _, get_locale, normalize_locale
from app.models import User
from app.models_drama import DramaProject, DramaScript
from app.schemas_drama import DramaProjectOut
from app.services.drama.access import get_owned_drama_project
from app.services.drama.content_locale import content_text, default_episode_title, set_content_locale
from app.services.drama.script_import import MAX_FILE_BYTES, extract_script_text, split_script_episodes
from app.services.drama.workflow import build_project_params

logger = logging.getLogger(__name__)

router = APIRouter()


def _parse_params(raw: str) -> dict | None:
    """表单里的 params 为 JSON 字符串（视频模型 / 画幅 / 清晰度 / draft_mode）。"""
    text = (raw or "").strip()
    if not text:
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=_("params 必须是 JSON 对象")) from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail=_("params 必须是 JSON 对象"))
    return data


@router.post("/projects/import", response_model=DramaProjectOut)
async def import_script_project(
    file: UploadFile = File(...),
    title: str = Form(""),
    image_style_id: str = Form(""),
    content_locale: str = Form(""),
    params: str = Form(""),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DramaProjectOut:
    """上传 .txt/.md/.docx/.pdf 剧本：按集标题切分，每集正文保持原文。"""
    raw = await file.read(MAX_FILE_BYTES + 1)
    try:
        text = extract_script_text(file.filename or "", raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    header, episodes = split_script_episodes(text)

    locale = normalize_locale(content_locale or None, normalize_locale(get_locale()))
    set_content_locale(locale)
    extra = _clean_generation_params(_parse_params(params)) or {}
    extra["source_mode"] = "import"
    project_params = build_project_params(
        workflow="script",
        episode_count=len(episodes),
        image_style_id=image_style_id,
        extra=extra,
    )
    stem = (file.filename or "").rsplit(".", 1)[0].strip()
    project_title = (title or "").strip() or stem[:80] or content_text("未命名漫剧", locale)
    project = DramaProject(
        user_id=user.id,
        title=project_title[:200],
        params=project_params,
        content_locale=locale,
    )
    db.add(project)
    await db.flush()
    db.add(
        DramaScript(
            project_id=project.id,
            name=project.title,
            source=text,
            episode_content={
                "episodes": [
                    {
                        "episodeNumber": ep["episodeNumber"],
                        "title": ep["title"] or default_episode_title(ep["episodeNumber"], locale),
                        "body": ep["body"],
                        "origin": "import",
                    }
                    for ep in episodes
                ]
            },
            params={
                "episode_count": len(episodes),
                "image_style_id": image_style_id,
                "summary_status": "pending",
                # 正文已齐：大纲流水线只跑摘要，不再让 AI 重写分集
                "episode_content_status": "completed",
                "workflow": "script",
                "source_mode": "import",
                "import_filename": (file.filename or "")[:200],
                "import_header": header[:4000],
            },
        )
    )
    await db.commit()
    logger.info(
        "已导入剧本 project_id=%s user_id=%s chars=%s episodes=%s",
        project.id,
        user.id,
        len(text),
        len(episodes),
    )
    project = await get_owned_drama_project(
        db, project.id, user, with_script=True, with_assets=True, with_episodes=True
    )
    return _project_out(project)
