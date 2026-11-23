"""科普（AI 短视频）内容语言工具：按内容语言估口播时长、切字幕、选字体与音色。

约定：中文文本（含任意 CJK 字符）一律走原有「按字」逻辑，保证 zh 行为不变；
不含 CJK 的越南语 / 英语文本按「词」计算（空格分词）。
"""

from __future__ import annotations

import re
from pathlib import Path

from app.i18n import (
    catalogs,
    content_language_name,
    get_locale,
    normalize_locale,
    output_language_directive,
)

# CJK 统一表意文字 + 扩展 A + 兼容区 + 假名/谚文（按「字」计）
_CJK_RE = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]")
_WORD_RE = re.compile(r"[^\s]+")

# 口播语速：中文约 5 字/秒（沿用 seedance_segments），越南语/英语约 2.7 词/秒
LATIN_WORDS_PER_SEC = 2.7


def content_locale_of(obj: object | None, fallback: str = "zh") -> str:
    """取 project.content_locale（zh | en | vi）；缺省 zh 保持旧行为。"""
    raw = getattr(obj, "content_locale", None) if obj is not None else None
    return normalize_locale(raw, fallback)


def resolve_content_locale(locale: str | None) -> str:
    """显式传入优先；未传时用当前请求 / 任务语言。"""
    if locale:
        return normalize_locale(locale, "zh")
    return normalize_locale(get_locale(), "zh")


def is_zh(locale: str | None) -> bool:
    return normalize_locale(locale, "zh") == "zh"


def has_cjk(text: str | None) -> bool:
    return bool(_CJK_RE.search(text or ""))


def word_count(text: str | None) -> int:
    return len(_WORD_RE.findall(text or ""))


def latin_text(text: str | None) -> bool:
    """非中文文本（越南语 / 英语等）：按词处理。空串返回 False。"""
    t = (text or "").strip()
    return bool(t) and not has_cjk(t)


def cjk_equivalent_length(text: str | None) -> int:
    """把文本长度折算成「中文字数」口径：中文按字，拉丁文按 词×1.85（≈同等朗读时长）。"""
    raw = text or ""
    if latin_text(raw):
        return int(round(word_count(raw) * 5 / LATIN_WORDS_PER_SEC))
    return len(re.sub(r"\s+", "", raw))


def truncate_words(text: str, max_chars: int) -> str:
    """按词边界截断（不截半个词）；单词本身超长时硬截。"""
    t = (text or "").strip()
    if len(t) <= max_chars:
        return t
    cut = t[:max_chars]
    if " " in cut and not t[max_chars : max_chars + 1].isspace():
        cut = cut[: cut.rfind(" ")]
    return cut.rstrip(" ,.;:!?-")


# ---- LLM 提示词附加段 ----

def storyboard_language_addon(locale: str | None) -> str:
    """科普分镜 LLM：口播/叠字用内容语言；给画面模型的字段一律英文（Seedream / Seedance 效果最好）。"""
    loc = normalize_locale(locale, "zh")
    if loc == "zh":
        return ""
    lang = content_language_name(loc)
    return (
        output_language_directive(loc)
        + "\n【字段语言分工（覆盖上文任何「使用简体中文 / 禁止英文」的要求）】"
        f"title、subtitle、text 以及 segments 中 kind=narration 的 text 是观众会听到/看到的口播与叠字，必须使用 {lang}。"
        "img_prompt、video_prompt、camera、bgm、bgm_lock、character_bible 以及 kind=visual/action 的 text "
        "是给图像/视频模型的画面描述，必须使用英文（English），不要使用中文。"
        "上文中「N 字」的长度要求请按同等朗读时长换算为词数（约 5 个中文字 ≈ 2.7 个词），"
        f"narration 的 duration 按约 {LATIN_WORDS_PER_SEC:g} 词/秒估算。\n"
        f"Spoken narration (text, narration segments), title and subtitle MUST be in {lang}. "
        "Visual fields (img_prompt, video_prompt, camera, bgm, bgm_lock, character_bible, visual/action segments) "
        "MUST be written in English. Never output Chinese."
    )


def expand_content_language_addon(locale: str | None) -> str:
    """选题扩写 LLM：输出语言 + 字数换算。"""
    loc = normalize_locale(locale, "zh")
    if loc == "zh":
        return ""
    return (
        output_language_directive(loc)
        + "\n上文中的「字」数要求请按同等朗读时长换算为词数（约 5 个中文字 ≈ 2.7 个词）。"
    )


def speech_language_addon(locale: str | None) -> str:
    """Seedance 提示词：口播语言约束（zh 为空，保持原提示词不变）。"""
    loc = normalize_locale(locale, "zh")
    if loc == "zh":
        return ""
    lang = content_language_name(loc)
    return (
        f"【口播语言】画面中如有旁白、对白或人声，必须使用 {lang} 朗读，"
        "与脚本原文逐字一致，禁止翻译成中文或说普通话；如需烧录字幕，字幕文字同样使用该语言。"
        f"Any spoken voice (and any burned-in subtitle) must be in {lang}, exactly as written."
    )


