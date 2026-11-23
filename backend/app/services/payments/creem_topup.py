# -*- coding: utf-8 -*-
"""Creem 一次性 credit 包：下单 → checkout.completed 入账 → refund.created 扣回。"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any
from urllib.parse import urlencode

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.i18n import _
from app.models import Order, User
from app.services import creem
from app.services.billing.currency import billing_currency
from app.services.billing.orders import mark_order_paid
from app.services.billing.pricing import sku_by_id
from app.services.billing.settlement import _ledger, _lock_user
from app.services.payments import creem_webhook
from app.services.payments.creem_webhook import id_of, metadata_of

logger = logging.getLogger(__name__)

KIND_TOPUP = "topup"


def new_out_trade_no(user_id: int, prefix: str = "CR") -> str:
    """本地订单号（同时作为 Creem request_id）。"""
    return f"{prefix}{int(time.time())}{int(user_id):04d}{uuid.uuid4().hex[:8]}"


def app_url(path: str, **query: Any) -> str:
    """拼用户端站点地址（支付完成跳回）。"""
    base = (get_settings().app_public_url or "").rstrip("/")
    qs = urlencode({k: v for k, v in query.items() if v is not None})
    return f"{base}{path}{'?' + qs if qs else ''}"


def resolve_topup_product(sku_id: str) -> tuple[str, int | None]:
    """credit 包对应的 Creem 产品：逐包映射优先，否则通用产品 + custom_price。"""
    s = get_settings()
    mapped = creem.sku_product_map(s).get(sku_id)
    if mapped:
        return mapped, None
    generic = (s.creem_credit_product_id or "").strip()
    if not generic:
        raise ValueError(_("Creem 未配置 credit 产品（CREEM_CREDIT_PRODUCT_ID）"))
    sku = sku_by_id(sku_id) or {}
    return generic, int(sku.get("amount_fen") or 0)


async def create_topup_checkout(db: AsyncSession, user: User, sku_id: str) -> dict[str, Any]:
    """建待支付订单并向 Creem 申请 checkout；返回 {out_trade_no, checkout_url, ...}。"""
    if billing_currency() != "USD":
        raise ValueError(_("当前计费币种不支持该支付方式"))
    if not creem.creem_configured():
        raise ValueError(_("Creem 未配置 API Key"))
    sku = sku_by_id(sku_id)
    if not sku:
        raise ValueError(_("未知充值包"))
    product_id, custom_price = resolve_topup_product(sku["id"])
    out_trade_no = new_out_trade_no(int(user.id))
    order = Order(
        out_trade_no=out_trade_no,
        user_id=user.id,
        sku_id=sku["id"],
        amount_fen=int(sku["amount_fen"]),
        credit_fen=int(sku["credit_fen"]),
        pay_type="creem",
        status="pending",
        currency="USD",
        provider="creem",
    )
    db.add(order)
    await db.flush()
    checkout = await creem.create_checkout(
        product_id=product_id,
        request_id=out_trade_no,
        success_url=app_url("/pricing", paid="1", order=out_trade_no),
        customer_email=user.email,
        metadata={"kind": KIND_TOPUP, "out_trade_no": out_trade_no, "user_id": user.id, "sku_id": sku["id"]},
        custom_price=custom_price,
    )
    order.provider_ref = str(checkout.get("id") or "") or None
    await db.commit()
    return {
        "out_trade_no": out_trade_no,
        "sku_id": sku["id"],
        "amount_fen": order.amount_fen,
        "credit_fen": order.credit_fen,
        "pay_type": "creem",
        "checkout_url": checkout["checkout_url"],
        "checkout_id": order.provider_ref,
    }


async def _lock_order(db: AsyncSession, *, out_trade_no: str = "", checkout_id: str = "") -> Order | None:
    """按本地单号或 Creem checkout id 锁订单行。"""
    if out_trade_no:
        row = (
            await db.execute(select(Order).where(Order.out_trade_no == out_trade_no).with_for_update())
        ).scalar_one_or_none()
        if row is not None:
            return row
    if checkout_id:
        return (
            await db.execute(
                select(Order).where(Order.provider == "creem", Order.provider_ref == checkout_id).with_for_update()
            )
        ).scalar_one_or_none()
    return None


async def on_checkout_completed(db: AsyncSession, obj: dict[str, Any], _event: dict[str, Any]) -> tuple[str, str]:
    """credit 包付款完成：核对金额 / 币种后入账（订阅类 checkout 交给订阅模块）。"""
    meta = metadata_of(obj)
    if meta.get("kind") != KIND_TOPUP:
        return "ignored", "not topup"
    out_trade_no = str(meta.get("out_trade_no") or obj.get("request_id") or "")
    order = await _lock_order(db, out_trade_no=out_trade_no, checkout_id=id_of(obj))
    if order is None:
        logger.error("creem checkout.completed unknown order %s", out_trade_no)
        return "ignored", f"unknown order {out_trade_no}"
    if order.status == "paid":
        return "ignored", "already paid"
    pay = obj.get("order") if isinstance(obj.get("order"), dict) else {}
    paid = pay.get("amount_paid", pay.get("amount"))
    currency = str(pay.get("currency") or "").upper()
    # 金额 / 币种必须对得上，防止改价 checkout 套 credit。税费由 Creem 另收，不在 amount 内比较 sub_total
    expected = int(order.amount_fen)
    sub_total = pay.get("sub_total")
    candidates = {int(v) for v in (paid, sub_total, pay.get("amount")) if isinstance(v, (int, float))}
    if currency and currency != (order.currency or "USD").upper():
        logger.error("creem currency mismatch order=%s expect=%s got=%s", order.out_trade_no, order.currency, currency)
        return "ignored", "currency mismatch"
    if candidates and expected not in candidates:
        logger.error("creem amount mismatch order=%s expect=%s got=%s", order.out_trade_no, expected, candidates)
        return "ignored", "amount mismatch"
    order.provider_ref = order.provider_ref or id_of(obj) or None
    await mark_order_paid(db, order, trade_no=id_of(pay) or id_of(obj) or None, note="creem")
    return "processed", f"paid {order.out_trade_no}"


async def on_refund_created(db: AsyncSession, obj: dict[str, Any], _event: dict[str, Any]) -> tuple[str, str]:
    """退款成功：按退款比例扣回 credit（含首充赠送）；余额可为负，表示欠费。"""
    checkout = obj.get("checkout") if isinstance(obj.get("checkout"), dict) else {}
    out_trade_no = str(metadata_of(checkout).get("out_trade_no") or checkout.get("request_id") or "")
    order = await _lock_order(db, out_trade_no=out_trade_no, checkout_id=id_of(checkout))
    if order is None:
        return "ignored", "refund not for a topup order"
    if order.status == "refunded":
        return "ignored", "already refunded"
    if order.status != "paid":
        return "ignored", f"order status {order.status}"
    total = int(order.amount_fen or 0)
    refunded = int(obj.get("refund_amount") or total)
    granted = int(order.credit_fen or 0) + int(order.bonus_fen or 0)
    claw = granted if total <= 0 else min(granted, round(granted * refunded / total))
    user = await _lock_user(db, int(order.user_id))
    if user is None:
        return "ignored", "user missing"
    await _ledger(db, user, -claw, "refund", ref_type="order", ref_id=order.out_trade_no, note=f"creem refund {id_of(obj)}")
    if refunded >= total:
        order.status = "refunded"
    await db.flush()
    logger.warning("creem refund order=%s clawback=%s balance_after=%s", order.out_trade_no, claw, user.balance_fen)
    return "processed", f"refund {order.out_trade_no} -{claw}"


creem_webhook.register("checkout.completed", on_checkout_completed)
creem_webhook.register("refund.created", on_refund_created)
