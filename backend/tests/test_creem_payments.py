"""Creem：验签、下单、checkout.completed 入账、重复事件、金额校验、退款扣回。"""

from __future__ import annotations

import hashlib
import hmac
import json

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import Order, User
from app.models_commerce import PaymentEvent
from app.services import creem
from app.services.payments import creem_topup
from app.services.payments.creem_webhook import dispatch_event
from tests.conftest import make_user


@pytest.fixture
def creem_usd(monkeypatch: pytest.MonkeyPatch):
    """USD + Creem 已配置（测试模式）。"""
    s = get_settings()
    monkeypatch.setattr(s, "billing_currency", "USD")
    monkeypatch.setattr(s, "billing_markup", 2.3)
    monkeypatch.setattr(s, "billing_first_topup_bonus_fen", 0)
    monkeypatch.setattr(s, "creem_api_key", "creem_test_key")
    monkeypatch.setattr(s, "creem_webhook_secret", "whsec_test")
    monkeypatch.setattr(s, "creem_test_mode", True)
    monkeypatch.setattr(s, "creem_credit_product_id", "prod_credits")
    monkeypatch.setattr(s, "creem_sku_products", "")
    monkeypatch.setattr(s, "app_public_url", "https://app.example.com")
    return s


def _sign(body: bytes, secret: str = "whsec_test") -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_verify_signature(creem_usd):
    body = b'{"id":"evt_1"}'
    assert creem.verify_webhook_signature(body, _sign(body))
    assert not creem.verify_webhook_signature(body, _sign(body, "other"))
    assert not creem.verify_webhook_signature(body + b" ", _sign(body))
    assert not creem.verify_webhook_signature(body, None)
    creem_usd.creem_webhook_secret = ""
    # 未配置 secret 一律拒绝
    assert not creem.verify_webhook_signature(body, _sign(body, ""))


def test_sku_product_map_and_base(creem_usd):
    creem_usd.creem_sku_products = "credits_900:prod_a, credits_3900:prod_b,bad"
    assert creem.sku_product_map() == {"credits_900": "prod_a", "credits_3900": "prod_b"}
    assert creem.creem_base_url() == creem.TEST_BASE
    creem_usd.creem_test_mode = False
    assert creem.creem_base_url() == creem.PROD_BASE
    assert creem_topup.resolve_topup_product("credits_900") == ("prod_a", None)
    assert creem_topup.resolve_topup_product("credits_7900") == ("prod_credits", 7900)


async def _checkout(db, monkeypatch, user: User, sku: str = "credits_900") -> dict:
    """下单（Creem HTTP 打桩）。"""
    sent: dict = {}

    async def fake_create(**kwargs):
        sent.update(kwargs)
        return {"id": "ch_123", "checkout_url": "https://checkout.creem.io/ch_123"}

    monkeypatch.setattr(creem_topup.creem, "create_checkout", fake_create)
    out = await creem_topup.create_topup_checkout(db, user, sku)
    out["_sent"] = sent
    return out


def _completed(out_trade_no: str, *, amount: int = 900, currency: str = "USD", evt: str = "evt_1") -> dict:
    return {
        "id": evt,
        "eventType": "checkout.completed",
        "created_at": 1,
        "object": {
            "id": "ch_123",
            "object": "checkout",
            "request_id": out_trade_no,
            "status": "completed",
            "metadata": {"kind": "topup", "out_trade_no": out_trade_no},
            "order": {"id": "ord_1", "amount": amount, "amount_paid": amount, "currency": currency, "status": "paid"},
        },
    }


