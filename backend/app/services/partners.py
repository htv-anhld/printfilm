# -*- coding: utf-8 -*-
"""合作伙伴计划（对齐 Dravelio /api/partner-program/{apply,dashboard,me,submissions}）。

- 归因：注册时带 ref 码 → users.referred_by_partner_id（不能自荐）
- 佣金：被推荐用户在注册后 N 个月内每笔实付（credit 包 / 订阅）按比例计佣；
  同一笔支付只计一次（source 唯一）；先 held，冷静期（覆盖退款窗口）后 available；退款则 reversed
- 兑付：可用佣金一键兑换为 credit（ledger partner_redeem），或由管理员线下打款后标记 paid
- 推广内容：提交链接，管理员审核通过后发 credit 奖励（ledger partner_reward）
"""
from __future__ import annotations

import logging
import secrets
import string
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.i18n import _
from app.models import User
from app.models_commerce import PartnerAccount, PartnerCommission, PartnerSubmission
from app.services.billing.settlement import _ledger, _lock_user

logger = logging.getLogger(__name__)

CODE_ALPHABET = string.ascii_uppercase + string.digits


class PartnerError(Exception):
    """合作伙伴业务错误。"""


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def normalize_code(code: str | None) -> str:
    return "".join(ch for ch in (code or "").upper() if ch in CODE_ALPHABET)[:24]


async def _new_code(db: AsyncSession) -> str:
    for _i in range(10):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
        exists = (await db.execute(select(PartnerAccount.id).where(PartnerAccount.ref_code == code))).first()
        if not exists:
            return code
    raise PartnerError(_("生成推广码失败，请重试"))


def ref_link(code: str) -> str:
    s = get_settings()
    base = str(s.app_public_url or s.public_base_url or "").rstrip("/")
    return f"{base}/?ref={code}"


def rate_of(partner: PartnerAccount) -> float:
    if partner.commission_rate is not None:
        return max(0.0, min(1.0, float(partner.commission_rate)))
    return max(0.0, min(1.0, float(get_settings().partner_commission_rate or 0)))


# ── 申请 / 资料 ─────────────────────────────────────────


async def get_partner(db: AsyncSession, user_id: int) -> PartnerAccount | None:
    return (await db.execute(select(PartnerAccount).where(PartnerAccount.user_id == int(user_id)))).scalar_one_or_none()


async def apply(db: AsyncSession, user: User, *, channel: str, website: str, audience: str, note: str) -> PartnerAccount:
    """提交 / 重新提交申请（被拒后可再申请；已通过则只更新资料）。"""
    partner = await get_partner(db, user.id)
    if partner is None:
        partner = PartnerAccount(user_id=user.id, ref_code=await _new_code(db))
        db.add(partner)
    partner.channel = (channel or "").strip()[:64]
    partner.website = (website or "").strip()[:512]
    partner.audience = (audience or "").strip()[:64]
    partner.note = (note or "").strip()[:1000]
    if partner.status in ("pending", "rejected"):
        partner.status = "approved" if get_settings().partner_auto_approve else "pending"
        if partner.status == "approved":
            partner.reviewed_at = _now()
    await db.flush()
    return partner


def partner_out(partner: PartnerAccount | None) -> dict[str, Any]:
    if partner is None:
        return {"status": "none"}
    approved = partner.status == "approved"
    return {
        "status": partner.status,
        "ref_code": partner.ref_code if approved else None,
        "ref_link": ref_link(partner.ref_code) if approved else None,
        "commission_rate": rate_of(partner),
        "channel": partner.channel,
        "website": partner.website,
        "audience": partner.audience,
        "note": partner.note,
        "review_note": partner.review_note,
        "created_at": partner.created_at.isoformat() if partner.created_at else None,
    }


# ── 归因 ───────────────────────────────────────────────


async def attribute_signup(db: AsyncSession, user: User, code: str | None) -> bool:
    """注册时归因：码有效、合作伙伴已通过、不是自己、尚未归因。"""
    norm = normalize_code(code)
    if not norm or user.referred_by_partner_id:
        return False
    partner = (
        await db.execute(select(PartnerAccount).where(PartnerAccount.ref_code == norm, PartnerAccount.status == "approved"))
    ).scalar_one_or_none()
    if partner is None or partner.user_id == user.id:
        return False
    user.referred_by_partner_id = partner.id
    return True


# ── 计佣 / 冲正 ─────────────────────────────────────────


