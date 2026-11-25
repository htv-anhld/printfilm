"""漫剧整部成片：POST 发起后台合成，GET 查询进度（状态存 project.params.film_compose）。"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.i18n import _
from app.models import User
from app.services.drama.access import get_owned_drama_project
from app.services.drama.film_compose import read_film_state, start_film_compose

router = APIRouter()


@router.get("/projects/{project_id}/film")
async def get_film_state(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """整部成片当前状态：idle / running(done/total) / done(url) / failed(error)。"""
    project = await get_owned_drama_project(db, project_id, user)
    state = read_film_state(project)
    return {"status": state.get("status") or "idle", **state}


@router.post("/projects/{project_id}/film")
async def compose_film(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """发起整部成片合成（按集序拼接所有已生成的分镜视频）。"""
    project = await get_owned_drama_project(db, project_id, user)
    # 后台任务开头会自行写入 running 状态
    if not start_film_compose(project.id):
        raise HTTPException(status_code=409, detail=_("整部影片正在合成，请稍候"))
    return {"status": "running", "started_at": datetime.now(UTC).isoformat(), "done": 0}