async def test_checkout_creates_pending_order(db_session, monkeypatch, creem_usd):
    user = await make_user(db_session, balance_fen=0)
    out = await _checkout(db_session, monkeypatch, user)
    assert out["checkout_url"].startswith("https://checkout.creem.io/")
    sent = out["_sent"]
    assert sent["product_id"] == "prod_credits"
    assert sent["custom_price"] == 900
    assert sent["request_id"] == out["out_trade_no"]
    assert sent["metadata"]["kind"] == "topup"
    assert sent["success_url"].startswith("https://app.example.com/pricing?paid=1&order=")
    order = (await db_session.execute(select(Order).where(Order.out_trade_no == out["out_trade_no"]))).scalar_one()
    assert (order.status, order.provider, order.currency, order.provider_ref) == ("pending", "creem", "USD", "ch_123")


async def test_checkout_rejected_in_cny(db_session, monkeypatch, creem_usd):
    creem_usd.billing_currency = "CNY"
    user = await make_user(db_session, balance_fen=0)
    with pytest.raises(ValueError):
        await _checkout(db_session, monkeypatch, user)


async def test_completed_credits_once(db_session, monkeypatch, creem_usd):
    user = await make_user(db_session, balance_fen=0)
    out = await _checkout(db_session, monkeypatch, user)
    event = _completed(out["out_trade_no"])
    assert (await dispatch_event(db_session, event))[0] == "processed"
    assert (await dispatch_event(db_session, event))[0] == "duplicate"
    # 不同事件 id 的手动重发：订单已 paid，不重复入账
    assert (await dispatch_event(db_session, {**event, "id": "evt_2"}))[0] == "ignored"
    await db_session.refresh(user)
    assert user.balance_fen == 900
    rows = (await db_session.execute(select(PaymentEvent).where(PaymentEvent.provider == "creem"))).scalars().all()
    assert {r.event_id for r in rows} >= {"evt_1", "evt_2"}


async def test_completed_amount_or_currency_mismatch_not_credited(db_session, monkeypatch, creem_usd):
    user = await make_user(db_session, balance_fen=0)
    out = await _checkout(db_session, monkeypatch, user)
    # 订阅模块也监听 checkout.completed，note 会拼上它的 "not subscription"
    assert "amount mismatch" in (await dispatch_event(db_session, _completed(out["out_trade_no"], amount=100, evt="e1")))[1]
    assert "currency mismatch" in (await dispatch_event(db_session, _completed(out["out_trade_no"], currency="EUR", evt="e2")))[1]
    await db_session.refresh(user)
    assert user.balance_fen == 0


async def test_refund_claws_back(db_session, monkeypatch, creem_usd):
    user = await make_user(db_session, balance_fen=0)
    out = await _checkout(db_session, monkeypatch, user)
    await dispatch_event(db_session, _completed(out["out_trade_no"]))
    refund = {
        "id": "evt_r",
        "eventType": "refund.created",
        "object": {
            "id": "ref_1",
            "status": "succeeded",
            "refund_amount": 900,
            "refund_currency": "USD",
            "checkout": {"id": "ch_123", "request_id": out["out_trade_no"]},
            "order": {"id": "ord_1"},
        },
    }
    assert (await dispatch_event(db_session, refund))[0] == "processed"
    await db_session.refresh(user)
    assert user.balance_fen == 0
    order = (await db_session.execute(select(Order).where(Order.out_trade_no == out["out_trade_no"]))).scalar_one()
    assert order.status == "refunded"


async def test_webhook_endpoint_rejects_bad_signature(db_session, creem_usd):
    from fastapi import HTTPException

    from app.api import billing as billing_api

    class _Req:
        def __init__(self, body: bytes, sig: str):
            self._b, self.headers = body, {"creem-signature": sig}

        async def body(self):
            return self._b

    body = json.dumps({"id": "evt_x", "eventType": "checkout.completed", "object": {}}).encode()
    with pytest.raises(HTTPException) as exc:
        await billing_api.creem_webhook_endpoint(_Req(body, "nope"), db=db_session)
    assert exc.value.status_code == 401
    ok = await billing_api.creem_webhook_endpoint(_Req(body, _sign(body)), db=db_session)
    assert ok["status"] == "ignored"
