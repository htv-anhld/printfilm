"""3D 布局（对齐 Dravelio /api/studio3d/scenes、/drama/layout3d/options）：场景 CRUD + 截图存为构图参考图。"""

from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.i18n import _
from app.models import User
from app.models_commerce import Scene3D
from app.services import storage

router = APIRouter(tags=["studio3d"])

MAX_SCENES = 100
MAX_OBJECTS = 60
MAX_DATA_BYTES = 200_000
MAX_SNAPSHOT = 8 * 1024 * 1024

OPTIONS: dict[str, Any] = {
    "objects": ["person", "person_sit", "box", "table", "chair", "wall", "door", "car", "tree", "light"],
    "lenses": [14, 18, 24, 35, 50, 85, 135],
    "ratios": ["16:9", "9:16", "1:1", "4:3", "2.39:1"],
    "rooms": ["empty", "interior", "street"],
    "shots": ["wide", "medium", "close", "over_shoulder", "top_down", "low_angle"],
}


class SceneBody(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("data")
    @classmethod
    def _limit(cls, value: dict[str, Any]) -> dict[str, Any]:
        """限制体积与对象数，防止塞大数据。"""
        if len(json.dumps(value)) > MAX_DATA_BYTES:
            raise ValueError("scene too large")
        objects = value.get("objects")
        if objects is not None and (not isinstance(objects, list) or len(objects) > MAX_OBJECTS):
            raise ValueError("too many objects")
        return value


def _out(scene: Scene3D, *, full: bool = True) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": scene.id,
        "name": scene.name,
        "snapshot_url": scene.snapshot_url,
        "updated_at": scene.updated_at.isoformat() if scene.updated_at else None,
    }
    if full:
        out["data"] = scene.data or {}
    return out


async def _owned(db: AsyncSession, scene_id: int, user: User) -> Scene3D:
    scene = await db.get(Scene3D, scene_id)
    if scene is None or scene.user_id != user.id:
        raise HTTPException(status_code=404, detail=_("场景不存在"))
    return scene


@router.get("/drama/layout3d/options")
async def layout_options() -> dict:
    return OPTIONS


@router.get("/studio3d/scenes")
async def list_scenes(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    rows = (
        await db.execute(select(Scene3D).where(Scene3D.user_id == user.id).order_by(Scene3D.updated_at.desc()).limit(MAX_SCENES))
    ).scalars().all()
    return {"items": [_out(s, full=False) for s in rows]}


@router.post("/studio3d/scenes")
async def create_scene(body: SceneBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    count = int((await db.execute(select(func.count(Scene3D.id)).where(Scene3D.user_id == user.id))).scalar() or 0)
    if count >= MAX_SCENES:
        raise HTTPException(status_code=400, detail=_("场景数量已达上限"))
    scene = Scene3D(user_id=user.id, name=body.name.strip(), data=body.data)
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return _out(scene)


@router.get("/studio3d/scenes/{scene_id}")
async def get_scene(scene_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return _out(await _owned(db, scene_id, user))


@router.patch("/studio3d/scenes/{scene_id}")
async def update_scene(scene_id: int, body: SceneBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    scene = await _owned(db, scene_id, user)
    scene.name = body.name.strip()
    scene.data = body.data
    await db.commit()
    await db.refresh(scene)
    return _out(scene)


@router.delete("/studio3d/scenes/{scene_id}")
async def delete_scene(scene_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    scene = await _owned(db, scene_id, user)
    await db.delete(scene)
    await db.commit()
    return {"ok": True}


@router.post("/studio3d/scenes/{scene_id}/snapshot")
async def snapshot(
    scene_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    """保存机位截图（PNG），返回公网地址，可直接当图生图 / 图生视频的参考图。"""
    scene = await _owned(db, scene_id, user)
    raw = await file.read()
    if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=400, detail=_("截图须为 PNG"))
    if len(raw) > MAX_SNAPSHOT:
        raise HTTPException(status_code=400, detail=_("截图过大"))
    folder = storage.user_dir(user.id) / "studio3d"
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / f"scene{scene.id}_{uuid.uuid4().hex[:10]}.png"
    dest.write_bytes(raw)
    scene.snapshot_url = storage.publish_local(dest)
    await db.commit()
    return {"url": scene.snapshot_url}
