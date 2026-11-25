"""素材库：上传校验、私有 / 全站可见性、删除权限、BGM 进入合成目录、头像与时间线聚合。"""

from __future__ import annotations

import io
import wave
from pathlib import Path

import pytest

from app.services import bgm
from app.services import library as svc
from tests.conftest import make_user


def _wav_bytes(seconds: float = 0.5) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b"\0\0" * int(8000 * seconds))
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _tmp_static(tmp_path, monkeypatch):
    """静态目录与用户目录都指向临时目录，避免污染仓库。"""
    monkeypatch.setattr(svc, "STATIC_ROOT", tmp_path)
    monkeypatch.setattr(bgm, "_STATIC_ROOT", tmp_path)
    monkeypatch.setattr(svc.storage, "user_dir", lambda uid: tmp_path / "users" / str(uid))
    monkeypatch.setattr(svc.storage, "publish_local", lambda p, **_k: f"/static/{Path(p).name}")


async def test_upload_validation(db_session):
    user = await make_user(db_session)
    with pytest.raises(svc.LibraryError):
        await svc.add_item(db_session, kind="avatar", name="x", data=b"abc", filename="a.exe", owner=user)
    with pytest.raises(svc.LibraryError):
        await svc.add_item(db_session, kind="bgm", name="x", data=b"abc", filename="a.png", owner=user)
    with pytest.raises(svc.LibraryError):
        await svc.add_item(db_session, kind="avatar", name="x", data=b"", filename="a.png", owner=user)


async def test_visibility_and_delete(db_session):
    alice, bob = await make_user(db_session), await make_user(db_session)
    mine = await svc.add_item(db_session, kind="avatar", name="me", data=b"\x89PNG....", filename="a.png", owner=alice)
    glob = await svc.add_item(db_session, kind="avatar", name="global", data=b"\x89PNG....", filename="g.png", owner=None)
    alice_ids = {i["id"] for i in await svc.list_items(db_session, "avatar", alice)}
    bob_ids = {i["id"] for i in await svc.list_items(db_session, "avatar", bob)}
    assert {mine.id, glob.id} <= alice_ids and mine.id not in bob_ids and glob.id in bob_ids
    with pytest.raises(svc.LibraryError):
        await svc.delete_item(db_session, mine.id, owner=bob)
    with pytest.raises(svc.LibraryError):
        await svc.delete_item(db_session, glob.id, owner=alice)  # 用户不能删全站素材
    await svc.delete_item(db_session, mine.id, owner=alice)


async def test_global_bgm_used_by_compose(db_session, tmp_path):
    item = await svc.add_item(db_session, kind="bgm", name="Rain", data=_wav_bytes(), filename="rain.wav", owner=None, tags=["Tense", "night"])
    assert item.tags[0] == "tense" and Path(item.local_path).parent == tmp_path / "bgm" / "tense"
    assert item.duration_sec is None or item.duration_sec > 0
    assert bgm.resolve_bgm_path("悬疑紧张") == Path(item.local_path)
    assert bgm.resolve_bgm_path("căng thẳng") == Path(item.local_path)


async def test_timeline_and_avatar_aggregation(db_session):
    from app.models_drama import DramaAsset, DramaEpisode, DramaEpisodeFragment, DramaProject

    user = await make_user(db_session)
    project = DramaProject(user_id=user.id, title="Phim A")
    db_session.add(project)
    await db_session.flush()
    episode = DramaEpisode(name="Tập 1", project_id=project.id)
    db_session.add_all([episode, DramaAsset(type="character", name="Lan", url="/static/lan.png", project_id=project.id)])
    await db_session.flush()
    db_session.add(DramaEpisodeFragment(episode_id=episode.id, video="/static/f1.mp4", cover="/static/f1.jpg", duration_sec=5))
    await db_session.flush()
    tl = await svc.timeline_library(db_session, user)
    assert tl["clips"][0]["url"] == "/static/f1.mp4" and tl["clips"][0]["project"] == "Phim A"
    av = await svc.avatar_library(db_session, user)
    assert av["characters"][0]["name"] == "Lan"
