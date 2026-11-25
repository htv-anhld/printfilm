"""漫剧内容语言（DramaProject.content_locale）上下文与语言相关的启发式。

- 界面语言（``app.i18n.get_locale``）决定报错/提示文案；
- 内容语言决定 AI 产出的剧本、台词、字幕等用什么语言写，跟项目走。

后台任务 / API 在拿到项目后调用 ``set_content_locale(project.content_locale)``（或
``use_content_locale``），之后本模块内的 LLM 调用与时长估算自动按该语言处理；
未设置时回退到当前界面语言（测试/无语言头时为 zh，与原行为一致）。
"""

from __future__ import annotations

import re
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Iterator

from app.i18n import get_locale, normalize_locale, output_language_directive, translate

_content_locale: ContextVar[str | None] = ContextVar("printfilm_drama_content_locale", default=None)

# 与 app.i18n.output_language_directive 输出里的标记一致，用于幂等判断
_DIRECTIVE_MARKER = "OUTPUT LANGUAGE"
_VISUAL_MARKER = "PROMPT LANGUAGE"

# 汉字（含扩展 A、兼容表意）与拉丁词
_CJK_RE = re.compile(r"[㐀-䶿一-鿿豈-﫿]")
_WORD_RE = re.compile(r"[^\W_]+(?:['’-][^\W_]+)*", re.UNICODE)

# 语速：中文约 4 字/秒；越南语/英语约 2.5 词/秒 → 1 词 ≈ 1.6 个「汉字当量」
WORD_TO_CJK_UNITS = 1.6


def project_content_locale(project: Any) -> str:
    """读取项目内容语言（缺省 zh，兼容旧数据）。"""
    raw = getattr(project, "content_locale", None) if project is not None else None
    return normalize_locale(raw, "zh")


def get_content_locale() -> str:
    """当前内容语言；未显式设置时回退当前界面语言。"""
    value = _content_locale.get()
    if value:
        return value
    return normalize_locale(get_locale(), "zh")


def set_content_locale(locale: str | None) -> None:
    """设置当前上下文内容语言（请求/后台任务各自独立的 contextvar 副本）。"""
    _content_locale.set(normalize_locale(locale, "zh") if locale else None)


def set_project_content_locale(project: Any) -> str:
    """按项目设置内容语言并返回。"""
    loc = project_content_locale(project)
    _content_locale.set(loc)
    return loc


@contextmanager
def use_content_locale(locale: str | None) -> Iterator[str]:
    """临时切换内容语言。"""
    token = _content_locale.set(normalize_locale(locale, "zh") if locale else None)
    try:
        yield get_content_locale()
    finally:
        _content_locale.reset(token)


def _resolve(locale: str | None) -> str:
    return normalize_locale(locale, "zh") if locale else get_content_locale()


def is_zh(locale: str | None = None) -> bool:
    return _resolve(locale) == "zh"


# ---------------------------------------------------------------------------
# LLM 提示词：输出语言指令
# ---------------------------------------------------------------------------

_DRAMA_MARKERS_NOTE = (
    "\n结构标记保持原样（不要翻译，只把标记后面的内容用目标语言写）：场号行「### 场1-2」、"
    "场头行开头的「日/夜/晨 内/外」、「出场人物：」、动作行开头的「△」、「【空镜：…】」、"
    "分镜行标签「空镜：/远景：/近景：/中景：/全景：/特写：」、「旁白（VO）：」、台词括号里的 vo/os，"
    "以及「角色名：台词」中的全角冒号格式。角色名在全剧保持一致。\n"
    "Keep these structural markers exactly as written (do NOT translate them; translate only the text "
    "after them): scene headers \"### 场1-2\", the \"日/夜 内/外\" prefix of scene heading lines, "
    "\"出场人物：\", the \"△\" action prefix, \"【空镜：…】\", shot labels \"空镜：/远景：/近景：/中景：/全景：/特写：\", "
    "\"旁白（VO）：\", vo/os tags in parentheses, and the \"Name：line\" colon format.\n"
    "上文以「字/汉字」给出的篇幅要求按同等时长换算：约 1 个汉字 ≈ 0.6 个单词。\n"
    "Length limits given in Chinese characters (字/汉字) mean the same speaking time: "
    "about 0.6 words per Chinese character (e.g. 550 字 ≈ 330 words)."
)


