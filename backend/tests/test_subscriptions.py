"""订阅：月额度发放 / 优先消耗 / 月末过期、年付按月发、升级补差、取消、并发上限。"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import User, WalletLedger
from app.models_commerce import Subscription, SubscriptionGrant
from app.models_tasks import TaskRun
from app.services.billing.settlement import _ledger, freeze_for_task, settle_task
from app.services.payments import subscriptions as subs
from app.services.payments.creem_webhook import dispatch_event
from app.services.subscriptions.plans import plan_concurrency, plan_from_product, product_for
from tests.conftest import make_user

PERIOD_START = datetime(2026, 11, 1, tzinfo=UTC)


@pytest.fixture
def usd_plans(monkeypatch: pytest.MonkeyPatch):
    """USD + Creem + 套餐产品映射。"""
    s = get_settings()
    monkeypatch.setattr(s, "billing_currency", "USD")
    monkeypatch.setattr(s, "billing_markup", 1.0)
    monkeypatch.setattr(s, "creem_api_key", "k")
    monkeypatch.setattr(s, "creem_webhook_secret", "w")
    monkeypatch.setattr(
        s,
        "creem_plan_products",
        "starter_month:prod_sm,starter_year:prod_sy,pro_month:prod_pm",
    )
    return s


def _sub_obj(user: User, *, product: str = "prod_sm", status: str = "active", start=PERIOD_START, months: int = 1, sid="sub_1"):
    return {
        "id": sid,
        "object": "subscription",
        "status": status,
        "product": {"id": product},
        "customer": {"id": "cust_1", "email": user.email},
        "current_period_start_date": start.isoformat(),
        "current_period_end_date": subs._add_months(start, months).isoformat(),
        "metadata": {"kind": "subscription", "user_id": str(user.id)},
    }


def test_plan_lookup(usd_plans):
    assert product_for("starter", "year") == "prod_sy"
    plan, interval = plan_from_product("prod_pm")
    assert (plan["id"], interval) == ("pro", "month")
    assert plan_from_product("prod_unknown") == (None, "")
    assert plan_concurrency("pro", 4) == 6
    assert plan_concurrency("free", 4) == 4


def test_billing_month_start_for_yearly():
    now = datetime(2027, 2, 15, tzinfo=UTC)
    assert subs.billing_month_start(PERIOD_START, now) == datetime(2027, 2, 1, tzinfo=UTC)
    # 月末对齐：1/31 起算，2 月切到 2/28
    assert subs._add_months(datetime(2027, 1, 31, tzinfo=UTC), 1).day == 28


async def test_checkout_completed_grants_first_month(db_session, usd_plans, monkeypatch):
    monkeypatch.setattr(subs, "datetime", _FrozenDatetime)
    user = await make_user(db_session, balance_fen=500)
    event = {
        "id": "evt_s1",
        "eventType": "checkout.completed",
        "object": {
            "id": "ch_s",
            "request_id": "SB1",
            "metadata": {"kind": "subscription", "user_id": str(user.id), "plan_id": "starter", "interval": "month"},
            "subscription": _sub_obj(user),
            "order": {"amount": 1900, "currency": "USD"},
        },
    }
    status, _note = await dispatch_event(db_session, event)
    assert status == "processed"
    await db_session.refresh(user)
    assert user.plan == "starter"
    assert user.balance_fen == 500 + 1900
    assert user.sub_credit_fen == 1900
    # subscription.paid 同一计费月：不重复发
    await dispatch_event(db_session, {"id": "evt_s2", "eventType": "subscription.paid", "object": _sub_obj(user)})
    await db_session.refresh(user)
    assert user.balance_fen == 2400
    grants = (await db_session.execute(select(SubscriptionGrant))).scalars().all()
    assert len([g for g in grants if g.user_id == user.id]) == 1


async def test_sub_credits_consumed_first_and_expire(db_session, usd_plans):
    user = await make_user(db_session, balance_fen=1000)
    sub = await subs.upsert_from_creem(db_session, _sub_obj(user))
    await subs.grant_for_now(db_session, sub, now=PERIOD_START + timedelta(days=1))
    assert (user.balance_fen, user.sub_credit_fen) == (2900, 1900)
    # 消费 500：先吃月额度
    await _ledger(db_session, user, -500, "settle")
    assert (user.balance_fen, user.sub_credit_fen) == (2400, 1400)
    # 下一个计费月：剩余 1400 过期，再发 1900；永久 credit 1000 不动
    await subs.grant_for_now(db_session, sub, now=subs._add_months(PERIOD_START, 1) + timedelta(days=1))
    assert (user.balance_fen, user.sub_credit_fen) == (1000 + 1900, 1900)
    kinds = [
        row.kind
        for row in (
            await db_session.execute(select(WalletLedger).where(WalletLedger.user_id == user.id).order_by(WalletLedger.id))
        ).scalars()
    ]
    assert kinds == ["sub_grant", "settle", "sub_expire", "sub_grant"]


async def test_freeze_refund_returns_to_sub_bucket(db_session, usd_plans, monkeypatch):
    """预扣 300（全来自月额度），实扣 100 → 退回的 200 还回月额度，而不是变成永久 credit。"""
    from app.models import UsageEvent
    from app.services.billing import settlement

    user = await make_user(db_session, balance_fen=1000)
    sub = await subs.upsert_from_creem(db_session, _sub_obj(user))
    await subs.grant_for_now(db_session, sub, now=PERIOD_START + timedelta(days=1))
    task = TaskRun(domain="studio", task_type="tool_image", requested_by=user.id, payload={}, status="running")
    db_session.add(task)
    await db_session.flush()

    async def est(_db, _task):
        return 300

    monkeypatch.setattr(settlement, "estimate_task_fen", est)
    await freeze_for_task(db_session, task)
    assert task.billing_sub_fen == 300
    assert (user.balance_fen, user.sub_credit_fen) == (2600, 1600)
    db_session.add(UsageEvent(user_id=user.id, task_run_id=task.id, billing_key="seedream", charge_fen=100, cost_fen=100))
    await db_session.flush()
    out = await settle_task(db_session, task.id)
    assert out == {"charged": 100, "refunded": 200}
    await db_session.refresh(user)
    # 实扣 100 全部来自月额度：永久 1000 不动，月额度 1900 - 100 = 1800
    assert (user.balance_fen, user.sub_credit_fen) == (2800, 1800)


async def test_yearly_grants_monthly_via_maintenance(db_session, usd_plans):
    user = await make_user(db_session, balance_fen=0)
    sub = await subs.upsert_from_creem(db_session, _sub_obj(user, product="prod_sy", months=12, sid="sub_y"))
    assert sub.interval == "year"
    await subs.grant_for_now(db_session, sub, now=PERIOD_START + timedelta(hours=1))
    assert sub.next_grant_at == datetime(2026, 12, 1, tzinfo=UTC)
    out = await subs.run_maintenance(db_session, now=datetime(2026, 12, 2, tzinfo=UTC))
    assert out["granted"] == 1
    await db_session.refresh(user)
    assert user.balance_fen == 1900  # 第一月 1900 过期后再发 1900
    assert user.sub_credit_fen == 1900
    assert subs._aware(sub.next_grant_at) == datetime(2027, 1, 1, tzinfo=UTC)


async def test_upgrade_mid_period_grants_delta(db_session, usd_plans):
    user = await make_user(db_session, balance_fen=0)
    sub = await subs.upsert_from_creem(db_session, _sub_obj(user))
    await subs.grant_for_now(db_session, sub, now=PERIOD_START + timedelta(days=1))
    await subs.upsert_from_creem(db_session, _sub_obj(user, product="prod_pm"))
    assert sub.plan_id == "pro"
    assert user.sub_credit_fen == 6200
    assert user.plan == "pro"


async def test_cancel_and_stale_expire_end_benefits(db_session, usd_plans):
    user = await make_user(db_session, balance_fen=300)
    sub = await subs.upsert_from_creem(db_session, _sub_obj(user))
    await subs.grant_for_now(db_session, sub, now=PERIOD_START + timedelta(days=1))
    await subs.upsert_from_creem(db_session, _sub_obj(user, status="canceled"))
    assert (user.plan, user.sub_credit_fen, user.balance_fen) == ("free", 0, 300)
    # 期末后无续费回调 → 维护判过期
    user2 = await make_user(db_session, balance_fen=0)
    sub2 = await subs.upsert_from_creem(db_session, _sub_obj(user2, sid="sub_2"))
    out = await subs.run_maintenance(db_session, now=subs._aware(sub2.current_period_end) + timedelta(days=3))
    assert out["expired"] == 1
    assert sub2.status == "expired"
    assert user2.plan == "free"


async def test_checkout_requires_product_and_no_live_sub(db_session, usd_plans, monkeypatch):
    user = await make_user(db_session, balance_fen=0)
    with pytest.raises(ValueError):
        await subs.create_subscription_checkout(db_session, user, "pro", "year")  # 未配置产品

    async def fake_checkout(**kwargs):
        return {"id": "ch", "checkout_url": "https://x"}

    monkeypatch.setattr(subs.creem, "create_checkout", fake_checkout)
    out = await subs.create_subscription_checkout(db_session, user, "starter", "month")
    assert out["checkout_url"] == "https://x"
    await subs.upsert_from_creem(db_session, _sub_obj(user))
    with pytest.raises(ValueError):
        await subs.create_subscription_checkout(db_session, user, "pro", "month")


async def test_scheduler_uses_plan_concurrency(db_session, usd_plans):
    from app.services.tasks.scheduler import _user_limits

    pro = await make_user(db_session)
    pro.plan = "pro"
    free = await make_user(db_session)
    await db_session.flush()
    limits = await _user_limits(db_session, {pro.id, free.id}, 4)
    assert limits == {pro.id: 6, free.id: 4}


class _FrozenDatetime(datetime):
    """把 subs 模块里的 now 固定在首个计费月内。"""

    @classmethod
    def now(cls, tz=None):
        return PERIOD_START + timedelta(days=2)
