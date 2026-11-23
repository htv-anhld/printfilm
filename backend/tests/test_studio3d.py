"""3D 布局：CRUD、归属隔离、体积限制、截图校验。"""

from __future__ import annotations

import httpx
import pytest

from app.database import get_db
from app.main import app
from app.services import storage
from app.services.auth import create_access_token
from tests.conftest import make_user

PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64


@pytest.fixture
async def client(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(storage, "user_dir", lambda uid: tmp_path / str(uid))
    monkeypatch.setattr(storage, "publish_local", lambda p, **_k: f"/static/{p.name}")

    async def _db():
        yield db_session

    app.dependency_overrides[get_db] = _db
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


async def test_scene_crud_and_isolation(client, db_session):
    alice, bob = await make_user(db_session), await make_user(db_session)
    ha = {"Authorization": f"Bearer {create_access_token(str(alice.id))}"}
    hb = {"Authorization": f"Bearer {create_access_token(str(bob.id))}"}
    opts = (await client.get("/api/drama/layout3d/options")).json()
    assert "person" in opts["objects"] and 35 in opts["lenses"]
    data = {"objects": [{"id": "a", "type": "person", "position": [0, 0, 0]}], "camera": {"lens": 35}, "ratio": "16:9"}
    created = (await client.post("/api/studio3d/scenes", headers=ha, json={"name": "Cảnh 1", "data": data})).json()
    sid = created["id"]
    assert (await client.get(f"/api/studio3d/scenes/{sid}", headers=hb)).status_code == 404
    upd = await client.patch(f"/api/studio3d/scenes/{sid}", headers=ha, json={"name": "Cảnh 1b", "data": data})
    assert upd.json()["name"] == "Cảnh 1b"
    too_many = {"objects": [{"type": "box"}] * 61}
    assert (await client.post("/api/studio3d/scenes", headers=ha, json={"name": "x", "data": too_many})).status_code == 422
    bad = await client.post(f"/api/studio3d/scenes/{sid}/snapshot", headers=ha, files={"file": ("a.png", b"GIF89a", "image/png")})
    assert bad.status_code == 400
    ok = await client.post(f"/api/studio3d/scenes/{sid}/snapshot", headers=ha, files={"file": ("a.png", PNG, "image/png")})
    assert ok.json()["url"].startswith("/static/scene")
    listed = (await client.get("/api/studio3d/scenes", headers=ha)).json()["items"]
    assert listed[0]["snapshot_url"] == ok.json()["url"] and "data" not in listed[0]
    assert (await client.delete(f"/api/studio3d/scenes/{sid}", headers=ha)).json() == {"ok": True}
