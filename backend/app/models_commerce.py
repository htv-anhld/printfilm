"""商业化数据表：支付渠道回调事件（幂等）等。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String, UniqueConstraint, func
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
