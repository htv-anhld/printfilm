"""合作伙伴：申请审核、注册归因（防自荐）、订单 / 订阅计佣去重、冷静期、退款冲正、兑换、推广内容奖励。"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import Order
from app.models_commerce import PartnerCommission
from app.services import partners as svc
from app.services.billing.orders import mark_order_paid
from app.services.payments import partner_hooks
from app.services.payments.creem_webhook import dispatch_event
from tests.conftest import make_user


@pytest.fixture(autouse=True)
def _partner_settings(monkeypatch: pytest.MonkeyPatch):
    s = get_settings()
    monkeypatch.setattr(s, "partner_commission_rate", 0.2)
    monkeypatch.setattr(s, "partner_commission_months", 12)
    monkeypatch.setattr(s, "partner_hold_days", 30)
    monkeypatch.setattr(s, "partner_auto_approve", False)
    monkeypatch.setattr(s, "billing_first_topup_bonus_fen", 0)
    # 订阅模块与佣金模块都要挂到 dispatcher 上
    import app.services.payments.subscriptions  # noqa: F401
    assert partner_hooks.on_refund_created


async def _approved_partner(db):
    owner = await make_user(db, balance_fen=0)
    partner = await svc.apply(db, owner, channel="youtube", website="https://yt.example", audience="10k", note="")
    assert partner.status == "pending"
    await svc.review_partner(db, partner.id, status="approved", rate=None, note="ok")
    return owner, partner


async def _referred_user(db, partner):
    user = await make_user(db, balance_fen=0)
    assert await svc.attribute_signup(db, user, partner.ref_code.lower())
    return user


async def _paid_order(db, user, *, out="PO-1", amount=7900):
    order = Order(
        out_trade_no=out, user_id=user.id, sku_id="credits_7900", amount_fen=amount, credit_fen=amount,
        pay_type="creem", status="pending", currency="USD", provider="creem", provider_ref=f"ch_{out}",
    )
    db.add(order)
    await db.flush()
    await mark_order_paid(db, order, trade_no=f"ord_{out}", note="creem")
    return order


async def test_apply_review_and_self_referral(db_session):
    owner, partner = await _approved_partner(db_session)
    assert svc.partner_out(partner)["ref_link"].endswith(f"?ref={partner.ref_code}")
    # 自荐无效、无效码无效
    assert await svc.attribute_signup(db_session, owner, partner.ref_code) is False
    other = await make_user(db_session)
    assert await svc.attribute_signup(db_session, other, "NOPE1234") is False


async def test_order_commission_hold_redeem_and_refund(db_session):
    owner, partner = await _approved_partner(db_session)
    user = await _referred_user(db_session, partner)
    await _paid_order(db_session, user)
    rows = (await db_session.execute(select(PartnerCommission).where(PartnerCommission.partner_id == partner.id))).scalars().all()
    assert [(r.commission_fen, r.status) for r in rows] == [(1580, "held")]
    # 冷静期内不能兑换
    with pytest.raises(svc.PartnerError):
        await svc.redeem(db_session, owner)
    rows[0].available_at = datetime.now(UTC) - timedelta(seconds=1)
    assert await svc.redeem(db_session, owner) == 1580
    await db_session.refresh(owner)
    assert owner.balance_fen == 1580
    # 退款：已兑换的佣金从合作伙伴钱包扣回
    refund = {
        "id": "evt_ref_p",
        "eventType": "refund.created",
        "object": {"id": "ref_1", "refund_amount": 7900, "checkout": {"id": "ch_PO-1", "request_id": "PO-1"}, "order": {"id": "ord_PO-1"}},
    }
    await dispatch_event(db_session, refund)
    await db_session.refresh(owner)
    assert owner.balance_fen == 0
    assert rows[0].status == "reversed"


async def test_subscription_commission_not_double_counted(db_session, monkeypatch):
    from app.services.payments import subscriptions as subs

    monkeypatch.setattr(get_settings(), "creem_plan_products", "pro_month:prod_pm")
    _owner, partner = await _approved_partner(db_session)
    user = await _referred_user(db_session, partner)
    start = datetime.now(UTC)
    sub_obj = {
        "id": "sub_p",
        "status": "active",
        "product": {"id": "prod_pm"},
        "customer": {"id": "c", "email": user.email},
        "current_period_start_date": start.isoformat(),
        "current_period_end_date": subs._add_months(start, 1).isoformat(),
    }
    await dispatch_event(db_session, {
        "id": "evt_c1", "eventType": "checkout.completed",
        "object": {"id": "ch_s", "metadata": {"kind": "subscription", "user_id": str(user.id)}, "subscription": sub_obj,
                   "order": {"id": "ord_s", "amount": 6200, "transaction": "tran_1"}},
    })
    # 同一次扣款的 subscription.paid：transaction 相同 → 不重复计佣
    await dispatch_event(db_session, {
        "id": "evt_p1", "eventType": "subscription.paid",
        "object": {**sub_obj, "last_transaction": {"id": "tran_1", "amount": 6200, "order": "ord_s"}},
    })
    # 下个月续费：新 transaction → 再计一次
    await dispatch_event(db_session, {
        "id": "evt_p2", "eventType": "subscription.paid",
        "object": {**sub_obj, "last_transaction": {"id": "tran_2", "amount": 6200}},
    })
    rows = (await db_session.execute(select(PartnerCommission).where(PartnerCommission.partner_id == partner.id))).scalars().all()
    assert sorted(r.source_id for r in rows) == ["tran_1", "tran_2"]
    assert all(r.commission_fen == 1240 for r in rows)


async def test_attribution_window(db_session):
    _owner, partner = await _approved_partner(db_session)
    user = await _referred_user(db_session, partner)
    user.created_at = datetime.now(UTC) - timedelta(days=400)
    assert await svc.record_commission(db_session, user_id=user.id, paid_fen=1000, source_type="order", source_id="old") is None


async def test_submission_reward_once(db_session):
    owner, partner = await _approved_partner(db_session)
    with pytest.raises(svc.PartnerError):
        await svc.submit(db_session, owner, url="not-a-url", platform="tiktok", note="")
    row = await svc.submit(db_session, owner, url="https://tiktok.com/@x/video/1", platform="tiktok", note="")
    await svc.review_submission(db_session, row.id, status="approved", reward_fen=500, note="nice")
    await db_session.refresh(owner)
    assert owner.balance_fen == 500
    with pytest.raises(svc.PartnerError):
        await svc.review_submission(db_session, row.id, status="approved", reward_fen=500, note="again")


async def test_dashboard_and_admin_list(db_session):
    from app.api.admin.partners import list_partners

    owner, partner = await _approved_partner(db_session)
    user = await _referred_user(db_session, partner)
    await db_session.flush()
    await _paid_order(db_session, user, out="PO-2", amount=900)
    dash = await svc.dashboard(db_session, owner)
    assert (dash["signups"], dash["paying_users"], dash["held_fen"]) == (1, 1, 180)
    admin = await make_user(db_session)
    out = await list_partners(page=1, page_size=10, q=partner.ref_code, status="", _admin=admin, db=db_session)
    row = out["items"][0]
    assert (row["signups"], row["open_fen"], row["available_fen"]) == (1, 180, 0)
