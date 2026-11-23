# -*- coding: utf-8 -*-
"""Billing wallet + epay top-up APIs."""
from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import _
from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Order, Project, UsageEvent, User
from app.models_tasks import TaskRun
from app.services import billing, epay
from app.services.billing.currency import billing_currency, currency_symbol, format_money
from app.services.billing.http import http_exception_for_value_error
from app.services.billing.orders import mark_order_paid
from app.services.billing.settlement import (
    billing_active,
    ensure_balance_for_task_batch,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])
settings = get_settings()


class CreateOrderBody(BaseModel):
    sku_id: str
    pay_type: Literal["alipay", "wxpay"]


def _epay_pay_types() -> list[str]:
    """易支付只收人民币；美元计费时不提供。"""
    return ["alipay", "wxpay"] if billing_currency() == "CNY" else []


def available_pay_types() -> list[str]:
    """当前币种可用的支付方式：CNY → 易支付；USD → Creem（已配置 Key 时）。"""
    from app.services import creem

    types = _epay_pay_types()
    if billing_currency() == "USD" and creem.creem_configured():
        types.append("creem")
    return types


@router.get("/config")
async def billing_config() -> dict:
    """前端展示计费所需的全站配置（币种、换算、赠送、可用支付方式）。"""
    s = get_settings()
    return {
        "billing_enabled": bool(s.billing_enabled),
        "currency": billing_currency(s),
        "symbol": currency_symbol(s),
        # 钱包整数单位：USD 下 1 = 1 credit = 1 美分
        "unit": "credit" if billing_currency(s) == "USD" else "fen",
        "units_per_major": 100,
        "signup_grant_fen": int(s.billing_signup_grant_fen or 0),
        "first_topup_bonus_fen": int(s.billing_first_topup_bonus_fen or 0),
        "pay_types": available_pay_types(),
    }


@router.get("/wallet")
async def wallet(user: User = Depends(get_current_user)) -> dict:
    s = get_settings()
    return {
        "balance_fen": int(user.balance_fen or 0),
        "frozen_fen": int(user.frozen_fen or 0),
        # *_yuan 是历史字段名，含义为「计费币种主单位」（USD 下即美元）
        "balance_yuan": round(int(user.balance_fen or 0) / 100, 2),
        "frozen_yuan": round(int(user.frozen_fen or 0) / 100, 2),
        "currency": billing_currency(s),
        "symbol": currency_symbol(s),
        "balance_display": format_money(int(user.balance_fen or 0), s),
        "plan": user.plan or "free",
        "billing_enabled": s.billing_enabled,
        "markup": s.billing_markup,
    }


@router.get("/skus")
async def list_skus() -> dict:
    s = get_settings()
    return {
        # 套餐名按请求语言展示；下单给支付网关的商品名仍用中文原文
        "skus": [{**item, "name": _(str(item["name"]))} for item in billing.active_skus(s)],
        "currency": billing_currency(s),
        "symbol": currency_symbol(s),
        "pay_types": available_pay_types(),
        "markup": s.billing_markup,
        "first_topup_bonus_fen": int(s.billing_first_topup_bonus_fen or 0),
    }


