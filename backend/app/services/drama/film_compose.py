"""漫剧整部成片：按集序 + 镜序把所有分镜视频统一画幅重编码后拼成一个 MP4。

合成可能持续数分钟，放到进程内后台任务执行；状态写进 project.params["film_compose"]，
前端轮询项目详情即可拿到进度与下载地址。
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.i18n import _
from app.models_drama import DramaEpisode, DramaProject
from app.services import storage as storage_svc
from app.services.drama.episode_compose import _concat_normalized, _ensure_clip_local, _normalize_clip
from app.services.drama.output_settings import resolve_episode_video_output, target_pixel_size

logger = logging.getLogger("app.drama.film_compose")

STATE_KEY = "film_compose"
# 正在运行的项目 id（同一进程内防重入）
_running: set[int] = set()


def read_film_state(project: DramaProject) -> dict[str, Any]:
    """读取整部成片状态；超时的 running 视为 failed。"""
    raw = (project.params or {}).get(STATE_KEY)
    state = dict(raw) if isinstance(raw, dict) else {}
    # 合成任务只活在当前进程里（建议单 worker）：记录为 running 但本进程没有在跑 → 已被重启打断
    if state.get("status") == "running" and int(project.id) not in _running:
        state["status"] = "failed"
        state["error"] = _("合成被中断，请重新发起")
    return state


def collect_film_clips(episodes: list[DramaEpisode]) -> tuple[list[str], list[int], list[int]]:
    """
    按集序、镜序收集已有视频的分镜。
    @returns (视频 URL 列表, 参与的集号列表, 缺视频而被跳过的集号列表)
    """
    urls: list[str] = []
    included: list[int] = []
    skipped: list[int] = []
    # 与分集列表一致：按 params.episodeNumber，再按 id
    def _episode_key(ep: DramaEpisode) -> tuple[int, int]:
        params = ep.params if isinstance(ep.params, dict) else {}
        try:
            number = int(params.get("episodeNumber") or 0)
        except (TypeError, ValueError):
            number = 0
        return (number, int(ep.id or 0))

    ordered = sorted(episodes, key=_episode_key)
    for index, ep in enumerate(ordered, start=1):
        frags = sorted(ep.fragments or [], key=lambda f: (int(f.sort_order or 0), int(f.id or 0)))
        clips = [(f.video or "").strip() for f in frags if (f.video or "").strip()]
        if clips:
            urls.extend(clips)
            included.append(index)
        else:
            skipped.append(index)
    return urls, included, skipped


async def _save_state(project_id: int, state: dict[str, Any]) -> None:
    """写回状态（独立会话，后台任务里调用）。"""
    async with AsyncSessionLocal() as db:
        project = await db.get(DramaProject, project_id)
        if project is None:
            return
        params = dict(project.params or {})
        params[STATE_KEY] = state
        project.params = params
        await db.commit()


async def _run_compose(project_id: int) -> None:
    """后台：下载 → 统一重编码 → 拼接 → 发布。"""
    state: dict[str, Any] = {"status": "running", "started_at": datetime.now(UTC).isoformat(), "done": 0}
    await _save_state(project_id, state)
    try:
        async with AsyncSessionLocal() as db:
            project = await db.get(DramaProject, project_id)
            episodes = (
                (
                    await db.execute(
                        select(DramaEpisode)
                        .where(DramaEpisode.project_id == project_id)
                        .options(selectinload(DramaEpisode.fragments))
                    )
                )
                .scalars()
                .all()
            )
            urls, included, skipped = collect_film_clips(list(episodes))
            ratio, resolution = resolve_episode_video_output(None, project.params if project else None)
        if not urls:
            raise RuntimeError(_("还没有任何已生成视频的分镜，无法合成整部影片"))
        width, height = target_pixel_size(ratio, resolution)
        state.update({"total": len(urls), "episodes": included, "skipped_episodes": skipped})
        await _save_state(project_id, state)

        out_path = storage_svc.project_dir(project_id) / f"film_{project_id}_compose.mp4"
        with tempfile.TemporaryDirectory(prefix=f"drama_film_{project_id}_") as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "src").mkdir()
            (tmp_path / "norm").mkdir()
            normalized: list[Path] = []
            for idx, url in enumerate(urls):
                src = await _ensure_clip_local(url, tmp_path / "src", idx)
                dest = tmp_path / "norm" / f"seg_{idx:04d}.mp4"
                await asyncio.to_thread(_normalize_clip, src, dest, width, height)
                normalized.append(dest)
                state["done"] = idx + 1
                # 每 5 段写一次进度，避免频繁写库
                if (idx + 1) % 5 == 0 or idx + 1 == len(urls):
                    await _save_state(project_id, state)
            await asyncio.to_thread(_concat_normalized, normalized, out_path)

        published = storage_svc.publish_local(out_path, sync=True)
        if published and str(published).startswith(("http://", "https://", "/static/")):
            url = str(published)
        else:
            url = storage_svc.rel_static_url(out_path)
        state.update(
            {
                "status": "done",
                "url": url,
                "finished_at": datetime.now(UTC).isoformat(),
                "size": f"{width}x{height}",
            }
        )
        logger.info("film compose done project_id=%s clips=%s url=%s", project_id, len(urls), url[:120])
    except Exception as exc:  # noqa: BLE001
        logger.exception("film compose failed project_id=%s", project_id)
        state.update({"status": "failed", "error": str(exc)[:400], "finished_at": datetime.now(UTC).isoformat()})
    finally:
        _running.discard(project_id)
        await _save_state(project_id, state)


def start_film_compose(project_id: int) -> bool:
    """发起后台合成；同一项目已在合成时返回 False。"""
    if project_id in _running:
        return False
    _running.add(project_id)
    asyncio.get_running_loop().create_task(_run_compose(project_id))
    return True
