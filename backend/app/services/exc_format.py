"""将异常格式化为可展示、非空的错误文案。"""

from __future__ import annotations

from app.i18n import _

# 已建连、等响应超时（不是连不上）
_READ_TIMEOUT_EXC_NAMES = frozenset({"ReadTimeout"})
# 已建连、发请求体超时
_WRITE_TIMEOUT_EXC_NAMES = frozenset({"WriteTimeout"})
# 建连失败 / 代理不可达（含未细分的 TimeoutException）
_CONNECT_EXC_NAMES = frozenset(
    {
        "ConnectError",
        "ConnectTimeout",
        "PoolTimeout",
        "TimeoutException",
        "NetworkError",
        "ProxyError",
    }
)


def format_exception_message(
    exc: BaseException,
    *,
    fallback: str | None = None,
    limit: int = 500,
) -> str:
    """生成带类型名的错误文案；ConnectError 等空 message 时补上可读说明。"""
    name = type(exc).__name__
    detail = str(exc).strip()
    if fallback is None:
        fallback = _("未知错误")
    if name in _READ_TIMEOUT_EXC_NAMES:
        tip = detail or _("上游已连通但响应超时（图片/视频生成可能超过等待上限）")
        return _("网络错误（{name}）：{tip}", name=name, tip=tip)[:limit]
    if name in _WRITE_TIMEOUT_EXC_NAMES:
        tip = detail or _("上游已连通但发送请求超时")
        return _("网络错误（{name}）：{tip}", name=name, tip=tip)[:limit]
    if name in _CONNECT_EXC_NAMES:
        tip = detail or _("无法连接上游服务（请检查网络、代理或 TokenFree 是否可达）")
        return _("网络错误（{name}）：{tip}", name=name, tip=tip)[:limit]
    if not detail:
        return _("{name}：{fallback}", name=name, fallback=fallback)[:limit]
    if detail.startswith(name):
        return detail[:limit]
    return f"{name}: {detail}"[:limit]
