# -*- coding: utf-8 -*-
"""充值订单入账：所有支付渠道（易支付 / Creem）共用，保证幂等与首充赠送一致。"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models import Order, User
from app.services.billing.settlement import credit_topup

logger = logging.getLogger(__name__)


async def first_topup_bonus_fen(
    db: AsyncSession,
    user_id: int,
    *,
    exclude_order_id: int | None = None,
    settings: Settings | None = None,
) -> int:
    """首充赠送：该用户此前没有任何已支付订单时返回配置值，否则 0。"""
    s = settings or get_settings()
    bonus = max(0, int(getattr(s, "billing_first_topup_bonus_fen", 0) or 0))
    if bonus <= 0:
        return 0
    stmt = select(func.count(Order.id)).where(Order.user_id == int(user_id), Order.status == "paid")
    if exclude_order_id is not None:
        stmt = stmt.where(Order.id != int(exclude_order_id))
    paid_before = int((await db.execute(stmt)).scalar() or 0)
    return 0 if paid_before else bonus


async def mark_order_paid(
    db: AsyncSession,
    order: Order,
    *,
    trade_no: str | None,
    note: str,
) -> bool:
    """把订单置为已支付并入账（含首充赠送）。

    调用方须已对 order 行加 FOR UPDATE 锁；已支付则直接返回 False（幂等）。
    不 commit，由调用方提交。
    """
    if order.status == "paid":
        return False
    user = await db.get(User, order.user_id)
    if user is None:
        raise ValueError(f"order {order.out_trade_no} user missing")
    bonus = await first_topup_bonus_fen(db, int(order.user_id), exclude_order_id=order.id)
    order.status = "paid"
    order.trade_no = trade_no or order.trade_no
    order.paid_at = datetime.now(timezone.utc)
    order.bonus_fen = bonus
    await credit_topup(
        db,
        user,
        int(order.credit_fen) + bonus,
        ref_type="order",
        ref_id=order.out_trade_no,
        note=note if not bonus else f"{note} +first_topup_bonus:{bonus}",
    )
    logger.info(
        "order paid order=%s user=%s credit=%s bonus=%s provider=%s",
        order.out_trade_no,
        user.id,
        order.credit_fen,
        bonus,
        order.provider,
    )
    return True
