"""前端错误上报（对齐 Dravelio /api/error-reports）：公开接口，按 IP 限流。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_optional_user
from app.models import User
from app.services import error_reports

router = APIRouter(tags=["error-reports"])


class ErrorReportIn(BaseModel):
    message: str = Field(max_length=4000)
    stack: str | None = Field(default=None, max_length=20000)
    url: str | None = Field(default=None, max_length=2000)
    source: str | None = Field(default=None, max_length=32)
    release: str | None = Field(default=None, max_length=64)


def _client_ip(request: Request) -> str:
    """代理头优先（nginx X-Forwarded-For）。"""
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "")


@router.post("/error-reports", status_code=202)
async def report_error(
    body: ErrorReportIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> dict[str, Any]:
    """记录一条前端错误；超过限流直接丢弃（仍返回 202，避免前端重试风暴）。"""
    if not error_reports.allow(_client_ip(request)):
        return {"ok": True, "dropped": True}
    await error_reports.record(
        db,
        body.model_dump(),
        user_id=int(user.id) if user else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return {"ok": True}
