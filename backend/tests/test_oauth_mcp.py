"""OAuth 2.1 + MCP 全链路（ASGI）：元数据、动态注册、PKCE 授权码、令牌轮换、MCP 工具、撤销。"""

from __future__ import annotations

import base64
import hashlib
import secrets
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from app.config import get_settings
from app.database import get_db
from app.main import app
from app.services.auth import create_access_token
from tests.conftest import make_user


@pytest.fixture
async def client(db_session, monkeypatch):
    """HTTP 客户端，数据库指向测试事务。"""
    monkeypatch.setattr(get_settings(), "public_base_url", "https://api.test")
    monkeypatch.setattr(get_settings(), "app_public_url", "https://app.test")

    async def _db():
        yield db_session

    app.dependency_overrides[get_db] = _db
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


def _pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


async def _authorize(client, user, client_id: str, redirect: str, challenge: str) -> str:
    res = await client.post(
        "/api/oauth/authorize",
        headers={"Authorization": f"Bearer {create_access_token(str(user.id))}"},
        json={"client_id": client_id, "redirect_uri": redirect, "state": "xyz", "code_challenge": challenge},
    )
    assert res.status_code == 200, res.text
    q = parse_qs(urlsplit(res.json()["redirect_url"]).query)
    assert q["state"] == ["xyz"]
    return q["code"][0]


async def test_metadata(client):
    meta = (await client.get("/.well-known/oauth-authorization-server")).json()
    assert meta["token_endpoint"] == "https://api.test/api/oauth/token"
    assert meta["authorization_endpoint"] == "https://app.test/oauth/authorize"
    assert meta["code_challenge_methods_supported"] == ["S256"]
    pr = (await client.get("/.well-known/oauth-protected-resource")).json()
    assert pr["resource"] == "https://api.test/api/mcp"


