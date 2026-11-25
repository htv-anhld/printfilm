"""上游删除了 API Key 与 /api/v1 公开接口；本分支保留它们（API Key、开放 API、MCP/OAuth）。

这里改为验证本分支的等价安全约束：公开接口仍挂载但必须鉴权；未知/已撤销的 pf_live Key
不能换到用户；X-Api-Key 不能访问普通应用路由；v1_* 任务类型只作计费留痕（noop），不会被调度器执行生成。
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.deps import _user_from_bearer, get_current_user
from app.main import app
from app.services.tasks.handlers import get_task_handler


@pytest.mark.asyncio
@pytest.mark.parametrize("method,path", [
    ("GET", "/api/user/api-keys"), ("POST", "/api/user/api-keys"),
    ("DELETE", "/api/user/api-keys/1"), ("POST", "/api/v1/images/generations"),
    ("POST", "/api/v1/videos/generations"), ("POST", "/api/v1/seedance/tasks"),
    ("GET", "/api/v1/tasks/retired-task"),
])
async def test_removed_routes_are_not_reachable(method, path):
    # 本分支保留这些路由：未带凭证必须 401（上游断言 404 + 不在 OpenAPI 中）
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.request(method, path)
    assert response.status_code == 401
    assert any(route.startswith(("/api/v1/", "/api/user/api-keys")) for route in app.openapi()["paths"])


@pytest.mark.asyncio
async def test_retired_key_is_not_accepted_as_application_bearer():
    # 本分支 pf_live Key 走数据库查验（不当 JWT 解析）；查不到（未知/已撤销）则拒绝
    db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(first=lambda: None)))
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="pf_live_retired_test_key")
    assert await _user_from_bearer(db, creds.credentials) is None
    with pytest.raises(HTTPException) as error:
        await get_current_user(creds=creds, db=db)
    assert error.value.status_code == 401
    assert db.execute.await_count == 2


@pytest.mark.asyncio
async def test_valid_login_jwt_still_resolves_application_user(monkeypatch):
    user = SimpleNamespace(id=31)
    lookup = AsyncMock(return_value=user)
    monkeypatch.setattr("app.deps.decode_token", lambda token: "31")
    monkeypatch.setattr("app.deps.get_user_by_id", lookup)
    assert await _user_from_bearer(None, "login-jwt") is user
    lookup.assert_awaited_once_with(None, 31)


@pytest.mark.asyncio
async def test_key_header_cannot_authenticate_an_application_route():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/tasks/generations", headers={"X-Api-Key": "pf_live_retired_test_key"})
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["v1_image", "v1_video", "v1_seedance"])
async def test_generic_task_admission_cannot_recreate_removed_generations(kind):
    # 本分支保留 v1_* 类型，但只注册为 noop：生成在 /api/v1 请求内联完成，TaskRun 仅用于计费/留痕，
    # 调度器拿到这类任务也不会再次调用上游生成。
    from app.services.tasks.handlers import _noop_ephemeral

    handler = get_task_handler("api", kind)
    assert handler is not None and handler.executor is _noop_ephemeral
