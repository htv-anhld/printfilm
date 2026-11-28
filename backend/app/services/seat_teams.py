# -*- coding: utf-8 -*-
"""团队：成员 / 角色 / 邀请 / 席位 / 额度分配（对齐 Dravelio /api/teams）。

不做共享钱包：计费冻结与结算都按个人钱包进行，团队额度通过「分配 / 收回」在 owner 与成员钱包间转账，
流水记 team_allocate / team_reclaim。席位订阅发放的月额度进入 owner 的月额度（期末过期），
分配给成员时从 owner 余额扣（优先吃月额度），成员拿到的是永久额度。
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.i18n import _
from app.models import UsageEvent, User
from app.models_commerce import Team, TeamInvite, TeamMember
from app.services.billing.settlement import _ledger, _lock_user
from app.services.email import send_email

logger = logging.getLogger(__name__)

ROLES = ("owner", "admin", "member")
MANAGER_ROLES = ("owner", "admin")
INVITE_TTL = timedelta(days=7)
MAX_TEAMS_PER_OWNER = 5


class TeamError(Exception):
    """团队业务错误（权限 / 席位 / 邀请无效等）。"""


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


# ── 查询 / 权限 ─────────────────────────────────────────


async def membership(db: AsyncSession, team_id: int, user_id: int) -> TeamMember | None:
    return (
        await db.execute(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id))
    ).scalar_one_or_none()


async def require_member(db: AsyncSession, team_id: int, user: User, *, manage: bool = False) -> tuple[Team, TeamMember]:
    """成员才能看；manage=True 要求 owner / admin。"""
    team = await db.get(Team, int(team_id))
    member = await membership(db, int(team_id), int(user.id)) if team else None
    if team is None or member is None:
        raise TeamError(_("团队不存在或你不是成员"))
    if manage and member.role not in MANAGER_ROLES:
        raise TeamError(_("需要团队管理员权限"))
    return team, member


async def member_count(db: AsyncSession, team_id: int) -> int:
    return int((await db.execute(select(func.count(TeamMember.id)).where(TeamMember.team_id == team_id))).scalar() or 0)


async def pending_invite_count(db: AsyncSession, team_id: int) -> int:
    now = datetime.now(UTC)
    return int(
        (
            await db.execute(
                select(func.count(TeamInvite.id)).where(
                    TeamInvite.team_id == team_id, TeamInvite.accepted_at.is_(None), TeamInvite.expires_at > now
                )
            )
        ).scalar()
        or 0
    )


async def my_teams(db: AsyncSession, user: User) -> list[dict[str, Any]]:
    """我加入的团队（含角色、人数、席位）。"""
    rows = (
        await db.execute(
            select(Team, TeamMember.role)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(TeamMember.user_id == user.id)
            .order_by(Team.id)
        )
    ).all()
    out = []
    for team, role in rows:
        out.append(
            {
                "id": team.id,
                "name": team.name,
                "role": role,
                "seats": int(team.seats or 1),
                "members": await member_count(db, team.id),
                "owner_id": team.owner_id,
            }
        )
    return out


async def team_detail(db: AsyncSession, team: Team, viewer: TeamMember) -> dict[str, Any]:
    """团队详情：成员（管理员可见本月用量与余额）、待接受邀请。"""
    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = (
        await db.execute(
            select(TeamMember, User).join(User, User.id == TeamMember.user_id).where(TeamMember.team_id == team.id)
        )
    ).all()
    is_manager = viewer.role in MANAGER_ROLES
    members = []
    for member, user in rows:
        item: dict[str, Any] = {
            "user_id": user.id,
            "email": user.email,
            "nickname": user.nickname,
            "role": member.role,
            "joined_at": member.created_at.isoformat() if member.created_at else None,
        }
        if is_manager:
            used = (
                await db.execute(
                    select(func.coalesce(func.sum(UsageEvent.charge_fen), 0)).where(
                        UsageEvent.user_id == user.id, UsageEvent.created_at >= month_start
                    )
                )
            ).scalar()
            item.update(
                {
                    "balance_fen": int(user.balance_fen or 0),
                    "allocated_fen": int(member.allocated_fen or 0),
                    "month_charge_fen": int(used or 0),
                }
            )
        members.append(item)
    members.sort(key=lambda m: (ROLES.index(m["role"]) if m["role"] in ROLES else 9, m["email"]))
    invites = []
    if is_manager:
        now = datetime.now(UTC)
        for inv in (
            await db.execute(
                select(TeamInvite).where(TeamInvite.team_id == team.id, TeamInvite.accepted_at.is_(None)).order_by(TeamInvite.id.desc())
            )
        ).scalars():
            invites.append(
                {
                    "id": inv.id,
                    "email": inv.email,
                    "role": inv.role,
                    "expires_at": inv.expires_at.isoformat(),
                    "expired": _aware(inv.expires_at) <= now,
                }
            )
    return {
        "id": team.id,
        "name": team.name,
        "seats": int(team.seats or 1),
        "owner_id": team.owner_id,
        "my_role": viewer.role,
        "members": members,
        "invites": invites,
        "credits_per_seat": int(get_settings().team_credits_per_seat or 0),
    }


# ── 创建 / 修改 ─────────────────────────────────────────


async def create_team(db: AsyncSession, owner: User, name: str) -> Team:
    name = (name or "").strip()[:64]
    if not name:
        raise TeamError(_("请填写团队名称"))
    owned = int((await db.execute(select(func.count(Team.id)).where(Team.owner_id == owner.id))).scalar() or 0)
    if owned >= MAX_TEAMS_PER_OWNER:
        raise TeamError(_("最多创建 {n} 个团队", n=MAX_TEAMS_PER_OWNER))
    team = Team(name=name, owner_id=owner.id, seats=int(get_settings().team_free_seats or 1))
    db.add(team)
    await db.flush()
    db.add(TeamMember(team_id=team.id, user_id=owner.id, role="owner"))
    await db.flush()
    return team


async def rename_team(db: AsyncSession, team: Team, name: str) -> None:
    name = (name or "").strip()[:64]
    if not name:
        raise TeamError(_("请填写团队名称"))
    team.name = name


async def set_role(db: AsyncSession, team: Team, actor: TeamMember, user_id: int, role: str) -> None:
    """owner 才能改角色；不能改 owner，不能设成 owner。"""
    if actor.role != "owner":
        raise TeamError(_("只有团队所有者可以修改角色"))
    if role not in ("admin", "member"):
        raise TeamError(_("角色无效"))
    target = await membership(db, team.id, int(user_id))
    if target is None:
        raise TeamError(_("成员不存在"))
    if target.role == "owner":
        raise TeamError(_("不能修改所有者的角色"))
    target.role = role


async def remove_member(db: AsyncSession, team: Team, actor: TeamMember, user_id: int) -> None:
    """管理员移除成员，或成员自己退出；owner 不能被移除。"""
    target = await membership(db, team.id, int(user_id))
    if target is None:
        raise TeamError(_("成员不存在"))
    if target.role == "owner":
        raise TeamError(_("不能移除团队所有者"))
    leaving_self = int(user_id) == int(actor.user_id)
    if not leaving_self:
        if actor.role not in MANAGER_ROLES:
            raise TeamError(_("需要团队管理员权限"))
        if target.role == "admin" and actor.role != "owner":
            raise TeamError(_("只有团队所有者可以移除管理员"))
    await db.delete(target)


# ── 邀请 ─────────────────────────────────────────────


def invite_link(token: str) -> str:
    s = get_settings()
    base = str(s.app_public_url or s.public_base_url or "").rstrip("/")
    return f"{base}/teams/invite?token={token}"


async def create_invite(db: AsyncSession, team: Team, actor: User, email: str, role: str = "member") -> tuple[TeamInvite, str]:
    """发邀请：席位不足（成员 + 未过期邀请 ≥ 席位）时拒绝。返回 (邀请, 明文 token)。"""
    email = (email or "").strip().lower()
    if "@" not in email or len(email) > 255:
        raise TeamError(_("邮箱格式不正确"))
    if role not in ("admin", "member"):
        raise TeamError(_("角色无效"))
    existing_user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing_user and await membership(db, team.id, existing_user.id):
        raise TeamError(_("该用户已是团队成员"))
    used = await member_count(db, team.id) + await pending_invite_count(db, team.id)
    if used >= int(team.seats or 1):
        raise TeamError(_("席位已满（{n} 个），请先增加席位", n=int(team.seats or 1)))
    token = secrets.token_urlsafe(32)
    invite = TeamInvite(
        team_id=team.id,
        email=email,
        role=role,
        token_hash=_hash(token),
        invited_by=actor.id,
        expires_at=datetime.now(UTC) + INVITE_TTL,
    )
    db.add(invite)
    await db.flush()
    body = (
        _("{who} 邀请你加入 Prismreel 团队「{team}」。", who=actor.nickname or actor.email, team=team.name)
        + "\n\n"
        + _("7 天内打开以下链接接受邀请：")
        + f"\n{invite_link(token)}\n"
    )
    sent = await send_email(to_addrs=[email], subject=_("Prismreel 团队邀请"), body=body)
    if not sent:
        logger.warning("team invite email not sent team=%s email=%s", team.id, email)
    return invite, token


async def _invite_by_token(db: AsyncSession, token: str) -> TeamInvite:
    invite = (
        await db.execute(select(TeamInvite).where(TeamInvite.token_hash == _hash((token or "").strip())).with_for_update())
    ).scalar_one_or_none()
    if invite is None or invite.accepted_at is not None or _aware(invite.expires_at) <= datetime.now(UTC):
        raise TeamError(_("邀请链接无效或已过期"))
    return invite


async def preview_invite(db: AsyncSession, token: str) -> dict[str, Any]:
    """未登录也可预览：团队名、邀请人、受邀邮箱。"""
    invite = await _invite_by_token(db, token)
    team = await db.get(Team, invite.team_id)
    inviter = await db.get(User, invite.invited_by)
    return {
        "team_name": team.name if team else "",
        "inviter": (inviter.nickname or inviter.email) if inviter else "",
        "email": invite.email,
        "role": invite.role,
        "expires_at": invite.expires_at.isoformat(),
    }


async def accept_invite(db: AsyncSession, user: User, token: str) -> Team:
    """接受邀请：登录邮箱须与受邀邮箱一致（防止链接被转发后他人占席位）。"""
    invite = await _invite_by_token(db, token)
    if (user.email or "").lower() != invite.email:
        raise TeamError(_("请使用受邀邮箱 {email} 登录后再接受邀请", email=invite.email))
    team = await db.get(Team, invite.team_id)
    if team is None:
        raise TeamError(_("邀请链接无效或已过期"))
    if await membership(db, team.id, user.id) is None:
        # 本邀请已占一个席位，所以只需成员数 < 席位
        if await member_count(db, team.id) >= int(team.seats or 1):
            raise TeamError(_("席位已满（{n} 个），请先增加席位", n=int(team.seats or 1)))
        db.add(TeamMember(team_id=team.id, user_id=user.id, role=invite.role))
    invite.accepted_at = datetime.now(UTC)
    invite.accepted_by = user.id
    await db.flush()
    return team


async def revoke_invite(db: AsyncSession, team: Team, invite_id: int) -> None:
    invite = await db.get(TeamInvite, int(invite_id))
    if invite is None or invite.team_id != team.id or invite.accepted_at is not None:
        raise TeamError(_("邀请不存在"))
    await db.delete(invite)


# ── 额度分配 ─────────────────────────────────────────


async def allocate(db: AsyncSession, team: Team, actor: User, user_id: int, amount: int) -> dict[str, int]:
    """管理员把自己的额度转给成员（成员拿到永久额度）。"""
    amount = int(amount)
    if amount <= 0:
        raise TeamError(_("金额必须大于 0"))
    target_member = await membership(db, team.id, int(user_id))
    if target_member is None:
        raise TeamError(_("成员不存在"))
    if int(user_id) == int(actor.id):
        raise TeamError(_("不能给自己分配"))
    # 固定加锁顺序（按 user id）避免互相转账死锁
    first, second = sorted((int(actor.id), int(user_id)))
    locked = {first: await _lock_user(db, first), second: await _lock_user(db, second)}
    giver, receiver = locked[int(actor.id)], locked[int(user_id)]
    if giver is None or receiver is None:
        raise TeamError(_("成员不存在"))
    if int(giver.balance_fen or 0) < amount:
        raise TeamError(_("你的余额不足"))
    ref = f"team:{team.id}"
    await _ledger(db, giver, -amount, "team_allocate", ref_type="team", ref_id=ref, note=f"to user {receiver.id}")
    await _ledger(db, receiver, amount, "team_allocate", ref_type="team", ref_id=ref, note=f"from user {giver.id}")
    target_member.allocated_fen = int(target_member.allocated_fen or 0) + amount
    await db.flush()
    return {"giver_balance_fen": int(giver.balance_fen), "member_balance_fen": int(receiver.balance_fen)}


async def reclaim(db: AsyncSession, team: Team, actor: User, user_id: int, amount: int) -> dict[str, int]:
    """收回成员未用完的分配额度（不超过成员当前余额与累计分配额）。"""
    amount = int(amount)
    if amount <= 0:
        raise TeamError(_("金额必须大于 0"))
    target_member = await membership(db, team.id, int(user_id))
    if target_member is None or int(user_id) == int(actor.id):
        raise TeamError(_("成员不存在"))
    first, second = sorted((int(actor.id), int(user_id)))
    locked = {first: await _lock_user(db, first), second: await _lock_user(db, second)}
    taker, member_user = locked[int(actor.id)], locked[int(user_id)]
    take = min(amount, max(0, int(member_user.balance_fen or 0)), int(target_member.allocated_fen or 0))
    if take <= 0:
        raise TeamError(_("没有可收回的额度"))
    ref = f"team:{team.id}"
    await _ledger(db, member_user, -take, "team_reclaim", ref_type="team", ref_id=ref, note=f"to user {taker.id}")
    await _ledger(db, taker, take, "team_reclaim", ref_type="team", ref_id=ref, note=f"from user {member_user.id}")
    target_member.allocated_fen = int(target_member.allocated_fen or 0) - take
    await db.flush()
    return {"reclaimed_fen": take, "member_balance_fen": int(member_user.balance_fen)}


# ── 席位订阅 ─────────────────────────────────────────


async def seats_checkout(db: AsyncSession, team: Team, owner: User, seats: int, interval: str) -> dict[str, Any]:
    """购买 / 变更团队席位：新订阅走 Creem 收银台（units = 席位）；已有订阅走升级接口。"""
    from app.services import creem
    from app.services.billing.currency import billing_currency
    from app.services.payments.creem_topup import app_url, new_out_trade_no
    from app.services.payments.subscriptions import live_subscription
    from app.services.subscriptions.plans import INTERVALS, product_for

    if team.owner_id != owner.id:
        raise TeamError(_("只有团队所有者可以购买席位"))
    seats = int(seats)
    if seats < 1 or seats > 500:
        raise TeamError(_("席位数无效"))
    if seats < await member_count(db, team.id):
        raise TeamError(_("席位数不能少于当前成员数"))
    if interval not in INTERVALS:
        raise TeamError(_("未知订阅套餐"))
    if billing_currency() != "USD" or not creem.creem_configured():
        raise TeamError(_("订阅仅在美元计费时可用"))
    product = product_for("team", interval)
    if not product:
        raise TeamError(_("该套餐暂未开放购买"))
    if await live_subscription(db, owner.id, team_id=team.id) is not None:
        raise TeamError(_("该团队已有席位订阅，请在「管理订阅」中调整席位"))
    request_id = new_out_trade_no(int(owner.id), "TM")
    checkout = await creem.create_checkout(
        product_id=product,
        request_id=request_id,
        success_url=app_url("/settings", tab="team", team=team.id, subscribed="1"),
        customer_email=owner.email,
        units=seats,
        metadata={
            "kind": "subscription",
            "user_id": owner.id,
            "plan_id": "team",
            "interval": interval,
            "team_id": team.id,
            "seats": seats,
        },
    )
    return {"checkout_url": checkout["checkout_url"], "request_id": request_id}
