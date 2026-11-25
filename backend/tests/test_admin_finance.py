"""管理端财务列表：按日扣费/成本/利润聚合。"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UpstreamUsageDaily
from app.services.admin.finance import _profit_fen, build_finance_daily_list
from tests.conftest import make_user
from tests.test_admin_stats import _add_usage, _utc_days_ago


def test_profit_fen_prefers_actual_cost() -> None:
    assert _profit_fen(charge_fen=200, cost_fen=120, actual_cost_fen=90) == 110


def test_profit_fen_falls_back_to_local_cost() -> None:
    assert _profit_fen(charge_fen=100, cost_fen=40, actual_cost_fen=0) == 60


@pytest.mark.asyncio
async def test_finance_daily_list_includes_new_usage(db_session: AsyncSession) -> None:
    """新增用量应反映到对应日期的财务行（增量断言，兼容共享测试库）。"""
    user = await make_user(db_session)
    target_day = _utc_days_ago(5)
    day = target_day.date()
    before = await build_finance_daily_list(db_session, days=30)
    before_row = next(item for item in before["series"] if item["date"] == day.isoformat())

    await _add_usage(
        db_session,
        user_id=user.id,
        charge_fen=200,
        cost_fen=120,
        total_tokens=5000,
        created_at=target_day,
        capability="video",
        billing_key="seedance2:video0",
    )
    existing = (
        await db_session.execute(select(UpstreamUsageDaily).where(UpstreamUsageDaily.usage_date == day))
    ).scalar_one_or_none()
    if existing:
        existing.official_tokens = 4800
        existing.official_cost_fen = 90
    else:
        db_session.add(
            UpstreamUsageDaily(
                usage_date=day,
                official_tokens=4800,
                official_cost_fen=90,
                local_cost_fen=120,
                local_tokens=5000,
                fetched_at=datetime.now(timezone.utc),
            )
        )
    await db_session.commit()

    after = await build_finance_daily_list(db_session, days=30)
    after_row = next(item for item in after["series"] if item["date"] == day.isoformat())
    assert after_row["charge_fen"] - before_row["charge_fen"] == 200
    assert after_row["cost_fen"] - before_row["cost_fen"] == 120
    assert after_row["tokens"] - before_row["tokens"] == 5000
    assert after_row["actual_cost_fen"] == 90
    assert after_row["profit_fen"] == _profit_fen(
        charge_fen=after_row["charge_fen"],
        cost_fen=after_row["cost_fen"],
        actual_cost_fen=after_row["actual_cost_fen"],
    )
    if after["totals"]["charge_fen"] > 0:
        assert after["totals"]["profit_pct"] is not None


@pytest.mark.asyncio
@pytest.mark.parametrize(("requested_days", "expected_days"), [(0, 1), (3, 3), (91, 90)])
async def test_finance_daily_list_pads_and_clamps_window(
    monkeypatch: pytest.MonkeyPatch, requested_days: int, expected_days: int
) -> None:
    """窗口裁剪到 1..90 天，无数据日期补零（含调用次数）。"""
    from datetime import date
    from unittest.mock import AsyncMock, MagicMock

    from app.services.admin import finance

    monkeypatch.setattr(finance, "_utc_today", lambda: date(2026, 10, 26))
    monkeypatch.setattr(finance, "_local_usage_daily", AsyncMock(return_value={}))
    db = AsyncMock()
    empty = MagicMock()
    empty.scalars.return_value.all.return_value = []
    db.execute.return_value = empty
    out = await build_finance_daily_list(db, days=requested_days)

    assert out["days"] == expected_days
    assert len(out["series"]) == expected_days
    assert out["series"][-1]["date"] == "2026-10-26"
    assert out["totals"]["charge_fen"] == out["totals"]["calls"] == 0
    assert all(row["charge_fen"] == row["tokens"] == row["calls"] == 0 for row in out["series"])


def test_finance_admin_routes_keep_upstream_compare() -> None:
    """本分支管理端保留成本/利润与上游用量对照接口。"""
    from app.api.admin import router

    paths = {route.path for route in router.routes}
    assert "/admin/finance/daily" in paths
    assert "/admin/finance/daily/sync" in paths
    assert "/admin/stats/upstream-usage" in paths
    assert "/admin/stats/upstream-usage/sync" in paths
