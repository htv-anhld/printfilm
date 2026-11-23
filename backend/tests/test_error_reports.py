"""前端错误上报：限流、指纹聚合、upsert 计数。"""

from __future__ import annotations

from sqlalchemy import select

from app.models_commerce import ClientErrorReport
from app.services import error_reports as er


def test_rate_limit_bucket():
    ip = "203.0.113.9"
    allowed = sum(er.allow(ip, now=100.0) for _ in range(er.RATE_PER_MINUTE + 5))
    assert allowed == er.RATE_PER_MINUTE
    assert er.allow(ip, now=100.0 + 60.0)  # 一分钟后补满


def test_fingerprint_ignores_volatile_parts():
    a = er.fingerprint("TypeError: x is undefined", "at f (index-abc12345.js:10:5)")
    b = er.fingerprint("TypeError: x is undefined", "at f (index-def67890.js:99:1)")
    c = er.fingerprint("TypeError: y is undefined", "at f (index-abc12345.js:10:5)")
    assert a == b != c


async def test_record_upserts_count(db_session):
    payload = {"message": "Boom 1", "stack": "at a (x.js:1:1)", "url": "/pricing", "source": "window"}
    await er.record(db_session, payload, user_id=None, user_agent="UA")
    await er.record(db_session, {**payload, "message": "Boom 2", "url": "/studio"}, user_id=7, user_agent="UA")
    rows = (await db_session.execute(select(ClientErrorReport))).scalars().all()
    mine = [r for r in rows if r.message.startswith("Boom")]
    assert len(mine) == 1  # 数字被归一，同一指纹
    await db_session.refresh(mine[0])
    assert mine[0].count == 2 and mine[0].user_id == 7 and mine[0].url == "/studio"
    items, total = await er.list_reports(db_session, page=1, page_size=10, q="Boom")
    assert total >= 1 and items[0].message.startswith("Boom")
