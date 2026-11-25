# -*- coding: utf-8 -*-
"""计费相关 HTTP 异常映射。"""
from __future__ import annotations

from fastapi import HTTPException

from app.i18n import _


def http_exception_for_value_error(exc: ValueError) -> HTTPException:
    """余额不足 → 402，其余 ValueError → 400。"""
    detail = str(exc)
    from .wallet_base import WalletError
    if isinstance(exc, WalletError):
        return HTTPException(status_code=exc.status, detail={"code": exc.code, "message": exc.message})
    from app.services.media_models import MediaValidationError
    if isinstance(exc, MediaValidationError):
        return HTTPException(status_code=422, detail=[{"loc": ["body", exc.field], "msg": detail, "type": "media_parameter"}])
    # 消息可能已按请求语言翻译，中文原文与译文前缀都认
    status = 402 if detail.startswith(("余额不足", "团队余额不足", _("余额不足"), _("团队余额不足"))) else 400
    return HTTPException(status_code=status, detail=detail)
