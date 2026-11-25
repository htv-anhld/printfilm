"""管理端：订阅与团队列表（服务端分页 + 搜索）。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_admin
from app.models import User
from app.models_commerce import Subscription, Team, TeamMember

router = APIRouter()


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


@router.get("/subscriptions")
async def admin_subscriptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query("", max_length=200),
    status: str = Query("", max_length=24),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """全部订阅：用户邮箱 / 套餐 / 状态 / 周期 / 席位。"""
    stmt = select(Subscription, User.email).join(User, User.id == Subscription.user_id)
    count = select(func.count(Subscription.id)).join(User, User.id == Subscription.user_id)
    if q.strip():
        like = f"%{q.strip()}%"
        cond = or_(User.email.ilike(like), Subscription.provider_sub_id.ilike(like), Subscription.plan_id.ilike(like))
        stmt, count = stmt.where(cond), count.where(cond)
    if status.strip():
        stmt, count = stmt.where(Subscription.status == status.strip()), count.where(Subscription.status == status.strip())
    total = int((await db.execute(count)).scalar() or 0)
    rows = (
        await db.execute(stmt.order_by(Subscription.id.desc()).offset((page - 1) * page_size).limit(page_size))
    ).all()
    return {
        "items": [
            {
                "id": sub.id,
                "user_id": sub.user_id,
                "email": email,
                "plan_id": sub.plan_id,
                "interval": sub.interval,
                "status": sub.status,
                "seats": int(sub.seats or 1),
                "team_id": sub.team_id,
                "credits_per_period": int(sub.credits_per_period or 0),
                "current_period_end": _iso(sub.current_period_end),
                "provider_sub_id": sub.provider_sub_id,
                "created_at": _iso(sub.created_at),
            }
            for sub, email in rows
        ],
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.get("/seat-teams")
async def admin_teams(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query("", max_length=200),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """全部团队：名称 / 所有者 / 席位 / 成员数。"""
    members = (
        select(TeamMember.team_id, func.count(TeamMember.id).label("n")).group_by(TeamMember.team_id).subquery()
    )
    stmt = (
        select(Team, User.email, func.coalesce(members.c.n, 0))
        .join(User, User.id == Team.owner_id)
        .outerjoin(members, members.c.team_id == Team.id)
    )
    count = select(func.count(Team.id)).join(User, User.id == Team.owner_id)
    if q.strip():
        like = f"%{q.strip()}%"
        cond = or_(Team.name.ilike(like), User.email.ilike(like))
        stmt, count = stmt.where(cond), count.where(cond)
    total = int((await db.execute(count)).scalar() or 0)
    rows = (await db.execute(stmt.order_by(Team.id.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    return {
        "items": [
            {
                "id": team.id,
                "name": team.name,
                "owner_id": team.owner_id,
                "owner_email": email,
                "seats": int(team.seats or 1),
                "members": int(n or 0),
                "created_at": _iso(team.created_at),
            }
            for team, email, n in rows
        ],
        "meta": {"page": page, "page_size": page_size, "total": total},
    }
