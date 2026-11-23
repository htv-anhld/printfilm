"""管理端：前端错误列表（服务端分页）。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_admin
from app.models import User
from app.services.error_reports import list_reports

router = APIRouter()


@router.get("/error-reports")
async def admin_error_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query("", max_length=200),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    rows, total = await list_reports(db, page=page, page_size=page_size, q=q)
    return {
        "items": [
            {
                "id": r.id,
                "message": r.message,
                "stack": r.stack,
                "url": r.url,
                "source": r.source,
                "user_agent": r.user_agent,
                "release": r.release,
                "user_id": r.user_id,
                "count": r.count,
                "first_seen_at": r.first_seen_at.isoformat() if r.first_seen_at else None,
                "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
            }
            for r in rows
        ],
        "meta": {"page": page, "page_size": page_size, "total": total},
    }
