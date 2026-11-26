"""漫剧后期字幕 cue：从分镜正文提取口播字幕（与前端 lib/dramaSubtitleBoard.ts 逐行对齐）。

字幕板 / SRT 导出 / 服务端成片烧录共用同一套解析规则：
- ``@duration:N`` 开启一个时长块，块内每句对白/旁白占满该块时间窗；
- 字幕正文去掉 ``@asset:ID`` 引用与（动作说明）括注。
改解析规则时必须同步前端 ``frontend/src/lib/dramaSubtitleBoard.ts``。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable, Literal

from app.services.drama.content_locale import VISUAL_LABEL_ALIASES

SubtitleMode = Literal["model", "post"]

# 说话人占位：旁白 / 内心独白（前端渲染时再本地化）
SPEAKER_NARRATION = "narration"
SPEAKER_INNER = "inner_monologue"

# SRT 单条最短显示时长（秒），与前端导出一致
SRT_MIN_CUE_SEC = 0.4

_DURATION_RE = re.compile(r"^@duration:(\d+)")
_ASSET_REF_RE = re.compile(r"@asset:\d+\s*")
# 行首可能连续多个【…】标签（如「【空镜·…】【空镜：…】」），全部去掉
_LEADING_TAG_RE = re.compile(r"^(?:【[^】]+】\s*)+")
_LATIN_VOICE_PREFIX_RE = re.compile(
    r"^(narration|narrator|voice-?over|vo|inner monologue|lời dẫn|người dẫn chuyện|thuyết minh|"
    r"độc thoại nội tâm|độc thoại)\s*(?:\((?:vo|v\.o\.)\))?\s*[：:]",
    re.IGNORECASE,
)
_DIALOGUE_RE = re.compile(r"^([^：:]{1,24})[：:](.+)$")
_NON_SPEAKER_RE = re.compile(r"^(?:https?|@?duration|@?asset)$", re.IGNORECASE)
_ZH_SHOT_LABELS = frozenset({"空镜", "远景", "近景", "特写", "全景", "中景"})
_VISUAL_ALIASES = frozenset(a.strip().lower() for a in VISUAL_LABEL_ALIASES)


@dataclass(frozen=True)
class SubtitleCue:
    """一条字幕：时间单位秒；fragment_index 为参与解析的分镜序号（0 起）。"""

    fragment_id: int | None
    fragment_index: int
    start_sec: float
    end_sec: float
    speaker: str
    text: str


def resolve_effective_subtitle_mode(
    episode_params: dict[str, Any] | None,
    project_params: dict[str, Any] | None,
) -> SubtitleMode:
    """有效字幕方式：项目全局 subtitleMode 优先，再回退分集 subtitleMode / 历史 subtitleEnabled；默认后期。"""
    proj = project_params if isinstance(project_params, dict) else {}
    mode = proj.get("subtitleMode")
    if mode in ("model", "post"):
        return mode  # type: ignore[return-value]
    ep = episode_params if isinstance(episode_params, dict) else {}
    mode = ep.get("subtitleMode")
    if mode in ("model", "post"):
        return mode  # type: ignore[return-value]
    return "model" if _truthy(ep.get("subtitleEnabled")) else "post"


def _truthy(value: Any) -> bool:
    """兼容字符串/数字布尔值（缺省 False）。"""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"0", "false", "no", "off", ""}:
            return False
        if normalized in {"1", "true", "yes", "on"}:
            return True
    return bool(value)


def parse_subtitle_line(line: str) -> tuple[str, str] | None:
    """解析单行口播：返回 (说话人, 正文)；画面描述 / 标签行返回 None。"""
    normalized = _ASSET_REF_RE.sub("", str(line or "")).strip()
    stripped = _LEADING_TAG_RE.sub("", normalized, count=1).strip()
    if not stripped:
        return None
    for prefix, speaker in (
        ("旁白（VO）：", SPEAKER_NARRATION),
        ("旁白：", SPEAKER_NARRATION),
        ("内心独白：", SPEAKER_INNER),
    ):
        if stripped.startswith(prefix):
            return speaker, stripped[len(prefix) :].strip()
    latin = _LATIN_VOICE_PREFIX_RE.match(stripped)
    if latin:
        inner = bool(re.search(r"monologue|độc thoại", latin.group(1), re.IGNORECASE))
        text = stripped[latin.end() :].strip()
        if not text:
            return None
        return (SPEAKER_INNER if inner else SPEAKER_NARRATION), text
    dialogue = _DIALOGUE_RE.match(stripped)
    if not dialogue:
        return None
    speaker = dialogue.group(1).strip()
    text = dialogue.group(2).strip()
    if not speaker or not text:
        return None
    if speaker in _ZH_SHOT_LABELS:
        return None
    if speaker.lower() in _VISUAL_ALIASES or _NON_SPEAKER_RE.match(speaker):
        return None
    return speaker, text


def build_fragment_cues(
    content: str | None,
    *,
    fragment_id: int | None = None,
    fragment_index: int = 0,
    offset_sec: float = 0.0,
) -> tuple[list[SubtitleCue], float]:
    """
    解析单条分镜正文。
    @returns (cue 列表（时间已加 offset_sec）, 该分镜按 @duration 累计的总时长)
    """
    lines = [ln.strip() for ln in str(content or "").replace("\r\n", "\n").split("\n")]
    cues: list[SubtitleCue] = []
    local = 0.0
    block_duration = 0.0
    block_start = 0.0
    for line in lines:
        if not line:
            continue
        m = _DURATION_RE.match(line)
        if m:
            local += block_duration
            block_duration = float(max(0, int(m.group(1) or 0)))
            block_start = local
            continue
        spoken = parse_subtitle_line(line)
        if not spoken or block_duration <= 0:
            continue
        cues.append(
            SubtitleCue(
                fragment_id=fragment_id,
                fragment_index=fragment_index,
                start_sec=offset_sec + block_start,
                end_sec=offset_sec + block_start + block_duration,
                speaker=spoken[0],
                text=spoken[1],
            )
        )
    local += block_duration
    return cues, local


def build_subtitle_board(fragments: Iterable[Any]) -> list[SubtitleCue]:
    """整集字幕板（按 @duration 顺序累计时间轴），等价前端 buildDramaSubtitleBoard。"""
    cues: list[SubtitleCue] = []
    global_sec = 0.0
    for index, frag in enumerate(fragments):
        frag_cues, total = build_fragment_cues(
            getattr(frag, "content", None),
            fragment_id=getattr(frag, "id", None),
            fragment_index=index,
            offset_sec=global_sec,
        )
        cues.extend(frag_cues)
        global_sec += total
    return cues


def sanitize_caption_text(raw: str | None) -> str:
    """清理（动作说明）括注，保留可上屏的口播正文。"""
    text = re.sub(r"（[^）]*）", "", str(raw or ""))
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    # 去掉 @asset 称呼后残留的行首标点（如 "@asset:113, hay…" → "hay…"）
    return re.sub(r"^[,，、;；:：.。\s]+", "", text)


def format_srt_timestamp(total_sec: float) -> str:
    """秒数 → SRT 时间轴 00:00:00,000。"""
    ms_total = max(0, round(total_sec * 1000))
    hours, rem = divmod(ms_total, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    seconds, millis = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def export_srt(cues: Iterable[SubtitleCue]) -> str:
    """导出 SRT（仅正文，不含说话人），等价前端 exportDramaSubtitleBoardSrt。"""
    items = [(c, sanitize_caption_text(c.text)) for c in cues]
    items = [(c, t) for c, t in items if t]
    blocks = []
    for idx, (cue, text) in enumerate(items, start=1):
        start = format_srt_timestamp(cue.start_sec)
        end = format_srt_timestamp(max(cue.end_sec, cue.start_sec + SRT_MIN_CUE_SEC))
        blocks.append(f"{idx}\n{start} --> {end}\n{text}")
    return "\n\n".join(blocks)


@dataclass(frozen=True)
class TimelineClip:
    """成片里的一段：分镜正文 + 实际视频时长；burn=False 的段（模型字幕集）不出后期字幕。"""

    content: str | None
    duration_sec: float
    burn: bool = True
    fragment_id: int | None = None


@dataclass(frozen=True)
class BurnCue:
    """待烧录的一条字幕（成片绝对时间，秒）。"""

    start_sec: float
    end_sec: float
    text: str


def build_burn_timeline(clips: Iterable[TimelineClip], *, min_cue_sec: float = SRT_MIN_CUE_SEC) -> list[BurnCue]:
    """
    把每段分镜的字幕 cue 映射到成片时间轴：
    - 段起点 = 之前各段**实际**视频时长之和（整部影片跨集同样累加）；
    - 实际视频比 @duration 合计短时，按比例压缩段内 cue，避免字幕被截掉；
    - 同一时长块内多句对白共享一个时间窗时，按字数依次切分，避免叠在一起；
    - 正文清洗规则与 SRT 导出一致。
    """
    out: list[BurnCue] = []
    offset = 0.0
    for index, clip in enumerate(clips):
        actual = max(0.0, float(clip.duration_sec or 0.0))
        if clip.burn and actual > 0:
            cues, declared = build_fragment_cues(clip.content, fragment_id=clip.fragment_id, fragment_index=index)
            scale = actual / declared if declared > 0 and actual < declared - 0.25 else 1.0
            for start, end, text in _split_shared_windows(cues):
                a = start * scale
                b = min(end * scale, actual)
                if b - a < min_cue_sec * 0.5:
                    continue
                out.append(BurnCue(start_sec=round(offset + a, 3), end_sec=round(offset + b, 3), text=text))
        offset += actual
    return out


def _split_shared_windows(cues: list[SubtitleCue]) -> list[tuple[float, float, str]]:
    """同一时间窗内的多条 cue 按清洗后字数比例顺序切分。"""
    groups: dict[tuple[float, float], list[str]] = {}
    order: list[tuple[float, float]] = []
    for cue in cues:
        text = sanitize_caption_text(cue.text)
        if not text:
            continue
        key = (cue.start_sec, cue.end_sec)
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(text)
    result: list[tuple[float, float, str]] = []
    for start, end in order:
        texts = groups[(start, end)]
        if len(texts) == 1:
            result.append((start, end, texts[0]))
            continue
        weights = [max(1, len(t)) for t in texts]
        total = float(sum(weights))
        cursor = start
        for text, weight in zip(texts, weights):
            nxt = cursor + (end - start) * weight / total
            result.append((cursor, nxt, text))
            cursor = nxt
    return result