async def test_full_flow_dynamic_public_client(client, db_session):
    user = await make_user(db_session, balance_fen=1234)
    redirect = "https://claude.ai/api/mcp/auth_callback"
    reg = await client.post("/api/oauth/register", json={"client_name": "Claude", "redirect_uris": [redirect], "token_endpoint_auth_method": "none"})
    assert reg.status_code == 201
    client_id = reg.json()["client_id"]
    assert "client_secret" not in reg.json()

    # 未注册的回调地址被拒
    bad = await client.post(
        "/api/oauth/authorize",
        headers={"Authorization": f"Bearer {create_access_token(str(user.id))}"},
        json={"client_id": client_id, "redirect_uri": "https://evil.test/cb", "code_challenge": "x" * 43},
    )
    assert bad.status_code == 400

    verifier, challenge = _pkce()
    code = await _authorize(client, user, client_id, redirect, challenge)
    # 错误 verifier 失败
    wrong = await client.post("/api/oauth/token", data={"grant_type": "authorization_code", "code": code, "redirect_uri": redirect, "client_id": client_id, "code_verifier": "nope" * 12})
    assert wrong.status_code == 400 and wrong.json()["error"] == "invalid_grant"
    tok = await client.post("/api/oauth/token", data={"grant_type": "authorization_code", "code": code, "redirect_uri": redirect, "client_id": client_id, "code_verifier": verifier})
    assert tok.status_code == 200, tok.text
    access, refresh = tok.json()["access_token"], tok.json()["refresh_token"]

    # MCP：无令牌 401 并给出资源元数据
    unauth = await client.post("/api/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert unauth.status_code == 401 and "resource_metadata" in unauth.headers["www-authenticate"]
    h = {"Authorization": f"Bearer {access}"}
    init = (await client.post("/api/mcp", headers=h, json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}})).json()
    assert init["result"]["protocolVersion"] == "2025-06-18"
    note = await client.post("/api/mcp", headers=h, json={"jsonrpc": "2.0", "method": "notifications/initialized"})
    assert note.status_code == 202
    tools = (await client.post("/api/mcp", headers=h, json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"})).json()
    assert {t["name"] for t in tools["result"]["tools"]} >= {"generate_image", "get_balance"}
    bal = (await client.post("/api/mcp", headers=h, json={"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "get_balance", "arguments": {}}})).json()
    assert '"balance": 1234' in bal["result"]["content"][0]["text"]
    bad_args = (await client.post("/api/mcp", headers=h, json={"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "generate_image", "arguments": {}}})).json()
    assert bad_args["result"]["isError"] is True
    unknown = (await client.post("/api/mcp", headers=h, json={"jsonrpc": "2.0", "id": 5, "method": "nope"})).json()
    assert unknown["error"]["code"] == -32601

    # 调用记录
    logs = (await client.get("/api/mcp/requests", headers={"Authorization": f"Bearer {create_access_token(str(user.id))}"})).json()
    assert logs["meta"]["total"] >= 2 and logs["items"][0]["app"] == "Claude"

    # 刷新轮换：旧 refresh 失效
    new = await client.post("/api/oauth/token", data={"grant_type": "refresh_token", "refresh_token": refresh, "client_id": client_id})
    assert new.status_code == 200
    again = await client.post("/api/oauth/token", data={"grant_type": "refresh_token", "refresh_token": refresh, "client_id": client_id})
    assert again.status_code == 400

    # 用户取消授权后令牌失效
    apps = (await client.get("/api/oauth/apps", headers={"Authorization": f"Bearer {create_access_token(str(user.id))}"})).json()
    app_id = apps["authorized"][0]["id"]
    await client.delete(f"/api/oauth/authorized/{app_id}", headers={"Authorization": f"Bearer {create_access_token(str(user.id))}"})
    gone = await client.post("/api/mcp", headers={"Authorization": f"Bearer {new.json()['access_token']}"}, json={"jsonrpc": "2.0", "id": 9, "method": "tools/list"})
    assert gone.status_code == 401


async def test_code_replay_revokes_tokens(client, db_session):
    user = await make_user(db_session)
    redirect = "http://localhost:3333/cb"
    reg = (await client.post("/api/oauth/register", json={"redirect_uris": [redirect]})).json()
    verifier, challenge = _pkce()
    code = await _authorize(client, user, reg["client_id"], redirect, challenge)
    form = {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect, "client_id": reg["client_id"], "code_verifier": verifier}
    first = await client.post("/api/oauth/token", data=form)
    assert first.status_code == 200
    replay = await client.post("/api/oauth/token", data=form)
    assert replay.status_code == 400
    dead = await client.post("/api/mcp", headers={"Authorization": f"Bearer {first.json()['access_token']}"}, json={"jsonrpc": "2.0", "id": 1, "method": "ping"})
    assert dead.status_code == 401


async def test_confidential_app_requires_secret_and_hides_from_key_list(client, db_session):
    user = await make_user(db_session)
    auth = {"Authorization": f"Bearer {create_access_token(str(user.id))}"}
    created = (await client.post("/api/oauth/apps", headers=auth, json={"name": "My app", "redirect_uris": ["https://my.app/cb"]})).json()
    assert created["client_secret"].startswith("pfs_")
    http_bad = await client.post("/api/oauth/apps", headers=auth, json={"name": "x", "redirect_uris": ["http://my.app/cb"]})
    assert http_bad.status_code == 400  # 非本机必须 https
    verifier, challenge = _pkce()
    code = await _authorize(client, user, created["client_id"], "https://my.app/cb", challenge)
    no_secret = await client.post("/api/oauth/token", data={"grant_type": "authorization_code", "code": code, "redirect_uri": "https://my.app/cb", "client_id": created["client_id"], "code_verifier": verifier})
    assert no_secret.status_code == 401
    basic = base64.b64encode(f"{created['client_id']}:{created['client_secret']}".encode()).decode()
    code2 = await _authorize(client, user, created["client_id"], "https://my.app/cb", challenge)
    ok = await client.post("/api/oauth/token", headers={"Authorization": f"Basic {basic}"}, data={"grant_type": "authorization_code", "code": code2, "redirect_uri": "https://my.app/cb", "code_verifier": verifier})
    assert ok.status_code == 200
    keys = (await client.get("/api/user/api-keys", headers=auth)).json()
    assert isinstance(keys, list)
    assert all(not str(k.get("name", "")).startswith("OAuth") for k in keys)
