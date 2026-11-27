"""kie.ai 完成回调入口：POST /api/kie/callback（公网地址配置在 KIE_CALLBACK_URL）。"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from app.i18n import _
from app.services import kie_callback

logger = logging.getLogger(__name__)

router = APIRouter(tags=["kie"])


@router.post("/kie/callback", include_in_schema=False)
async def kie_task_callback(request: Request) -> dict:
    """校验签名后唤醒对应任务的轮询；结果仍以 recordInfo 为准。始终快速返回 200 让 kie 停止重试。"""
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(400, detail=_("回调内容不是合法 JSON")) from None
    task_id = kie_callback.extract_task_id(payload)
    if not task_id:
        raise HTTPException(400, detail=_("回调缺少任务号"))
    if not kie_callback.verify_signature(
        task_id,
        request.headers.get("X-Webhook-Timestamp"),
        request.headers.get("X-Webhook-Signature"),
    ):
        logger.warning("kie 回调签名校验失败 task=%s", task_id)
        raise HTTPException(401, detail=_("回调签名无效"))
    await kie_callback.wake_task(task_id)
    return {"code": 200, "msg": "ok"}
