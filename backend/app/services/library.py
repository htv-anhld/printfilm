# -*- coding: utf-8 -*-
"""素材库（对齐 Dravelio /api/avatars/library、/drama/timeline/library）。

- 全站素材（管理员上传）+ 用户私有素材；按 kind 区分 avatar / bgm / sfx
- 管理员上传的 BGM 按情绪标签落到 static/bgm/<mood>/，成片合成（bgm.resolve_bgm_path）直接可用
"""
from __future__ import annotations

import subprocess
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.i18n import _
from app.models import User
from app.models_commerce import LibraryItem
from app.services import storage

KINDS = ("avatar", "bgm", "sfx")
BGM_MOODS = ("default", "tense", "warm", "tech", "epic", "upbeat", "calm")
IMAGE_EXT = {".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image"}
AUDIO_EXT = {".mp3": "audio", ".m4a": "audio", ".wav": "audio", ".aac": "audio"}
MAX_IMAGE = 10 * 1024 * 1024
MAX_AUDIO = 25 * 1024 * 1024
MAX_PER_USER = 200
STATIC_ROOT = Path(__file__).resolve().parents[2] / "static"


class LibraryError(Exception):
    """素材库业务错误。"""


def _probe_duration(path: Path) -> float | None:
    """ffprobe 取音频时长；失败返回 None。"""
    try:
        out = subprocess.run(
            [get_settings().ffprobe_path, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        return round(float(out.stdout.strip()), 2) if out.stdout.strip() else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def _validate(kind: str, filename: str, size: int) -> str:
    if kind not in KINDS:
        raise LibraryError(_("素材类型无效"))
    ext = Path(filename or "").suffix.lower()
    if kind == "avatar":
        if ext not in IMAGE_EXT:
            raise LibraryError(_("仅支持 JPG / PNG / WebP"))
        if size > MAX_IMAGE:
            raise LibraryError(_("图片不能超过 10MB"))
    else:
        if ext not in AUDIO_EXT:
            raise LibraryError(_("仅支持 MP3 / M4A / WAV / AAC"))
        if size > MAX_AUDIO:
            raise LibraryError(_("音频不能超过 25MB"))
    return ".jpg" if ext == ".jpeg" else ext


async def add_item(
    db: AsyncSession,
    *,
    kind: str,
    name: str,
    data: bytes,
    filename: str,
    owner: User | None,
    tags: list[str] | None = None,
) -> LibraryItem:
    """保存文件并入库。全站 BGM（owner 为空）按情绪放进 static/bgm/<mood>/ 供合成使用。"""
    if not data:
        raise LibraryError(_("空文件"))
    ext = _validate(kind, filename, len(data))
    clean_tags = [t.strip().lower()[:32] for t in (tags or []) if t and t.strip()][:8]
    if owner is not None:
        count = len(
            (await db.execute(select(LibraryItem.id).where(LibraryItem.owner_user_id == owner.id))).all()
        )
        if count >= MAX_PER_USER:
            raise LibraryError(_("素材数量已达上限"))
        folder = storage.user_dir(owner.id) / "library"
    elif kind == "bgm":
        mood = next((t for t in clean_tags if t in BGM_MOODS), "default")
        clean_tags = [mood, *[t for t in clean_tags if t != mood]]
        folder = STATIC_ROOT / "bgm" / mood
    else:
        folder = STATIC_ROOT / "library" / kind
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / f"{uuid.uuid4().hex[:16]}{ext}"
    dest.write_bytes(data)
    item = LibraryItem(
        kind=kind,
        owner_user_id=owner.id if owner else None,
        name=(name or Path(filename).stem or kind).strip()[:128],
        url=storage.publish_local(dest),
        local_path=str(dest),
        tags=clean_tags or None,
        duration_sec=_probe_duration(dest) if kind != "avatar" else None,
    )
    db.add(item)
    await db.flush()
    return item


async def delete_item(db: AsyncSession, item_id: int, *, owner: User | None) -> None:
    """删除：用户只能删自己的；管理员（owner=None）删全站素材。顺带删本地文件。"""
    item = await db.get(LibraryItem, int(item_id))
    if item is None or (owner is not None and item.owner_user_id != owner.id) or (owner is None and item.owner_user_id is not None):
        raise LibraryError(_("素材不存在"))
    if item.local_path:
        try:
            Path(item.local_path).unlink(missing_ok=True)
        except OSError:
            pass
    await db.delete(item)


def item_out(item: LibraryItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "kind": item.kind,
        "name": item.name,
        "url": item.url,
        "tags": list(item.tags or []),
        "duration_sec": item.duration_sec,
        "scope": "mine" if item.owner_user_id else "global",
    }


async def list_items(db: AsyncSession, kind: str, user: User | None, *, include_global: bool = True) -> list[dict[str, Any]]:
    conds = []
    if include_global:
        conds.append(LibraryItem.owner_user_id.is_(None))
    if user is not None:
        conds.append(LibraryItem.owner_user_id == user.id)
    if not conds:
        return []
    rows = (
        await db.execute(
            select(LibraryItem).where(LibraryItem.kind == kind, or_(*conds)).order_by(LibraryItem.owner_user_id.is_(None), LibraryItem.id.desc()).limit(500)
        )
    ).scalars().all()
    return [item_out(r) for r in rows]


async def avatar_library(db: AsyncSession, user: User) -> dict[str, Any]:
    """头像库：全站 + 我的上传 + 我在漫剧里生成过图的角色。"""
    from app.models_drama import DramaAsset, DramaProject

    rows = (
        await db.execute(
            select(DramaAsset.id, DramaAsset.name, DramaAsset.url, DramaAsset.cover, DramaProject.title)
            .join(DramaProject, DramaProject.id == DramaAsset.project_id)
            .where(DramaProject.user_id == user.id, DramaAsset.type == "character", or_(DramaAsset.url.is_not(None), DramaAsset.cover.is_not(None)))
            .order_by(DramaAsset.id.desc())
            .limit(100)
        )
    ).all()
    characters = [
        {"id": f"asset:{aid}", "kind": "avatar", "name": name or "", "url": url or cover, "project": pname, "scope": "project"}
        for aid, name, url, cover, pname in rows
        if (url or cover)
    ]
    return {"items": await list_items(db, "avatar", user), "characters": characters}


async def timeline_library(db: AsyncSession, user: User) -> dict[str, Any]:
    """时间线素材：BGM / 音效（全站 + 我的）+ 我最近生成的分镜视频。"""
    from app.models_drama import DramaEpisode, DramaEpisodeFragment, DramaProject

    rows = (
        await db.execute(
            select(DramaEpisodeFragment.id, DramaEpisodeFragment.video, DramaEpisodeFragment.cover, DramaEpisodeFragment.duration_sec, DramaProject.title)
            .join(DramaEpisode, DramaEpisode.id == DramaEpisodeFragment.episode_id)
            .join(DramaProject, DramaProject.id == DramaEpisode.project_id)
            .where(DramaProject.user_id == user.id, DramaEpisodeFragment.video != "")
            .order_by(DramaEpisodeFragment.id.desc())
            .limit(60)
        )
    ).all()
    clips = [
        {"id": f"fragment:{fid}", "url": url, "cover": cover or None, "duration_sec": dur, "project": title}
        for fid, url, cover, dur, title in rows
    ]
    return {"bgm": await list_items(db, "bgm", user), "sfx": await list_items(db, "sfx", user), "clips": clips, "moods": list(BGM_MOODS)}
