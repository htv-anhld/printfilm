# -*- coding: utf-8 -*-
"""计费相关 HTTP 异常映射。"""
from __future__ import annotations

from fastapi import HTTPException

from app.i18n import _


def http_exception_for_value_error(exc: ValueError) -> HTTPException:
    """余额不足 → 402，其余 ValueError → 400。"""
    detail = str(exc)
    # 消息可能已按请求语言翻译，中文原文与译文前缀都认
    status = 402 if detail.startswith(("余额不足", _("余额不足"))) else 400
    return HTTPException(status_code=status, detail=detail)
