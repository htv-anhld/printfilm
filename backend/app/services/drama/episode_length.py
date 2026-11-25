"""漫剧单集目标时长：决定分集正文篇幅、场次数、分镜条数上限与总时长预算。

项目 params.episode_duration_sec 为空或 ≤ 90 时保持原有短剧规格（60–90 秒、≤10 镜、正文约 450–600 字）。
更长的集按秒数线性放大。任务入口用 set_episode_length_from_project() 写入上下文，
提示词与分镜裁剪处通过 current_episode_length() 读取，无需层层传参。
"""

from __future__ import annotations

import math
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

# 前端可选的单集时长（秒）
EPISODE_DURATION_CHOICES = (60, 90, 120, 180, 300)
_MIN_SEC = 60
_MAX_SEC = 600


@dataclass(frozen=True)
class EpisodeLengthSpec:
    """单集规格。"""

    target_sec: int
    chars_min: int
    chars_max: int
    scenes: str
    fragment_max: int
    duration_budget_sec: int
    range_label: str

    @property
    def is_default(self) -> bool:
        return self.target_sec <= 90


DEFAULT_SPEC = EpisodeLengthSpec(
    target_sec=90,
    chars_min=450,
    chars_max=600,
    scenes="2-3 场",
    fragment_max=10,
    duration_budget_sec=90,
    range_label="60–90 秒",
)

_current: ContextVar[EpisodeLengthSpec] = ContextVar("drama_episode_length", default=DEFAULT_SPEC)


def normalize_episode_duration(raw: Any) -> int | None:
    """解析项目里的单集时长；非法或 ≤90 返回 None（走默认规格）。"""
    try:
        sec = int(raw)
    except (TypeError, ValueError):
        return None
    if sec <= 90:
        return None
    return max(_MIN_SEC, min(sec, _MAX_SEC))


def episode_length_spec(target_sec: int | None) -> EpisodeLengthSpec:
    """按目标秒数计算规格（实测正文约 6.4 字当量/秒成片 → 取 6.5–8 字/秒；单镜 4–15 秒 → 约 8 秒/镜）。"""
    sec = normalize_episode_duration(target_sec)
    if sec is None:
        return DEFAULT_SPEC
    return EpisodeLengthSpec(
        target_sec=sec,
        chars_min=int(sec * 6.5),
        chars_max=int(sec * 8),
        scenes=f"{max(3, round(sec / 45))}-{max(4, round(sec / 30))} 场",
        fragment_max=math.ceil(sec / 8),
        duration_budget_sec=int(sec * 1.15),
        range_label=f"{int(sec * 0.85)}–{int(sec * 1.1)} 秒",
    )


def set_episode_length_from_project(project: Any) -> EpisodeLengthSpec:
    """任务入口调用：按项目 params.episode_duration_sec 设置当前上下文规格。"""
    params = getattr(project, "params", None) or {}
    spec = episode_length_spec(params.get("episode_duration_sec") if isinstance(params, dict) else None)
    _current.set(spec)
    return spec


def current_episode_length() -> EpisodeLengthSpec:
    """当前上下文的单集规格（未设置时为默认短剧规格）。"""
    return _current.get()


def adapt_episode_prompt(prompt: str, spec: EpisodeLengthSpec | None = None) -> str:
    """把提示词里写死的「450-600 汉字」「2-3 场」「≤10 条」「60–90 秒」换成当前规格。"""
    s = spec or current_episode_length()
    if s.is_default:
        return prompt
    return (
        prompt.replace("450-600 汉字", f"{s.chars_min}-{s.chars_max} 汉字")
        .replace("每集 2-3 场", f"每集 {s.scenes}")
        .replace("不得超过 10 条", f"不得超过 {s.fragment_max} 条")
        .replace("≤ 10", f"≤ {s.fragment_max}")
        .replace("≤10", f"≤{s.fragment_max}")
        .replace("60–90 秒", s.range_label)
    )
