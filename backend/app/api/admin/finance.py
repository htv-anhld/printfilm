# Admin finance daily ledger API
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_admin
from app.models import User
from app.schemas import AdminFinanceDailyOut
from app.services.admin.finance import build_finance_daily_list
from app.services.admin.upstream_usage import sync_upstream_usage

router = APIRouter(prefix="/finance", tags=["admin-finance"])


@router.get("/daily", response_model=AdminFinanceDailyOut,
    summary="查看每日财务汇总",
    description="管理员按日查看最近 days 天的本地扣费、本地成本、Token 用量、调用次数、官方实际成本与利润；days 支持 1 至 90 天。",
    response_description="操作成功，返回结果详见响应结构",
)
async def admin_finance_daily(
    days: int = Query(30, ge=1, le=90),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminFinanceDailyOut:
    """按日财务对照：本地扣费、本地成本、token、实际成本与利润。"""
    raw = await build_finance_daily_list(db, days=days)
    return AdminFinanceDailyOut(**raw)


@router.post("/daily/sync", response_model=AdminFinanceDailyOut)
async def admin_finance_daily_sync(
    days: int = Query(30, ge=1, le=90),
    force: bool = Query(False),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminFinanceDailyOut:
    """刷新官方上游成本快照后返回财务列表。"""
    try:
        await sync_upstream_usage(db, days=days, force=force)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    raw = await build_finance_daily_list(db, days=days)
    return AdminFinanceDailyOut(**raw)
