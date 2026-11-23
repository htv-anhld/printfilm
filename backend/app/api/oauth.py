"""OAuth 2.1 授权服务器接口 + MCP 端点（对齐 Dravelio /api/oauth/apps、/api/mcp/requests）。"""

from __future__ import annotations

import base64
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.models_commerce import McpRequest, OAuthApp
from app.services import oauth_provider as op

router = APIRouter(tags=["oauth"])
# /.well-known/* 挂在站点根（不在 /api 下），见 main.py
well_known = APIRouter(tags=["oauth"])


def _oauth_error(exc: op.OAuthError, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": exc.error, "error_description": exc.description}, status_code=status)


# ── 元数据 ─────────────────────────────────────────────


@well_known.get("/.well-known/oauth-authorization-server")
async def oauth_metadata() -> dict:
    return op.metadata()


@well_known.get("/.well-known/oauth-protected-resource")
@well_known.get("/.well-known/oauth-protected-resource/api/mcp")
async def protected_resource() -> dict:
    return op.protected_resource_metadata()


# ── 应用管理（用户自建） ─────────────────────────────────


class AppBody(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    redirect_uris: list[str] = Field(min_length=1, max_length=10)
    confidential: bool = True


@router.get("/oauth/apps")
async def list_apps(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    rows = (
        await db.execute(
            select(OAuthApp).where(OAuthApp.owner_user_id == user.id, OAuthApp.revoked_at.is_(None)).order_by(OAuthApp.id.desc())
        )
    ).scalars().all()
    return {"items": [op.app_out(r) for r in rows], "authorized": await op.authorized_apps(db, user)}


@router.post("/oauth/apps")
async def create_app(body: AppBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    try:
        app, secret = await op.create_app(
            db, name=body.name, redirect_uris=body.redirect_uris, owner=user, confidential=body.confidential
        )
    except op.OAuthError as exc:
        raise HTTPException(status_code=400, detail=exc.description) from exc
    await db.commit()
    # client_secret 只在创建时返回一次
    return op.app_out(app, secret)


@router.delete("/oauth/apps/{app_id}")
async def delete_app(app_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    from datetime import UTC, datetime

    app = await db.get(OAuthApp, app_id)
    if app is None or app.owner_user_id != user.id or app.revoked_at is not None:
        raise HTTPException(status_code=404, detail="not found")
    app.revoked_at = datetime.now(UTC)
    await db.commit()
    return {"ok": True}


@router.delete("/oauth/authorized/{app_id}")
async def revoke_authorization(app_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """取消对某应用的授权（吊销其访问 / 刷新令牌）。"""
    await op.revoke_app_tokens(db, app_id, user.id)
    await db.commit()
    return {"ok": True}


# ── 动态注册（RFC 7591）───────────────────────────────


@router.post("/oauth/register", status_code=201)
async def register_client(request: Request, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    """MCP 客户端自助注册；token_endpoint_auth_method=none 时为公共客户端（必须 PKCE）。"""
    try:
        body = await request.json()
    except ValueError:
        return JSONResponse({"error": "invalid_client_metadata"}, status_code=400)
    uris = body.get("redirect_uris") if isinstance(body, dict) else None
    if not isinstance(uris, list):
        return JSONResponse({"error": "invalid_redirect_uri"}, status_code=400)
    confidential = str(body.get("token_endpoint_auth_method") or "none") != "none"
    try:
        app, secret = await op.create_app(
            db,
            name=str(body.get("client_name") or "MCP client"),
            redirect_uris=[str(u) for u in uris],
            owner=None,
            confidential=confidential,
            registration="dynamic",
        )
    except op.OAuthError as exc:
        return _oauth_error(exc)
    await db.commit()
    out: dict[str, Any] = {
        "client_id": app.client_id,
        "client_name": app.name,
        "redirect_uris": app.redirect_uris,
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "client_secret_post" if secret else "none",
    }
    if secret:
        out["client_secret"] = secret
    return JSONResponse(out, status_code=201)


# ── 授权（同意页在用户端 /oauth/authorize，调用这两个接口）────────


@router.get("/oauth/authorize/preview")
async def authorize_preview(
    client_id: str = Query(max_length=128), redirect_uri: str = Query(max_length=1000), db: AsyncSession = Depends(get_db)
) -> dict:
    try:
        return await op.authorize_preview(db, client_id=client_id, redirect_uri=redirect_uri)
    except op.OAuthError as exc:
        raise HTTPException(status_code=400, detail=exc.description) from exc


class ApproveBody(BaseModel):
    client_id: str = Field(max_length=128)
    redirect_uri: str = Field(max_length=1000)
    scope: str | None = Field(default=None, max_length=255)
    state: str | None = Field(default=None, max_length=1000)
    code_challenge: str = Field(default="", max_length=128)
    code_challenge_method: str = Field(default="S256", max_length=10)
    approve: bool = True


@router.post("/oauth/authorize")
async def authorize(body: ApproveBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """返回要跳转的回调 URL（同意带 code，拒绝带 error=access_denied）。"""
    try:
        await op.authorize_preview(db, client_id=body.client_id, redirect_uri=body.redirect_uri)
        if not body.approve:
            return {"redirect_url": op.deny_url(body.redirect_uri, body.state)}
        url = await op.approve(
            db,
            user,
            client_id=body.client_id,
            redirect_uri=body.redirect_uri,
            scope=body.scope,
            state=body.state,
            code_challenge=body.code_challenge,
            code_challenge_method=body.code_challenge_method,
        )
    except op.OAuthError as exc:
        raise HTTPException(status_code=400, detail=exc.description) from exc
    await db.commit()
    return {"redirect_url": url}


def _basic_auth(request: Request) -> tuple[str | None, str | None]:
    header = request.headers.get("authorization") or ""
    if not header.lower().startswith("basic "):
        return None, None
    try:
        raw = base64.b64decode(header[6:]).decode("utf-8")
        cid, _sep, secret = raw.partition(":")
        return cid, secret
    except (ValueError, UnicodeDecodeError):
        return None, None


@router.post("/oauth/token")
async def token(request: Request, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    """application/x-www-form-urlencoded；支持 client_secret_post / basic / none(PKCE)。"""
    form = {k: str(v) for k, v in (await request.form()).items()}
    basic_id, basic_secret = _basic_auth(request)
    client_id = form.get("client_id") or basic_id or ""
    client_secret = form.get("client_secret") or basic_secret
    grant = form.get("grant_type") or ""
    try:
        if grant == "authorization_code":
            out = await op.exchange_code(
                db,
                client_id=client_id,
                client_secret=client_secret,
                code=form.get("code") or "",
                redirect_uri=form.get("redirect_uri") or "",
                code_verifier=form.get("code_verifier") or "",
            )
        elif grant == "refresh_token":
            out = await op.refresh(db, client_id=client_id, client_secret=client_secret, refresh_token=form.get("refresh_token") or "")
        else:
            return JSONResponse({"error": "unsupported_grant_type"}, status_code=400)
    except op.OAuthError as exc:
        await db.commit()  # 授权码重放时吊销动作要落库
        return _oauth_error(exc, 401 if exc.error == "invalid_client" else 400)
    await db.commit()
    return JSONResponse(out, headers={"Cache-Control": "no-store"})


@router.post("/oauth/revoke")
async def revoke(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    """RFC 7009：撤销访问令牌（Key）或刷新令牌；未知令牌也返回 200。"""
    from datetime import UTC, datetime

    from sqlalchemy import update

    from app.models_api import UserApiKey
    from app.models_commerce import OAuthRefreshToken
    from app.services.api_keys import _hash_key

    form = {k: str(v) for k, v in (await request.form()).items()}
    raw = form.get("token") or ""
    now = datetime.now(UTC)
    await db.execute(update(UserApiKey).where(UserApiKey.key_hash == _hash_key(raw), UserApiKey.oauth_app_id.is_not(None)).values(revoked_at=now))
    await db.execute(update(OAuthRefreshToken).where(OAuthRefreshToken.token_hash == op._hash(raw)).values(revoked_at=now))
    await db.commit()
    return Response(status_code=200)


# ── MCP ───────────────────────────────────────────────


def _unauthorized() -> JSONResponse:
    meta = f"{op.issuer()}/.well-known/oauth-protected-resource"
    return JSONResponse(
        {"error": "invalid_token"},
        status_code=401,
        headers={"WWW-Authenticate": f'Bearer resource_metadata="{meta}"'},
    )


@router.post("/mcp")
async def mcp_endpoint(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    """Streamable HTTP：一次 POST 一条 JSON-RPC 消息，返回 application/json。"""
    from app.services.api_keys import api_key_context
    from app.services.mcp_server import handle

    header = request.headers.get("authorization") or ""
    token = header[7:].strip() if header.lower().startswith("bearer ") else (request.headers.get("x-api-key") or "")
    ctx = await api_key_context(db, token) if token else None
    if ctx is None:
        return _unauthorized()
    user, key_row = ctx
    try:
        message = json.loads(await request.body())
    except ValueError:
        return JSONResponse({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}, status_code=400)
    if not isinstance(message, dict):
        return JSONResponse({"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Batching not supported"}}, status_code=400)
    response = await handle(db, user, key_row.oauth_app_id, message)
    await db.commit()
    if response is None:
        return Response(status_code=202)
    return JSONResponse(response)


@router.get("/mcp")
async def mcp_get() -> Response:
    """本服务不提供服务端推送流。"""
    return Response(status_code=405, headers={"Allow": "POST"})


@router.get("/mcp/requests")
async def mcp_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """我的 MCP 调用记录。"""
    from sqlalchemy import func

    total = int((await db.execute(select(func.count(McpRequest.id)).where(McpRequest.user_id == user.id))).scalar() or 0)
    rows = (
        await db.execute(
            select(McpRequest, OAuthApp.name)
            .outerjoin(OAuthApp, OAuthApp.id == McpRequest.app_id)
            .where(McpRequest.user_id == user.id)
            .order_by(McpRequest.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return {
        "items": [
            {
                "id": r.id,
                "app": name,
                "method": r.method,
                "tool": r.tool,
                "status": r.status,
                "summary": r.summary,
                "duration_ms": r.duration_ms,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r, name in rows
        ],
        "meta": {"page": page, "page_size": page_size, "total": total},
    }
