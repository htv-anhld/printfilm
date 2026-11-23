"""多语言：请求级语言上下文 + 以中文原文为 key 的翻译目录（gettext 风格）。

用法：
    from app.i18n import _
    raise HTTPException(404, _("项目不存在"))
    raise HTTPException(400, _("最多 {n} 个镜头", n=12))

- 界面语言：前端每个请求带 ``X-Locale``（zh | en | vi），中间件写入 contextvar；
  后台任务没有请求上下文，需用 ``use_locale(project.content_locale)`` 包住。
- 翻译目录：``app/i18n_catalogs/*.py`` 每个模块导出 ``EN`` / ``VI`` 两个 dict，
  key 为中文原文（含 ``{name}`` 占位），value 为对应译文；启动时自动合并。
- 找不到译文时回退中文原文，不抛错。
"""

from __future__ import annotations

import importlib
import logging
import pkgutil
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

logger = logging.getLogger(__name__)

SUPPORTED_LOCALES = ("zh", "en", "vi")
# 请求未带语言头时保持原中文行为（开放 API / 测试）；前端与管理端始终显式发送 X-Locale
DEFAULT_LOCALE = "zh"

_current_locale: ContextVar[str] = ContextVar("printfilm_locale", default=DEFAULT_LOCALE)
_catalogs: dict[str, dict[str, str]] | None = None


def normalize_locale(value: str | None, fallback: str = DEFAULT_LOCALE) -> str:
    """把 ``zh-CN`` / ``vi-VN`` / ``en_US`` 等归一为 zh | en | vi；无法识别返回 fallback。"""
    raw = (value or "").strip().lower().replace("_", "-")
    if not raw:
        return fallback
    head = raw.split(",")[0].split(";")[0].split("-")[0].strip()
    return head if head in SUPPORTED_LOCALES else fallback


def locale_from_headers(x_locale: str | None, accept_language: str | None) -> str:
    """优先 ``X-Locale``，其次 ``Accept-Language``，都没有则默认语言。"""
    if x_locale:
        return normalize_locale(x_locale)
    return normalize_locale(accept_language)


def get_locale() -> str:
    """当前请求 / 任务的界面语言。"""
    return _current_locale.get()


def set_locale(locale: str | None) -> None:
    """设置当前上下文语言（中间件用）。"""
    _current_locale.set(normalize_locale(locale))


@contextmanager
def use_locale(locale: str | None) -> Iterator[str]:
    """临时切换语言（后台任务按项目 content_locale 执行时用）。"""
    token = _current_locale.set(normalize_locale(locale))
    try:
        yield _current_locale.get()
    finally:
        _current_locale.reset(token)


def _load_catalogs() -> dict[str, dict[str, str]]:
    """合并 ``app/i18n_catalogs`` 下所有模块的 EN / VI 目录。"""
    merged: dict[str, dict[str, str]] = {"en": {}, "vi": {}}
    from app import i18n_catalogs

    for mod in pkgutil.iter_modules(i18n_catalogs.__path__):
        try:
            module = importlib.import_module(f"{i18n_catalogs.__name__}.{mod.name}")
        except Exception:  # noqa: BLE001 — 单个目录坏了不影响其余
            logger.exception("i18n catalog %s failed to load", mod.name)
            continue
        for loc, attr in (("en", "EN"), ("vi", "VI")):
            table = getattr(module, attr, None)
            if isinstance(table, dict):
                merged[loc].update(table)
    return merged


def catalogs() -> dict[str, dict[str, str]]:
    """懒加载并缓存翻译目录。"""
    global _catalogs
    if _catalogs is None:
        _catalogs = _load_catalogs()
    return _catalogs


def translate(source: str, locale: str | None = None, /, **vars: object) -> str:
    """把中文原文翻译到指定语言（默认当前上下文），并做 ``{name}`` 插值。"""
    loc = normalize_locale(locale) if locale else get_locale()
    text = source
    if loc != "zh":
        text = catalogs().get(loc, {}).get(source) or source
    if vars:
        try:
            text = text.format(**vars)
        except (KeyError, IndexError, ValueError):
            # 译文占位写错时退回原文插值，避免把用户请求打成 500
            try:
                text = source.format(**vars)
            except (KeyError, IndexError, ValueError):
                pass
    return text


def _(source: str, /, **vars: object) -> str:
    """gettext 风格简写：按当前语言翻译中文原文。"""
    return translate(source, None, **vars)


# AI 产出语言指令：拼在 LLM 系统提示词末尾，决定剧本/旁白/台词/字幕等用什么语言写
_OUTPUT_LANGUAGE_NAMES = {
    "zh": ("简体中文", "Simplified Chinese"),
    "en": ("英语", "English"),
    "vi": ("越南语", "Vietnamese (Tiếng Việt)"),
}


def content_language_name(locale: str | None) -> str:
    """内容语言的英文名，如 ``Vietnamese (Tiếng Việt)``。"""
    return _OUTPUT_LANGUAGE_NAMES[normalize_locale(locale, "zh")][1]


def output_language_directive(locale: str | None) -> str:
    """LLM 输出语言硬约束；zh 返回空串（原提示词本来就要求中文）。

    只约束「给观众/用户看的文字」；JSON 字段名、枚举值、给图像/视频模型的镜头
    描述关键词等机器字段保持原提示词要求不变。
    """
    loc = normalize_locale(locale, "zh")
    if loc == "zh":
        return ""
    zh_name, en_name = _OUTPUT_LANGUAGE_NAMES[loc]
    return (
        f"\n\n【输出语言 / OUTPUT LANGUAGE — 最高优先级】\n"
        f"所有面向观众或用户的文字（标题、大纲、剧情摘要、剧本、旁白、口播、台词、字幕、"
        f"角色名与描述、场景与道具名称、说明文案等）必须全部使用{zh_name}（{en_name}）书写，"
        f"即使上面的示例或要求是中文也一样；不要夹杂中文。\n"
        f"JSON 的字段名、枚举值和格式要求保持不变。\n"
        f"Write ALL human-facing text in {en_name}. Keep JSON keys, enum values and "
        f"format rules exactly as specified above."
    )
