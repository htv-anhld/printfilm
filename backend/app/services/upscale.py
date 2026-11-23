# -*- coding: utf-8 -*-
"""画质放大（对齐 Dravelio /drama/upscale/options）。

当前上游生图模型最高 2K（Seedream Pro / gpt-image 的 3K、4K 会被钳到 2K），无法用 AI 做更高倍放大，
所以这里用 FFmpeg（lanczos 重采样 + 轻度锐化）在本机 CPU 上放大，界面明确标注「非 AI」。不计费。

来源限制（防 SSRF / 任意读文件）：上传文件，或本站 /static 下的媒体，或已配置的 OSS 公网域名。
"""
from __future__ import annotations

import asyncio
import subprocess
import uuid
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.i18n import _
from app.models import User
from app.services import storage

IMAGE_SCALES = (2, 4)
VIDEO_TARGETS = {"1080p": 1080, "1440p": 1440, "2160p": 2160}
MAX_IMAGE_SIDE = 8192
MAX_VIDEO_SEC = 60
VIDEO_TIMEOUT_SEC = 540
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXT = {".mp4", ".mov", ".webm", ".m4v"}


class UpscaleError(Exception):
    """放大失败（来源不合法 / 尺寸超限 / FFmpeg 出错）。"""


def options() -> dict[str, Any]:
    return {
        "engine": "ffmpeg",
        "ai": False,
        "image": {"scales": list(IMAGE_SCALES), "max_side": MAX_IMAGE_SIDE},
        "video": {"targets": list(VIDEO_TARGETS), "max_seconds": MAX_VIDEO_SEC},
    }


def _run(cmd: list[str], timeout: int) -> None:
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired as exc:
        raise UpscaleError(_("处理超时，请换更短的视频")) from exc
    except OSError as exc:
        raise UpscaleError(_("服务器未安装 FFmpeg")) from exc
    if proc.returncode != 0:
        raise UpscaleError(_("放大失败：{detail}", detail=proc.stderr.decode("utf-8", "ignore")[-300:]))


def _probe(path: Path) -> dict[str, float]:
    """ffprobe：宽、高、时长。"""
    s = get_settings()
    proc = subprocess.run(
        [s.ffprobe_path, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "default=nw=1", str(path)],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    out: dict[str, float] = {}
    for line in proc.stdout.splitlines():
        key, _sep, value = line.partition("=")
        try:
            out[key] = float(value)
        except ValueError:
            continue
    if not out.get("width") or not out.get("height"):
        raise UpscaleError(_("无法读取媒体尺寸"))
    return out


async def resolve_source(url: str | None, upload: Path | None) -> Path:
    """把来源变成本地文件路径（只接受上传 / 本站静态文件 / 本站 OSS 域名）。"""
    if upload is not None:
        return upload
    raw = (url or "").strip()
    if not raw:
        raise UpscaleError(_("请上传文件或填写本站媒体链接"))
    local = storage.local_path_from_url(raw)
    if local is not None:
        root = storage.STATIC_ROOT.resolve()
        resolved = local.resolve()
        # 防 /static/../../ 路径穿越
        if root not in resolved.parents:
            raise UpscaleError(_("只能放大本站生成的媒体"))
        if not resolved.is_file():
            raise UpscaleError(_("文件不存在"))
        return resolved
    oss_base = (get_settings().oss_public_base or "").rstrip("/")
    if oss_base and raw.startswith(oss_base + "/"):
        dest = storage.user_dir(0) / "upscale_src" / f"{uuid.uuid4().hex[:12]}{Path(raw.split('?')[0]).suffix[:6]}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        await storage.download_to(raw, dest)
        return dest
    raise UpscaleError(_("只能放大本站生成的媒体"))


async def upscale(user: User, src: Path, *, kind: str, scale: int = 2, target: str = "1080p") -> dict[str, Any]:
    """执行放大，返回 {url, width, height}。"""
    s = get_settings()
    ext = src.suffix.lower()
    out_dir = storage.user_dir(user.id) / "upscale"
    out_dir.mkdir(parents=True, exist_ok=True)
    info = await asyncio.to_thread(_probe, src)
    w, h = int(info["width"]), int(info["height"])
    if kind == "image":
        if ext not in IMAGE_EXT:
            raise UpscaleError(_("仅支持 JPG / PNG / WebP"))
        if scale not in IMAGE_SCALES:
            raise UpscaleError(_("放大倍数无效"))
        nw, nh = w * scale, h * scale
        if max(nw, nh) > MAX_IMAGE_SIDE:
            raise UpscaleError(_("放大后超过 {n} 像素上限", n=MAX_IMAGE_SIDE))
        dest = out_dir / f"up_{uuid.uuid4().hex[:12]}.png"
        cmd = [s.ffmpeg_path, "-y", "-v", "error", "-i", str(src), "-vf", f"scale={nw}:{nh}:flags=lanczos,unsharp=5:5:0.6:5:5:0.0", str(dest)]
        await asyncio.to_thread(_run, cmd, 120)
    elif kind == "video":
        if ext not in VIDEO_EXT:
            raise UpscaleError(_("仅支持 MP4 / MOV / WebM"))
        if target not in VIDEO_TARGETS:
            raise UpscaleError(_("目标分辨率无效"))
        if float(info.get("duration") or 0) > MAX_VIDEO_SEC:
            raise UpscaleError(_("视频不能超过 {n} 秒", n=MAX_VIDEO_SEC))
        short = VIDEO_TARGETS[target]
        if min(w, h) >= short:
            raise UpscaleError(_("视频已达到该分辨率"))
        # 按短边放大，保持宽高比且尺寸为偶数
        vf = f"scale='if(gt(iw,ih),-2,{short})':'if(gt(iw,ih),{short},-2)':flags=lanczos,unsharp=5:5:0.5:5:5:0.0"
        dest = out_dir / f"up_{uuid.uuid4().hex[:12]}.mp4"
        cmd = [
            s.ffmpeg_path, "-y", "-v", "error", "-i", str(src), "-vf", vf,
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", str(dest),
        ]
        await asyncio.to_thread(_run, cmd, VIDEO_TIMEOUT_SEC)
    else:
        raise UpscaleError(_("类型无效"))
    out = await asyncio.to_thread(_probe, dest)
    return {"url": storage.publish_local(dest), "width": int(out["width"]), "height": int(out["height"]), "engine": "ffmpeg"}
