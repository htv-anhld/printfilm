# -*- coding: utf-8 -*-
"""记住本地素材的上游公网原图地址（未开 OSS 时给 Seedance 当参考图用）。

Seedream 出图返回的是方舟 CDN 签名 URL（约 24 小时有效），我们下载到本地 /static 后
原地址就丢了；而 Seedance 只能拉公网 https 图片。这里在本地文件旁写一个 .src 侧车文件，
记录原地址与下载时间，过期前可直接复用，省去必须配置 OSS 才能跑视频的门槛。
"""
from __future__ import annotations

import json
import time
from pathlib import Path

# 签名 URL 一般 24h；留足余量，Seedance 任务排队期间也不会过期
REMOTE_SOURCE_TTL_SEC = 20 * 3600


def _sidecar(path: Path) -> Path:
    return path.with_name(path.name + ".src")


def remember_remote_source(local_path: Path, remote_url: str | None) -> None:
    """下载完成后记录原图地址；只记无需鉴权的公网 https。"""
    url = (remote_url or "").strip()
    if not url.startswith("https://"):
        return
    try:
        _sidecar(local_path).write_text(json.dumps({"url": url, "ts": time.time()}), encoding="utf-8")
    except OSError:
        pass


def fresh_remote_source(local_path: Path, *, now: float | None = None) -> str | None:
    """仍在有效期内的原图地址；没有或已过期返回 None。"""
    try:
        data = json.loads(_sidecar(local_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    url = str(data.get("url") or "")
    ts = float(data.get("ts") or 0)
    if not url.startswith("https://"):
        return None
    if (now if now is not None else time.time()) - ts > REMOTE_SOURCE_TTL_SEC:
        return None
    return url
