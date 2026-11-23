"""商业化数据表：支付渠道回调事件（幂等）、订阅与月额度发放。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PaymentEvent(Base):
    """支付渠道 webhook 事件：按 (provider, event_id) 去重，重放 / 重试不重复入账。"""

    __tablename__ = "payment_events"
    __table_args__ = (UniqueConstraint("provider", "event_id", name="uq_payment_events_provider_event"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(16), index=True)
    event_id: Mapped[str] = mapped_column(String(128))
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    # processed | ignored | failed
    status: Mapped[str] = mapped_column(String(16), default="processed")
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Subscription(Base):
    """订阅：一个用户同一时刻最多一条有效订阅（active / trialing / past_due / scheduled_cancel）。

    月额度（credits_per_period）每个计费月发放一次，月底未用完即过期；
    年付也按月发放（next_grant_at 驱动），避免一次性发 12 个月后退款难追回。
    """

    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[str] = mapped_column(String(32))
    # month | year
    interval: Mapped[str] = mapped_column(String(8), default="month")
    # active | trialing | past_due | unpaid | paused | scheduled_cancel | canceled | expired
    status: Mapped[str] = mapped_column(String(24), default="active", index=True)
    provider: Mapped[str] = mapped_column(String(16), default="creem")
    provider_sub_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    provider_customer_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    credits_per_period: Mapped[int] = mapped_column(Integer, default=0)
    max_concurrent: Mapped[int] = mapped_column(Integer, default=0)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 下次发放月额度的时间（年付按月推进；月付等续费事件）
    next_grant_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_grant_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SubscriptionGrant(Base):
    """月额度发放记录：(subscription_id, period_key) 唯一，事件重放 / 调度重跑不重复发。"""

    __tablename__ = "subscription_grants"
    __table_args__ = (UniqueConstraint("subscription_id", "period_key", name="uq_subscription_grants_period"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subscription_id: Mapped[int] = mapped_column(ForeignKey("subscriptions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    # 计费月起始日 YYYY-MM-DD
    period_key: Mapped[str] = mapped_column(String(16))
    credit_fen: Mapped[int] = mapped_column(Integer)
    expired_fen: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClientErrorReport(Base):
    """前端运行时错误上报：按 fingerprint 聚合，重复出现只累加次数。"""

    __tablename__ = "client_error_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    message: Mapped[str] = mapped_column(String(1000))
    stack: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="window")
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    release: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # 最近一次上报的用户（可空）
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    count: Mapped[int] = mapped_column(Integer, default=1)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
