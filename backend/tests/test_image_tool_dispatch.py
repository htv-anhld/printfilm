"""工具生图派发：先提交再派发、保留协程强引用、卡住的任务判失败。"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from app.models import ToolRun
from app.services import studio_tools as st
from tests.conftest import make_user


async def test_row_committed_before_dispatch(db_session, monkeypatch):
    user = await make_user(db_session, balance_fen=100_000)
    seen = {}

    async def no_balance_check(*_a, **_k):
        return None

    def fake_dispatch(run_id):
        # 派发时行必须已提交且带 task_id
        seen["in_tx"] = db_session.in_transaction()
        seen["run_id"] = run_id
        return f"local-{run_id}"

    commits = []
    real_commit = db_session.commit

    async def tracking_commit():
        commits.append(seen.get("run_id"))
        await real_commit()

    monkeypatch.setattr(st, "_ensure_image_tool_balance", no_balance_check)
    monkeypatch.setattr(st, "_dispatch_tool_image", fake_dispatch)
    monkeypatch.setattr(db_session, "commit", tracking_commit)
    out = await st.enqueue_image_tool(
        db_session, user, tool_id="t2i", prompt="cat astronaut", negative="", ratio="1:1",
        strength=None, mode=None, pack=None, files=[], params={},
    )
    assert commits == [None], "必须在派发之前提交"
    assert out["task_id"] == f"local-{seen['run_id']}"
    row = await db_session.get(ToolRun, seen["run_id"])
    assert row.task_id == out["task_id"]


async def test_dispatch_keeps_strong_reference(monkeypatch):
    started = asyncio.Event()
    release = asyncio.Event()

    async def fake_exec(run_id):
        started.set()
        await release.wait()

    monkeypatch.setattr(st, "execute_image_tool_run", fake_exec)
    st._dispatch_tool_image(42)
    await started.wait()
    assert len(st._IMAGE_TOOL_TASKS) == 1
    release.set()
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert len(st._IMAGE_TOOL_TASKS) == 0


async def test_stale_run_marked_failed(db_session):
    user = await make_user(db_session)
    old = datetime.now(UTC) - timedelta(seconds=st.IMAGE_TOOL_STALE_SEC + 60)
    stuck = ToolRun(user_id=user.id, tool_id="t2i", kind="image", status="running", prompt="x", task_id="local-stale")
    fresh = ToolRun(user_id=user.id, tool_id="t2i", kind="image", status="running", prompt="x", task_id="local-fresh")
    db_session.add_all([stuck, fresh])
    await db_session.flush()
    stuck.created_at = stuck.updated_at = old
    await db_session.flush()
    out = await st.poll_image_tool_task(db_session, user, "local-stale")
    assert out["status"] == "failed"
    assert (await st.poll_image_tool_task(db_session, user, "local-fresh"))["status"] == "running"