def drama_output_directive(locale: str | None = None) -> str:
    """剧本/分镜类 LLM 的输出语言指令（zh 为空串）。"""
    loc = _resolve(locale)
    base = output_language_directive(loc)
    if not base:
        return ""
    return base + _DRAMA_MARKERS_NOTE


def visual_prompt_directive(locale: str | None = None) -> str:
    """生图 / 音色描述类提示词 LLM：非中文项目统一用英文写（Seedream、音色设计对英文理解最好）。"""
    loc = _resolve(locale)
    if loc == "zh":
        return ""
    return (
        "\n\n【提示词语言 / PROMPT LANGUAGE — 最高优先级】\n"
        "无论上面要求什么语言，这条描述必须用英语书写（专有名词/角色名保持原样），字数要求按同等信息量理解。\n"
        "Write this description in English regardless of the language requested above; "
        "keep proper names as given. Treat the length requirement as the equivalent amount of detail."
    )


def with_output_language(system: str, locale: str | None = None, *, mode: str = "content") -> str:
    """把语言指令拼到系统提示词末尾（幂等；zh 原样返回）。

    mode: ``content``（剧本/台词/名称等）| ``visual``（生图提示词）| ``none``。
    """
    text = system or ""
    if mode == "none":
        return text
    if mode == "visual":
        if _VISUAL_MARKER in text:
            return text
        return text + visual_prompt_directive(locale)
    if _DIRECTIVE_MARKER in text:
        return text
    return text + drama_output_directive(locale)


# ---------------------------------------------------------------------------
# 文本长度 / 口播时长启发式
# ---------------------------------------------------------------------------


def text_units(text: str | None, locale: str | None = None) -> int:
    """文本篇幅，按「汉字当量」计：zh 为去空白后字符数（与原逻辑一致）；

    vi/en 为 汉字数 + 词数 × 1.6（按语速折算），这样原先以汉字为单位的阈值/预算可以共用。
    """
    raw = text or ""
    if _resolve(locale) == "zh":
        return len(re.sub(r"\s+", "", raw))
    cjk = len(_CJK_RE.findall(raw))
    words = len(_WORD_RE.findall(_CJK_RE.sub(" ", raw)))
    return cjk + int(round(words * WORD_TO_CJK_UNITS))


def speech_seconds(text: str | None, locale: str | None = None) -> float:
    """粗略口播秒数：zh ≈ 4 字/秒；vi/en ≈ 2.5 词/秒。"""
    return text_units(text, locale) / 4.0


def clip_text(text: str, max_units: int, locale: str | None = None) -> str:
    """按篇幅上限截断；zh 按字符（原行为），vi/en 按单词边界。"""
    raw = (text or "").strip()
    if _resolve(locale) == "zh":
        return raw[:max_units]
    if text_units(raw, locale) <= max_units:
        return raw
    max_words = max(1, int(max_units / WORD_TO_CJK_UNITS))
    words = raw.split()
    return " ".join(words[:max_words])


def char_limit(zh_chars: int, locale: str | None = None) -> int:
    """以汉字为单位的字符上限换算成当前语言的字符上限（拉丁文字约 3.5 倍）。"""
    if _resolve(locale) == "zh":
        return zh_chars
    return int(zh_chars * 3.5)


# ---------------------------------------------------------------------------
# 分镜行标签（前端在 en/vi 下插入的本地化景别标签，见 frontend lib/dramaCameraLexicon.ts）
# ---------------------------------------------------------------------------

