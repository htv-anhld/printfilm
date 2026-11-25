# -*- coding: utf-8 -*-
"""Creem webhook：验签后的事件去重与分发。

事件结构：``{"id": "evt_…", "eventType": "checkout.completed", "created_at": …, "object": {…}}``。
各业务模块用 ``register`` 挂处理函数（credit 包在 creem_topup，订阅在 subscriptions）。
同一事件 id 只处理一次：先插入 payment_events（唯一约束），插入失败即视为重复。
"""
from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models_commerce import PaymentEvent

logger = logging.getLogger(__name__)

PROVIDER = "creem"

# 返回 (status, note)：status ∈ processed | ignored
Handler = Callable[[AsyncSession, dict[str, Any], dict[str, Any]], Awaitable[tuple[str, str]]]
_handlers: dict[str, list[Handler]] = {}


def register(event_type: str, handler: Handler) -> None:
    """为事件类型挂处理函数（同一类型可挂多个，按注册顺序执行）。"""
    bucket = _handlers.setdefault(event_type, [])
    if handler not in bucket:
        bucket.append(handler)


def registered_event_types() -> list[str]:
    """已注册的事件类型（测试 / 健康检查用）。"""
    return sorted(_handlers)


async def dispatch_event(db: AsyncSession, event: dict[str, Any]) -> tuple[str, str]:
    """处理一条已验签事件；返回 (status, note)。重复事件返回 ("duplicate", …)。

    调用方负责 commit。处理函数抛异常时整个事务回滚（含去重行），Creem 会重试。
    """
    event_id = str(event.get("id") or "").strip()
    event_type = str(event.get("eventType") or event.get("type") or "").strip()
    obj = event.get("object") if isinstance(event.get("object"), dict) else {}
    if not event_id or not event_type:
        return "ignored", "missing id/eventType"

    existing = (
        await db.execute(
            select(PaymentEvent.id).where(PaymentEvent.provider == PROVIDER, PaymentEvent.event_id == event_id)
        )
    ).scalar_one_or_none()
    if existing is not None:
        return "duplicate", event_id

    row = PaymentEvent(provider=PROVIDER, event_id=event_id, event_type=event_type, status="processing", payload=event)
    try:
        async with db.begin_nested():
            db.add(row)
            await db.flush()
    except IntegrityError:
        # 并发重放：另一个请求已插入
        return "duplicate", event_id

    handlers = _handlers.get(event_type) or []
    if not handlers:
        row.status, row.note = "ignored", "no handler"
        return "ignored", f"no handler for {event_type}"
    status, notes = "ignored", []
    for handler in handlers:
        st, note = await handler(db, obj, event)
        if st == "processed":
            status = "processed"
        if note:
            notes.append(note)
    row.status = status
    row.note = "; ".join(notes)[:255] or None
    logger.info("creem event %s %s -> %s %s", event_type, event_id, status, row.note or "")
    return status, row.note or ""


def metadata_of(obj: dict[str, Any]) -> dict[str, Any]:
    """取 object.metadata（Creem 原样回传下单时的 metadata）。"""
    meta = obj.get("metadata")
    return meta if isinstance(meta, dict) else {}


def id_of(value: Any) -> str:
    """Creem 字段可能是 ID 字符串或展开的对象。"""
    if isinstance(value, dict):
        return str(value.get("id") or "")
    return str(value or "")
