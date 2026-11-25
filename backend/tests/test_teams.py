"""团队：创建、邀请（席位 / 邮箱校验 / 一次性）、角色、移除、额度分配与收回、席位订阅。"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import WalletLedger
from app.models_commerce import TeamMember
from app.services import seat_teams as svc
from tests.conftest import make_user


@pytest.fixture(autouse=True)
def _team_settings(monkeypatch: pytest.MonkeyPatch):
    s = get_settings()
    monkeypatch.setattr(s, "team_free_seats", 3)
    monkeypatch.setattr(s, "team_credits_per_seat", 2000)
    monkeypatch.setattr(s, "app_public_url", "https://app.test")

    async def no_mail(**_kw):
        return False

    monkeypatch.setattr(svc, "send_email", no_mail)


async def _team(db):
    owner = await make_user(db, balance_fen=10_000)
    team = await svc.create_team(db, owner, "Studio A")
    owner_member = await svc.membership(db, team.id, owner.id)
    return owner, team, owner_member


async def _join(db, team, owner, *, role="member"):
    user = await make_user(db, balance_fen=0)
    _inv, token = await svc.create_invite(db, team, owner, user.email, role)
    await svc.accept_invite(db, user, token)
    return user


async def test_create_and_detail(db_session):
    owner, team, member = await _team(db_session)
    assert (team.seats, member.role) == (3, "owner")
    detail = await svc.team_detail(db_session, team, member)
    assert detail["members"][0]["email"] == owner.email and "balance_fen" in detail["members"][0]
    with pytest.raises(svc.TeamError):
        await svc.create_team(db_session, owner, "   ")


async def test_invite_flow_and_seat_limit(db_session):
    owner, team, _m = await _team(db_session)
    await _join(db_session, team, owner)
    stranger = await make_user(db_session)
    _inv, token = await svc.create_invite(db_session, team, owner, "someone@else.test")
    # 邮箱不一致不能接受
    with pytest.raises(svc.TeamError):
        await svc.accept_invite(db_session, stranger, token)
    # 3 席位 = owner + 1 成员 + 1 待接受邀请 → 已满
    with pytest.raises(svc.TeamError, match="3"):
        await svc.create_invite(db_session, team, owner, "third@else.test")
    preview = await svc.preview_invite(db_session, token)
    assert preview["team_name"] == "Studio A" and preview["email"] == "someone@else.test"


async def test_invite_is_single_use_and_expires(db_session):
    owner, team, _m = await _team(db_session)
    user = await make_user(db_session)
    invite, token = await svc.create_invite(db_session, team, owner, user.email)
    await svc.accept_invite(db_session, user, token)
    with pytest.raises(svc.TeamError):
        await svc.accept_invite(db_session, user, token)
    user2 = await make_user(db_session)
    invite2, token2 = await svc.create_invite(db_session, team, owner, user2.email)
    invite2.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    with pytest.raises(svc.TeamError):
        await svc.preview_invite(db_session, token2)


async def test_roles_and_removal(db_session):
    owner, team, owner_m = await _team(db_session)
    member = await _join(db_session, team, owner)
    admin = await _join(db_session, team, owner, role="admin")
    admin_m = await svc.membership(db_session, team.id, admin.id)
    with pytest.raises(svc.TeamError):
        await svc.set_role(db_session, team, admin_m, member.id, "admin")  # 只有 owner 能改
    with pytest.raises(svc.TeamError):
        await svc.remove_member(db_session, team, admin_m, owner.id)  # 不能移除 owner
    await svc.set_role(db_session, team, owner_m, member.id, "admin")
    member_m = await svc.membership(db_session, team.id, member.id)
    await svc.remove_member(db_session, team, member_m, member.id)  # 自己退出
    await db_session.flush()
    assert await svc.membership(db_session, team.id, member.id) is None


async def test_allocate_and_reclaim(db_session):
    owner, team, _m = await _team(db_session)
    member = await _join(db_session, team, owner)
    with pytest.raises(svc.TeamError):
        await svc.allocate(db_session, team, owner, member.id, 50_000)  # 余额不足
    out = await svc.allocate(db_session, team, owner, member.id, 3000)
    assert out == {"giver_balance_fen": 7000, "member_balance_fen": 3000}
    back = await svc.reclaim(db_session, team, owner, member.id, 10_000)
    assert back["reclaimed_fen"] == 3000  # 不超过已分配额
    kinds = [
        r.kind
        for r in (await db_session.execute(select(WalletLedger).where(WalletLedger.ref_id == f"team:{team.id}"))).scalars()
    ]
    assert kinds.count("team_allocate") == 2 and kinds.count("team_reclaim") == 2
    row = (await db_session.execute(select(TeamMember).where(TeamMember.user_id == member.id))).scalar_one()
    assert row.allocated_fen == 0


async def test_team_seat_subscription_grants_per_seat(db_session, monkeypatch):
    from app.services.payments import subscriptions as subs

    s = get_settings()
    monkeypatch.setattr(s, "creem_plan_products", "team_month:prod_team")
    owner, team, _m = await _team(db_session)
    start = datetime(2026, 11, 1, tzinfo=UTC)
    obj = {
        "id": "sub_team",
        "status": "active",
        "product": {"id": "prod_team"},
        "items": [{"product_id": "prod_team", "units": 10}],
        "customer": {"id": "cust_t", "email": owner.email},
        "current_period_start_date": start.isoformat(),
        "current_period_end_date": subs._add_months(start, 1).isoformat(),
        "metadata": {"kind": "subscription", "user_id": str(owner.id), "team_id": str(team.id)},
    }
    sub = await subs.upsert_from_creem(db_session, obj)
    assert (sub.plan_id, sub.seats, sub.credits_per_period, sub.team_id) == ("team", 10, 20_000, team.id)
    assert team.seats == 10
    await subs.grant_for_now(db_session, sub, now=start + timedelta(days=1))
    assert owner.sub_credit_fen == 20_000
    # 团队订阅不影响个人订阅判断
    assert await subs.live_subscription(db_session, owner.id) is None
    await subs.upsert_from_creem(db_session, {**obj, "status": "expired"})
    assert team.seats == 3


async def test_admin_lists(db_session):
    from app.api.admin.commerce import admin_subscriptions, admin_teams

    owner, team, _m = await _team(db_session)
    admin = await make_user(db_session)
    out = await admin_teams(page=1, page_size=10, q="Studio A", _admin=admin, db=db_session)
    row = next(item for item in out["items"] if item["id"] == team.id)
    assert (row["owner_email"], row["members"], row["seats"]) == (owner.email, 1, 3)
    subs = await admin_subscriptions(page=1, page_size=10, q="", status="", _admin=admin, db=db_session)
    assert "items" in subs and subs["meta"]["page"] == 1
