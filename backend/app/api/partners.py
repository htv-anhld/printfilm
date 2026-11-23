"""合作伙伴计划 API（对齐 Dravelio /api/partner-program/*）。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.services import partners as svc

router = APIRouter(prefix="/partner-program", tags=["partners"])


class ApplyBody(BaseModel):
    channel: str = Field(default="", max_length=64)
    website: str = Field(default="", max_length=512)
    audience: str = Field(default="", max_length=64)
    note: str = Field(default="", max_length=1000)


class SubmissionBody(BaseModel):
    url: str = Field(min_length=8, max_length=1000)
    platform: str = Field(default="", max_length=32)
    note: str = Field(default="", max_length=1000)


async def _run(db: AsyncSession, coro):
    try:
        result = await coro
    except svc.PartnerError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    return result


@router.get("/me")
async def me(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return svc.partner_out(await svc.get_partner(db, user.id))


@router.post("/apply")
async def apply(body: ApplyBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    partner = await _run(db, svc.apply(db, user, **body.model_dump()))
    return svc.partner_out(partner)


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return await _run(db, svc.dashboard(db, user))


@router.post("/redeem")
async def redeem(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """把可用佣金兑换成钱包 credit。"""
    amount = await _run(db, svc.redeem(db, user))
    return {"ok": True, "redeemed_fen": amount}


@router.get("/submissions")
async def submissions(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return {"items": await svc.list_submissions(db, user)}


@router.post("/submissions")
async def create_submission(body: SubmissionBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = await _run(db, svc.submit(db, user, **body.model_dump()))
    return svc.submission_out(row)
