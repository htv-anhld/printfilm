# -*- coding: utf-8 -*-
"""Creem 支付网关客户端（REST，https://docs.creem.io）。

只做 HTTP 与签名，不碰数据库；业务（订单入账、订阅）在 services/payments/ 下。

- 鉴权：请求头 ``x-api-key``
- 正式 ``https://api.creem.io/v1``，测试 ``https://test-api.creem.io/v1``（Key 不通用）
- Webhook：``creem-signature`` = HMAC-SHA256(webhook_secret, 原始请求体) 的 hex
"""
from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.i18n import _

logger = logging.getLogger(__name__)

PROD_BASE = "https://api.creem.io/v1"
TEST_BASE = "https://test-api.creem.io/v1"
TIMEOUT = httpx.Timeout(connect=10.0, read=30.0, write=30.0, pool=10.0)


class CreemError(RuntimeError):
    """Creem 调用失败（未配置 / 网络 / 4xx-5xx）。"""


def creem_configured(settings: Settings | None = None) -> bool:
    """已填 API Key 才算可用；webhook secret 缺失时下单仍可，但回调会拒收。"""
    s = settings or get_settings()
    return bool((s.creem_api_key or "").strip())


def creem_base_url(settings: Settings | None = None) -> str:
    """按测试模式选接口根地址。"""
    s = settings or get_settings()
    return TEST_BASE if s.creem_test_mode else PROD_BASE


def verify_webhook_signature(raw_body: bytes, signature: str | None, settings: Settings | None = None) -> bool:
    """校验 creem-signature；未配置 secret 一律拒绝（避免伪造回调白送 credit）。"""
    s = settings or get_settings()
    secret = (s.creem_webhook_secret or "").strip()
    sig = (signature or "").strip().lower()
    if not secret or not sig:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


def sku_product_map(settings: Settings | None = None) -> dict[str, str]:
    """解析 CREEM_SKU_PRODUCTS（"sku:prod,sku:prod"）。"""
    s = settings or get_settings()
    out: dict[str, str] = {}
    for part in (s.creem_sku_products or "").split(","):
        if ":" not in part:
            continue
        sku, prod = part.split(":", 1)
        if sku.strip() and prod.strip():
            out[sku.strip()] = prod.strip()
    return out


async def _request(method: str, path: str, *, json: dict[str, Any] | None = None, settings: Settings | None = None) -> dict[str, Any]:
    """统一请求：带 Key、超时、错误转 CreemError（不把 Key 写进日志）。"""
    s = settings or get_settings()
    key = (s.creem_api_key or "").strip()
    if not key:
        raise CreemError(_("Creem 未配置 API Key"))
    url = f"{creem_base_url(s)}{path}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.request(
                method,
                url,
                # 显式 UA：Creem 前置 Cloudflare 会拦部分默认客户端 UA（如 Python-urllib 返回 error 1010）
                headers={"x-api-key": key, "Content-Type": "application/json", "User-Agent": "printfilm-api/1.0"},
                json=json,
            )
    except httpx.HTTPError as exc:
        logger.warning("creem %s %s network error: %s", method, path, exc)
        raise CreemError(_("连接 Creem 失败，请稍后重试")) from exc
    if resp.status_code >= 400:
        logger.warning("creem %s %s -> %s %s", method, path, resp.status_code, resp.text[:500])
        raise CreemError(_("Creem 返回错误（HTTP {code}）", code=resp.status_code))
    try:
        data = resp.json()
    except ValueError as exc:
        raise CreemError(_("Creem 返回内容无法解析")) from exc
    return data if isinstance(data, dict) else {"data": data}


async def create_checkout(
    *,
    product_id: str,
    request_id: str,
    success_url: str,
    customer_email: str | None = None,
    customer_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    custom_price: int | None = None,
    units: int = 1,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """POST /checkouts → {id, checkout_url, ...}。customer 只能二选一（id 优先）。"""
    body: dict[str, Any] = {
        "product_id": product_id,
        "request_id": request_id,
        "success_url": success_url,
        "units": max(1, int(units)),
    }
    if custom_price is not None:
        # 文档：仅一次性产品可用，单位美分，最小 100
        body["custom_price"] = max(100, int(custom_price))
    if customer_id:
        body["customer"] = {"id": customer_id}
    elif customer_email:
        body["customer"] = {"email": customer_email}
    if metadata:
        body["metadata"] = {k: str(v) for k, v in metadata.items()}
    data = await _request("POST", "/checkouts", json=body, settings=settings)
    if not data.get("checkout_url"):
        raise CreemError(_("Creem 未返回支付链接"))
    return data


async def customer_portal_link(customer_id: str, settings: Settings | None = None) -> str:
    """POST /customers/billing → customer_portal_link（用户自助管理订阅 / 发票）。"""
    data = await _request("POST", "/customers/billing", json={"customer_id": customer_id}, settings=settings)
    link = str(data.get("customer_portal_link") or "")
    if not link:
        raise CreemError(_("Creem 未返回客户门户链接"))
    return link


async def get_subscription(subscription_id: str, settings: Settings | None = None) -> dict[str, Any]:
    """GET /subscriptions/{id}。"""
    return await _request("GET", f"/subscriptions/{subscription_id}", settings=settings)


async def upgrade_subscription(
    subscription_id: str,
    product_id: str,
    *,
    update_behavior: str = "proration-charge-immediately",
    settings: Settings | None = None,
) -> dict[str, Any]:
    """POST /subscriptions/{id}/upgrade；按比例立即补差价。"""
    return await _request(
        "POST",
        f"/subscriptions/{subscription_id}/upgrade",
        json={"product_id": product_id, "update_behavior": update_behavior},
        settings=settings,
    )


async def cancel_subscription(subscription_id: str, settings: Settings | None = None) -> dict[str, Any]:
    """POST /subscriptions/{id}/cancel。

    注意：文档未给出 REST 下「期末取消」的参数，这里按文档示例不带 body；
    需要期末取消时引导用户去客户门户操作（门户里的取消是期末生效）。
    """
    return await _request("POST", f"/subscriptions/{subscription_id}/cancel", json={}, settings=settings)