async def record_commission(
    db: AsyncSession,
    *,
    user_id: int,
    paid_fen: int,
    source_type: str,
    source_id: str,
    alt_refs: list[str] | None = None,
) -> PartnerCommission | None:
    """被推荐用户的一笔实付计佣（幂等）。不在归因期内 / 无推荐人 / 金额 ≤ 0 时返回 None。"""
    if paid_fen <= 0 or not source_id:
        return None
    user = await db.get(User, int(user_id))
    if user is None or not user.referred_by_partner_id:
        return None
    partner = await db.get(PartnerAccount, int(user.referred_by_partner_id))
    if partner is None or partner.status != "approved":
        return None
    s = get_settings()
    months = int(s.partner_commission_months or 0)
    created = _aware(user.created_at) or _now()
    if months > 0 and _now() > created + timedelta(days=30 * months):
        return None
    rate = rate_of(partner)
    commission = int(paid_fen * rate)
    if commission <= 0:
        return None
    row = PartnerCommission(
        partner_id=partner.id,
        referred_user_id=user.id,
        source_type=source_type,
        source_id=str(source_id)[:128],
        alt_refs=",".join(r for r in (alt_refs or []) if r)[:512],
        paid_fen=int(paid_fen),
        rate=rate,
        commission_fen=commission,
        status="held",
        available_at=_now() + timedelta(days=int(s.partner_hold_days or 0)),
    )
    try:
        async with db.begin_nested():
            db.add(row)
            await db.flush()
    except IntegrityError:
        return None
    logger.info("partner commission partner=%s user=%s source=%s:%s fen=%s", partner.id, user.id, source_type, source_id, commission)
    return row


async def reverse_commission(db: AsyncSession, refs: list[str]) -> int:
    """退款冲正：按任一单号匹配未兑付的佣金（已兑换成 credit 的从合作伙伴钱包扣回）。返回冲正条数。"""
    refs = [r for r in refs if r]
    if not refs:
        return 0
    conds = [PartnerCommission.source_id.in_(refs)]
    conds += [PartnerCommission.alt_refs.contains(r) for r in refs]
    rows = (
        await db.execute(select(PartnerCommission).where(or_(*conds), PartnerCommission.status != "reversed").with_for_update())
    ).scalars().all()
    for row in rows:
        if row.status == "redeemed":
            partner = await db.get(PartnerAccount, row.partner_id)
            owner = await _lock_user(db, partner.user_id) if partner else None
            if owner is not None:
                await _ledger(db, owner, -int(row.commission_fen), "partner_reverse", ref_type="partner_commission", ref_id=str(row.id))
        row.status = "reversed"
        row.settled_at = _now()
    await db.flush()
    return len(rows)


async def release_matured(db: AsyncSession, partner_id: int | None = None) -> int:
    """冷静期已过的 held → available（读取看板时顺带执行，幂等）。"""
    stmt = (
        update(PartnerCommission)
        .where(PartnerCommission.status == "held", PartnerCommission.available_at <= _now())
        .values(status="available")
    )
    if partner_id is not None:
        stmt = stmt.where(PartnerCommission.partner_id == int(partner_id))
    result = await db.execute(stmt)
    return int(result.rowcount or 0)


async def redeem(db: AsyncSession, user: User) -> int:
    """把全部可用佣金兑换为钱包 credit。返回兑换金额。"""
    partner = await get_partner(db, user.id)
    if partner is None or partner.status != "approved":
        raise PartnerError(_("你还不是合作伙伴"))
    await release_matured(db, partner.id)
    rows = (
        await db.execute(
            select(PartnerCommission)
            .where(PartnerCommission.partner_id == partner.id, PartnerCommission.status == "available")
            .with_for_update()
        )
    ).scalars().all()
    total = sum(int(r.commission_fen) for r in rows)
    if total <= 0:
        raise PartnerError(_("暂无可兑换的佣金"))
    owner = await _lock_user(db, user.id)
    await _ledger(db, owner, total, "partner_redeem", ref_type="partner", ref_id=str(partner.id), note=f"{len(rows)} commissions")
    for row in rows:
        row.status = "redeemed"
        row.settled_at = _now()
    await db.flush()
    return total


# ── 看板 ───────────────────────────────────────────────


