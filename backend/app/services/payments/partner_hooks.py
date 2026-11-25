# -*- coding: utf-8 -*-
"""Creem 事件 → 合作伙伴佣金：订阅扣款计佣、任意退款冲正。

credit 包在 mark_order_paid 里计佣；这里只处理订阅。
同一次扣款 checkout.completed 与 subscription.paid 都会到：统一用 transaction id 做来源单号，靠唯一约束去重。
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models_commerce import Subscription
from app.services.partners import record_commission, reverse_commission
from app.services.payments import creem_webhook
from app.services.payments.creem_webhook import id_of, metadata_of


def _amount(block: dict[str, Any]) -> int:
    for key in ("amount_paid", "amount"):
        value = block.get(key)
        if isinstance(value, (int, float)) and value > 0:
            return int(value)
    return 0


async def _subscription_user(db: AsyncSession, sub_id: str) -> int | None:
    from sqlalchemy import select

    row = (await db.execute(select(Subscription.user_id).where(Subscription.provider_sub_id == sub_id))).first()
    return int(row[0]) if row else None


async def on_checkout_completed(db: AsyncSession, obj: dict[str, Any], _event: dict[str, Any]) -> tuple[str, str]:
    """订阅首付计佣（credit 包已在入账时计过）。"""
    meta = metadata_of(obj)
    if meta.get("kind") != "subscription":
        return "ignored", ""
    order = obj.get("order") if isinstance(obj.get("order"), dict) else {}
    sub = obj.get("subscription") if isinstance(obj.get("subscription"), dict) else {}
    user_id = await _subscription_user(db, id_of(sub)) if sub else None
    if user_id is None and str(meta.get("user_id") or "").isdigit():
        user_id = int(meta["user_id"])
    tx = id_of(order.get("transaction")) or id_of(order)
    if user_id is None or not tx:
        return "ignored", ""
    row = await record_commission(
        db, user_id=user_id, paid_fen=_amount(order), source_type="subscription", source_id=tx,
        alt_refs=[id_of(order), id_of(obj)],
    )
    return ("processed", "commission") if row else ("ignored", "")


async def on_subscription_paid(db: AsyncSession, obj: dict[str, Any], _event: dict[str, Any]) -> tuple[str, str]:
    """续费扣款计佣。"""
    tx_block = obj.get("last_transaction") if isinstance(obj.get("last_transaction"), dict) else {}
    tx = id_of(tx_block) or str(obj.get("last_transaction_id") or "")
    user_id = await _subscription_user(db, id_of(obj))
    if user_id is None or not tx:
        return "ignored", ""
    row = await record_commission(
        db, user_id=user_id, paid_fen=_amount(tx_block), source_type="subscription", source_id=tx,
        alt_refs=[id_of(tx_block.get("order"))],
    )
    return ("processed", "commission") if row else ("ignored", "")


async def on_refund_created(db: AsyncSession, obj: dict[str, Any], _event: dict[str, Any]) -> tuple[str, str]:
    """任意退款：按订单号 / 交易号 / checkout 冲正佣金。"""
    checkout = obj.get("checkout") if isinstance(obj.get("checkout"), dict) else {}
    refs = [
        str(metadata_of(checkout).get("out_trade_no") or ""),
        str(checkout.get("request_id") or ""),
        id_of(checkout),
        id_of(obj.get("order")),
        id_of(obj.get("transaction")),
    ]
    n = await reverse_commission(db, refs)
    return ("processed", f"reversed {n}") if n else ("ignored", "")


creem_webhook.register("checkout.completed", on_checkout_completed)
creem_webhook.register("subscription.paid", on_subscription_paid)
creem_webhook.register("refund.created", on_refund_created)
