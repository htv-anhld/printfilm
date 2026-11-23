"""多上游渠道运行时工具：熔断（failover 降级）+ 视频任务 ID 绑定渠道。

开源版只允许 TokenFree 一个上游；商业版允许任意 OpenAI 兼容 / 方舟渠道并存。
本模块不做路由决策（那是 logical_model_router 的事），只提供两件事：

1. 熔断：某渠道连续出现网络错误 / 5xx / 429 时，在冷却期内把它排到候选末尾，
   让下一次请求自动走备用渠道；冷却结束或成功一次即恢复。
2. 任务 ID 绑定渠道：异步视频任务在哪个渠道创建就必须在哪个渠道轮询，
   非主渠道创建的任务 ID 写成 ``{channel_id}::{raw_id}``，轮询时拆回。
"""

from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass

import httpx

from app.schemas_routing import SystemModelChannel

CHANNEL_TASK_SEP = "::"
# 渠道 ID 只允许小写字母数字与 -_，保证能安全拼进任务 ID 与 URL
CHANNEL_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,47}$")

# 连续失败多少次触发熔断；熔断冷却秒数
BREAKER_FAILURE_THRESHOLD = 2
BREAKER_COOLDOWN_SEC = 120.0

# 可切换渠道重试的 HTTP 状态：限流与服务端错误（4xx 业务错误换渠道也不会好）
FAILOVER_STATUS = {408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524}


@dataclass
class _BreakerState:
    """单渠道熔断状态。"""

    failures: int = 0
    open_until: float = 0.0


_lock = threading.Lock()
_states: dict[str, _BreakerState] = {}


def is_valid_channel_id(channel_id: str) -> bool:
    """渠道 ID 是否合法（小写字母数字开头，≤48 位）。"""
    return bool(CHANNEL_ID_RE.fullmatch((channel_id or "").strip()))


def is_failover_status(status_code: int | None) -> bool:
    """该 HTTP 状态是否值得换渠道。"""
    return status_code is not None and int(status_code) in FAILOVER_STATUS


def is_failover_exception(exc: BaseException) -> bool:
    """网络层异常（连不上、超时、断开）视为渠道故障。"""
    return isinstance(exc, httpx.TransportError)


def record_channel_failure(channel_id: str, *, now: float | None = None) -> None:
    """记一次渠道故障；达到阈值后进入冷却。"""
    cid = (channel_id or "").strip()
    if not cid:
        return
    ts = time.monotonic() if now is None else now
    with _lock:
        state = _states.setdefault(cid, _BreakerState())
        state.failures += 1
        if state.failures >= BREAKER_FAILURE_THRESHOLD:
            state.open_until = ts + BREAKER_COOLDOWN_SEC


def record_channel_success(channel_id: str) -> None:
    """成功一次即清零熔断。"""
    cid = (channel_id or "").strip()
    if not cid:
        return
    with _lock:
        _states.pop(cid, None)


def is_channel_cooling(channel_id: str, *, now: float | None = None) -> bool:
    """渠道是否处于熔断冷却期。"""
    cid = (channel_id or "").strip()
    ts = time.monotonic() if now is None else now
    with _lock:
        state = _states.get(cid)
        return bool(state and state.open_until > ts)


def channel_health_snapshot(*, now: float | None = None) -> dict[str, dict[str, float | int | bool]]:
    """健康检查 / 管理端展示用的熔断快照。"""
    ts = time.monotonic() if now is None else now
    with _lock:
        return {
            cid: {
                "failures": state.failures,
                "cooling": state.open_until > ts,
                "cooldown_left_sec": max(0.0, round(state.open_until - ts, 1)),
            }
            for cid, state in _states.items()
        }


def reset_channel_health() -> None:
    """清空熔断状态（测试 / 管理端保存渠道后调用）。"""
    with _lock:
        _states.clear()


def demote_cooling(items: list, key) -> list:
    """把冷却中的渠道稳定地挪到列表末尾（不丢弃：全部熔断时仍要有路可走）。"""
    healthy = [item for item in items if not is_channel_cooling(key(item))]
    cooling = [item for item in items if is_channel_cooling(key(item))]
    return healthy + cooling


def primary_channel(channels: list[SystemModelChannel]) -> SystemModelChannel | None:
    """主渠道：已启用且有 Key 的渠道里 sort_order 最小者（扁平配置 base/key 取它）。"""
    usable = [
        ch
        for ch in channels
        if ch.enabled and ((ch.api_key or "").strip() or ch.has_api_key) and (ch.base_url or "").strip()
    ]
    if not usable:
        return None
    return sorted(usable, key=lambda ch: (ch.sort_order, ch.id))[0]


def tag_channel_task_id(channel_id: str | None, raw_task_id: str, *, primary_id: str | None) -> str:
    """非主渠道创建的任务 ID 前缀渠道；主渠道保持原样（兼容存量数据与单渠道部署）。"""
    raw = (raw_task_id or "").strip()
    cid = (channel_id or "").strip()
    if not raw or not cid or cid == (primary_id or "").strip() or CHANNEL_TASK_SEP in raw:
        return raw
    return f"{cid}{CHANNEL_TASK_SEP}{raw}"


def split_channel_task_id(task_id: str) -> tuple[str | None, str]:
    """拆出 (渠道 ID 或 None, 上游原始任务 ID)。"""
    raw = (task_id or "").strip()
    if CHANNEL_TASK_SEP not in raw:
        return None, raw
    cid, rest = raw.split(CHANNEL_TASK_SEP, 1)
    if not is_valid_channel_id(cid) or not rest:
        return None, raw
    return cid, rest
