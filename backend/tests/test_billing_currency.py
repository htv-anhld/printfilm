"""商业版计费：USD credit、加价倍率、首充赠送、币种相关的充值包与支付方式。"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import Order, WalletLedger
from app.services.billing import currency
from app.services.billing.orders import mark_order_paid
from app.services.billing.pricing import (
    active_skus,
    charge_fen_for_tokens,
    kie_credits_to_cost_fen,
    parse_upstream_cost_fen,
    sku_by_id,
    user_charge_fen,
)
from app.services.tokenfree_usage import quota_to_cost_fen
from tests.conftest import make_user


@pytest.fixture
def usd(monkeypatch: pytest.MonkeyPatch):
    """切到商业版默认：USD + markup 2.3 + 汇率 7。"""
    s = get_settings()
    monkeypatch.setattr(s, "billing_currency", "USD")
    monkeypatch.setattr(s, "billing_markup", 2.3)
    monkeypatch.setattr(s, "billing_usd_cny", 7.0)
    return s


def test_usd_quota_maps_to_cents(usd):
    # 500000 quota = 1 USD = 100 美分（不再乘人民币汇率）
    assert quota_to_cost_fen(500_000) == 100
    assert parse_upstream_cost_fen({"usage": {"quota": 250_000, "total_tokens": 10}}) == 50


def test_usd_converts_cny_sources(usd):
    # 火山返回 7 元 → $1 → 100 美分
    assert parse_upstream_cost_fen({"usage": {"cost_yuan": 7}}) == 100
    # Kie 10 credit × 3.5 分人民币 = 35 分 → 5 美分
    usd.billing_kie_fen_per_credit = 3.5
    assert kie_credits_to_cost_fen(10) == 5
    # 本地兜底：7 元/百万 token，1M token → $1
    usd.billing_llm_per_m = 7.0
    cost, charge = charge_fen_for_tokens(1_000_000, "llm_chat")
    assert cost == 100
    assert charge == 230


def test_markup_rounds_up_and_never_zero(usd):
    assert user_charge_fen(0) == 0
    assert user_charge_fen(1) == 3  # 2.3 → 3
    assert user_charge_fen(100) == 230
    usd.billing_markup = 0.5  # 低于 1 视为 1，不允许亏本卖
    assert user_charge_fen(100) == 100


def test_usd_skus_and_symbol(usd):
    ids = [sku["id"] for sku in active_skus()]
    assert ids == ["credits_900", "credits_3900", "credits_7900", "credits_14900"]
    assert sku_by_id("topup_99") is None  # 人民币包在 USD 下不可下单
    assert currency.format_money(7900) == "$79.00"
    assert currency.localize_money_symbol("需要 ¥1.00") == "需要 $1.00"


def test_cny_mode_keeps_legacy_semantics(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "billing_currency", "CNY")
    monkeypatch.setattr(s, "billing_usd_cny", 7.0)
    assert quota_to_cost_fen(500_000) == 700
    assert [sku["id"] for sku in active_skus()][0] == "topup_10"
    assert currency.localize_money_symbol("¥1") == "¥1"


async def _order(db, user, *, credit: int = 900, out: str = "T1") -> Order:
    """建一个待支付订单。"""
    order = Order(
        out_trade_no=out,
        user_id=user.id,
        sku_id="credits_900",
        amount_fen=credit,
        credit_fen=credit,
        pay_type="creem",
        status="pending",
        currency="USD",
        provider="creem",
    )
    db.add(order)
    await db.flush()
    return order


async def test_first_topup_bonus_only_once(db_session, monkeypatch):
    monkeypatch.setattr(get_settings(), "billing_first_topup_bonus_fen", 500)
    user = await make_user(db_session, balance_fen=0)
    first = await _order(db_session, user, out="FT-1")
    assert await mark_order_paid(db_session, first, trade_no="x1", note="creem") is True
    await db_session.refresh(user)
    assert user.balance_fen == 900 + 500
    assert first.bonus_fen == 500
    # 重复回调幂等
    assert await mark_order_paid(db_session, first, trade_no="x1", note="creem") is False
    second = await _order(db_session, user, out="FT-2")
    await mark_order_paid(db_session, second, trade_no="x2", note="creem")
    await db_session.refresh(user)
    assert user.balance_fen == 900 * 2 + 500
    assert second.bonus_fen == 0
    rows = (
        await db_session.execute(select(WalletLedger).where(WalletLedger.user_id == user.id))
    ).scalars().all()
    assert len(rows) == 2
