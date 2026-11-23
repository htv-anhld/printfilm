"""画质放大：选项、来源限制（路径穿越 / 外链）、图片 2 倍、视频按短边放大到 1080p。"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from app.services import storage
from app.services import upscale as up
from tests.conftest import make_user

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="需要 FFmpeg")


@pytest.fixture
def media(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "STATIC_ROOT", tmp_path)
    monkeypatch.setattr(storage, "user_dir", lambda uid: tmp_path / "users" / str(uid))
    monkeypatch.setattr(storage, "publish_local", lambda p, **_k: "/static/" + str(Path(p).relative_to(tmp_path)))
    img = tmp_path / "generated" / "a.png"
    vid = tmp_path / "generated" / "a.mp4"
    img.parent.mkdir(parents=True)
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=320x180", "-frames:v", "1", str(img)], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=854x480:d=1", "-pix_fmt", "yuv420p", str(vid)], check=True)
    return tmp_path, img, vid


def test_options_are_honest():
    opts = up.options()
    assert opts["ai"] is False and opts["engine"] == "ffmpeg"


async def test_source_restrictions(media):
    root, img, _vid = media
    assert await up.resolve_source("/static/generated/a.png", None) == img.resolve()
    with pytest.raises(up.UpscaleError):
        await up.resolve_source("/static/../../etc/passwd", None)
    with pytest.raises(up.UpscaleError):
        await up.resolve_source("https://evil.example/x.png", None)
    with pytest.raises(up.UpscaleError):
        await up.resolve_source("", None)


async def test_image_and_video(db_session, media):
    _root, img, vid = media
    user = await make_user(db_session)
    out = await up.upscale(user, img, kind="image", scale=2)
    assert (out["width"], out["height"]) == (640, 360)
    res = await up.upscale(user, vid, kind="video", target="1080p")
    assert res["height"] == 1080 and res["width"] % 2 == 0
    with pytest.raises(up.UpscaleError):
        await up.upscale(user, vid, kind="video", target="480p")
    with pytest.raises(up.UpscaleError):
        await up.upscale(user, img, kind="image", scale=3)
