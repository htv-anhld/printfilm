# -*- coding: utf-8 -*-
"""前端错误上报：截断、按 fingerprint 聚合、按 IP 简单限流（进程内令牌桶）。"""
from __future__ import annotations

import hashlib
import re
import threading
import time
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models_commerce import ClientErrorReport

# 每个 IP 每分钟最多上报次数
RATE_PER_MINUTE = 30
_lock = threading.Lock()
_buckets: dict[str, tuple[float, float]] = {}

# 指纹去掉易变部分：数字、hash 化的打包文件名、查询串
_VOLATILE = re.compile(r"(\d+|[a-f0-9]{8,}|\?[^\s)]*)", re.IGNORECASE)


def allow(ip: str, *, now: float | None = None) -> bool:
    """令牌桶：容量与每分钟补充量都是 RATE_PER_MINUTE。"""
    ts = time.monotonic() if now is None else now
    key = ip or "-"
    with _lock:
        tokens, last = _buckets.get(key, (float(RATE_PER_MINUTE), ts))
        tokens = min(float(RATE_PER_MINUTE), tokens + (ts - last) * RATE_PER_MINUTE / 60.0)
        if tokens < 1.0:
            _buckets[key] = (tokens, ts)
            return False
        _buckets[key] = (tokens - 1.0, ts)
        if len(_buckets) > 10_000:
            _buckets.clear()
        return True


def fingerprint(message: str, stack: str | None) -> str:
    """同一个 bug 在不同构建 / 行号上得到同一指纹。"""
    first_frames = "\n".join((stack or "").splitlines()[:3])
    norm = _VOLATILE.sub("#", f"{message}\n{first_frames}")
    return hashlib.sha256(norm.encode("utf-8", "ignore")).hexdigest()


def _clip(value: Any, size: int) -> str | None:
    text = str(value or "").strip()
    return text[:size] or None


async def record(db: AsyncSession, payload: dict[str, Any], *, user_id: int | None, user_agent: str | None) -> None:
    """写入或累加一条错误（PG upsert，避免并发上报撞唯一约束）。"""
    message = _clip(payload.get("message"), 1000) or "(empty)"
    stack = _clip(payload.get("stack"), 8000)
    now = datetime.now(UTC)
    values = {
        "fingerprint": fingerprint(message, stack),
        "message": message,
        "stack": stack,
        "url": _clip(payload.get("url"), 1000),
        "source": _clip(payload.get("source"), 32) or "window",
        "user_agent": _clip(user_agent, 512),
        "release": _clip(payload.get("release"), 64),
        "user_id": user_id,
        "count": 1,
        "first_seen_at": now,
        "last_seen_at": now,
    }
    stmt = insert(ClientErrorReport).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[ClientErrorReport.fingerprint],
        set_={
            "count": ClientErrorReport.count + 1,
            "last_seen_at": now,
            "url": stmt.excluded.url,
            "user_id": func.coalesce(stmt.excluded.user_id, ClientErrorReport.user_id),
            "release": stmt.excluded.release,
        },
    )
    await db.execute(stmt)


async def list_reports(db: AsyncSession, *, page: int, page_size: int, q: str = "") -> tuple[list[ClientErrorReport], int]:
    """管理端分页（最近出现在前）。"""
    base = select(ClientErrorReport)
    count_stmt = select(func.count(ClientErrorReport.id))
    if q.strip():
        like = f"%{q.strip()}%"
        base = base.where(ClientErrorReport.message.ilike(like))
        count_stmt = count_stmt.where(ClientErrorReport.message.ilike(like))
    total = int((await db.execute(count_stmt)).scalar() or 0)
    rows = (
        await db.execute(
            base.order_by(ClientErrorReport.last_seen_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()
    return list(rows), total
