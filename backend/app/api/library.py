"""素材库 API（对齐 Dravelio /api/avatars/library、/api/drama/timeline/library）。"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_admin, get_current_user
from app.models import User
from app.services import library as svc

router = APIRouter(tags=["library"])


async def _read(file: UploadFile) -> bytes:
    data = await file.read()
    if len(data) > svc.MAX_AUDIO:
        raise HTTPException(status_code=400, detail="file too large")
    return data


@router.get("/avatars/library")
async def avatars_library(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return await svc.avatar_library(db, user)


@router.get("/drama/timeline/library")
async def timeline_library(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return await svc.timeline_library(db, user)


@router.post("/library/items")
async def upload_item(
    kind: Literal["avatar", "bgm", "sfx"] = Form(...),
    name: str = Form("", max_length=128),
    tags: str = Form("", max_length=200),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """用户上传私有素材。"""
    try:
        item = await svc.add_item(
            db, kind=kind, name=name, data=await _read(file), filename=file.filename or "", owner=user, tags=tags.split(",")
        )
    except svc.LibraryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    return svc.item_out(item)


@router.delete("/library/items/{item_id}")
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    try:
        await svc.delete_item(db, item_id, owner=user)
    except svc.LibraryError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await db.commit()
    return {"ok": True}


# ── 管理端：全站素材 ─────────────────────────────────


@router.get("/admin/library")
async def admin_list(
    kind: Literal["avatar", "bgm", "sfx"] = Query("bgm"),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await svc.list_items(db, kind, None)
    return {"items": items, "meta": {"page": 1, "page_size": len(items), "total": len(items)}, "moods": list(svc.BGM_MOODS)}


@router.post("/admin/library")
async def admin_upload(
    kind: Literal["avatar", "bgm", "sfx"] = Form(...),
    name: str = Form("", max_length=128),
    tags: str = Form("", max_length=200),
    file: UploadFile = File(...),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        item = await svc.add_item(
            db, kind=kind, name=name, data=await _read(file), filename=file.filename or "", owner=None, tags=tags.split(",")
        )
    except svc.LibraryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    return svc.item_out(item)


@router.delete("/admin/library/{item_id}")
async def admin_delete(item_id: int, _admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)) -> dict:
    try:
        await svc.delete_item(db, item_id, owner=None)
    except svc.LibraryError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await db.commit()
    return {"ok": True}
