# -*- coding: utf-8 -*-
"""Creem 订阅：下单、webhook 同步、月额度发放 / 过期、升级、门户、调度维护。

额度模型（不引入第二个钱包）：``users.sub_credit_fen`` 标记 ``balance_fen`` 里属于月额度的部分，
``_ledger`` 扣费时优先消耗它；新计费月开始时先把剩余月额度过期（ledger ``sub_expire``），再发新额度
（``sub_grant``）。年付也按月发放：``next_grant_at`` 由调度维护推进。
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.i18n import _
from app.models import User
from app.models_commerce import Subscription, SubscriptionGrant
from app.services import creem
from app.services.billing.currency import billing_currency
from app.services.billing.settlement import _ledger, _lock_user
from app.services.payments import creem_webhook
from app.services.payments.creem_topup import app_url, new_out_trade_no
from app.services.payments.creem_webhook import id_of, metadata_of
from app.services.subscriptions.plans import (
    INTERVALS,
    LIVE_STATUSES,
    plan_by_id,
    plan_credits,
    plan_from_product,
    product_for,
)

logger = logging.getLogger(__name__)

KIND_SUBSCRIPTION = "subscription"
# 续费 webhook 没来时，期末后再等多久判定过期（Creem 的 expired 事件最多晚一天）
RENEWAL_GRACE = timedelta(days=2)
# 结束权益的状态
ENDED_STATUSES = ("canceled", "expired", "unpaid", "paused")


# ── 时间工具 ─────────────────────────────────────────────


def _parse_dt(value: Any) -> datetime | None:
    """Creem 的 ISO 8601 时间 → aware datetime。"""
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _add_months(dt: datetime, months: int) -> datetime:
    """加 N 个自然月（月末日对齐到目标月最后一天）。"""
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    import calendar

    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def billing_month_start(period_start: datetime, now: datetime) -> datetime:
    """包含 now 的计费月起点（年付从周期起点按月切分；月付即周期起点）。"""
    start = period_start
    for _i in range(0, 24):
        nxt = _add_months(start, 1)
        if nxt > now:
            return start
        start = nxt
    return start


def _aware(dt: datetime | None) -> datetime | None:
    """数据库读回的时间可能是 naive（按 UTC 解释）。"""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


# ── 查询 ─────────────────────────────────────────────────


async def live_subscription(db: AsyncSession, user_id: int, *, team_id: int | None = None) -> Subscription | None:
    """当前有效订阅（最新一条）：team_id 为空查个人订阅，否则查该团队的席位订阅。"""
    team_clause = Subscription.team_id.is_(None) if team_id is None else Subscription.team_id == int(team_id)
    return (
        await db.execute(
            select(Subscription)
            .where(Subscription.user_id == int(user_id), Subscription.status.in_(LIVE_STATUSES), team_clause)
            .order_by(Subscription.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def _last_customer_id(db: AsyncSession, user_id: int) -> str | None:
    """复用历史订阅的 Creem customer id，避免同一人在 Creem 里多个客户。"""
    return (
        await db.execute(
            select(Subscription.provider_customer_id)
            .where(Subscription.user_id == int(user_id), Subscription.provider_customer_id.is_not(None))
            .order_by(Subscription.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


def subscription_out(sub: Subscription | None, user: User | None = None) -> dict[str, Any]:
    """前端展示用的订阅摘要。"""
    if sub is None:
        return {
            "plan_id": "free",
            "status": "none",
            "sub_credit_fen": int(getattr(user, "sub_credit_fen", 0) or 0) if user else 0,
        }
    plan = plan_by_id(sub.plan_id) or {}
    return {
        "id": sub.id,
        "plan_id": sub.plan_id,
        "plan_name": plan.get("name") or sub.plan_id,
        "interval": sub.interval,
        "status": sub.status,
        "credits_per_period": int(sub.credits_per_period or 0),
        "max_concurrent": int(sub.max_concurrent or 0),
        "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "next_grant_at": sub.next_grant_at.isoformat() if sub.next_grant_at else None,
        "cancel_at_period_end": bool(sub.cancel_at_period_end),
        "sub_credit_fen": int(getattr(user, "sub_credit_fen", 0) or 0) if user else 0,
        "can_manage": bool(sub.provider_customer_id),
    }


# ── 下单 / 升级 / 门户 / 取消 ────────────────────────────


def _require_creem() -> None:
    """订阅只在 USD + Creem 可用时开放。"""
    if billing_currency() != "USD":
        raise ValueError(_("订阅仅在美元计费时可用"))
    if not creem.creem_configured():
        raise ValueError(_("Creem 未配置 API Key"))


def _plan_product(plan_id: str, interval: str) -> tuple[dict[str, Any], str]:
    """校验套餐与周期并取 Creem 产品。"""
    plan = plan_by_id(plan_id)
    if plan is None or interval not in INTERVALS:
        raise ValueError(_("未知订阅套餐"))
    product = product_for(plan["id"], interval)
    if not product:
        raise ValueError(_("该套餐暂未开放购买"))
    return plan, product


async def create_subscription_checkout(db: AsyncSession, user: User, plan_id: str, interval: str) -> dict[str, Any]:
    """新订阅走 Creem 收银台；已有有效订阅时要求改用升级接口。"""
    _require_creem()
    plan, product = _plan_product(plan_id, interval)
    if await live_subscription(db, int(user.id)) is not None:
        raise ValueError(_("你已有订阅，请使用升级 / 变更套餐"))
    request_id = new_out_trade_no(int(user.id), "SB")
    checkout = await creem.create_checkout(
        product_id=product,
        request_id=request_id,
        success_url=app_url("/pricing", subscribed="1"),
        customer_email=None if (cid := await _last_customer_id(db, int(user.id))) else user.email,
        customer_id=cid,
        metadata={"kind": KIND_SUBSCRIPTION, "user_id": user.id, "plan_id": plan["id"], "interval": interval},
    )
    return {"checkout_url": checkout["checkout_url"], "request_id": request_id}


async def change_plan(db: AsyncSession, user: User, plan_id: str, interval: str) -> dict[str, Any]:
    """已有订阅换套餐（Creem 按比例立即补差价）；额度差额在 subscription.update 回调里补发。"""
    _require_creem()
    _plan, product = _plan_product(plan_id, interval)
    sub = await live_subscription(db, int(user.id))
    if sub is None:
        raise ValueError(_("当前没有订阅"))
    if sub.plan_id == plan_id and sub.interval == interval:
        raise ValueError(_("已经是该套餐"))
    data = await creem.upgrade_subscription(sub.provider_sub_id, product)
    if isinstance(data, dict) and data.get("id"):
        await upsert_from_creem(db, data)
    await db.commit()
    return subscription_out(await live_subscription(db, int(user.id)), user)


async def portal_link(db: AsyncSession, user: User) -> str:
    """Creem 客户门户（改卡、发票、期末取消）。"""
    customer_id = await _last_customer_id(db, int(user.id))
    if not customer_id:
        raise ValueError(_("当前没有可管理的订阅"))
    return await creem.customer_portal_link(customer_id)


async def cancel(db: AsyncSession, user: User) -> dict[str, Any]:
    """立即取消订阅（期末取消请走客户门户）。"""
    sub = await live_subscription(db, int(user.id))
    if sub is None:
        raise ValueError(_("当前没有订阅"))
    data = await creem.cancel_subscription(sub.provider_sub_id)
    if isinstance(data, dict) and data.get("status"):
        await upsert_from_creem(db, {**data, "id": sub.provider_sub_id})
    await db.commit()
    return subscription_out(await live_subscription(db, int(user.id)) or sub, user)


# ── 同步 / 发放 / 过期 ───────────────────────────────────


async def _resolve_user(db: AsyncSession, obj: dict[str, Any], meta: dict[str, Any], existing: Subscription | None) -> User | None:
    """订阅归属：已有记录 > metadata.user_id > 客户邮箱。"""
    if existing is not None:
        return await db.get(User, existing.user_id)
    uid = meta.get("user_id")
    if uid and str(uid).isdigit():
        user = await db.get(User, int(uid))
        if user is not None:
            return user
    customer = obj.get("customer") if isinstance(obj.get("customer"), dict) else {}
    email = str(customer.get("email") or "").strip().lower()
    if email:
        return (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    return None


async def upsert_from_creem(
    db: AsyncSession,
    obj: dict[str, Any],
    *,
    meta: dict[str, Any] | None = None,
) -> Subscription | None:
    """用 Creem 订阅对象创建 / 更新本地订阅，并同步 users.plan 与权益。"""
    sub_id = id_of(obj)
    if not sub_id:
        return None
    meta = {**metadata_of(obj), **(meta or {})}
    existing = (
        await db.execute(select(Subscription).where(Subscription.provider_sub_id == sub_id).with_for_update())
    ).scalar_one_or_none()
    product_id = id_of(obj.get("product"))
    if not product_id and isinstance(obj.get("items"), list) and obj["items"]:
        product_id = str(obj["items"][0].get("product_id") or "")
    plan, interval = plan_from_product(product_id)
    if plan is None:
        plan = plan_by_id(str(meta.get("plan_id") or "")) or (plan_by_id(existing.plan_id) if existing else None)
        interval = str(meta.get("interval") or (existing.interval if existing else "month"))
    if plan is None:
        logger.error("creem subscription %s: unknown product %s", sub_id, product_id)
        return existing
    user = await _resolve_user(db, obj, meta, existing)
    if user is None:
        logger.error("creem subscription %s: cannot resolve user", sub_id)
        return existing

    sub = existing or Subscription(user_id=user.id, provider="creem", provider_sub_id=sub_id)
    old_credits = int(sub.credits_per_period or 0) if existing else 0
    status = str(obj.get("status") or sub.status or "active").lower()
    sub.plan_id = plan["id"]
    sub.interval = interval if interval in INTERVALS else "month"
    sub.status = status
    sub.seats = _seats_of(obj, meta, existing)
    team_meta = str(meta.get("team_id") or "")
    if team_meta.isdigit():
        sub.team_id = int(team_meta)
    sub.credits_per_period = plan_credits(plan, sub.seats)
    sub.max_concurrent = int(plan["max_concurrent"])
    sub.provider_customer_id = id_of(obj.get("customer")) or sub.provider_customer_id
    sub.current_period_start = _parse_dt(obj.get("current_period_start_date")) or sub.current_period_start
    sub.current_period_end = _parse_dt(obj.get("current_period_end_date")) or sub.current_period_end
    sub.cancel_at_period_end = status == "scheduled_cancel"
    db.add(sub)
    await db.flush()

    if sub.team_id:
        await _sync_team_seats(db, sub, live=status in LIVE_STATUSES)
    if status in LIVE_STATUSES:
        user.plan = sub.plan_id
        # 期中升级：本计费月已发过额度时补发差额
        if existing is not None and sub.credits_per_period > old_credits and sub.last_grant_at is not None:
            await _grant_upgrade_delta(db, sub, sub.credits_per_period - old_credits)
    elif status in ENDED_STATUSES:
        await end_benefits(db, sub)
    await db.flush()
    return sub


def _seats_of(obj: dict[str, Any], meta: dict[str, Any], existing: Subscription | None) -> int:
    """席位数：订阅 items[0].units > 对象 units > metadata.seats > 已有值 > 1。"""
    items = obj.get("items") if isinstance(obj.get("items"), list) else []
    for value in (
        (items[0] or {}).get("units") if items else None,
        obj.get("units"),
        meta.get("seats"),
        existing.seats if existing else None,
    ):
        try:
            if value is not None and int(value) >= 1:
                return int(value)
        except (TypeError, ValueError):
            continue
    return 1


async def _sync_team_seats(db: AsyncSession, sub: Subscription, *, live: bool) -> None:
    """团队席位订阅变化时同步 teams.seats（结束后回到免费席位上限）。"""
    from app.models_commerce import Team

    team = await db.get(Team, int(sub.team_id))
    if team is None:
        return
    free = int(get_settings().team_free_seats or 1)
    team.seats = max(free, int(sub.seats)) if live else free


async def grant_for_now(db: AsyncSession, sub: Subscription, *, now: datetime | None = None) -> bool:
    """发放「包含 now 的计费月」额度；同一计费月只发一次。返回是否发放。"""
    if sub.status not in ("active", "scheduled_cancel"):
        return False
    ts = now or datetime.now(UTC)
    period_start = _aware(sub.current_period_start) or ts
    month_start = billing_month_start(period_start, ts)
    key = month_start.date().isoformat()
    grant = SubscriptionGrant(
        subscription_id=sub.id, user_id=sub.user_id, period_key=key, credit_fen=int(sub.credits_per_period)
    )
    try:
        async with db.begin_nested():
            db.add(grant)
            await db.flush()
    except IntegrityError:
        return False
    user = await _lock_user(db, int(sub.user_id))
    if user is None:
        return False
    leftover = min(int(user.sub_credit_fen or 0), max(0, int(user.balance_fen or 0)))
    if leftover > 0:
        await _ledger(db, user, -leftover, "sub_expire", ref_type="subscription", ref_id=str(sub.id), note="month_rollover")
        grant.expired_fen = leftover
    await _ledger(
        db,
        user,
        int(sub.credits_per_period),
        "sub_grant",
        ref_type="subscription",
        ref_id=str(sub.id),
        note=f"{sub.plan_id}:{key}",
    )
    user.sub_credit_fen = int(user.sub_credit_fen or 0) + int(sub.credits_per_period)
    sub.last_grant_at = ts
    nxt = _add_months(month_start, 1)
    period_end = _aware(sub.current_period_end)
    # 年付：周期内按月推进；月付：等续费 webhook
    sub.next_grant_at = nxt if period_end is not None and nxt < period_end else None
    await db.flush()
    logger.info("subscription grant sub=%s user=%s key=%s credits=%s expired=%s", sub.id, user.id, key, sub.credits_per_period, leftover)
    return True


async def _grant_upgrade_delta(db: AsyncSession, sub: Subscription, delta: int) -> None:
    """期中升级补发额度差（同样计入本月额度，月底过期）。"""
    user = await _lock_user(db, int(sub.user_id))
    if user is None or delta <= 0:
        return
    await _ledger(db, user, delta, "sub_grant", ref_type="subscription", ref_id=str(sub.id), note=f"upgrade:{sub.plan_id}")
    user.sub_credit_fen = int(user.sub_credit_fen or 0) + delta


async def end_benefits(db: AsyncSession, sub: Subscription, *, status: str | None = None) -> None:
    """订阅结束：剩余月额度过期、并发回到默认、users.plan 回 free（无其它有效订阅时）。"""
    if status:
        sub.status = status
    user = await _lock_user(db, int(sub.user_id))
    if user is None:
        return
    leftover = min(int(user.sub_credit_fen or 0), max(0, int(user.balance_fen or 0)))
    if leftover > 0:
        await _ledger(db, user, -leftover, "sub_expire", ref_type="subscription", ref_id=str(sub.id), note=f"ended:{sub.status}")
    user.sub_credit_fen = 0
    sub.next_grant_at = None
    other = (
        await db.execute(
            select(Subscription.id).where(
                Subscription.user_id == sub.user_id,
                Subscription.id != sub.id,
                Subscription.status.in_(LIVE_STATUSES),
            )
        )
    ).first()
    if other is None:
        user.plan = "free"


async def run_maintenance(db: AsyncSession, *, now: datetime | None = None) -> dict[str, int]:
    """调度维护（幂等）：年付按月发额度；期末后迟迟没有续费回调的订阅判过期。"""
    ts = now or datetime.now(UTC)
    granted = expired = 0
    due = (
        await db.execute(
            select(Subscription).where(
                Subscription.status.in_(("active", "scheduled_cancel")),
                Subscription.next_grant_at.is_not(None),
                Subscription.next_grant_at <= ts,
            )
        )
    ).scalars().all()
    for sub in due:
        if await grant_for_now(db, sub, now=ts):
            granted += 1
    stale = (
        await db.execute(
            select(Subscription).where(
                Subscription.status.in_(LIVE_STATUSES),
                Subscription.current_period_end.is_not(None),
                Subscription.current_period_end < ts - RENEWAL_GRACE,
            )
        )
    ).scalars().all()
    for sub in stale:
        await end_benefits(db, sub, status="expired")
        expired += 1
    if granted or expired:
        await db.commit()
    return {"granted": granted, "expired": expired}


# ── webhook 处理 ─────────────────────────────────────────


async def on_checkout_completed(db: AsyncSession, obj: dict[str, Any], _event: dict[str, Any]) -> tuple[str, str]:
    """订阅首付：建订阅并发首月额度。"""
    meta = metadata_of(obj)
    if meta.get("kind") != KIND_SUBSCRIPTION:
        return "ignored", "not subscription"
    sub_obj = obj.get("subscription") if isinstance(obj.get("subscription"), dict) else None
    if not sub_obj:
        return "ignored", "checkout without subscription object"
    if not sub_obj.get("customer") and obj.get("customer"):
        sub_obj = {**sub_obj, "customer": obj["customer"]}
    if not sub_obj.get("product") and obj.get("product"):
        sub_obj = {**sub_obj, "product": obj["product"]}
    sub = await upsert_from_creem(db, sub_obj, meta=meta)
    if sub is None:
        return "ignored", "subscription not resolved"
    granted = await grant_for_now(db, sub)
    return "processed", f"sub {sub.id} {sub.status} grant={granted}"


async def on_subscription_event(db: AsyncSession, obj: dict[str, Any], event: dict[str, Any]) -> tuple[str, str]:
    """subscription.*：同步状态；active / paid 时发本计费月额度（已发则跳过）。"""
    sub = await upsert_from_creem(db, obj)
    if sub is None:
        return "ignored", "subscription not resolved"
    event_type = str(event.get("eventType") or "")
    granted = False
    if event_type in ("subscription.active", "subscription.paid") and sub.status in ("active", "scheduled_cancel"):
        granted = await grant_for_now(db, sub)
    return "processed", f"sub {sub.id} {sub.status} grant={granted}"


creem_webhook.register("checkout.completed", on_checkout_completed)
for _event_type in (
    "subscription.active",
    "subscription.paid",
    "subscription.update",
    "subscription.trialing",
    "subscription.past_due",
    "subscription.scheduled_cancel",
    "subscription.canceled",
    "subscription.expired",
    "subscription.unpaid",
    "subscription.paused",
):
    creem_webhook.register(_event_type, on_subscription_event)
