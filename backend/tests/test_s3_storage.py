"""S3 兼容存储（Cloudflare R2 / AWS S3 / MinIO）：用 moto 本地 S3 服务验证上传、公网 URL 与连通性自检。"""

import socket

import pytest

moto_server = pytest.importorskip("moto.server")

from app.config import get_settings  # noqa: E402
from app.services import oss  # noqa: E402


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture
def s3_settings(monkeypatch, tmp_path):
    """启动本地 moto S3，并把设置切到 provider=s3（测试结束自动还原）。"""
    import uuid

    bucket = f"pf-test-{uuid.uuid4().hex[:10]}"
    port = _free_port()
    server = moto_server.ThreadedMotoServer(ip_address="127.0.0.1", port=port, verbose=False)
    server.start()
    endpoint = f"http://127.0.0.1:{port}"
    settings = get_settings()
    for key, value in {
        "oss_enabled": True,
        "oss_provider": "s3",
        "oss_endpoint": endpoint,
        "oss_region": "us-east-1",
        "oss_bucket": bucket,
        "oss_access_key_id": "test",
        "oss_access_key_secret": "test",
        "oss_public_base": "",
        "oss_folder": "kepu",
    }.items():
        monkeypatch.setattr(settings, key, value)
    oss.reset_oss_client()
    oss._s3_client().create_bucket(Bucket=bucket)
    yield endpoint
    oss.reset_oss_client()
    server.stop()


def _make_bucket_public() -> None:
    """模拟用户在 R2/S3 控制台把桶设为公开读（桶策略）。"""
    import json

    bucket = oss.bucket_name()
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {"Effect": "Allow", "Principal": "*", "Action": "s3:GetObject", "Resource": f"arn:aws:s3:::{bucket}/*"}
        ],
    }
    oss._s3_client().put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))


def test_s3_upload_file_returns_public_url(s3_settings, tmp_path):
    """upload_file 上传到桶，返回 path-style 公网 URL，且可匿名读回原内容。"""
    import httpx

    src = tmp_path / "shot.png"
    src.write_bytes(b"\x89PNG fake image")
    _make_bucket_public()
    url = oss.upload_file(src, "kepu/generated/p1/shot.png")
    assert url == f"{s3_settings}/{get_settings().oss_bucket}/kepu/generated/p1/shot.png"
    assert httpx.get(url).content == b"\x89PNG fake image"


def test_s3_public_base_used_for_r2_domain(s3_settings, monkeypatch):
    """配置了公网域名（如 R2 的 pub-xxx.r2.dev）时，返回 URL 走该域名。"""
    monkeypatch.setattr(get_settings(), "oss_public_base", "https://pub-abc.r2.dev/")
    assert oss.public_url("kepu/a.png") == "https://pub-abc.r2.dev/kepu/a.png"


def test_check_storage_reports_upload_and_public_access(s3_settings):
    """后台「测试连接」：上传成功且公网可读时 ok=True，并清理测试对象。"""
    _make_bucket_public()
    result = oss.check_storage()
    assert result["provider"] == "s3"
    assert result["upload_ok"] and result["public_ok"] and result["ok"], result
    keys = oss._s3_client().list_objects_v2(Bucket=get_settings().oss_bucket).get("KeyCount", 0)
    assert keys == 0


def test_check_storage_flags_private_bucket(s3_settings):
    """桶未公开时：能上传但公网读 403 → public_ok=False，提示用户打开公开访问。"""
    result = oss.check_storage()
    assert result["upload_ok"] is True
    assert result["public_ok"] is False and result["ok"] is False
    assert "403" in result["error"]


def test_s3_tolerates_pasted_whitespace_and_bucket_in_endpoint(s3_settings, monkeypatch):
    """复制粘贴常见错误：桶名前后空白、endpoint 末尾带 /桶名 → 自动清洗后仍能上传。"""
    bucket = get_settings().oss_bucket
    monkeypatch.setattr(get_settings(), "oss_bucket", f" {bucket}\n")
    monkeypatch.setattr(get_settings(), "oss_endpoint", f"{s3_settings}/{bucket} ")
    oss.reset_oss_client()
    _make_bucket_public()
    url = oss.upload_bytes(b"x", "kepu/w.txt", content_type="text/plain")
    assert url == f"{s3_settings}/{bucket}/kepu/w.txt"


def test_aliyun_remains_default_provider(monkeypatch):
    """未设置 provider 时仍是阿里云 OSS。"""
    monkeypatch.setattr(get_settings(), "oss_provider", "")
    assert oss.provider() == "aliyun"
