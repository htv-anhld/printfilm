"""kie.ai 任务完成回调：校验签名 → 唤醒对应任务的轮询，让结果在几秒内落地。

设计要点：
- **不信任回调内容**：回调只当"该去查了"的信号；状态、结果链接、creditsConsumed 仍以
  recordInfo 为准（poller 照常查询、下载、结算），伪造回调最多让我们多查一次
- 签名（配置了 ``KIE_WEBHOOK_HMAC_KEY`` 时强制）：
  ``X-Webhook-Signature = base64(HMAC-SHA256(key, taskId + "." + X-Webhook-Timestamp))``，时间戳 ±10 分钟
- 唤醒两类等待者：
  1. TaskRun（漫剧分镜 / 工具视频等，status=awaiting_poll）：把 next_action_at 提前到现在；
     处于 finalizing 收尾认领中的不动，避免并发下载
  2. 进程内阻塞轮询（科普流水线 ``poll_kie_task``）：通过 asyncio.Event 提前结束等待
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import logging
import re
import time
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

from app.config import get_settings
from app.services.upstream_channels import CHANNEL_TASK_SEP

logger = logging.getLogger(__name__)

SIGNATURE_MAX_SKEW_SEC = 600
# kie taskId 只含字母数字 / 下划线 / 连字符；其它一律忽略（防 LIKE 通配与超长输入）
_TASK_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_FINALIZE_STEP = "finalizing"

# kie 原始 taskId → 正在阻塞等待它的 Event（科普内联轮询）
_waiters: dict[str, asyncio.Event] = {}


def callback_url() -> str:
    """建单时附带的回调地址；未配置返回空串（只轮询）。"""
    url = str(getattr(get_settings(), "kie_callback_url", "") or "").strip()
    return url if url.startswith("https://") or url.startswith("http://") else ""


def sign(task_id: str, timestamp: str, key: str) -> str:
    """按 kie 约定计算签名（测试与校验共用）。"""
    digest = hmac.new(key.encode(), f"{task_id}.{timestamp}".encode(), hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


def verify_signature(task_id: str, timestamp: str | None, signature: str | None, *, now: float | None = None) -> bool:
    """校验回调签名；未配置密钥时放行（回调本身不被信任，只触发查询）。"""
    key = str(getattr(get_settings(), "kie_webhook_hmac_key", "") or "").strip()
    if not key:
        return True
    if not task_id or not timestamp or not signature:
        return False
    try:
        ts = float(timestamp)
    except ValueError:
        return False
    # kie 时间戳可能是毫秒
    if ts > 1e12:
        ts /= 1000.0
    if abs((now if now is not None else time.time()) - ts) > SIGNATURE_MAX_SKEW_SEC:
        return False
    return hmac.compare_digest(sign(task_id, timestamp, key), signature.strip())


def extract_task_id(payload: Any) -> str:
    """回调 body（同 recordInfo：``{code, msg, data:{taskId, ...}}``）里的 taskId。"""
    if not isinstance(payload, dict):
        return ""
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    task_id = str(data.get("taskId") or data.get("task_id") or "").strip()
    return task_id if _TASK_ID_RE.match(task_id) else ""


def register_waiter(raw_task_id: str) -> asyncio.Event:
    """阻塞轮询方登记等待；回调到达时 set。"""
    event = _waiters.get(raw_task_id)
    if event is None:
        event = asyncio.Event()
        _waiters[raw_task_id] = event
    return event


def release_waiter(raw_task_id: str) -> None:
    """轮询结束后注销。"""
    _waiters.pop(raw_task_id, None)


async def wake_task(raw_task_id: str) -> int:
    """唤醒等待该 kie 任务的轮询；返回被提前的 TaskRun 数量。"""
    from app.database import AsyncSessionLocal
    from app.models_tasks import TaskRun

    event = _waiters.get(raw_task_id)
    if event is not None:
        event.set()
    if not raw_task_id:
        return 0
    suffix = f"{CHANNEL_TASK_SEP}{raw_task_id}"
    woken = 0
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(TaskRun).where(
                    TaskRun.status == "awaiting_poll",
                    TaskRun.provider_task_id.like(f"%{suffix}"),
                )
            )
        ).scalars().all()
        now = datetime.now(UTC)
        for task in rows:
            if not str(task.provider_task_id or "").endswith(suffix):
                continue
            if (task.current_step_status or "") == _FINALIZE_STEP:
                continue
            task.next_action_at = now
            woken += 1
        if woken:
            await db.commit()
    logger.info("kie 回调 task=%s 唤醒 TaskRun=%s 内联等待=%s", raw_task_id, woken, event is not None)
    return woken
