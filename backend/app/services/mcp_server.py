# -*- coding: utf-8 -*-
"""MCP（Model Context Protocol）服务端：Streamable HTTP + JSON-RPC 2.0。

工具直接复用 /api/v1 的实现（同一套计费与归属校验），供 Claude connector 等外部 Agent 调用。
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.models_commerce import McpRequest

logger = logging.getLogger(__name__)

SUPPORTED_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")
SERVER_INFO = {"name": "printfilm", "version": "1.0.0"}

TOOLS: list[dict[str, Any]] = [
    {
        "name": "generate_image",
        "description": "Generate an image from a text prompt (optionally guided by a reference image). Costs credits. Returns image URLs.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "What to draw"},
                "ratio": {"type": "string", "enum": ["1:1", "16:9", "9:16"], "default": "1:1"},
                "image_url": {"type": "string", "description": "Optional public URL of a reference image"},
                "negative": {"type": "string", "description": "Things to avoid"},
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "generate_video",
        "description": "Animate a first-frame image into a short video (4-15 s). Costs credits. Returns a task_id; poll with get_video_task.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "image_url": {"type": "string", "description": "Public URL of the first frame"},
                "prompt": {"type": "string", "description": "Motion / camera description"},
                "duration": {"type": "integer", "minimum": 4, "maximum": 15, "default": 5},
                "resolution": {"type": "string", "enum": ["480p", "720p", "1080p"], "default": "480p"},
            },
            "required": ["image_url", "prompt"],
        },
    },
    {
        "name": "get_video_task",
        "description": "Check a video task created by generate_video. Returns status and, when finished, the video URL.",
        "inputSchema": {
            "type": "object",
            "properties": {"task_id": {"type": "string"}},
            "required": ["task_id"],
        },
    },
    {
        "name": "get_balance",
        "description": "Show the user's remaining credits.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def _result(req_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _error(req_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def _text(payload: Any, *, is_error: bool = False) -> dict[str, Any]:
    text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


async def _call_tool(db: AsyncSession, user: User, name: str, args: dict[str, Any]) -> dict[str, Any]:
    """执行工具；业务错误作为 isError 结果返回（而不是 JSON-RPC 错误），便于 Agent 自行处理。"""
    from app.api.v1 import generation as v1
    from app.schemas_api import V1ImageGenerateRequest, V1VideoGenerateRequest

    try:
        if name == "generate_image":
            out = await v1.generate_image(V1ImageGenerateRequest(**args), db=db, user=user)
            return _text(out.model_dump(exclude_none=True))
        if name == "generate_video":
            out = await v1.generate_video(V1VideoGenerateRequest(**args), db=db, user=user)
            return _text(out.model_dump(exclude_none=True))
        if name == "get_video_task":
            out = await v1.get_task(str(args.get("task_id") or ""), db=db, user=user)
            return _text(out.model_dump(exclude_none=True))
        if name == "get_balance":
            from app.services.billing.currency import billing_currency, format_money

            return _text(
                {
                    "balance": int(user.balance_fen or 0),
                    "monthly_credits": int(getattr(user, "sub_credit_fen", 0) or 0),
                    "currency": billing_currency(),
                    "display": format_money(int(user.balance_fen or 0)),
                }
            )
    except ValidationError as exc:
        return _text(f"Invalid arguments: {exc.errors()[:3]}", is_error=True)
    except HTTPException as exc:
        return _text(str(exc.detail), is_error=True)
    raise KeyError(name)


async def handle(db: AsyncSession, user: User, app_id: int | None, message: dict[str, Any]) -> dict[str, Any] | None:
    """处理一条 JSON-RPC 消息；通知（无 id）返回 None。"""
    req_id = message.get("id")
    method = str(message.get("method") or "")
    params = message.get("params") if isinstance(message.get("params"), dict) else {}
    if message.get("jsonrpc") != "2.0" or not method:
        return _error(req_id, -32600, "Invalid Request")
    if req_id is None:
        return None  # notifications/initialized 等通知

    started = time.monotonic()
    tool = None
    status = "ok"
    summary = None
    try:
        if method == "initialize":
            asked = str(params.get("protocolVersion") or "")
            return _result(
                req_id,
                {
                    "protocolVersion": asked if asked in SUPPORTED_VERSIONS else SUPPORTED_VERSIONS[0],
                    "capabilities": {"tools": {"listChanged": False}},
                    "serverInfo": SERVER_INFO,
                    "instructions": "Generate images and short videos with PRINTFILM. Each generation spends the user's credits.",
                },
            )
        if method == "ping":
            return _result(req_id, {})
        if method == "tools/list":
            return _result(req_id, {"tools": TOOLS})
        if method == "tools/call":
            tool = str(params.get("name") or "")
            args = params.get("arguments") if isinstance(params.get("arguments"), dict) else {}
            if tool not in {t["name"] for t in TOOLS}:
                status = "error"
                return _error(req_id, -32602, f"Unknown tool: {tool}")
            result = await _call_tool(db, user, tool, args)
            if result.get("isError"):
                status = "error"
            summary = result["content"][0]["text"][:500]
            return _result(req_id, result)
        status = "error"
        return _error(req_id, -32601, f"Method not found: {method}")
    finally:
        if method not in ("initialize", "ping", "notifications/initialized"):
            db.add(
                McpRequest(
                    user_id=user.id,
                    app_id=app_id,
                    method=method[:64],
                    tool=(tool or None),
                    status=status,
                    summary=summary,
                    duration_ms=int((time.monotonic() - started) * 1000),
                )
            )
