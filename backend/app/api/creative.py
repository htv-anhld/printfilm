"""创意看板（Dravelio /api/creative/projects 的本地实现：按活动归档工具产出）。"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.i18n import _
from app.models import User
from app.models_commerce import CreativeProject

router = APIRouter(prefix="/creative", tags=["creative"])

MAX_PROJECTS = 100
MAX_ITEMS = 300


class ProjectBody(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=1000)


class ItemBody(BaseModel):
    kind: Literal["image", "video", "text", "link"]
    url: str | None = Field(default=None, max_length=1024)
    text: str | None = Field(default=None, max_length=20_000)
    note: str = Field(default="", max_length=500)
    source: str = Field(default="", max_length=64)

    @model_validator(mode="after")
    def _need_content(self) -> "ItemBody":
        """图 / 视频 / 链接要 url（http(s) 或 /static），文案要 text。"""
        if self.kind == "text":
            if not (self.text or "").strip():
                raise ValueError("text required")
        else:
            url = (self.url or "").strip()
            if not (url.startswith(("http://", "https://")) or url.startswith("/static/")):
                raise ValueError("valid url required")
        return self


class OrderBody(BaseModel):
    item_ids: list[str] = Field(max_length=MAX_ITEMS)


def _out(p: CreativeProject, *, full: bool = True) -> dict[str, Any]:
    items = list(p.items or [])
    cover = next((i.get("url") for i in items if i.get("kind") == "image"), None)
    out: dict[str, Any] = {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "item_count": len(items),
        "cover": cover,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }
    if full:
        out["items"] = items
    return out


async def _owned(db: AsyncSession, project_id: int, user: User) -> CreativeProject:
    p = await db.get(CreativeProject, project_id)
    if p is None or p.user_id != user.id:
        raise HTTPException(status_code=404, detail=_("看板不存在"))
    return p


@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    rows = (
        await db.execute(select(CreativeProject).where(CreativeProject.user_id == user.id).order_by(CreativeProject.updated_at.desc()))
    ).scalars().all()
    return {"items": [_out(p, full=False) for p in rows]}


@router.post("/projects")
async def create_project(body: ProjectBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    n = int((await db.execute(select(func.count(CreativeProject.id)).where(CreativeProject.user_id == user.id))).scalar() or 0)
    if n >= MAX_PROJECTS:
        raise HTTPException(status_code=400, detail=_("看板数量已达上限"))
    p = CreativeProject(user_id=user.id, name=body.name.strip(), description=body.description.strip(), items=[])
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _out(p)


@router.get("/projects/{project_id}")
async def get_project(project_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return _out(await _owned(db, project_id, user))


@router.patch("/projects/{project_id}")
async def update_project(project_id: int, body: ProjectBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    p = await _owned(db, project_id, user)
    p.name, p.description = body.name.strip(), body.description.strip()
    await db.commit()
    await db.refresh(p)
    return _out(p)


@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await db.delete(await _owned(db, project_id, user))
    await db.commit()
    return {"ok": True}


@router.post("/projects/{project_id}/items")
async def add_item(project_id: int, body: ItemBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    p = await _owned(db, project_id, user)
    items = list(p.items or [])
    if len(items) >= MAX_ITEMS:
        raise HTTPException(status_code=400, detail=_("看板内容已达上限"))
    item = {
        "id": secrets.token_hex(6),
        "kind": body.kind,
        "url": (body.url or "").strip() or None,
        "text": (body.text or "").strip() or None,
        "note": body.note.strip(),
        "source": body.source.strip(),
        "added_at": datetime.now(UTC).isoformat(),
    }
    # JSON 列需要整体赋值才会被检测为变更
    p.items = [item, *items]
    await db.commit()
    await db.refresh(p)
    return _out(p)


@router.delete("/projects/{project_id}/items/{item_id}")
async def remove_item(project_id: int, item_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    p = await _owned(db, project_id, user)
    p.items = [i for i in (p.items or []) if i.get("id") != item_id]
    await db.commit()
    await db.refresh(p)
    return _out(p)


@router.put("/projects/{project_id}/order")
async def reorder(project_id: int, body: OrderBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """按给定 id 顺序重排；未列出的保持原相对顺序排在后面。"""
    p = await _owned(db, project_id, user)
    by_id = {i.get("id"): i for i in (p.items or [])}
    ordered = [by_id[i] for i in body.item_ids if i in by_id]
    rest = [i for i in (p.items or []) if i.get("id") not in set(body.item_ids)]
    p.items = ordered + rest
    await db.commit()
    await db.refresh(p)
    return _out(p)
