import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import _
from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleExchangeRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
    VerifyEmailCodeRequest,
    VerifyEmailTokenRequest,
)
from app.services import storage
from app.services.auth import (
    create_access_token,
    get_user_by_email,
    hash_password,
    verify_password,
)
from app.services.password_reset import (
    InvalidTokenError,
    RedisUnavailableError,
    apply_password_reset,
    request_password_reset,
)
from app.services.profile import ProfileError, prepare_profile_update

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=400, detail=_("邮箱已注册"))
    from app.services.email_verification import mark_verified, send_verification, verification_active

    user = User(
        email=body.email.lower(),
        nickname=(body.nickname or "").strip() or _("创作者"),
        hashed_password=hash_password(body.password),
        quota_left=settings.new_user_quota,
        balance_fen=0,
        plan="free",
    )
    db.add(user)
    await db.flush()
    from app.services.partners import attribute_signup

    await attribute_signup(db, user, body.ref)
    must_verify = verification_active()
    if not must_verify:
        # 未启用邮箱验证（无 SMTP 或关闭）：注册即视为已验证并发赠金（开源版行为）
        await mark_verified(db, user)
    await db.commit()
    await db.refresh(user)
    if must_verify:
        try:
            await send_verification(user)
        except RedisUnavailableError:
            logger.warning("register: redis unavailable, verification email not sent user=%s", user.id)
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        email_verification_required=must_verify,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await get_user_by_email(db, body.email.lower())
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_("邮箱或密码错误"))
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, bool]:
    """校验当前密码后写入新密码。"""
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail=_("当前密码不正确"))
    if body.current_password == body.new_password:
        raise HTTPException(status_code=400, detail=_("新密码不能与当前密码相同"))
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """发送密码重置邮件；统一成功文案，避免邮箱枚举。"""
    try:
        return await request_password_reset(db, str(body.email))
    except RedisUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """用邮件中的一次性 token 设置新密码。"""
    try:
        await apply_password_reset(db, token=body.token, new_password=body.new_password)
    except RedisUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except InvalidTokenError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    """更新当前用户的用户名、登录邮箱与联系手机号（仅记录，无验证码）。"""
    try:
        fields = prepare_profile_update(
            nickname=(body.nickname or "").strip() or _("创作者"),
            email=body.email,
            phone=body.phone,
        )
    except ProfileError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if fields["email"] != user.email:
        taken = await get_user_by_email(db, fields["email"])
        if taken and taken.id != user.id:
            raise HTTPException(status_code=400, detail=_("该邮箱已被使用"))

    user.nickname = fields["nickname"]
    user.email = fields["email"]
    user.phone = fields["phone"]
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    """Upload or replace the current user's profile avatar."""
    content_type = (file.content_type or "").lower()
    allowed = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    ext = allowed.get(content_type)
    if not ext:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
            ext = ".jpg" if suffix == ".jpeg" else suffix
        else:
            raise HTTPException(status_code=400, detail=_("仅支持 JPG / PNG / WebP / GIF"))

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail=_("空文件"))
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail=_("头像不能超过 5MB"))

    dest = storage.user_dir(user.id) / f"avatar{ext}"
    dest.write_bytes(raw)
    user.avatar_url = storage.publish_local(dest)
    await db.commit()
    await db.refresh(user)
    return user


# ── 登录方式 / 邮箱验证 / Google 登录（对齐 Dravelio） ──


@router.get("/providers")
async def auth_providers() -> dict[str, bool]:
    """前端据此显示「Google 登录」按钮与邮箱验证流程。"""
    from app.services.email_verification import verification_active
    from app.services.google_oauth import google_configured

    return {"google": google_configured(), "email_verification": verification_active()}


@router.post("/resend-verification")
async def resend_verification(user: User = Depends(get_current_user)) -> dict[str, object]:
    """重新发送验证邮件（60 秒冷却）。"""
    from app.services.email_verification import send_verification

    try:
        return await send_verification(user)
    except RedisUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/verify-email-code", response_model=UserOut)
async def verify_email_code(
    body: VerifyEmailCodeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    """登录状态下输入 6 位验证码。"""
    from app.services.email_verification import VerificationError, verify_code

    try:
        await verify_code(db, user, body.code)
    except RedisUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except VerificationError as exc:
        await db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/verify-email", response_model=TokenResponse)
async def verify_email(body: VerifyEmailTokenRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """邮件链接验证（无需登录）；成功后直接返回登录 token。"""
    from app.services.email_verification import VerificationError, verify_link_token

    try:
        user = await verify_link_token(db, body.token)
    except RedisUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except VerificationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/google/start")
async def google_start(next: str = Query("/", max_length=512)) -> dict[str, str]:
    """返回 Google 授权地址，前端整页跳转。"""
    from app.services.google_oauth import GoogleOAuthError, authorize_url

    try:
        return {"url": authorize_url(next)}
    except GoogleOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/google/exchange")
async def google_exchange(body: GoogleExchangeRequest, db: AsyncSession = Depends(get_db)) -> dict[str, object]:
    """回调页把 code + state 交给后端换登录 token。"""
    from app.services.google_oauth import GoogleOAuthError, exchange_code, login_or_create, verify_state

    try:
        next_path = verify_state(body.state)
        profile = await exchange_code(body.code)
        user, created = await login_or_create(db, profile)
        if created:
            from app.services.partners import attribute_signup

            await attribute_signup(db, user, body.ref)
    except GoogleOAuthError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    return {
        "access_token": create_access_token(str(user.id)),
        "token_type": "bearer",
        "next": next_path,
        "created": created,
    }
