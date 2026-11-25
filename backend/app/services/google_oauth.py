# -*- coding: utf-8 -*-
"""Google 登录（OAuth 2.0 授权码流程，服务端机密客户端）。

对齐 Dravelio：/auth/google/start → 跳 Google → 回到用户端 /auth/google/callback → /auth/google/exchange。
state 用 SECRET_KEY 做 HMAC 签名（含 next 与过期时间），服务端无需存储；
id_token 交给 Google tokeninfo 校验（aud / iss / email_verified），不在本地验签。
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.i18n import _
from app.models import User
from app.services.auth import hash_password
from app.services.email_verification import mark_verified

logger = logging.getLogger(__name__)

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
VALID_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
STATE_TTL_SECONDS = 10 * 60
TIMEOUT = httpx.Timeout(connect=10.0, read=20.0, write=20.0, pool=10.0)


class GoogleOAuthError(Exception):
    """Google 登录失败（未配置 / state 无效 / 换 token 失败 / 邮箱未验证）。"""


def google_configured(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    return bool((s.google_client_id or "").strip() and (s.google_client_secret or "").strip())


def redirect_uri(settings: Settings | None = None) -> str:
    """Google 控制台里登记的回调地址（用户端页面）。"""
    s = settings or get_settings()
    explicit = (s.google_redirect_uri or "").strip()
    if explicit:
        return explicit
    return f"{(s.app_public_url or '').rstrip('/')}/auth/google/callback"


def _safe_next(next_path: str | None) -> str:
    """只允许站内相对路径，防开放重定向。"""
    raw = (next_path or "").strip()
    if not raw.startswith("/") or raw.startswith("//") or "\\" in raw:
        return "/"
    return raw[:512]


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign_state(next_path: str | None, *, now: float | None = None, settings: Settings | None = None) -> str:
    """state = base64(payload).hmac；payload 含 next、过期时间与随机数。"""
    s = settings or get_settings()
    payload = {
        "n": _safe_next(next_path),
        "e": int((now or time.time()) + STATE_TTL_SECONDS),
        "r": secrets.token_urlsafe(8),
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(s.secret_key.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_state(state: str, *, now: float | None = None, settings: Settings | None = None) -> str:
    """校验签名与有效期，返回 next 路径。"""
    s = settings or get_settings()
    try:
        body, sig = (state or "").split(".", 1)
    except ValueError as exc:
        raise GoogleOAuthError(_("登录状态无效，请重新登录")) from exc
    expected = _b64(hmac.new(s.secret_key.encode(), body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, sig):
        raise GoogleOAuthError(_("登录状态无效，请重新登录"))
    try:
        payload = json.loads(_unb64(body))
    except ValueError as exc:
        raise GoogleOAuthError(_("登录状态无效，请重新登录")) from exc
    if int(payload.get("e") or 0) < int(now or time.time()):
        raise GoogleOAuthError(_("登录已超时，请重新登录"))
    return _safe_next(payload.get("n"))


def authorize_url(next_path: str | None = None) -> str:
    """生成 Google 授权地址。"""
    s = get_settings()
    if not google_configured(s):
        raise GoogleOAuthError(_("未配置 Google 登录"))
    params = {
        "client_id": s.google_client_id,
        "redirect_uri": redirect_uri(s),
        "response_type": "code",
        "scope": "openid email profile",
        "state": sign_state(next_path, settings=s),
        "prompt": "select_account",
        "access_type": "online",
    }
    return f"{AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict[str, Any]:
    """授权码 → id_token → tokeninfo 校验，返回 {sub, email, name, picture}。"""
    s = get_settings()
    if not google_configured(s):
        raise GoogleOAuthError(_("未配置 Google 登录"))
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            token_res = await client.post(
                TOKEN_URL,
                data={
                    "code": code,
                    "client_id": s.google_client_id,
                    "client_secret": s.google_client_secret,
                    "redirect_uri": redirect_uri(s),
                    "grant_type": "authorization_code",
                },
            )
            if token_res.status_code >= 400:
                logger.warning("google token exchange failed %s %s", token_res.status_code, token_res.text[:300])
                raise GoogleOAuthError(_("Google 登录失败，请重试"))
            id_token = str(token_res.json().get("id_token") or "")
            if not id_token:
                raise GoogleOAuthError(_("Google 登录失败，请重试"))
            info_res = await client.get(TOKENINFO_URL, params={"id_token": id_token})
    except httpx.HTTPError as exc:
        raise GoogleOAuthError(_("连接 Google 失败，请稍后重试")) from exc
    if info_res.status_code >= 400:
        raise GoogleOAuthError(_("Google 登录失败，请重试"))
    info = info_res.json()
    return validate_tokeninfo(info, client_id=s.google_client_id)


def validate_tokeninfo(info: dict[str, Any], *, client_id: str, now: float | None = None) -> dict[str, Any]:
    """校验 aud / iss / exp / email_verified。"""
    if str(info.get("aud") or "") != client_id:
        raise GoogleOAuthError(_("Google 登录失败，请重试"))
    if str(info.get("iss") or "") not in VALID_ISSUERS:
        raise GoogleOAuthError(_("Google 登录失败，请重试"))
    if int(info.get("exp") or 0) < int(now or time.time()):
        raise GoogleOAuthError(_("登录已超时，请重新登录"))
    verified = str(info.get("email_verified") or "").lower() in {"true", "1"}
    email = str(info.get("email") or "").strip().lower()
    if not email or not verified:
        raise GoogleOAuthError(_("该 Google 账号的邮箱未验证"))
    return {
        "sub": str(info.get("sub") or ""),
        "email": email,
        "name": str(info.get("name") or "")[:64],
        "picture": str(info.get("picture") or "")[:512],
    }


async def login_or_create(db: AsyncSession, profile: dict[str, Any]) -> tuple[User, bool]:
    """按 google_sub → 邮箱找用户，找不到就建号（邮箱已由 Google 验证）。返回 (user, created)。"""
    sub = profile["sub"]
    user = (await db.execute(select(User).where(User.google_sub == sub))).scalar_one_or_none() if sub else None
    created = False
    if user is None:
        user = (await db.execute(select(User).where(User.email == profile["email"]))).scalar_one_or_none()
        if user is not None and user.google_sub and user.google_sub != sub:
            raise GoogleOAuthError(_("该邮箱已绑定其它 Google 账号"))
    if user is None:
        s = get_settings()
        user = User(
            email=profile["email"],
            nickname=profile["name"] or _("创作者"),
            # 随机密码：Google 用户可再用「忘记密码」设置邮箱密码
            hashed_password=hash_password(secrets.token_urlsafe(24)),
            quota_left=s.new_user_quota,
            balance_fen=0,
            plan="free",
            avatar_url=profile["picture"],
        )
        db.add(user)
        await db.flush()
        created = True
    if sub and not user.google_sub:
        user.google_sub = sub
    # Google 已验证邮箱：等同邮箱验证，并发放注册赠金（幂等）
    await mark_verified(db, user)
    return user, created
