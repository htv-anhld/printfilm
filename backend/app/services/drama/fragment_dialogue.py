"""LLM 分镜的对白覆盖与口播估时；纯函数，不访问数据库或模型。"""

from __future__ import annotations

import math
import re
from collections import defaultdict
from typing import Any

from app.services.drama.content_locale import WORD_TO_CJK_UNITS, is_zh
from app.services.seedance_segments import (
    SEGMENT_DURATION_MAX,
    SEGMENT_DURATION_MIN,
    SPEAKER_DIALOGUE_RE,
    classify_voice_body,
    is_generic_narrator_name,
    is_production_meta_line,
)

_ASSET_REF_RE = re.compile(r"@asset:(\d+)")
_VOICE_CUE_RE = re.compile(r"^(【(?:对白|旁白|内心独白)[^】]*】)\s*")
_SPEECH_CHARS_PER_SECOND = 3
_MIN_COVERAGE_LINE_CHARS = 6
_SPEECH_BREAKS = frozenset("。！？!?；;，,、")
# vi/en：按词计口播（约 2.5 词/秒，与 content_locale.speech_seconds 一致），句读含西文句号/省略号
_WORDS_PER_SECOND = 4.0 / WORD_TO_CJK_UNITS
_WORD_SPEECH_BREAKS = frozenset("。！？!?；;，,、.…:：")
_WORD_TOKEN_RE = re.compile(r"\S+\s*|\s+")
_WORD_COUNT_RE = re.compile(r"[^\W_]+(?:['’-][^\W_]+)*", re.UNICODE)