# 提示词里「简体中文字幕」的替换语言名（给中文提示词用的中文语言名）
_ZH_LANGUAGE_LABEL = {"en": "英语", "vi": "越南语"}


def localize_subtitle_language_cues(text: str, locale: str | None) -> str:
    """非 zh 内容：把 Seedance 约束 / 字幕 cue 中的「简体中文」改成内容语言；zh 原样返回。

    只改【字幕…】cue 行与「N. 字幕：…」规则行，不动画面描述正文。
    """
    loc = normalize_locale(locale, "zh")
    label = _ZH_LANGUAGE_LABEL.get(loc)
    if not label or "简体中文" not in (text or ""):
        return text
    out: list[str] = []
    for line in (text or "").split("\n"):
        stripped = line.strip()
        if stripped.startswith("【字幕") or re.match(r"^\d+\.\s*字幕", stripped):
            line = line.replace("简体中文", label)
        out.append(line)
    return "\n".join(out)


# ---- 字幕字体 ----

_LATIN_FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
)

# ASS / libass 字体族名（非中文内容用 DejaVu Sans，保证越南语声调符号完整）
LATIN_SUBTITLE_FONT_FAMILY = "DejaVu Sans"


def find_latin_font() -> str | None:
    """越南语 / 英语字幕字体文件（drawtext fontfile）；找不到返回 None。"""
    import os

    env = os.environ.get("FRAMECUT_LATIN_FONT")
    for c in (env, *_LATIN_FONT_CANDIDATES):
        if c and Path(c).exists():
            return c
    try:
        import subprocess

        out = subprocess.check_output(
            ["fc-match", "-f", "%{file}", "DejaVu Sans:lang=vi"],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=3,
        ).strip()
        if out and Path(out).exists():
            return out
    except Exception:  # noqa: BLE001
        pass
    return None


# ---- 默认音色 ----

# 非中文内容的 edge-tts 默认音色（豆包 uranus 音色仅中文）
DEFAULT_VOICE_BY_LOCALE: dict[str, dict[str, str]] = {
    "vi": {"female": "vi-VN-HoaiMyNeural", "male": "vi-VN-NamMinhNeural"},
    "en": {"female": "en-US-JennyNeural", "male": "en-US-GuyNeural"},
}

_EDGE_VOICE_RE = re.compile(r"^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$")


def is_edge_voice(speaker: str | None) -> bool:
    """形如 vi-VN-HoaiMyNeural 的微软 neural 音色 id。"""
    return bool(_EDGE_VOICE_RE.match((speaker or "").strip()))


def edge_voice_locale(speaker: str | None) -> str | None:
    """edge 音色 id 的语言：vi-VN-* → vi；en-* → en；zh-* → zh。"""
    s = (speaker or "").strip()
    if not is_edge_voice(s):
        return None
    head = s.split("-", 1)[0].lower()
    return head if head in {"zh", "en", "vi"} else head


def speaker_supports_locale(speaker: str | None, locale: str | None) -> bool:
    """音色能否朗读该内容语言。豆包 zh_* / saturn_* / S_ 克隆音视为仅中文。"""
    loc = normalize_locale(locale, "zh")
    if loc == "zh":
        return True
    s = (speaker or "").strip()
    if not s:
        return False
    edge_loc = edge_voice_locale(s)
    if edge_loc is not None:
        return edge_loc == loc
    lowered = s.lower()
    if lowered.startswith(("zh_", "saturn_", "s_")):
        return False
    if lowered.startswith(f"{loc}_") or lowered.startswith(f"{loc}-"):
        return True
    # 其它自定义 id（如 TokenFree Gemini 多语种音色名）交给上游
    return True


def default_voice_for_locale(locale: str | None, gender: str | None = None) -> str | None:
    """非中文内容的默认音色；zh 返回 None（沿用原逻辑）。"""
    loc = normalize_locale(locale, "zh")
    table = DEFAULT_VOICE_BY_LOCALE.get(loc)
    if not table:
        return None
    return table.get(gender or "female") or table["female"]


# ---- 译文变体（内部按文案匹配错误类型时，兼容三种语言） ----

def text_variants(source: str) -> tuple[str, ...]:
    """中文原文 + 已登记的 en / vi 译文，供 ``any(v in msg for v in …)`` 匹配。"""
    cats = catalogs()
    out = [source]
    for loc in ("en", "vi"):
        v = cats.get(loc, {}).get(source)
        if v and v not in out:
            out.append(v)
    return tuple(out)


def contains_any_variant(text: str | None, source: str) -> bool:
    t = text or ""
    return any(v and v in t for v in text_variants(source))
