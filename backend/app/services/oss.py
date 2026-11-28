"""对象存储上传：Aliyun OSS 或任意 S3 兼容存储（Cloudflare R2 / AWS S3 / Backblaze B2 / MinIO）。

本地文件仍留在磁盘供 FFmpeg 使用；数据库 / 前端 / Seedance 参考图使用公网 URL。
Object key layout: {folder}/generated/p{id}/... and {folder}/ for SPA.
provider 由 settings.oss_provider 决定（aliyun | s3），两者共用 endpoint/bucket/key/secret/public_base 字段。
"""

from __future__ import annotations

import logging
import mimetypes
from functools import lru_cache
from io import BufferedIOBase
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)


def provider() -> str:
    """当前存储提供方：aliyun（默认）或 s3。"""
    return "s3" if (get_settings().oss_provider or "").strip().lower() == "s3" else "aliyun"


def bucket_name() -> str:
    """桶名（去掉复制粘贴带进来的空白 / 换行 / 斜杠）。"""
    return (get_settings().oss_bucket or "").strip().strip("/")


def _endpoint_url() -> str:
    """S3 endpoint：去空白；用户把桶名一起粘进来（…/bucket）时去掉，path-style 由 SDK 自己拼桶名。"""
    ep = (get_settings().oss_endpoint or "").strip().rstrip("/")
    if not ep.startswith("http"):
        ep = f"https://{ep}"
    bucket = bucket_name()
    if bucket and ep.lower().endswith("/" + bucket.lower()):
        ep = ep[: -(len(bucket) + 1)]
    return ep.rstrip("/")


@lru_cache
def _s3_client():
    """S3 兼容客户端（R2 region 填 auto）。"""
    import boto3
    from botocore.config import Config

    s = get_settings()
    if not s.oss_enabled:
        raise RuntimeError("OSS disabled")
    return boto3.client(
        "s3",
        endpoint_url=_endpoint_url(),
        region_name=(s.oss_region or "").strip() or "auto",
        aws_access_key_id=(s.oss_access_key_id or "").strip(),
        aws_secret_access_key=(s.oss_access_key_secret or "").strip(),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}, retries={"max_attempts": 3}),
    )


def _s3_put(key: str, body, content_type: str) -> None:
    """S3 上传（不带 ACL：R2 不支持 ACL，AWS 新桶默认禁用 ACL；公开读请在桶策略 / r2.dev 打开）。"""
    _s3_client().put_object(
        Bucket=bucket_name(),
        Key=key,
        Body=body,
        ContentType=content_type,
        CacheControl="public, max-age=31536000",
    )


@lru_cache
def _bucket():
    import oss2

    s = get_settings()
    if not s.oss_enabled:
        raise RuntimeError("OSS disabled")
    if not (bucket_name() and s.oss_access_key_id and s.oss_access_key_secret):
        raise RuntimeError("OSS credentials incomplete")
    auth = oss2.Auth(s.oss_access_key_id, s.oss_access_key_secret)
    endpoint = s.oss_endpoint.strip()
    if not endpoint.startswith("http"):
        endpoint = f"https://{endpoint}"
    return oss2.Bucket(auth, endpoint, bucket_name())


def reset_oss_client() -> None:
    """后台改 OSS 密钥后丢掉缓存的 Bucket，避免继续用已禁用的旧 Key。"""
    _bucket.cache_clear()
    _s3_client.cache_clear()


def oss_enabled() -> bool:
    s = get_settings()
    return bool(
        s.oss_enabled
        and bucket_name()
        and (s.oss_access_key_id or "").strip()
        and (s.oss_access_key_secret or "").strip()
    )


def folder_prefix() -> str:
    return get_settings().oss_folder.strip().strip("/") or "kepu"


def public_base() -> str:
    """浏览器可访问的公网基址；内网上传 endpoint 不能出现在返回 URL 里。"""
    s = get_settings()
    if s.oss_public_base.strip():
        return s.oss_public_base.strip().rstrip("/")
    if provider() == "s3":
        # 未配公网域名时退回 path-style（AWS / MinIO 公开桶可用；R2 必须填 r2.dev 或自定义域名）
        return f"{_endpoint_url()}/{bucket_name()}"
    ep = s.oss_endpoint.strip().removeprefix("https://").removeprefix("http://")
    ep = ep.replace("-internal.aliyuncs.com", ".aliyuncs.com")
    ep = ep.replace("-internal-accelerate.aliyuncs.com", ".aliyuncs.com")
    return f"https://{bucket_name()}.{ep}"


def public_url(object_key: str) -> str:
    key = object_key.lstrip("/")
    return f"{public_base()}/{key}"


