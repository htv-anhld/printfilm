# -*- coding: utf-8 -*-
"""OAuth 2.1 授权服务器（供 MCP 客户端 / 第三方应用代用户调用 /api/v1 与 /api/mcp）。

- 授权码 + PKCE（S256，强制）；机密客户端额外校验 client_secret
- 动态客户端注册（RFC 7591）：MCP 客户端（如 Claude connector）自助注册为公共客户端
- access token = 一行 user_api_keys（oauth_app_id + expires_at），沿用现有 Bearer 鉴权与撤销
- refresh token 轮换：每次刷新作废旧令牌
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode, urlsplit

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.i18n import _
from app.models import User
from app.models_api import UserApiKey
from app.models_commerce import OAuthApp, OAuthCode, OAuthRefreshToken
from app.services.api_keys import generate_api_key

CODE_TTL = timedelta(minutes=10)
ACCESS_TTL = timedelta(hours=1)
REFRESH_TTL = timedelta(days=30)
SCOPES = ("generate", "read")
DEFAULT_SCOPE = "generate read"
MAX_APPS_PER_USER = 10


class OAuthError(Exception):
    """OAuth 错误；error 为 RFC 6749 错误码，交给接口层映射。"""

    def __init__(self, error: str, description: str = "") -> None:
        super().__init__(description or error)
        self.error = error
        self.description = description or error


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def issuer() -> str:
    """授权服务器标识：API 的公网地址。"""
    return str(get_settings().public_base_url or "").rstrip("/")


def metadata() -> dict[str, Any]:
    """RFC 8414 /.well-known/oauth-authorization-server。授权页在用户端站点。"""
    s = get_settings()
    api = issuer()
    app = str(s.app_public_url or api).rstrip("/")
    return {
        "issuer": api,
        "authorization_endpoint": f"{app}/oauth/authorize",
        "token_endpoint": f"{api}/api/oauth/token",
        "registration_endpoint": f"{api}/api/oauth/register",
        "revocation_endpoint": f"{api}/api/oauth/revoke",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post", "client_secret_basic"],
        "scopes_supported": list(SCOPES),
    }


def protected_resource_metadata() -> dict[str, Any]:
    """RFC 9728 /.well-known/oauth-protected-resource（MCP 客户端据此找到授权服务器）。"""
    api = issuer()
    return {
        "resource": f"{api}/api/mcp",
        "authorization_servers": [api],
        "scopes_supported": list(SCOPES),
        "bearer_methods_supported": ["header"],
    }


def normalize_scope(scope: str | None) -> str:
    """只保留支持的 scope；空则默认全部。"""
    parts = [p for p in (scope or "").split() if p in SCOPES]
    return " ".join(dict.fromkeys(parts)) or DEFAULT_SCOPE


def _valid_redirect(uri: str) -> bool:
    """https 任意主机；http 仅限 localhost / 127.0.0.1（本机客户端）；禁止 fragment。"""
    try:
        parts = urlsplit(uri)
    except ValueError:
        return False
    if parts.fragment or not parts.netloc:
        return False
    if parts.scheme == "https":
        return True
    return parts.scheme == "http" and parts.hostname in {"localhost", "127.0.0.1"}


# ── 客户端 ─────────────────────────────────────────────


async def create_app(
    db: AsyncSession,
    *,
    name: str,
    redirect_uris: list[str],
    owner: User | None,
    confidential: bool,
    registration: str = "manual",
) -> tuple[OAuthApp, str | None]:
    """建客户端；返回 (应用, 明文 client_secret 或 None)。"""
    uris = [u.strip() for u in redirect_uris if u and u.strip()]
    if not uris or len(uris) > 10 or not all(_valid_redirect(u) for u in uris):
        raise OAuthError("invalid_redirect_uri", _("回调地址无效：需为 https（本机可用 http://localhost）"))
    if owner is not None:
        count = (
            await db.execute(
                select(OAuthApp.id).where(OAuthApp.owner_user_id == owner.id, OAuthApp.revoked_at.is_(None))
            )
        ).all()
        if len(count) >= MAX_APPS_PER_USER:
            raise OAuthError("invalid_request", _("最多创建 {n} 个应用", n=MAX_APPS_PER_USER))
    secret = f"pfs_{secrets.token_urlsafe(32)}" if confidential else None
    row = OAuthApp(
        owner_user_id=owner.id if owner else None,
        name=(name or "MCP client").strip()[:128],
        client_id=f"pfc_{secrets.token_urlsafe(18)}",
        client_secret_hash=_hash(secret) if secret else None,
        redirect_uris=uris,
        registration=registration,
    )
    db.add(row)
    await db.flush()
    return row, secret


async def app_by_client_id(db: AsyncSession, client_id: str) -> OAuthApp:
    row = (
        await db.execute(select(OAuthApp).where(OAuthApp.client_id == (client_id or "").strip(), OAuthApp.revoked_at.is_(None)))
    ).scalar_one_or_none()
    if row is None:
        raise OAuthError("invalid_client", _("应用不存在或已停用"))
    return row


def _check_secret(app: OAuthApp, client_secret: str | None) -> None:
    """机密客户端必须带正确密钥；公共客户端不校验（靠 PKCE）。"""
    if app.client_secret_hash is None:
        return
    if not client_secret or not hmac.compare_digest(_hash(client_secret), app.client_secret_hash):
        raise OAuthError("invalid_client", _("客户端密钥错误"))


def app_out(app: OAuthApp, secret: str | None = None) -> dict[str, Any]:
    out = {
        "id": app.id,
        "name": app.name,
        "client_id": app.client_id,
        "redirect_uris": list(app.redirect_uris or []),
        "confidential": app.client_secret_hash is not None,
        "registration": app.registration,
        "created_at": app.created_at.isoformat() if app.created_at else None,
    }
    if secret:
        out["client_secret"] = secret
    return out


# ── 授权 ───────────────────────────────────────────────


async def authorize_preview(db: AsyncSession, *, client_id: str, redirect_uri: str) -> dict[str, Any]:
    """同意页展示：应用名、回调主机、scope 说明。回调地址必须预先登记。"""
    app = await app_by_client_id(db, client_id)
    if redirect_uri not in (app.redirect_uris or []):
        raise OAuthError("invalid_request", _("回调地址与应用登记的不一致"))
    return {"name": app.name, "redirect_host": urlsplit(redirect_uri).hostname, "scopes": list(SCOPES)}


async def approve(
    db: AsyncSession,
    user: User,
    *,
    client_id: str,
    redirect_uri: str,
    scope: str | None,
    state: str | None,
    code_challenge: str,
    code_challenge_method: str,
) -> str:
    """用户同意 → 签发授权码，返回带 code/state 的回调 URL。"""
    app = await app_by_client_id(db, client_id)
    if redirect_uri not in (app.redirect_uris or []):
        raise OAuthError("invalid_request", _("回调地址与应用登记的不一致"))
    if (code_challenge_method or "").upper() != "S256" or not (43 <= len(code_challenge or "") <= 128):
        raise OAuthError("invalid_request", _("必须使用 PKCE（S256）"))
    code = secrets.token_urlsafe(32)
    db.add(
        OAuthCode(
            code_hash=_hash(code),
            app_id=app.id,
            user_id=user.id,
            redirect_uri=redirect_uri,
            scope=normalize_scope(scope),
            code_challenge=code_challenge,
            expires_at=_now() + CODE_TTL,
        )
    )
    await db.flush()
    params = {"code": code}
    if state:
        params["state"] = state
    sep = "&" if "?" in redirect_uri else "?"
    return f"{redirect_uri}{sep}{urlencode(params)}"


def deny_url(redirect_uri: str, state: str | None) -> str:
    params = {"error": "access_denied"}
    if state:
        params["state"] = state
    sep = "&" if "?" in redirect_uri else "?"
    return f"{redirect_uri}{sep}{urlencode(params)}"


def _pkce_ok(verifier: str, challenge: str) -> bool:
    digest = hashlib.sha256((verifier or "").encode("ascii", "ignore")).digest()
    computed = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return hmac.compare_digest(computed, challenge or "")


# ── 令牌 ───────────────────────────────────────────────


async def _issue(db: AsyncSession, app: OAuthApp, user_id: int, scope: str) -> dict[str, Any]:
    raw, prefix, key_hash = generate_api_key()
    db.add(
        UserApiKey(
            user_id=user_id,
            name=f"OAuth · {app.name}"[:64],
            key_prefix=prefix,
            key_hash=key_hash,
            oauth_app_id=app.id,
            expires_at=_now() + ACCESS_TTL,
        )
    )
    refresh = f"pfr_{secrets.token_urlsafe(32)}"
    db.add(
        OAuthRefreshToken(
            token_hash=_hash(refresh), app_id=app.id, user_id=user_id, scope=scope, expires_at=_now() + REFRESH_TTL
        )
    )
    await db.flush()
    return {
        "access_token": raw,
        "token_type": "Bearer",
        "expires_in": int(ACCESS_TTL.total_seconds()),
        "refresh_token": refresh,
        "scope": scope,
    }


async def exchange_code(
    db: AsyncSession, *, client_id: str, client_secret: str | None, code: str, redirect_uri: str, code_verifier: str
) -> dict[str, Any]:
    app = await app_by_client_id(db, client_id)
    _check_secret(app, client_secret)
    row = (
        await db.execute(select(OAuthCode).where(OAuthCode.code_hash == _hash(code or "")).with_for_update())
    ).scalar_one_or_none()
    if row is None or row.app_id != app.id:
        raise OAuthError("invalid_grant", _("授权码无效"))
    if row.used_at is not None:
        # 授权码被重放：按 RFC 6749 §4.1.2 吊销由它签发的令牌
        await revoke_app_tokens(db, app.id, row.user_id)
        raise OAuthError("invalid_grant", _("授权码已使用"))
    if _aware(row.expires_at) <= _now():
        raise OAuthError("invalid_grant", _("授权码已过期"))
    if row.redirect_uri != redirect_uri:
        raise OAuthError("invalid_grant", _("回调地址与应用登记的不一致"))
    if not _pkce_ok(code_verifier, row.code_challenge):
        raise OAuthError("invalid_grant", _("PKCE 校验失败"))
    row.used_at = _now()
    return await _issue(db, app, row.user_id, row.scope)


async def refresh(db: AsyncSession, *, client_id: str, client_secret: str | None, refresh_token: str) -> dict[str, Any]:
    app = await app_by_client_id(db, client_id)
    _check_secret(app, client_secret)
    row = (
        await db.execute(
            select(OAuthRefreshToken).where(OAuthRefreshToken.token_hash == _hash(refresh_token or "")).with_for_update()
        )
    ).scalar_one_or_none()
    if row is None or row.app_id != app.id or row.revoked_at is not None or _aware(row.expires_at) <= _now():
        raise OAuthError("invalid_grant", _("刷新令牌无效或已过期"))
    row.revoked_at = _now()
    return await _issue(db, app, row.user_id, row.scope)


async def revoke_app_tokens(db: AsyncSession, app_id: int, user_id: int) -> None:
    """撤销某用户对某应用的全部访问 / 刷新令牌（用户取消授权、授权码重放）。"""
    now = _now()
    await db.execute(
        update(UserApiKey)
        .where(UserApiKey.oauth_app_id == app_id, UserApiKey.user_id == user_id, UserApiKey.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await db.execute(
        update(OAuthRefreshToken)
        .where(OAuthRefreshToken.app_id == app_id, OAuthRefreshToken.user_id == user_id, OAuthRefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


async def authorized_apps(db: AsyncSession, user: User) -> list[dict[str, Any]]:
    """我授权过且仍有有效刷新令牌的应用。"""
    rows = (
        await db.execute(
            select(OAuthApp, OAuthRefreshToken.created_at)
            .join(OAuthRefreshToken, OAuthRefreshToken.app_id == OAuthApp.id)
            .where(
                OAuthRefreshToken.user_id == user.id,
                OAuthRefreshToken.revoked_at.is_(None),
                OAuthRefreshToken.expires_at > _now(),
            )
            .order_by(OAuthRefreshToken.created_at.desc())
        )
    ).all()
    seen: dict[int, dict[str, Any]] = {}
    for app, created in rows:
        seen.setdefault(app.id, {"id": app.id, "name": app.name, "client_id": app.client_id, "authorized_at": created.isoformat() if created else None})
    return list(seen.values())