def summarize_locked_fragment(content: str, assets: list[Any] | None = None) -> str:
    """保留已拍镜头的画面和口播，避免续拆时只给模型一个分镜编号。"""
    names = asset_names_by_id(assets)
    lines: list[str] = []
    for raw in (content or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("@duration:") or is_production_meta_line(line):
            continue
        line = re.sub(r"^【(?:画面|空镜|对白|旁白|内心独白)[^】]*】\s*", "", line)
        lines.append(_restore_assets(line, names) if names else line)
        if len(lines) >= 3:
            break
    return "；".join(lines)


def asset_names_by_id(assets: list[Any] | None) -> dict[int, str]:
    """建立资产 ID 到名称的映射，用于还原角色称呼和台词中的引用。"""
    return {
        int(asset.id): str(asset.name or "")
        for asset in assets or []
        if getattr(asset, "id", None) is not None
    }


def _restore_assets(text: str, asset_names: dict[int, str]) -> str:
    """将资产标记还原为实际名称，避免将标记字符计入口播。"""
    return _ASSET_REF_RE.sub(lambda match: asset_names.get(int(match[1]), ""), text)


def _spoken_parts(line: str) -> tuple[str, str, str] | None:
    """提取生产前缀、说话人标注和台词，跳过画面、场头与舞台指示。"""
    raw = (line or "").strip()
    if not raw or is_production_meta_line(raw) or raw.startswith(("出场人物", "@duration:", "###")):
        return None
    cue = _VOICE_CUE_RE.match(raw)
    if raw.startswith("【") and cue is None:
        return None
    prefix = cue[1] if cue else ""
    body = raw[cue.end() :] if cue else raw
    # 先屏蔽资产标记中的冒号，再识别真正分隔说话人与台词的冒号。
    masked = _ASSET_REF_RE.sub(lambda match: f"@asset_{match[1]}", body)
    if classify_voice_body(masked) not in {"dialogue", "narration", "inner"}:
        return None
    spoken = SPEAKER_DIALOGUE_RE.match(masked)
    if not spoken:
        return None
    label = spoken["speaker"] + (spoken["paren"] or "")

    def unmask(text: str) -> str:
        """恢复解析前临时屏蔽的资产标记。"""
        return re.sub(r"@asset_(\d+)", r"@asset:\1", text)

    return prefix, unmask(label), unmask(spoken["text"])


def _speech_char_count(text: str, asset_names: dict[int, str]) -> int:
    """只统计实际读出的文字和数字，不计算标点、空白与生产标记。"""
    return sum(char.isalnum() for char in _restore_assets(text, asset_names))


def _speech_word_count(text: str, asset_names: dict[int, str]) -> int:
    """vi/en：统计实际读出的词数（资产标记还原为名称后计词）。"""
    return len(_WORD_COUNT_RE.findall(_restore_assets(text, asset_names)))


def _split_spoken_text(text: str, asset_names: dict[int, str]) -> list[str]:
    """
    保留全部台词，优先按句读拆成单段时长可容纳的口播。
    zh 按字（每秒约三字）；vi/en 按词边界（每秒约 2.5 词），绝不在单词中间切开。
    """
    word_mode = not is_zh()
    if word_mode:
        max_units = int(_WORDS_PER_SECOND * SEGMENT_DURATION_MAX)
        tokens = _WORD_TOKEN_RE.findall(text)
        breaks = _WORD_SPEECH_BREAKS

        def cost_of(token: str) -> int:
            return _speech_word_count(token, asset_names)

        def is_break(token: str) -> bool:
            tail = token.rstrip()
            return bool(tail) and tail[-1] in breaks
    else:
        max_units = _SPEECH_CHARS_PER_SECOND * SEGMENT_DURATION_MAX
        tokens = re.findall(r"@asset:\d+|[\s\S]", text)

        def cost_of(token: str) -> int:
            return _speech_char_count(token, asset_names)

        def is_break(token: str) -> bool:
            return token in _SPEECH_BREAKS

    chunks: list[str] = []
    start = 0
    while start < len(tokens):
        end = start
        count = 0
        last_break: int | None = None
        while end < len(tokens):
            cost = cost_of(tokens[end])
            if count + cost > max_units and end > start:
                break
            count += cost
            end += 1
            if is_break(tokens[end - 1]) and count >= max_units // 2:
                last_break = end
        if end < len(tokens) and last_break is not None:
            end = last_break
        chunk = "".join(tokens[start:end])
        if word_mode:
            chunk = chunk.strip()
        if chunk:
            chunks.append(chunk)
        start = end
    return chunks


def _speech_seconds(chunk: str, asset_names: dict[int, str]) -> int:
    """单段口播秒数：zh 每秒约三字；vi/en 每秒约 2.5 词（按字母数会把越南语时长估高约 3 倍）。"""
    if is_zh():
        raw = math.ceil(_speech_char_count(chunk, asset_names) / _SPEECH_CHARS_PER_SECOND)
    else:
        raw = math.ceil(_speech_word_count(chunk, asset_names) / _WORDS_PER_SECOND)
    return max(SEGMENT_DURATION_MIN, raw)


def timed_spoken_lines(
    line: str, asset_names: dict[int, str]
) -> list[tuple[int, str]] | None:
    """按口播语速分配时长（zh 按字、vi/en 按词）；过长台词按句读/词边界拆段，画面行返回 None。"""
    parts = _spoken_parts(line)
    if parts is None:
        return None
    prefix, label, text = parts
    result: list[tuple[int, str]] = []
    for chunk in _split_spoken_text(text, asset_names):
        result.append((_speech_seconds(chunk, asset_names), f"{prefix}{label}：{chunk}"))
    return result


def dialogue_coverage_insufficient(
    episode_body: str,
    drafts: list[dict[str, Any]],
    *,
    assets: list[Any] | None = None,
) -> bool:
    """检查源剧本主要台词是否按说话人保留，允许跨镜拆句与标点调整。"""
    asset_names = asset_names_by_id(assets)
    # 旧调用方未加载资产时，无法解析的引用不能成为自动重拆已有分镜的依据。
    if assets is None and any(
        int(match[1]) not in asset_names
        for draft in drafts
        for match in _ASSET_REF_RE.finditer(str(draft.get("content") or ""))
    ):
        return False

    def spoken_rows(content: str) -> list[tuple[str, str]]:
        """还原资产，去除情绪和标点，生成可逐句核对的口播文本。"""
        rows: list[tuple[str, str]] = []
        for line in content.splitlines():
            parts = _spoken_parts(_restore_assets(line, asset_names))
            if parts is None:
                continue
            _, label, text = parts
            speaker = re.split(r"[（(]", label, maxsplit=1)[0].strip().lower()
            if is_generic_narrator_name(speaker):
                speaker = "旁白"
            normalized = "".join(char.lower() for char in text if char.isalnum())
            if normalized:
                rows.append((speaker, normalized))
        return rows

    target_by_speaker: dict[str, str] = defaultdict(str)
    for draft in drafts:
        for speaker, text in spoken_rows(str(draft.get("content") or "")):
            target_by_speaker[speaker] += text
    offsets: dict[str, int] = defaultdict(int)
    for speaker, text in spoken_rows(episode_body):
        if len(text) < _MIN_COVERAGE_LINE_CHARS:
            continue
        found = target_by_speaker[speaker].find(text, offsets[speaker])
        if found < 0:
            return True
        offsets[speaker] = found + len(text)
    return False
