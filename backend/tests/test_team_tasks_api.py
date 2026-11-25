"""统一任务列表的团队空间参数：上游已停用组织团队，带 team_id / X-Team-Id 一律 410。

原用例断言按团队空间筛选（200），上游代码自身已改为 410（_generation_workspace），此处跟随上游。
"""
from unittest.mock import AsyncMock
import httpx
import pytest
from fastapi import FastAPI
from app.api import tasks
from app.database import get_db
from app.deps import get_current_user
from app.models import User


@pytest.mark.asyncio
@pytest.mark.parametrize("query,header,expected", [("", "91", 91), ("?team_id=91", None, 91), ("", None, None)])
async def test_task_list_resolves_workspace_header(monkeypatch, query, header, expected):
    app = FastAPI()
    app.include_router(tasks.router)
    async def db():
        yield object()
    app.dependency_overrides[get_db] = db
    app.dependency_overrides[get_current_user] = lambda: User(id=1)
    listing = AsyncMock(return_value=([], 0))
    monkeypatch.setattr(tasks, "list_tasks_for_user", listing)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        response = await client.get("/tasks" + query, headers={"X-Team-Id": header} if header else {})
    if expected is not None:
        # 选了团队空间 → 410（独立团队已停用），不查询列表
        assert response.status_code == 410
        listing.assert_not_awaited()
        return
    assert response.status_code == 200
    assert listing.await_args.kwargs["team_id"] == expected


@pytest.mark.asyncio
async def test_task_list_rejects_inconsistent_workspace(monkeypatch):
    app = FastAPI()
    app.include_router(tasks.router)
    async def db():
        yield object()
    app.dependency_overrides[get_db] = db
    app.dependency_overrides[get_current_user] = lambda: User(id=1)
    listing = AsyncMock(return_value=([], 0))
    monkeypatch.setattr(tasks, "list_tasks_for_user", listing)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        response = await client.get("/tasks?team_id=92", headers={"X-Team-Id": "91"})
    assert response.status_code == 410
    listing.assert_not_awaited()