async def dashboard(db: AsyncSession, user: User) -> dict[str, Any]:
    partner = await get_partner(db, user.id)
    if partner is None or partner.status != "approved":
        raise PartnerError(_("你还不是合作伙伴"))
    await release_matured(db, partner.id)
    signups = int(
        (await db.execute(select(func.count(User.id)).where(User.referred_by_partner_id == partner.id))).scalar() or 0
    )
    sums = dict(
        (
            await db.execute(
                select(PartnerCommission.status, func.coalesce(func.sum(PartnerCommission.commission_fen), 0))
                .where(PartnerCommission.partner_id == partner.id)
                .group_by(PartnerCommission.status)
            )
        ).all()
    )
    paying = int(
        (
            await db.execute(
                select(func.count(func.distinct(PartnerCommission.referred_user_id))).where(
                    PartnerCommission.partner_id == partner.id, PartnerCommission.status != "reversed"
                )
            )
        ).scalar()
        or 0
    )
    recent = (
        await db.execute(
            select(PartnerCommission).where(PartnerCommission.partner_id == partner.id).order_by(PartnerCommission.id.desc()).limit(20)
        )
    ).scalars().all()
    return {
        "partner": partner_out(partner),
        "signups": signups,
        "paying_users": paying,
        "held_fen": int(sums.get("held", 0)),
        "available_fen": int(sums.get("available", 0)),
        "redeemed_fen": int(sums.get("redeemed", 0)) + int(sums.get("paid", 0)),
        "reversed_fen": int(sums.get("reversed", 0)),
        "recent": [
            {
                "id": r.id,
                "source_type": r.source_type,
                "paid_fen": r.paid_fen,
                "commission_fen": r.commission_fen,
                "status": r.status,
                "available_at": r.available_at.isoformat(),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in recent
        ],
        "hold_days": int(get_settings().partner_hold_days or 0),
    }


# ── 推广内容 ───────────────────────────────────────────


async def submit(db: AsyncSession, user: User, *, url: str, platform: str, note: str) -> PartnerSubmission:
    partner = await get_partner(db, user.id)
    if partner is None or partner.status != "approved":
        raise PartnerError(_("你还不是合作伙伴"))
    url = (url or "").strip()
    if not url.lower().startswith(("http://", "https://")) or len(url) > 1000:
        raise PartnerError(_("请填写有效的链接"))
    pending = int(
        (
            await db.execute(
                select(func.count(PartnerSubmission.id)).where(
                    PartnerSubmission.partner_id == partner.id, PartnerSubmission.status == "pending"
                )
            )
        ).scalar()
        or 0
    )
    if pending >= 20:
        raise PartnerError(_("待审核的提交过多，请等待审核"))
    row = PartnerSubmission(partner_id=partner.id, url=url, platform=(platform or "")[:32], note=(note or "")[:1000])
    db.add(row)
    await db.flush()
    return row


async def list_submissions(db: AsyncSession, user: User) -> list[dict[str, Any]]:
    partner = await get_partner(db, user.id)
    if partner is None:
        return []
    rows = (
        await db.execute(
            select(PartnerSubmission).where(PartnerSubmission.partner_id == partner.id).order_by(PartnerSubmission.id.desc()).limit(100)
        )
    ).scalars().all()
    return [submission_out(r) for r in rows]


def submission_out(r: PartnerSubmission) -> dict[str, Any]:
    return {
        "id": r.id,
        "url": r.url,
        "platform": r.platform,
        "note": r.note,
        "status": r.status,
        "reward_fen": int(r.reward_fen or 0),
        "review_note": r.review_note,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ── 管理端 ─────────────────────────────────────────────


async def review_partner(db: AsyncSession, partner_id: int, *, status: str, rate: float | None, note: str) -> PartnerAccount:
    if status not in ("approved", "rejected", "suspended", "pending"):
        raise PartnerError(_("状态无效"))
    partner = await db.get(PartnerAccount, int(partner_id))
    if partner is None:
        raise PartnerError(_("合作伙伴不存在"))
    partner.status = status
    partner.commission_rate = None if rate is None else max(0.0, min(1.0, float(rate)))
    partner.review_note = (note or "")[:512]
    partner.reviewed_at = _now()
    await db.flush()
    return partner


async def review_submission(db: AsyncSession, submission_id: int, *, status: str, reward_fen: int, note: str) -> PartnerSubmission:
    """审核推广内容；通过且奖励 > 0 时给合作伙伴发 credit（只发一次）。"""
    if status not in ("approved", "rejected"):
        raise PartnerError(_("状态无效"))
    row = (
        await db.execute(select(PartnerSubmission).where(PartnerSubmission.id == int(submission_id)).with_for_update())
    ).scalar_one_or_none()
    if row is None:
        raise PartnerError(_("提交不存在"))
    if row.status != "pending":
        raise PartnerError(_("该提交已审核"))
    row.status = status
    row.review_note = (note or "")[:512]
    row.reviewed_at = _now()
    if status == "approved" and reward_fen > 0:
        partner = await db.get(PartnerAccount, row.partner_id)
        owner = await _lock_user(db, partner.user_id) if partner else None
        if owner is not None:
            row.reward_fen = int(reward_fen)
            await _ledger(db, owner, int(reward_fen), "partner_reward", ref_type="partner_submission", ref_id=str(row.id))
    await db.flush()
    return row


async def mark_commissions_paid(db: AsyncSession, partner_id: int) -> int:
    """线下打款后把该合作伙伴全部 available 佣金标记 paid。"""
    await release_matured(db, int(partner_id))
    result = await db.execute(
        update(PartnerCommission)
        .where(PartnerCommission.partner_id == int(partner_id), PartnerCommission.status == "available")
        .values(status="paid", settled_at=_now())
    )
    return int(result.rowcount or 0)
