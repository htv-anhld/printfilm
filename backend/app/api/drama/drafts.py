"""漫剧 Draft 样片：把 480p 样片转成 1080p 正片（POST /api/drama/fragments/{id}/finalize_draft）。"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.i18n import _
from app.models import User
from app.models_drama import DramaEpisodeFragment
from app.schemas_tasks import TaskCreateRequest, TaskTargetBind
from app.services.billing.http import http_exception_for_value_error
from app.services.drama.access import get_owned_drama_project, get_owned_episode
from app.services.drama.generation import fragment_generation_status, read_fragment_draft
from app.services.tasks.service import create_task

logger = logging.getLogger(__name__)

router = APIRouter()

_BUSY = {"queued", "running", "generating"}


@router.post("/fragments/{fragment_id}/finalize_draft")
async def finalize_fragment_draft(
    fragment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """凭样片任务 id 入队 1080p 正片（同时长、画幅、音频），按一条 1080p 视频计费。"""
    frag = await db.get(DramaEpisodeFragment, fragment_id)
    if frag is None:
        raise HTTPException(status_code=404, detail=_("分镜不存在"))
    ep = await get_owned_episode(db, frag.episode_id, user)
    project = await get_owned_drama_project(db, ep.project_id, user)
    if fragment_generation_status(frag).get("status") in _BUSY:
        raise HTTPException(status_code=409, detail=_("所选分镜正在生成，请等待完成后再试"))
    draft = read_fragment_draft(frag)
    if draft is None:
        raise HTTPException(status_code=400, detail=_("该分镜没有可用的样片（样片仅保留 7 天），请重新生成"))

    model_id = str(draft.get("model") or (project.params or {}).get("video_model") or "").strip() or None
    params = dict(frag.params or {})
    params["generation"] = {
        "status": "queued",
        "queued_at": datetime.now(UTC).isoformat(),
        "message": _("已入队"),
        "finalizing_draft": True,
    }
    frag.params = params
    batch_key = f"drama:episode:{ep.id}:final:{uuid.uuid4().hex[:12]}"
    try:
        task = await create_task(
            db,
            user,
            TaskCreateRequest(
                domain="drama",
                task_type="fragment_video",
                dedupe_key=f"drama:fragment_video:fragment:{frag.id}",
                batch_key=batch_key,
                payload={
                    "project_id": ep.project_id,
                    "episode_id": ep.id,
                    "fragment_ids": [frag.id],
                    "sequential": False,
                    "batch_key": batch_key,
                    "batch_index": 0,
                    "replace_existing_video": True,
                    "duration_sec": int(frag.duration_sec or 8),
                    "model_id": model_id,
                    "resolution": "1080p",
                    "finalize_draft_task_id": str(draft["task_id"]),
                },
                drama_project_id=ep.project_id,
                episode_id=ep.id,
                fragment_id=frag.id,
                targets=[
                    TaskTargetBind(target_type="drama_project", target_id=ep.project_id),
                    TaskTargetBind(target_type="episode", target_id=ep.id),
                    TaskTargetBind(target_type="fragment", target_id=frag.id, sort_order=0),
                ],
            ),
            commit=False,
        )
    except ValueError as exc:
        await db.rollback()
        raise http_exception_for_value_error(exc) from exc
    await db.commit()
    logger.info(
        "已入队样片转正片 fragment_id=%s draft_task=%s task_id=%s",
        frag.id,
        draft["task_id"],
        task.id,
    )
    return {"ok": True, "fragment_id": frag.id, "task_id": task.id, "status": "pending"}