@router.get("/preflight")
async def billing_preflight(
    domain: str = Query(..., min_length=1),
    task_type: str = Query(..., min_length=1),
    count: int = Query(1, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """入队前余额预检：返回单项估算与批量总需求。"""
    if not billing_active(user):
        return {
            "ok": True,
            "billing_enabled": False,
            "balance_fen": int(user.balance_fen or 0),
            "unit_estimate_fen": 0,
            "pending_commitment_fen": 0,
            "requested_total_fen": 0,
            "required_total_fen": 0,
        }
    probe = TaskRun(
        domain=domain.strip(),
        task_type=task_type.strip(),
        requested_by=user.id,
        payload={},
    )
    try:
        summary = await ensure_balance_for_task_batch(db, user, probe, count)
    except ValueError as exc:
        raise http_exception_for_value_error(exc) from exc
    return {
        "ok": True,
        "billing_enabled": True,
        "balance_fen": summary["balance_fen"],
        "balance_yuan": round(summary["balance_fen"] / 100, 2),
        "unit_estimate_fen": summary["unit_estimate_fen"],
        "unit_estimate_yuan": round(summary["unit_estimate_fen"] / 100, 2),
        "pending_commitment_fen": summary["pending_commitment_fen"],
        "pending_commitment_yuan": round(summary["pending_commitment_fen"] / 100, 2),
        "requested_total_fen": summary["requested_total_fen"],
        "requested_total_yuan": round(summary["requested_total_fen"] / 100, 2),
        "required_total_fen": summary["required_total_fen"],
        "required_total_yuan": round(summary["required_total_fen"] / 100, 2),
        "count": int(count),
        "domain": domain.strip(),
        "task_type": task_type.strip(),
    }


def _client_ip(request: Request) -> str:
    """Prefer proxy headers, fall back to direct peer address."""
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    real = (request.headers.get("x-real-ip") or "").strip()
    if real:
        return real
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


@router.post("/orders")
async def create_order(
    body: CreateOrderBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    # 下单前先清理该用户已过期的待支付单
    await billing.close_expired_pending_orders(db, user_id=user.id)
    if body.pay_type not in _epay_pay_types():
        raise HTTPException(status_code=400, detail=_("当前计费币种不支持该支付方式"))
    sku = billing.sku_by_id(body.sku_id)
    if not sku:
        raise HTTPException(status_code=400, detail=_("未知充值包"))
    out_trade_no = f"PF{int(time.time())}{user.id:04d}{uuid.uuid4().hex[:8]}"
    order = Order(
        out_trade_no=out_trade_no,
        user_id=user.id,
        sku_id=sku["id"],
        amount_fen=int(sku["amount_fen"]),
        credit_fen=int(sku["credit_fen"]),
        pay_type=body.pay_type,
        status="pending",
        currency=billing_currency(),
        provider="epay",
    )
    db.add(order)
    await db.commit()
    money_yuan = epay.money_yuan_from_fen(int(sku["amount_fen"]))
    try:
        mapi = await epay.create_mapi_payment(
            out_trade_no=out_trade_no,
            name=str(sku["name"]),
            money_yuan=money_yuan,
            pay_type=body.pay_type,
            clientip=_client_ip(request),
        )
        fields = epay.build_submit_fields(
            out_trade_no=out_trade_no,
            name=str(sku["name"]),
            money_yuan=money_yuan,
            pay_type=body.pay_type,
            clientip=_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "out_trade_no": out_trade_no,
        "sku_id": sku["id"],
        "sku_name": _(str(sku["name"])),
        "pay_type": body.pay_type,
        "amount_fen": order.amount_fen,
        "credit_fen": order.credit_fen,
        "trade_no": mapi.get("trade_no") or "",
        "qrcode": mapi.get("qrcode") or "",
        "payurl": mapi.get("payurl") or "",
        "img": mapi.get("img") or "",
        "qr_payload": mapi.get("qr_payload") or "",
        "pay_mode": mapi.get("pay_mode") or ("qr" if mapi.get("qr_payload") else "redirect"),
        "expire_seconds": billing.ORDER_EXPIRE_SECONDS,
        "submit_url": epay.submit_url(fields),
    }


@router.get("/usage/summary")
async def usage_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """本月 token / 费用汇总，供历史页侧栏展示。"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(
            func.coalesce(func.sum(UsageEvent.total_tokens), 0),
            func.coalesce(func.sum(UsageEvent.charge_fen), 0),
            func.coalesce(func.sum(UsageEvent.cost_fen), 0),
            func.count(UsageEvent.id),
        ).where(
            UsageEvent.user_id == user.id,
            UsageEvent.created_at >= month_start,
        )
    )
    tokens, charge_fen, cost_fen, calls = result.one()
    return {
        "period": month_start.strftime("%Y-%m"),
        "tokens": int(tokens or 0),
        "charge_fen": int(charge_fen or 0),
        "charge_yuan": round(int(charge_fen or 0) / 100, 2),
        "cost_fen": int(cost_fen or 0),
        "calls": int(calls or 0),
        "balance_fen": int(user.balance_fen or 0),
        "balance_yuan": round(int(user.balance_fen or 0) / 100, 2),
        "frozen_fen": int(user.frozen_fen or 0),
        "frozen_yuan": round(int(user.frozen_fen or 0) / 100, 2),
    }


@router.get("/alerts/pending")
async def billing_alerts_pending(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """待展示的用户额度告警（弹窗）。"""
    from app.services.billing.alerts import list_pending_user_alerts

    rows = await list_pending_user_alerts(db, user.id)
    await db.commit()
    return {
        "items": [
            {
                "id": row.id,
                "kind": row.kind,
                "title": row.title,
                "message": row.message,
                "milestone_fen": int(row.milestone_fen or 0),
                "milestone_yuan": round(int(row.milestone_fen or 0) / 100, 2),
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]
    }


@router.post("/alerts/{alert_id}/ack")
async def billing_alert_ack(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.services.billing.alerts import acknowledge_user_alert

    ok = await acknowledge_user_alert(db, user.id, alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail=_("告警不存在"))
    await db.commit()
    return {"ok": True}


@router.get("/usage/events")
async def usage_events(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """分页返回当前用户的按次扣费记录（新→旧）。"""
    from app.models_drama import DramaProject

    count_stmt = select(func.count()).select_from(UsageEvent).where(UsageEvent.user_id == user.id)
    total = int((await db.execute(count_stmt)).scalar_one() or 0)

    stmt = (
        select(UsageEvent, Project.title, DramaProject.title)
        .outerjoin(Project, UsageEvent.project_id == Project.id)
        .outerjoin(DramaProject, UsageEvent.drama_project_id == DramaProject.id)
        .where(UsageEvent.user_id == user.id)
        .order_by(UsageEvent.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()

    items = []
    for ev, kepu_title, drama_title in rows:
        if drama_title:
            context = _("漫剧 · {title}", title=drama_title)
        elif kepu_title:
            context = _("科普 · {title}", title=kepu_title)
        elif ev.project_id:
            context = _("科普 · 项目 #{id}", id=ev.project_id)
        elif ev.drama_project_id:
            context = _("漫剧 · 项目 #{id}", id=ev.drama_project_id)
        else:
            context = _("工具创作")
        charge_fen = int(ev.charge_fen or 0)
        items.append(
            {
                "id": ev.id,
                "billing_key": ev.billing_key,
                "billing_label": billing.billing_key_label(ev.billing_key),
                "model": ev.model or "",
                "context": context,
                "total_tokens": int(ev.total_tokens or 0),
                "charge_fen": charge_fen,
                "charge_yuan": round(charge_fen / 100, 2),
                "estimated": bool(ev.estimated),
                "created_at": ev.created_at.isoformat() if ev.created_at else None,
            }
        )
    return {
        "items": items,
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.get("/orders")
async def list_orders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
) -> dict:
    """充值订单列表（新→旧）；返回前自动关闭过期待支付单。"""
    await billing.close_expired_pending_orders(db, user_id=user.id)
    result = await db.execute(
        select(Order)
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    items = []
    for o in rows:
        sku = billing.sku_by_id(o.sku_id) or {}
        items.append(
            {
                "out_trade_no": o.out_trade_no,
                "sku_id": o.sku_id,
                "sku_name": str(sku.get("name") or o.sku_id),
                "amount_fen": o.amount_fen,
                "credit_fen": o.credit_fen,
                "pay_type": o.pay_type,
                "status": o.status,
                "trade_no": o.trade_no,
                "paid_at": o.paid_at.isoformat() if o.paid_at else None,
                "currency": o.currency or "CNY",
                "provider": o.provider or "epay",
                "bonus_fen": int(o.bonus_fen or 0),
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
        )
    return {"orders": items}


@router.get("/orders/{out_trade_no}")
async def get_order(
    out_trade_no: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    await billing.close_expired_pending_orders(db, user_id=user.id, out_trade_no=out_trade_no)
    result = await db.execute(select(Order).where(Order.out_trade_no == out_trade_no))
    order = result.scalar_one_or_none()
    if not order or order.user_id != user.id:
        raise HTTPException(status_code=404, detail=_("订单不存在"))
    return {
        "out_trade_no": order.out_trade_no,
        "status": order.status,
        "amount_fen": order.amount_fen,
        "credit_fen": order.credit_fen,
        "pay_type": order.pay_type,
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "currency": order.currency or "CNY",
        "provider": order.provider or "epay",
        "bonus_fen": int(order.bonus_fen or 0),
    }


@router.post("/orders/{out_trade_no}/close")
async def close_order(
    out_trade_no: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """用户主动取消支付时关闭待支付订单（过期订单由系统自动关闭）。"""
    result = await db.execute(select(Order).where(Order.out_trade_no == out_trade_no))
    order = result.scalar_one_or_none()
    if not order or order.user_id != user.id:
        raise HTTPException(status_code=404, detail=_("订单不存在"))
    if order.status == "paid":
        raise HTTPException(status_code=400, detail=_("已支付订单无法关闭"))
    if order.status == "closed":
        return {"out_trade_no": order.out_trade_no, "status": "closed"}
    if order.status != "pending":
        raise HTTPException(status_code=400, detail=_("当前状态不可关闭"))
    order.status = "closed"
    await db.commit()
    return {"out_trade_no": order.out_trade_no, "status": "closed"}


def _notify_success(params: dict) -> bool:
    """判断易支付回调是否支付成功（兼容 trade_status/status 两种字段）。"""
    status = str(params.get("trade_status") or params.get("status") or "").strip().upper()
    return status in {"TRADE_SUCCESS", "SUCCESS", "1"}


@router.api_route("/epay/notify", methods=["GET", "POST"])
async def epay_notify(request: Request, db: AsyncSession = Depends(get_db)) -> PlainTextResponse:
    if request.method == "POST":
        form = await request.form()
        params = {k: str(v) for k, v in form.items()}
    else:
        params = {k: str(v) for k, v in request.query_params.items()}

    if not epay.verify(params):
        logger.warning("epay notify bad sign: %s", params)
        return PlainTextResponse("fail", status_code=400)

    if not _notify_success(params):
        return PlainTextResponse("success")

    out_trade_no = str(params.get("out_trade_no") or "")
    trade_no = str(params.get("trade_no") or params.get("transaction_id") or "")
    money = str(params.get("money") or "")
    if not out_trade_no:
        return PlainTextResponse("fail", status_code=400)

    # 行锁串行化同一订单的并发回调：第二个回调在锁释放后读到 paid 即幂等返回，
    # 避免重复入账（易支付会对同一笔支付重发多次 notify）。
    result = await db.execute(
        select(Order).where(Order.out_trade_no == out_trade_no).with_for_update()
    )
    order = result.scalar_one_or_none()
    if not order:
        logger.warning("epay notify unknown order %s", out_trade_no)
        return PlainTextResponse("fail", status_code=404)

    # amount check
    try:
        paid_fen = int(round(float(money) * 100))
    except ValueError:
        paid_fen = order.amount_fen
    if paid_fen != int(order.amount_fen):
        logger.error(
            "epay amount mismatch order=%s expect=%s got=%s",
            out_trade_no,
            order.amount_fen,
            paid_fen,
        )
        return PlainTextResponse("fail", status_code=400)

    if order.status == "paid":
        return PlainTextResponse("success")

    try:
        await mark_order_paid(db, order, trade_no=trade_no or None, note=f"epay:{order.pay_type}")
    except ValueError:
        return PlainTextResponse("fail", status_code=404)
    await db.commit()
    return PlainTextResponse("success")



class CreemCheckoutBody(BaseModel):
    sku_id: str


@router.post("/creem/checkout")
async def creem_checkout(
    body: CreemCheckoutBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """credit 包走 Creem 托管收银台：返回 checkout_url，前端整页跳转。"""
    from app.services.creem import CreemError
    from app.services.payments.creem_topup import create_topup_checkout

    await billing.close_expired_pending_orders(db, user_id=user.id)
    try:
        return await create_topup_checkout(db, user, body.sku_id)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CreemError as exc:
        await db.rollback()
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/creem/webhook")
async def creem_webhook_endpoint(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Creem 回调：原始请求体验签 → 事件去重 → 分发（credit 包 / 订阅 / 退款）。

    验签失败返回 401（Creem 不会把它当成功）；处理异常返回 500 让 Creem 重试。
    """
    import json as _json

    from app.services import creem
    from app.services.payments import creem_topup  # noqa: F401  注册 credit 包处理函数
    from app.services.payments.creem_webhook import dispatch_event

    _register_optional_creem_handlers()
    raw = await request.body()
    if not creem.verify_webhook_signature(raw, request.headers.get("creem-signature")):
        logger.warning("creem webhook bad signature")
        raise HTTPException(status_code=401, detail="invalid signature")
    try:
        event = _json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="invalid json") from exc
    if not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="invalid payload")
    try:
        status, note = await dispatch_event(db, event)
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("creem webhook handler failed event=%s", event.get("id"))
        raise HTTPException(status_code=500, detail="handler failed") from None
    return {"ok": True, "status": status, "note": note}


def _register_optional_creem_handlers() -> None:
    """挂载其它模块的 Creem 事件处理（订阅等）；模块不存在时跳过。"""
    import importlib

    for name in ("app.services.payments.subscriptions",):
        try:
            importlib.import_module(name)
        except ModuleNotFoundError:
            continue
