"""邮箱验证（验证码 / 链接 / 赠金在验证后发放）与 Google 登录（state、tokeninfo、建号 / 绑定）。"""

from __future__ import annotations

import pytest

from app.config import get_settings
from app.services import email_verification as ev
from app.services import google_oauth as go
from tests.conftest import make_user
from tests.test_password_reset import FakeRedis


class _TtlRedis(FakeRedis):
    """补 ttl()。"""

    def ttl(self, key: str) -> int:
        return self.ttls.get(key, -2)


@pytest.fixture
def smtp_on(monkeypatch: pytest.MonkeyPatch):
    """开启 SMTP 与邮箱验证；邮件只记录不发送。"""
    s = get_settings()
    monkeypatch.setattr(s, "smtp_enabled", True)
    monkeypatch.setattr(s, "smtp_host", "smtp.test")
    monkeypatch.setattr(s, "smtp_from", "no-reply@test")
    monkeypatch.setattr(s, "email_verification_required", True)
    monkeypatch.setattr(s, "billing_signup_grant_fen", 500)
    monkeypatch.setattr(s, "app_public_url", "https://app.test")
    redis = _TtlRedis()
    monkeypatch.setattr(ev, "get_redis_client", lambda: redis)
    sent: list[str] = []

    async def fake_send(*, to_addrs, subject, body, settings=None):
        sent.append(body)
        return True

    monkeypatch.setattr(ev, "send_email", fake_send)
    return redis, sent


def _code_from(body: str) -> str:
    return next(line.strip() for line in body.splitlines() if line.strip().isdigit() and len(line.strip()) == 6)


def _token_from(body: str) -> str:
    return body.split("token=", 1)[1].split()[0]


def test_verification_inactive_without_smtp(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "smtp_enabled", False)
    monkeypatch.setattr(s, "email_verification_required", True)
    assert ev.verification_active() is False


async def test_register_requires_verification_and_grants_after(db_session, smtp_on):
    from app.api.auth import register
    from app.schemas import RegisterRequest
    from app.services.auth import get_user_by_email

    _redis, sent = smtp_on
    out = await register(RegisterRequest(email="New@Example.com", password="secret12"), db=db_session)
    assert out.email_verification_required is True
    user = await get_user_by_email(db_session, "new@example.com")
    assert user.email_verified is False
    assert user.balance_fen == 0  # 赠金要等验证
    assert len(sent) == 1 and "https://app.test/auth?mode=verify&token=" in sent[0]

    with pytest.raises(ev.VerificationError):
        await ev.verify_code(db_session, user, "000000" if _code_from(sent[0]) != "000000" else "111111")
    await ev.verify_code(db_session, user, _code_from(sent[0]))
    assert user.email_verified is True
    assert user.balance_fen == 500
    # 幂等：再次验证不重复发赠金
    await ev.mark_verified(db_session, user)
    assert user.balance_fen == 500


async def test_verify_code_attempt_limit(db_session, smtp_on):
    _redis, sent = smtp_on
    user = await make_user(db_session, balance_fen=0)
    user.email_verified_at = None
    await ev.send_verification(user)
    code = _code_from(sent[-1])
    wrong = "123456" if code != "123456" else "654321"
    for _i in range(ev.MAX_ATTEMPTS):
        with pytest.raises(ev.VerificationError):
            await ev.verify_code(db_session, user, wrong)
    with pytest.raises(ev.VerificationError):
        await ev.verify_code(db_session, user, code)  # 次数用完，正确码也拒绝


async def test_verify_link_token_once(db_session, smtp_on):
    _redis, sent = smtp_on
    user = await make_user(db_session, balance_fen=0)
    user.email_verified_at = None
    await ev.send_verification(user)
    token = _token_from(sent[-1])
    verified = await ev.verify_link_token(db_session, token)
    assert verified.id == user.id and verified.email_verified
    with pytest.raises(ev.VerificationError):
        await ev.verify_link_token(db_session, token)


async def test_resend_cooldown(db_session, smtp_on):
    _redis, sent = smtp_on
    user = await make_user(db_session, balance_fen=0)
    user.email_verified_at = None
    await ev.send_verification(user)
    second = await ev.send_verification(user)
    assert second.get("cooldown") and len(sent) == 1


def test_state_roundtrip_and_tamper(monkeypatch):
    monkeypatch.setattr(get_settings(), "secret_key", "unit-secret")
    state = go.sign_state("/pricing#plans", now=1000)
    assert go.verify_state(state, now=1001) == "/pricing#plans"
    with pytest.raises(go.GoogleOAuthError):
        go.verify_state(state, now=1000 + go.STATE_TTL_SECONDS + 1)
    body, sig = state.split(".")
    with pytest.raises(go.GoogleOAuthError):
        go.verify_state(f"{body}x.{sig}", now=1001)
    # 开放重定向：外链一律回到首页
    assert go.verify_state(go.sign_state("https://evil.com", now=1000), now=1001) == "/"
    assert go.verify_state(go.sign_state("//evil.com", now=1000), now=1001) == "/"


def test_validate_tokeninfo():
    base = {"aud": "cid", "iss": "https://accounts.google.com", "exp": "9999999999", "email": "A@B.com", "email_verified": "true", "sub": "g1"}
    assert go.validate_tokeninfo(base, client_id="cid")["email"] == "a@b.com"
    for bad in ({"aud": "other"}, {"iss": "evil"}, {"email_verified": "false"}, {"exp": "1"}):
        with pytest.raises(go.GoogleOAuthError):
            go.validate_tokeninfo({**base, **bad}, client_id="cid")


async def test_google_login_creates_and_links(db_session, monkeypatch):
    monkeypatch.setattr(get_settings(), "billing_signup_grant_fen", 500)
    profile = {"sub": "g-123", "email": "fresh@example.com", "name": "Fresh", "picture": ""}
    user, created = await go.login_or_create(db_session, profile)
    assert created and user.google_sub == "g-123" and user.email_verified and user.balance_fen == 500
    again, created2 = await go.login_or_create(db_session, profile)
    assert again.id == user.id and not created2 and again.balance_fen == 500

    # 已有邮箱密码账号：绑定 Google，不建新号
    existing = await make_user(db_session, balance_fen=0)
    linked, created3 = await go.login_or_create(db_session, {**profile, "sub": "g-999", "email": existing.email})
    assert linked.id == existing.id and not created3 and linked.google_sub == "g-999"
    # 同邮箱换了另一个 Google 账号：拒绝
    with pytest.raises(go.GoogleOAuthError):
        await go.login_or_create(db_session, {**profile, "sub": "g-other", "email": existing.email})
