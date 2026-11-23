"""创意看板：CRUD、归属隔离、条目校验、重排。"""

from __future__ import annotations

import httpx
import pytest

from app.database import get_db
from app.main import app
from app.services.auth import create_access_token
from tests.conftest import make_user


@pytest.fixture
async def client(db_session):
    async def _db():
        yield db_session

    app.dependency_overrides[get_db] = _db
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


async def test_board_flow(client, db_session):
    alice, bob = await make_user(db_session), await make_user(db_session)
    ha = {"Authorization": f"Bearer {create_access_token(str(alice.id))}"}
    hb = {"Authorization": f"Bearer {create_access_token(str(bob.id))}"}
    board = (await client.post("/api/creative/projects", headers=ha, json={"name": "Chiến dịch Tết"})).json()
    bid = board["id"]
    assert (await client.get(f"/api/creative/projects/{bid}", headers=hb)).status_code == 404
    bad = await client.post(f"/api/creative/projects/{bid}/items", headers=ha, json={"kind": "image", "url": "javascript:alert(1)"})
    assert bad.status_code == 422
    assert (await client.post(f"/api/creative/projects/{bid}/items", headers=ha, json={"kind": "text", "text": "  "})).status_code == 422
    a = (await client.post(f"/api/creative/projects/{bid}/items", headers=ha, json={"kind": "image", "url": "/static/a.png", "source": "t2i"})).json()
    b = (await client.post(f"/api/creative/projects/{bid}/items", headers=ha, json={"kind": "text", "text": "Slogan"})).json()
    ids = [i["id"] for i in b["items"]]
    assert b["items"][0]["kind"] == "text" and a["cover"] == "/static/a.png"
    reordered = (await client.put(f"/api/creative/projects/{bid}/order", headers=ha, json={"item_ids": list(reversed(ids))})).json()
    assert [i["id"] for i in reordered["items"]] == list(reversed(ids))
    left = (await client.delete(f"/api/creative/projects/{bid}/items/{ids[0]}", headers=ha)).json()
    assert left["item_count"] == 1
    listed = (await client.get("/api/creative/projects", headers=ha)).json()["items"]
    assert listed[0]["cover"] == "/static/a.png" and "items" not in listed[0]