def ensure_browser_cors() -> None:
    """Allow SPA origins to fetch OSS media (needed for client-side zip)."""
    if not oss_enabled():
        return
    s = get_settings()
    origins = [
        o.strip()
        for o in (s.cors_origins or "").split(",")
        if o.strip()
    ]
    # Production site + common local/dev（主站 www 优先）
    for extra in (
        "https://www.prismreel.com",
        "http://www.prismreel.com",
        "https://prismreel.com",
        "http://prismreel.com",
        "https://admin.prismreel.com",
        "http://admin.prismreel.com",
        "https://app.prismreel.com",
        "http://app.prismreel.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ):
        if extra not in origins:
            origins.append(extra)
    pub = (s.public_base_url or "").rstrip("/")
    if pub and pub not in origins:
        origins.append(pub)
    if provider() == "s3":
        try:
            _s3_client().put_bucket_cors(
                Bucket=bucket_name(),
                CORSConfiguration={
                    "CORSRules": [
                        {
                            "AllowedOrigins": origins,
                            "AllowedMethods": ["GET", "HEAD"],
                            "AllowedHeaders": ["*"],
                            "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
                            "MaxAgeSeconds": 3600,
                        }
                    ]
                },
            )
            logger.info("s3 CORS updated for %s origin(s)", len(origins))
        except Exception:  # noqa: BLE001
            logger.warning("s3 CORS update failed (token may lack bucket admin permission)", exc_info=True)
        return
    try:
        from oss2.models import BucketCors, CorsRule

        rule = CorsRule(
            allowed_origins=origins,
            allowed_methods=["GET", "HEAD"],
            allowed_headers=["*"],
            expose_headers=["ETag", "Content-Length", "Content-Type"],
            max_age_seconds=3600,
        )
        _bucket().put_bucket_cors(BucketCors([rule]))
        logger.info("oss CORS updated for %s origin(s)", len(origins))
    except Exception:  # noqa: BLE001
        logger.exception("oss CORS update failed")


def key_for_local(path: Path, *, static_root: Path) -> str:
    """Map backend/static/... → {folder}/..."""
    rel = path.resolve().relative_to(static_root.resolve()).as_posix()
    return f"{folder_prefix()}/{rel}"


def upload_file(local_path: Path, object_key: str | None = None) -> str:
    """Upload local file; return public URL. Raises on failure."""
    from app.services import storage

    path = Path(local_path)
    if not path.is_file():
        raise FileNotFoundError(str(path))
    key = object_key or key_for_local(path, static_root=storage.STATIC_ROOT)
    key = key.lstrip("/")
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if provider() == "s3":
        with path.open("rb") as fh:
            _s3_put(key, fh, mime)
        url = public_url(key)
        logger.info("s3 uploaded %s → %s", path.name, url)
        return url
    headers = {
        "Content-Type": mime,
        "x-oss-object-acl": "public-read",
    }
    bucket = _bucket()
    bucket.put_object_from_file(key, str(path), headers=headers)
    url = public_url(key)
    logger.info("oss uploaded %s → %s", path.name, url)
    return url


def upload_bytes(data: bytes, object_key: str, *, content_type: str = "application/octet-stream") -> str:
    key = object_key.lstrip("/")
    if provider() == "s3":
        _s3_put(key, data, content_type)
        return public_url(key)
    headers = {"Content-Type": content_type, "x-oss-object-acl": "public-read"}
    _bucket().put_object(key, data, headers=headers)
    return public_url(key)


# 直接将文件对象流式上传到 OSS，避免先整文件读入内存。
def upload_fileobj(fileobj: BufferedIOBase, object_key: str, *, content_type: str = "application/octet-stream") -> str:
    key = object_key.lstrip("/")
    if provider() == "s3":
        _s3_put(key, fileobj, content_type)
        return public_url(key)
    headers = {"Content-Type": content_type, "x-oss-object-acl": "public-read"}
    _bucket().put_object(key, fileobj, headers=headers)
    return public_url(key)


def upload_dir(local_dir: Path, oss_prefix: str) -> int:
    """Upload directory recursively under oss_prefix. Returns file count."""
    root = Path(local_dir)
    if not root.is_dir():
        raise NotADirectoryError(str(root))
    prefix = oss_prefix.strip().strip("/")
    count = 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        key = f"{prefix}/{rel}"
        upload_file(path, key)
        count += 1
    return count


def check_storage() -> dict:
    """
    后台「测试连接」：上传一个小文件，再从公网 URL 读回（Seedance 正是这样取参考图）。
    @returns {ok, upload_ok, public_ok, url, error}
    """
    import uuid

    import httpx

    result: dict = {"ok": False, "upload_ok": False, "public_ok": False, "url": "", "error": "", "provider": provider()}
    if not oss_enabled():
        result["error"] = "storage_disabled"
        return result
    key = f"{folder_prefix()}/_healthcheck/{uuid.uuid4().hex[:10]}.txt"
    payload = b"printfilm storage check"
    try:
        result["url"] = upload_bytes(payload, key, content_type="text/plain")
        result["upload_ok"] = True
    except Exception as exc:  # noqa: BLE001
        result["error"] = f"upload: {str(exc)[:300]}"
        return result
    try:
        resp = httpx.get(result["url"], timeout=20, follow_redirects=True)
        result["public_ok"] = resp.status_code == 200 and resp.content == payload
        if not result["public_ok"]:
            result["error"] = f"public: HTTP {resp.status_code}"
    except Exception as exc:  # noqa: BLE001
        result["error"] = f"public: {str(exc)[:300]}"
    # 清理测试对象（失败不影响结果）
    try:
        if provider() == "s3":
            _s3_client().delete_object(Bucket=bucket_name(), Key=key)
        else:
            _bucket().delete_object(key)
    except Exception:  # noqa: BLE001
        pass
    result["ok"] = result["upload_ok"] and result["public_ok"]
    return result
