"""商业化数据表：支付渠道回调事件（幂等）、订阅与月额度发放。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
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
    # 团队席位订阅：席位数（Creem units）与所属团队；个人订阅 seats=1、team_id 为空
    seats: Mapped[int] = mapped_column(Integer, default=1)
    team_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
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


class Team(Base):
    """席位团队（本分支商业版，表 seat_teams；上游的 teams 表另作他用）：成员共用席位，owner 购买席位订阅并把额度分配给成员。"""

    __tablename__ = "seat_teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # 已购席位（含 owner）；无订阅时为免费上限
    seats: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TeamMember(Base):
    """团队成员；(team_id, user_id) 唯一。"""

    __tablename__ = "seat_team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_seat_team_members_team_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("seat_teams.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # owner | admin | member
    role: Mapped[str] = mapped_column(String(16), default="member")
    # 累计分配给该成员的额度（只做展示与对账）
    allocated_fen: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TeamInvite(Base):
    """团队邀请：邮件链接里的 token 只存哈希，7 天有效，一次性。"""

    __tablename__ = "seat_team_invites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("seat_teams.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(16), default="member")
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    invited_by: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PartnerAccount(Base):
    """合作伙伴（推广）账号：申请 → 审核 → 获得推广码与佣金。"""

    __tablename__ = "partner_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    # pending | approved | rejected | suspended
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    ref_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    # 佣金比例（0~1）；空则用全站默认
    commission_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    channel: Mapped[str] = mapped_column(String(64), default="")
    website: Mapped[str] = mapped_column(String(512), default="")
    audience: Mapped[str] = mapped_column(String(64), default="")
    note: Mapped[str] = mapped_column(String(1000), default="")
    review_note: Mapped[str] = mapped_column(String(512), default="")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PartnerCommission(Base):
    """一笔佣金：来源支付（订单 / 订阅扣款）唯一；先 held，冷静期后 available，退款则 reversed。"""

    __tablename__ = "partner_commissions"
    __table_args__ = (UniqueConstraint("source_type", "source_id", name="uq_partner_commissions_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    partner_id: Mapped[int] = mapped_column(ForeignKey("partner_accounts.id", ondelete="CASCADE"), index=True)
    referred_user_id: Mapped[int] = mapped_column(Integer, index=True)
    # order | subscription
    source_type: Mapped[str] = mapped_column(String(16))
    source_id: Mapped[str] = mapped_column(String(128))
    # 退款匹配用的其它单号（Creem order / transaction id），逗号分隔
    alt_refs: Mapped[str] = mapped_column(String(512), default="")
    paid_fen: Mapped[int] = mapped_column(Integer)
    rate: Mapped[float] = mapped_column(Float)
    commission_fen: Mapped[int] = mapped_column(Integer)
    # held | available | redeemed | paid | reversed
    status: Mapped[str] = mapped_column(String(16), default="held", index=True)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PartnerSubmission(Base):
    """合作伙伴提交的推广内容（视频 / 文章链接），审核通过可获 credit 奖励。"""

    __tablename__ = "partner_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    partner_id: Mapped[int] = mapped_column(ForeignKey("partner_accounts.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(1000))
    platform: Mapped[str] = mapped_column(String(32), default="")
    note: Mapped[str] = mapped_column(String(1000), default="")
    # pending | approved | rejected
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    reward_fen: Mapped[int] = mapped_column(Integer, default=0)
    review_note: Mapped[str] = mapped_column(String(512), default="")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OAuthApp(Base):
    """OAuth 客户端（用户自建或 MCP 客户端动态注册）。access token 以 user_api_keys 行签发。"""

    __tablename__ = "oauth_apps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # 创建者（动态注册的公共客户端为空）
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    client_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # 机密客户端的密钥哈希；公共客户端（PKCE）为空
    client_secret_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    redirect_uris: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # manual | dynamic
    registration: Mapped[str] = mapped_column(String(16), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OAuthCode(Base):
    """授权码：10 分钟、一次性、绑定 redirect_uri 与 PKCE challenge。"""

    __tablename__ = "oauth_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    app_id: Mapped[int] = mapped_column(ForeignKey("oauth_apps.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    redirect_uri: Mapped[str] = mapped_column(String(1000))
    scope: Mapped[str] = mapped_column(String(255), default="")
    code_challenge: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OAuthRefreshToken(Base):
    """刷新令牌（轮换：每次刷新作废旧的、签发新的）。"""

    __tablename__ = "oauth_refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    app_id: Mapped[int] = mapped_column(ForeignKey("oauth_apps.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scope: Mapped[str] = mapped_column(String(255), default="")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class McpRequest(Base):
    """MCP 工具调用日志（对齐 Dravelio /api/mcp/requests）。"""

    __tablename__ = "mcp_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    app_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    method: Mapped[str] = mapped_column(String(64))
    tool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # ok | error
    status: Mapped[str] = mapped_column(String(16), default="ok")
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class LibraryItem(Base):
    """素材库条目：头像 / 背景音乐 / 音效。owner 为空 = 管理员维护的全站素材，否则为用户私有。"""

    __tablename__ = "library_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # avatar | bgm | sfx
    kind: Mapped[str] = mapped_column(String(16), index=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    url: Mapped[str] = mapped_column(String(1024))
    # 本地文件（FFmpeg 合成取 BGM 用）；OSS 公网地址在 url
    local_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # bgm 的情绪标签（tense / warm / tech / epic / upbeat / calm / default）；avatar 的风格 / 性别等
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    duration_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Scene3D(Base):
    """3D 场景布局（站位 / 道具 / 机位），截图后作为构图参考图用于生图 / 生视频。"""

    __tablename__ = "studio3d_scenes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(128))
    # {objects: [...], camera: {...}, ratio: "16:9"}
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    snapshot_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CreativeProject(Base):
    """创意看板：把工具产出（图 / 视频 / 文案 / 3D 截图 / 链接）按活动归档整理。"""

    __tablename__ = "creative_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(String(1000), default="")
    # [{id, kind: image|video|text|link, url?, text?, note?, source?, added_at}]
    items: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
