"""kie.ai 文件上传：把本地 / 内网素材转成 kie 可拉取的临时公网链接。

背景：kie 只拉公网 http(s) 素材。没开 OSS 时站点素材是 ``/static/...``、``http://localhost:...``
或 data URI，kie 拉不到。这里改走 kie 的 File Upload API（免费，文件保留 24 小时）：

- 流式上传 ``POST https://kieai.redpandaai.co/api/file-stream-upload``（multipart：file / uploadPath / fileName）
- 响应 ``{"success": true, "code": 200, "data": {"downloadUrl": "..."}}``；业务错误同样是 HTTP 200 + code≠200

同一文件 20 小时内复用上次的链接（进程内缓存），避免一镜多次重复上传。绝不记录 API Key。
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import ipaddress
import logging
import mimetypes
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.i18n import _

logger = logging.getLogger(__name__)

KIE_UPLOAD_BASE_URL = "https://kieai.redpandaai.co"
STREAM_UPLOAD_PATH = "/api/file-stream-upload"
UPLOAD_DIR = "printfilm"
# kie 保留 24 小时；留 4 小时余量，避免任务排队期间链接过期
CACHE_TTL_SEC = 20 * 3600
# 单文件上限（kie 未写硬上限，按 URL 上传建议的 100MB 保守处理）
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
UPLOAD_TIMEOUT = httpx.Timeout(connect=15.0, read=180.0, write=180.0, pool=30.0)
FETCH_TIMEOUT = httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=30.0)
MAX_ATTEMPTS = 3

# 内容摘要 → (downloadUrl, 过期时间戳)
_cache: dict[str, tuple[str, float]] = {}


class KieUploadError(RuntimeError):
    """上传失败；message 已翻译，可直接展示。"""


def is_private_media_url(url: str) -> bool:
    """http(s) 链接是否指向 kie 拉不到的地址（localhost / 内网 IP / 无点主机名 / .local）。"""
    try:
        host = (urlsplit(url).hostname or "").strip().lower()
    except ValueError:
        return True
    if not host:
        return True
    if host in {"localhost", "host.docker.internal"} or host.endswith((".local", ".internal", ".localhost")):
        return True
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        # docker 服务名（api、web）这类无点主机名只在内网可达
        return "." not in host
    return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_reserved


def needs_kie_upload(url: str) -> bool:
    """该素材链接是否需要先上传到 kie 才能被拉取。"""
    value = (url or "").strip()
    if not value or value.startswith("asset://"):
        return False
    if value.startswith(("https://", "http://")):
        return is_private_media_url(value)
    return True


def _decode_data_uri(value: str) -> tuple[bytes, str]:
    """data URI → (字节, mime)。"""
    header, _sep, payload = value.partition(",")
    mime = header[5:].split(";", 1)[0] or "application/octet-stream"
    try:
        data = base64.b64decode(payload, validate=False) if ";base64" in header else payload.encode()
    except (binascii.Error, ValueError) as exc:
        raise KieUploadError(_("素材数据损坏，无法上传到 Kie.ai")) from exc
    return data, mime


async def _read_media(url: str) -> tuple[bytes, str, str]:
    """读取素材字节；返回 (字节, mime, 文件名)。本地文件优先，其次内网 http 下载。"""
    from app.services import storage as storage_svc

    value = url.strip()
    if value.startswith("data:"):
        data, mime = _decode_data_uri(value)
        ext = mimetypes.guess_extension(mime) or ".bin"
        return data, mime, f"inline{ext}"
    local: Path | None = storage_svc.local_path_from_url(value)
    if local is None and value.startswith(("http://", "https://")):
        path = urlsplit(value).path
        if path.startswith("/static/"):
            local = storage_svc.local_path_from_url(path)
    if local is not None and local.is_file():
        size = local.stat().st_size
        if size > MAX_UPLOAD_BYTES:
            raise KieUploadError(_("素材文件超过 100MB，Kie.ai 无法接收"))
        mime = mimetypes.guess_type(local.name)[0] or "application/octet-stream"
        return local.read_bytes(), mime, local.name
    if value.startswith(("http://", "https://")):
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(value)
        if resp.status_code >= 400:
            raise KieUploadError(_("读取素材失败（HTTP {code}），无法上传到 Kie.ai", code=resp.status_code))
        if len(resp.content) > MAX_UPLOAD_BYTES:
            raise KieUploadError(_("素材文件超过 100MB，Kie.ai 无法接收"))
        mime = (resp.headers.get("content-type") or "").split(";", 1)[0].strip() or "application/octet-stream"
        name = Path(urlsplit(value).path).name or "media"
        return resp.content, mime, name
    raise KieUploadError(_("找不到素材文件，无法上传到 Kie.ai"))


def _upload_name(digest: str, original: str, mime: str) -> str:
    """kie 上同名会覆盖：用内容摘要做文件名，保留扩展名。"""
    ext = Path(original).suffix.lower() or mimetypes.guess_extension(mime) or ".bin"
    return f"{digest[:24]}{ext}"


def _parse_upload_response(resp: httpx.Response) -> str:
    """解析上传响应，返回 downloadUrl；失败抛 KieUploadError。"""
    from app.services.kie_client import kie_error_message

    try:
        payload: Any = resp.json()
    except ValueError:
        payload = None
    code = resp.status_code
    if code < 400 and isinstance(payload, dict) and payload.get("code") not in (None, ""):
        try:
            code = int(payload["code"])
        except (TypeError, ValueError):
            code = 500
    data = payload.get("data") if isinstance(payload, dict) and isinstance(payload.get("data"), dict) else {}
    url = str(data.get("downloadUrl") or data.get("fileUrl") or "").strip()
    if code == 200 and url.startswith("https://"):
        return url
    msg = str(payload.get("msg") or "") if isinstance(payload, dict) else ""
    raise KieUploadError(kie_error_message(code if code != 200 else 500, msg))


async def upload_bytes(
    api_key: str,
    data: bytes,
    *,
    file_name: str,
    mime: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str:
    """流式上传字节到 kie，返回临时公网链接（24 小时有效）。429 / 5xx / 连接失败最多重试 3 次。"""
    import asyncio

    if not (api_key or "").strip():
        from app.services.kie_client import kie_error_message

        raise KieUploadError(kie_error_message(401))
    headers = {"Authorization": f"Bearer {api_key.strip()}"}
    last: Exception | None = None
    async with httpx.AsyncClient(timeout=UPLOAD_TIMEOUT, transport=transport) as client:
        for attempt in range(MAX_ATTEMPTS):
            try:
                resp = await client.post(
                    f"{KIE_UPLOAD_BASE_URL}{STREAM_UPLOAD_PATH}",
                    headers=headers,
                    files={"file": (file_name, data, mime)},
                    data={"uploadPath": UPLOAD_DIR, "fileName": file_name},
                )
            except httpx.TransportError as exc:
                last = KieUploadError(_("无法连接 Kie.ai，请检查网络后重试"))
                logger.warning("kie 上传连接失败 attempt=%s err=%s", attempt + 1, type(exc).__name__)
            else:
                if resp.status_code in {429, 500, 502, 503, 504}:
                    last = KieUploadError(_parse_error_safe(resp))
                else:
                    return _parse_upload_response(resp)
            if attempt + 1 < MAX_ATTEMPTS:
                await asyncio.sleep(1.5 * (2**attempt))
    assert last is not None
    raise last


def _parse_error_safe(resp: httpx.Response) -> str:
    """可重试失败的文案。"""
    try:
        _parse_upload_response(resp)
    except KieUploadError as exc:
        return str(exc)
    return _("Kie.ai 服务暂时异常，请稍后重试")


async def ensure_kie_media_url(route: Any, url: str, *, transport: httpx.AsyncBaseTransport | None = None) -> str:
    """素材已是公网链接则原样返回；否则上传到 kie 换成临时公网链接（同内容 20 小时内复用）。"""
    value = (url or "").strip()
    if not needs_kie_upload(value):
        return value
    data, mime, original = await _read_media(value)
    if not data:
        raise KieUploadError(_("素材文件为空，无法上传到 Kie.ai"))
    digest = hashlib.sha256(data).hexdigest()
    cached = _cache.get(digest)
    now = time.time()
    if cached and cached[1] > now:
        return cached[0]
    name = _upload_name(digest, original, mime)
    remote = await upload_bytes(getattr(route, "api_key", "") or "", data, file_name=name, mime=mime, transport=transport)
    _cache[digest] = (remote, now + CACHE_TTL_SEC)
    logger.info("kie 素材已上传 size=%s mime=%s name=%s", len(data), mime, name)
    return remote


async def localize_kie_video_body(route: Any, body: dict[str, Any]) -> dict[str, Any]:
    """把方舟格式视频 body 里 content 的本地 / 内网素材换成 kie 临时链接；返回新 body（不改原对象）。"""
    content = body.get("content")
    if not isinstance(content, list):
        return body
    new_items: list[Any] = []
    for item in content:
        if not isinstance(item, dict):
            new_items.append(item)
            continue
        kind = item.get("type")
        if kind not in {"image_url", "video_url", "audio_url"}:
            new_items.append(item)
            continue
        block = item.get(kind)
        raw = str(block.get("url") or "") if isinstance(block, dict) else str(block or "")
        if not needs_kie_upload(raw):
            new_items.append(item)
            continue
        remote = await ensure_kie_media_url(route, raw)
        new_block = {**block, "url": remote} if isinstance(block, dict) else {"url": remote}
        new_items.append({**item, kind: new_block})
    return {**body, "content": new_items}
