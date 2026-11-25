# -*- coding: utf-8 -*-
"""邮箱验证：6 位验证码 + 一次性链接（Redis 存哈希），验证后发放注册赠金。

对齐 Dravelio：/auth/verify-email（链接）、/auth/verify-email-code（验证码）、/auth/resend-verification。
只有 SMTP 可用且 EMAIL_VERIFICATION_REQUIRED=true 时才强制；否则注册即视为已验证（开源版行为）。
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.i18n import _
from app.models import User, WalletLedger
from app.services.email import _smtp_configured, send_email
from app.services.password_reset import RedisUnavailableError, get_redis_client

logger = logging.getLogger(__name__)

CODE_TTL_SECONDS = 30 * 60
RESEND_COOLDOWN_SECONDS = 60
MAX_ATTEMPTS = 5


class VerificationError(Exception):
    """验证码 / 链接无效、过期或尝试过多。"""


def verification_active() -> bool:
    """是否强制邮箱验证（需要 SMTP，否则用户永远收不到码）。"""
    s = get_settings()
    return bool(s.email_verification_required) and _smtp_configured(s)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _user_key(user_id: int) -> str:
    return f"emailverify:user:{user_id}"


def _token_key(token_hash: str) -> str:
    return f"emailverify:tok:{token_hash}"


def _cooldown_key(user_id: int) -> str:
    return f"emailverify:cd:{user_id}"


def _issue(redis_client: Any, user_id: int) -> tuple[str, str]:
    """签发新的 (验证码, 链接 token)，旧的同时作废。"""
    old = redis_client.get(_user_key(user_id))
    if old:
        try:
            redis_client.delete(_token_key(json.loads(old).get("token_hash", "")))
        except (ValueError, AttributeError):
            pass
    code = f"{secrets.randbelow(1_000_000):06d}"
    token = secrets.token_urlsafe(32)
    record = {"code_hash": _hash(code), "token_hash": _hash(token), "attempts": 0}
    pipe = redis_client.pipeline()
    pipe.setex(_user_key(user_id), CODE_TTL_SECONDS, json.dumps(record))
    pipe.setex(_token_key(record["token_hash"]), CODE_TTL_SECONDS, str(user_id))
    pipe.execute()
    return code, token


def _clear(redis_client: Any, user_id: int) -> None:
    raw = redis_client.get(_user_key(user_id))
    if raw:
        try:
            redis_client.delete(_token_key(json.loads(raw).get("token_hash", "")))
        except (ValueError, AttributeError):
            pass
    redis_client.delete(_user_key(user_id))


def build_verify_link(token: str) -> str:
    """用户端验证页：/auth?mode=verify&token=…"""
    s = get_settings()
    base = str(s.app_public_url or s.public_base_url or "").rstrip("/")
    return f"{base}/auth?mode=verify&token={token}"


async def send_verification(user: User, *, force: bool = False) -> dict[str, Any]:
    """发验证邮件（60 秒冷却）。已验证 / 未启用时直接返回。"""
    if user.email_verified_at is not None:
        return {"ok": True, "sent": False, "verified": True}
    if not verification_active():
        return {"ok": True, "sent": False, "verified": False}
    redis_client = get_redis_client()
    if not force and redis_client.get(_cooldown_key(int(user.id))):
        return {"ok": True, "sent": False, "cooldown": RESEND_COOLDOWN_SECONDS}
    redis_client.setex(_cooldown_key(int(user.id)), RESEND_COOLDOWN_SECONDS, "1")
    code, token = _issue(redis_client, int(user.id))
    body = (
        _("欢迎注册 PRINTFILM。您的邮箱验证码是：")
        + f"\n\n    {code}\n\n"
        + _("也可以在 30 分钟内打开以下链接完成验证：")
        + f"\n{build_verify_link(token)}\n\n"
        + _("如非本人操作，请忽略本邮件。")
    )
    sent = await send_email(to_addrs=[user.email], subject=_("PRINTFILM 邮箱验证"), body=body)
    if not sent:
        logger.warning("verification email not sent user=%s", user.id)
    return {"ok": True, "sent": bool(sent)}


async def grant_signup_bonus(db: AsyncSession, user: User) -> int:
    """发放注册赠金（每个账号一次）；返回发放额。"""
    if user.signup_grant_given:
        return 0
    grant = max(0, int(get_settings().billing_signup_grant_fen or 0))
    user.signup_grant_given = True
    if grant <= 0:
        return 0
    from app.services.billing import wallet

    if wallet.enabled():
        # 统一钱包：赠金必须登记零现金资金来源，否则余额与来源对不上（WALLET_ACCOUNT_INCONSISTENT）
        await wallet.initialize_account(db, user)
        await wallet.credit(
            db, user.id, grant, source_type="signup_grant", source_ref=str(user.id), note="signup_grant"
        )
        return grant
    user.balance_fen = int(user.balance_fen or 0) + grant
    db.add(
        WalletLedger(
            user_id=user.id,
            delta_fen=grant,
            balance_after=int(user.balance_fen),
            kind="grant",
            ref_type="signup",
            ref_id=str(user.id),
            note="signup_grant",
        )
    )
    return grant


async def mark_verified(db: AsyncSession, user: User) -> None:
    """标记已验证并发放注册赠金（幂等）。调用方 commit。"""
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(UTC)
    await grant_signup_bonus(db, user)


async def verify_code(db: AsyncSession, user: User, code: str) -> None:
    """校验 6 位验证码（最多 5 次）。"""
    if user.email_verified_at is not None:
        return
    redis_client = get_redis_client()
    raw = redis_client.get(_user_key(int(user.id)))
    if not raw:
        raise VerificationError(_("验证码已过期，请重新发送"))
    record = json.loads(raw)
    if int(record.get("attempts") or 0) >= MAX_ATTEMPTS:
        raise VerificationError(_("尝试次数过多，请重新发送验证码"))
    if not hmac.compare_digest(_hash((code or "").strip()), str(record.get("code_hash") or "")):
        record["attempts"] = int(record.get("attempts") or 0) + 1
        ttl = redis_client.ttl(_user_key(int(user.id)))
        redis_client.setex(_user_key(int(user.id)), max(1, int(ttl or CODE_TTL_SECONDS)), json.dumps(record))
        raise VerificationError(_("验证码不正确"))
    _clear(redis_client, int(user.id))
    await mark_verified(db, user)


async def verify_link_token(db: AsyncSession, token: str) -> User:
    """校验邮件链接 token（一次性），返回已验证的用户。"""
    raw = (token or "").strip()
    if not raw:
        raise VerificationError(_("验证链接无效或已过期"))
    redis_client = get_redis_client()
    uid = redis_client.getdel(_token_key(_hash(raw)))
    if not uid or not str(uid).isdigit():
        raise VerificationError(_("验证链接无效或已过期"))
    user = await db.get(User, int(uid))
    if user is None:
        raise VerificationError(_("验证链接无效或已过期"))
    redis_client.delete(_user_key(int(user.id)))
    await mark_verified(db, user)
    return user


__all__ = [
    "RedisUnavailableError",
    "VerificationError",
    "grant_signup_bonus",
    "mark_verified",
    "send_verification",
    "verification_active",
    "verify_code",
    "verify_link_token",
]