VISUAL_LABEL_ALIASES: tuple[str, ...] = (
    # en
    "empty shot", "wide shot", "full shot", "medium shot", "close shot", "close-up", "close up",
    "closeup", "extreme close-up", "establishing shot", "establishing", "atmosphere shot",
    "push in", "pull out", "pan", "truck", "tracking shot", "high angle", "low angle",
    "aerial shot", "visual", "environment", "shot", "action", "transition", "flashback",
    # vi
    "cảnh trống", "viễn cảnh", "toàn cảnh", "trung cảnh", "cận cảnh", "đặc tả", "đại đặc tả",
    "cảnh thiết lập", "cảnh không khí", "đẩy máy", "kéo máy", "lia máy", "dịch máy", "máy theo",
    "góc cao", "góc thấp", "flycam", "hình ảnh", "môi trường", "cảnh quay", "hành động",
    "chuyển cảnh", "hồi tưởng",
)
EMPTY_SHOT_ALIASES: tuple[str, ...] = ("empty shot", "cảnh trống")
# 「旁白」在英/越剧本里的写法
NARRATOR_ALIASES: frozenset[str] = frozenset(
    {"旁白", "narrator", "narration", "voice-over", "voiceover", "người dẫn chuyện", "lời dẫn", "dẫn truyện"}
)


def _alias_re(aliases: tuple[str, ...]) -> re.Pattern[str]:
    alt = "|".join(re.escape(a) for a in sorted(set(aliases), key=len, reverse=True))
    return re.compile(rf"^(?:{alt})\s*[：:]", re.IGNORECASE)


VISUAL_LABEL_ALIAS_RE = _alias_re(VISUAL_LABEL_ALIASES)
EMPTY_SHOT_ALIAS_RE = _alias_re(EMPTY_SHOT_ALIASES)


def is_visual_label_alias_line(text: str) -> bool:
    """行首是否为英/越景别标签（如 ``Wide shot: …`` / ``Viễn cảnh: …``）。"""
    return bool(VISUAL_LABEL_ALIAS_RE.match((text or "").strip()))


def is_narrator_name(name: str) -> bool:
    return (name or "").strip().lower() in NARRATOR_ALIASES


# 按句号切句：兼容中文与西文标点
SENTENCE_SPLIT_RE = re.compile(r"[。！？!?]|(?<=[^\d])\.(?=\s|$)")


def first_sentence(text: str) -> str:
    raw = (text or "").strip()
    return SENTENCE_SPLIT_RE.split(raw, maxsplit=1)[0].strip() or raw


# ---------------------------------------------------------------------------
# 服务端默认文案（内容语言）
# ---------------------------------------------------------------------------


def default_episode_title(number: int | str | None, locale: str | None = None) -> str:
    """默认集名「第 N 集」按内容语言。"""
    return translate("第 {n} 集", _resolve(locale), n=number)


# 只匹配西文默认集名；中文「第 N 集」由调用方原逻辑 + 精确比较处理（保持 zh 行为不变）
_DEFAULT_TITLE_RE = re.compile(r"^(?:Episode|Tập)\s+\d+$", re.IGNORECASE)


def is_default_episode_title(title: str | None, number: int | None = None) -> bool:
    """是否为系统默认集名（任意语言）。"""
    t = (title or "").strip()
    if not t:
        return True
    if number is not None:
        for loc in ("zh", "en", "vi"):
            if t == default_episode_title(number, loc):
                return True
    return bool(_DEFAULT_TITLE_RE.match(t))


def content_text(source: str, locale: str | None = None, /, **vars: object) -> str:
    """按内容语言翻译服务端写进剧本/字幕的固定文案（key 为中文原文）。"""
    return translate(source, _resolve(locale), **vars)


# 摘要 roleType 的常见中文取值（数据保持中文：分镜人物介绍按它判断主次），展示时按内容语言翻译
_ROLE_TYPE_TOKENS = ("女主角", "男主角", "重要配角", "主角", "配角", "反派", "群众", "客串", "旁白")


def localize_role_type(raw: str | None, locale: str | None = None) -> str:
    """把「主角（重要配角）」这类 roleType 中的已知词按内容语言替换；zh 或未知词原样返回。"""
    text = str(raw or "").strip()
    loc = _resolve(locale)
    if not text or loc == "zh":
        return text
    for token in _ROLE_TYPE_TOKENS:
        if token in text:
            text = text.replace(token, translate(token, loc))
    return text.replace("（", " (").replace("）", ")")
