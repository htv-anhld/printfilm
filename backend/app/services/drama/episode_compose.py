"""漫剧分集成片：统一画幅重编码后拼接（兼容各镜 HEVC 参数不一致）。"""

from __future__ import annotations

import asyncio
import logging
import tempfile
import time
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.i18n import _
from app.models_drama import DramaEpisode, DramaProject
from app.services import storage as storage_svc
from app.services.drama.output_settings import resolve_episode_video_output, target_pixel_size
from app.services.drama.subtitle_burn import burn_subtitles
from app.services.drama.subtitle_cues import BurnCue, TimelineClip, build_burn_timeline, resolve_effective_subtitle_mode
from app.services.ffmpeg_compose import _run, _scale_pad, _which, probe_duration

logger = logging.getLogger("app.drama.episode_compose")


# 将单镜规范到目标分辨率（H.264 + AAC），便于后续 stream copy 拼接
def _normalize_clip(src: Path, dest: Path, width: int, height: int) -> None:
    ffmpeg = _which("ffmpeg")
    vf = _scale_pad(width, height)
    _run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(src),
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            str(dest),
        ]
    )


# 拼接已规范化的片段（stream copy）
def _concat_normalized(paths: list[Path], output: Path) -> None:
    ffmpeg = _which("ffmpeg")
    with tempfile.TemporaryDirectory(prefix="drama_ep_concat_") as tmp:
        tmp_path = Path(tmp)
        concat_list = tmp_path / "concat.txt"
        concat_list.write_text(
            "\n".join(f"file '{p.resolve().as_posix()}'" for p in paths),
            encoding="utf-8",
        )
        merged = tmp_path / "merged.mp4"
        _run(
            [
                ffmpeg,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_list),
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                str(merged),
            ]
        )
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(merged.read_bytes())


# 确保远程/本地视频落到可 ffmpeg 读取的本地路径
async def _ensure_clip_local(url: str, cache_dir: Path, index: int) -> Path:
    local = storage_svc.local_path_from_url(url)
    if local is not None:
        if not local.exists():
            await storage_svc.ensure_local_media(url, local)
        if local.exists() and local.stat().st_size > 0:
            return local
    dest = cache_dir / f"src_{index:03d}.mp4"
    await storage_svc.ensure_local_media(url, dest)
    if not dest.exists() or dest.stat().st_size <= 0:
        raise RuntimeError(_("无法下载分镜视频：{url}", url=url[:120]))
    return dest


# 成片文件名固定（覆盖写），附加版本号避免浏览器/CDN 返回上一次的旧成片
def with_cache_buster(url: str) -> str:
    if not url or "?" in url:
        return url
    return f"{url}?v={int(time.time())}"


# 规范化后各段的实际时长（ffprobe 失败时回退分镜记录的 duration）
def probe_clip_durations(paths: list[Path], fallbacks: list[float | None]) -> list[float]:
    out: list[float] = []
    for path, fallback in zip(paths, fallbacks):
        actual = probe_duration(path)
        out.append(float(actual if actual and actual > 0 else (fallback or 0.0)))
    return out


# 拼接后按需烧录后期字幕；返回烧录的字幕行数（0 = 未烧录，output 即拼接结果）
def concat_and_burn(
    normalized: list[Path], output: Path, cues: list[BurnCue], *, width: int, height: int
) -> int:
    if not cues:
        _concat_normalized(normalized, output)
        return 0
    with tempfile.TemporaryDirectory(prefix="drama_burn_") as tmp:
        merged = Path(tmp) / "merged.mp4"
        _concat_normalized(normalized, merged)
        return burn_subtitles(merged, output, cues, width=width, height=height)


# 按分集设置统一重编码并拼接；返回可下载 URL（后期字幕模式下烧录字幕板字幕）
async def compose_episode_video(
    db: AsyncSession,
    *,
    episode: DramaEpisode,
    project: DramaProject,
    fragment_ids: list[int] | None = None,
) -> str:
    url, _burned = await compose_episode_video_ex(
        db, episode=episode, project=project, fragment_ids=fragment_ids
    )
    return url


# 同 compose_episode_video，额外返回烧录的字幕行数
async def compose_episode_video_ex(
    db: AsyncSession,
    *,
    episode: DramaEpisode,
    project: DramaProject,
    fragment_ids: list[int] | None = None,
) -> tuple[str, int]:
    frags = sorted(episode.fragments or [], key=lambda f: f.sort_order)
    if fragment_ids:
        allow = {int(x) for x in fragment_ids}
        frags = [f for f in frags if f.id in allow]
    video_frags = [f for f in frags if (f.video or "").strip()]
    clips = [(f.id, (f.video or "").strip()) for f in video_frags]
    if not clips:
        raise RuntimeError(_("本集还没有可拼接的分镜视频"))

    ratio, resolution = resolve_episode_video_output(episode.params, project.params)
    width, height = target_pixel_size(ratio, resolution)
    burn = resolve_effective_subtitle_mode(episode.params, project.params) == "post"

    out_dir = storage_svc.project_dir(project.id)
    out_path = out_dir / f"episode_{episode.id}_compose.mp4"

    with tempfile.TemporaryDirectory(prefix=f"drama_ep_{episode.id}_") as tmp:
        tmp_path = Path(tmp)
        src_dir = tmp_path / "src"
        norm_dir = tmp_path / "norm"
        src_dir.mkdir()
        norm_dir.mkdir()

        local_srcs: list[Path] = []
        for idx, (_fid, url) in enumerate(clips):
            local_srcs.append(await _ensure_clip_local(url, src_dir, idx))

        normalized: list[Path] = []
        for idx, src in enumerate(local_srcs):
            dest = norm_dir / f"seg_{idx:03d}.mp4"
            await asyncio.to_thread(_normalize_clip, src, dest, width, height)
            normalized.append(dest)

        cues: list[BurnCue] = []
        if burn:
            durations = await asyncio.to_thread(
                probe_clip_durations, normalized, [f.duration_sec for f in video_frags]
            )
            cues = build_burn_timeline(
                TimelineClip(content=f.content, duration_sec=d, fragment_id=f.id)
                for f, d in zip(video_frags, durations)
            )
        burned = await asyncio.to_thread(concat_and_burn, normalized, out_path, cues, width=width, height=height)

    published = storage_svc.publish_local(out_path, sync=True)
    if published and str(published).startswith(("http://", "https://", "/static/")):
        url = str(published)
    else:
        rel = "/static/" + str(out_path.relative_to(storage_svc.STATIC_ROOT)).replace("\\", "/")
        url = storage_svc.to_public_url(rel)
    url = with_cache_buster(url)
    logger.info(
        "episode compose done episode_id=%s clips=%s size=%sx%s subtitle_lines=%s url=%s",
        episode.id,
        len(clips),
        width,
        height,
        burned,
        url[:120],
    )
    return url, burned


# 加载分集（含 fragments）供合成
async def load_episode_for_compose(db: AsyncSession, episode_id: int) -> DramaEpisode | None:
    from sqlalchemy import select

    return (
        await db.execute(
            select(DramaEpisode)
            .where(DramaEpisode.id == episode_id)
            .options(selectinload(DramaEpisode.fragments))
        )
    ).scalar_one_or_none()
