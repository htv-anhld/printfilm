"""团队 API（对齐 Dravelio /api/teams、/teams/invites/{accept,preview}）。"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.services import teams as svc

router = APIRouter(prefix="/teams", tags=["teams"])


class TeamNameBody(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class InviteBody(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    role: Literal["admin", "member"] = "member"


class RoleBody(BaseModel):
    role: Literal["admin", "member"]


class AmountBody(BaseModel):
    amount_fen: int = Field(gt=0, le=100_000_000)


class AcceptBody(BaseModel):
    token: str = Field(min_length=8, max_length=256)


class SeatsBody(BaseModel):
    seats: int = Field(ge=1, le=500)
    interval: Literal["month", "year"] = "month"


async def _run(db: AsyncSession, coro):
    """团队业务错误统一 400；成功后提交。"""
    from app.services.creem import CreemError

    try:
        result = await coro
    except svc.TeamError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CreemError as exc:
        await db.rollback()
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    await db.commit()
    return result


@router.get("")
async def list_my_teams(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return {"items": await svc.my_teams(db, user)}


@router.post("")
async def create_team(body: TeamNameBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    team = await _run(db, svc.create_team(db, user, body.name))
    _team, member = await svc.require_member(db, team.id, user)
    return await svc.team_detail(db, team, member)


@router.get("/invites/preview")
async def preview_invite(token: str = Query(min_length=8, max_length=256), db: AsyncSession = Depends(get_db)) -> dict:
    """未登录也能看邀请信息。"""
    try:
        return await svc.preview_invite(db, token)
    except svc.TeamError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/invites/accept")
async def accept_invite(body: AcceptBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    team = await _run(db, svc.accept_invite(db, user, body.token))
    return {"ok": True, "team_id": team.id, "team_name": team.name}


@router.get("/{team_id}")
async def get_team(team_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    try:
        team, member = await svc.require_member(db, team_id, user)
    except svc.TeamError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return await svc.team_detail(db, team, member)


async def _manage(db: AsyncSession, team_id: int, user: User):
    try:
        return await svc.require_member(db, team_id, user, manage=True)
    except svc.TeamError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/{team_id}")
async def rename(team_id: int, body: TeamNameBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    team, member = await _manage(db, team_id, user)
    await _run(db, svc.rename_team(db, team, body.name))
    return await svc.team_detail(db, team, member)


@router.post("/{team_id}/invites")
async def invite(team_id: int, body: InviteBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    team, _member = await _manage(db, team_id, user)
    invite_row, token = await _run(db, svc.create_invite(db, team, user, body.email, body.role))
    # 返回链接：SMTP 未配置时管理员可手动转发
    return {"id": invite_row.id, "email": invite_row.email, "link": svc.invite_link(token)}


@router.delete("/{team_id}/invites/{invite_id}")
async def revoke(team_id: int, invite_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    team, _member = await _manage(db, team_id, user)
    await _run(db, svc.revoke_invite(db, team, invite_id))
    return {"ok": True}


@router.patch("/{team_id}/members/{member_user_id}")
async def change_role(
    team_id: int, member_user_id: int, body: RoleBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    team, actor = await _manage(db, team_id, user)
    await _run(db, svc.set_role(db, team, actor, member_user_id, body.role))
    return {"ok": True}


@router.delete("/{team_id}/members/{member_user_id}")
async def remove(team_id: int, member_user_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    try:
        team, actor = await svc.require_member(db, team_id, user)
    except svc.TeamError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    await _run(db, svc.remove_member(db, team, actor, member_user_id))
    return {"ok": True}


@router.post("/{team_id}/members/{member_user_id}/allocate")
async def allocate(
    team_id: int, member_user_id: int, body: AmountBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    team, _actor = await _manage(db, team_id, user)
    return await _run(db, svc.allocate(db, team, user, member_user_id, body.amount_fen))


@router.post("/{team_id}/members/{member_user_id}/reclaim")
async def reclaim(
    team_id: int, member_user_id: int, body: AmountBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    team, _actor = await _manage(db, team_id, user)
    return await _run(db, svc.reclaim(db, team, user, member_user_id, body.amount_fen))


@router.post("/{team_id}/seats/checkout")
async def seats_checkout(
    team_id: int, body: SeatsBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    team, _actor = await _manage(db, team_id, user)
    return await _run(db, svc.seats_checkout(db, team, user, body.seats, body.interval))
