"""回归：密文因 SECRET_KEY 错配解不开时，一次无关的「保存」不能把它删掉（2026-11-27 OSS / Creem 密钥丢失）。"""

import base64
import hashlib

from cryptography.fernet import Fernet
from sqlalchemy import select

from app.models_settings import AppSettings
from app.schemas_settings import AdminModelSettingsPatch
import pytest

import app.services.model_settings as model_settings
from app.config import reload_settings
from app.services.model_settings import ENCRYPTED_PREFIX, _decrypt_secret, patch_admin_model_settings


@pytest.fixture(autouse=True)
def _restore_settings_globals(monkeypatch):
    """保存设置会重载进程级 overlay / 路由快照；测完还原，避免污染其它测试。"""
    monkeypatch.setattr(model_settings, "_overlay", dict(model_settings._overlay))
    monkeypatch.setattr(model_settings, "_routing_snapshot", model_settings._routing_snapshot)
    yield
    monkeypatch.undo()
    reload_settings()


def _foreign_cipher(value: str) -> str:
    """用另一个 SECRET_KEY 加密（模拟错配）。"""
    key = base64.urlsafe_b64encode(hashlib.sha256(b"some-other-secret").digest())
    return ENCRYPTED_PREFIX + Fernet(key).encrypt(value.encode()).decode()


async def test_unrelated_save_keeps_undecryptable_secret(db_session):
    foreign = _foreign_cipher("old-oss-key")
    row = await db_session.get(AppSettings, "default")
    if row is None:
        row = AppSettings(id="default", config_json={})
        db_session.add(row)
    row.config_json = {**(row.config_json or {}), "flat": {"oss_access_key_id": foreign, "oss_bucket": "b1"}}
    await db_session.flush()

    await patch_admin_model_settings(db_session, AdminModelSettingsPatch(oss_bucket="b2"))
    saved = (await db_session.execute(select(AppSettings).where(AppSettings.id == "default"))).scalar_one()
    flat = saved.config_json["flat"]
    assert flat["oss_access_key_id"] == foreign  # 原密文保留
    assert flat["oss_bucket"] == "b2"


async def test_refill_replaces_undecryptable_secret(db_session):
    row = await db_session.get(AppSettings, "default")
    if row is None:
        row = AppSettings(id="default", config_json={})
        db_session.add(row)
    row.config_json = {**(row.config_json or {}), "flat": {"oss_access_key_id": _foreign_cipher("old")}}
    await db_session.flush()

    await patch_admin_model_settings(db_session, AdminModelSettingsPatch(oss_access_key_id="new-key"))
    saved = (await db_session.execute(select(AppSettings).where(AppSettings.id == "default"))).scalar_one()
    assert _decrypt_secret(saved.config_json["flat"]["oss_access_key_id"]) == "new-key"


def test_encrypt_flat_config_never_double_encrypts():
    """已是密文的字段原样保留；明文才加密。"""
    from app.services.model_settings import _encrypt_flat_config, _encrypt_secret

    cipher = _encrypt_secret("k1")
    out = _encrypt_flat_config({"oss_access_key_id": cipher, "oss_access_key_secret": "plain"})
    assert out["oss_access_key_id"] == cipher
    assert _decrypt_secret(out["oss_access_key_secret"]) == "plain"
    assert _decrypt_secret(_encrypt_flat_config(out)["oss_access_key_secret"]) == "plain"
