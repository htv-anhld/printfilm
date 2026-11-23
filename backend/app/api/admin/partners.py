"""管理端：合作伙伴审核、佣金结算、推广内容审核。"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_admin
from app.models import User
from app.models_commerce import PartnerAccount, PartnerCommission, PartnerSubmission
from app.services import partners as svc

router = APIRouter()


class ReviewPartnerBody(BaseModel):
    status: Literal["approved", "rejected", "suspended", "pending"]
    commission_rate: float | None = Field(default=None, ge=0, le=1)
    note: str = Field(default="", max_length=512)


class ReviewSubmissionBody(BaseModel):
    status: Literal["approved", "rejected"]
    reward_fen: int = Field(default=0, ge=0, le=10_000_000)
    note: str = Field(default="", max_length=512)


async def _run(db: AsyncSession, coro):
    try:
        result = await coro
    except svc.PartnerError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    return result


@router.get("/partners")
async def list_partners(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query("", max_length=200),
    status: str = Query("", max_length=16),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await svc.release_matured(db)
    totals = (
        select(
            PartnerCommission.partner_id,
            func.sum(case((PartnerCommission.status.in_(("held", "available")), PartnerCommission.commission_fen), else_=0)).label("open"),
            func.sum(case((PartnerCommission.status == "available", PartnerCommission.commission_fen), else_=0)).label("available"),
        )
        .group_by(PartnerCommission.partner_id)
        .subquery()
    )
    signups = select(User.referred_by_partner_id.label("pid"), func.count(User.id).label("n")).group_by(User.referred_by_partner_id).subquery()
    stmt = (
        select(PartnerAccount, User.email, totals.c.open, totals.c.available, signups.c.n)
        .join(User, User.id == PartnerAccount.user_id)
        .outerjoin(totals, totals.c.partner_id == PartnerAccount.id)
        .outerjoin(signups, signups.c.pid == PartnerAccount.id)
    )
    count = select(func.count(PartnerAccount.id)).join(User, User.id == PartnerAccount.user_id)
    if q.strip():
        like = f"%{q.strip()}%"
        cond = or_(User.email.ilike(like), PartnerAccount.ref_code.ilike(like), PartnerAccount.website.ilike(like))
        stmt, count = stmt.where(cond), count.where(cond)
    if status.strip():
        stmt, count = stmt.where(PartnerAccount.status == status.strip()), count.where(PartnerAccount.status == status.strip())
    total = int((await db.execute(count)).scalar() or 0)
    rows = (await db.execute(stmt.order_by(PartnerAccount.id.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    await db.commit()
    return {
        "items": [
            {
                **svc.partner_out(p),
                "id": p.id,
                "email": email,
                "ref_code": p.ref_code,
                "signups": int(n or 0),
                "open_fen": int(open_ or 0),
                "available_fen": int(avail or 0),
            }
            for p, email, open_, avail, n in rows
        ],
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("/partners/{partner_id}/review")
async def review_partner(
    partner_id: int, body: ReviewPartnerBody, _admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
) -> dict:
    partner = await _run(db, svc.review_partner(db, partner_id, status=body.status, rate=body.commission_rate, note=body.note))
    return svc.partner_out(partner)


@router.post("/partners/{partner_id}/mark-paid")
async def mark_paid(partner_id: int, _admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)) -> dict:
    n = await _run(db, svc.mark_commissions_paid(db, partner_id))
    return {"ok": True, "marked": n}


@router.get("/partner-submissions")
async def list_submissions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query("", max_length=200),
    status: str = Query("pending", max_length=16),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = (
        select(PartnerSubmission, User.email)
        .join(PartnerAccount, PartnerAccount.id == PartnerSubmission.partner_id)
        .join(User, User.id == PartnerAccount.user_id)
    )
    count = (
        select(func.count(PartnerSubmission.id))
        .join(PartnerAccount, PartnerAccount.id == PartnerSubmission.partner_id)
        .join(User, User.id == PartnerAccount.user_id)
    )
    if status.strip():
        stmt, count = stmt.where(PartnerSubmission.status == status.strip()), count.where(PartnerSubmission.status == status.strip())
    if q.strip():
        like = f"%{q.strip()}%"
        cond = or_(User.email.ilike(like), PartnerSubmission.url.ilike(like))
        stmt, count = stmt.where(cond), count.where(cond)
    total = int((await db.execute(count)).scalar() or 0)
    rows = (await db.execute(stmt.order_by(PartnerSubmission.id.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    return {
        "items": [{**svc.submission_out(r), "email": email} for r, email in rows],
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("/partner-submissions/{submission_id}/review")
async def review_submission(
    submission_id: int, body: ReviewSubmissionBody, _admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
) -> dict:
    row = await _run(db, svc.review_submission(db, submission_id, status=body.status, reward_fen=body.reward_fen, note=body.note))
    return svc.submission_out(row)
