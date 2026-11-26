"""漫剧后期字幕烧录：把 BurnCue 时间轴用 drawtext 叠到成片底部居中。

- 字体沿用科普合成（ffmpeg_compose）：越南语/英语用 DejaVu Sans（声调完整），中文用 CJK 字体；
- 拉丁文字按词断行（``_latin_fit_chars`` 估算行宽），中日韩按字断行；最多两行一屏，超长自动翻屏；
- 每行文字写入独立 textfile + ``expansion=none``，彻底规避 filtergraph 转义（引号/冒号/百分号）；
- 滤镜写进 ``-filter_script:v``，整部影片上百条字幕也不会撑爆命令行。
"""

from __future__ import annotations

import logging
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.services.drama.subtitle_cues import BurnCue
from app.services.ffmpeg_compose import _escape_fontfile, _find_cjk_font, _latin_fit_chars, _run, _which
from app.services.kepu_locale import find_latin_font, has_cjk

logger = logging.getLogger("app.drama.subtitle_burn")

# 一屏最多行数
MAX_LINES_PER_PAGE = 2

# 拉丁文本里混入的全角标点 → 半角（DejaVu 不含全角标点字形）
_FULLWIDTH_PUNCT = str.maketrans(
    {"。": ".", "，": ",", "！": "!", "？": "?", "：": ":", "；": ";", "、": ",", "（": "(", "）": ")", "…": "..."}
)
# 标点前多余空格（去掉 @asset 引用后常见 "vậy ?"）
_SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+([,.!?;:])")


@dataclass(frozen=True)
class SubtitleStyle:
    """按画幅算出的字幕样式（像素）。"""

    font_size: int
    line_height: int
    bottom_margin: int
    max_chars_latin: int
    max_chars_cjk: int
    border: int
    shadow: int


def subtitle_style(width: int, height: int) -> SubtitleStyle:
    """9:16 / 16:9 等画幅的字号、行高、安全边距与每行字数。"""
    w = max(int(width or 0), 64)
    h = max(int(height or 0), 64)
    portrait = h / w > 1.2
    short_side = min(w, h)
    # 竖屏字号按宽度算（约 5%），横屏按高度（约 5.5%）
    font_size = max(16, round(short_side * (0.05 if portrait else 0.055)))
    # 竖屏底部要避开短视频平台的标题/按钮区（约 12%），横屏 7%
    bottom_margin = round(h * (0.12 if portrait else 0.07))
    usable_w = int(w * 0.9)  # _latin_fit_chars 再留 8%，左右合计约 17% 安全边距
    return SubtitleStyle(
        font_size=font_size,
        line_height=round(font_size * 1.32),
        bottom_margin=bottom_margin,
        max_chars_latin=_latin_fit_chars(usable_w, font_size),
        max_chars_cjk=max(6, int(w * 0.84 / font_size)),
        border=max(2, round(font_size * 0.09)),
        shadow=max(1, round(font_size * 0.06)),
    )


def normalize_burn_text(text: str) -> str:
    """上屏前整理：拉丁文本全角标点转半角，去掉标点前空格。"""
    t = re.sub(r"\s+", " ", str(text or "")).strip()
    if not has_cjk(t):
        t = t.translate(_FULLWIDTH_PUNCT)
        t = _SPACE_BEFORE_PUNCT_RE.sub(r"\1", t)
    return t.strip()


def wrap_caption_lines(text: str, style: SubtitleStyle) -> list[str]:
    """断行：越南语/英语按词（不拆单词），中日韩按字。"""
    t = normalize_burn_text(text)
    if not t:
        return []
    if has_cjk(t):
        n = style.max_chars_cjk
        compact = t.replace(" ", "")
        return [compact[i : i + n] for i in range(0, len(compact), n)]
    n = style.max_chars_latin
    lines: list[str] = []
    cur = ""
    for word in t.split(" "):
        cand = f"{cur} {word}".strip()
        if cur and len(cand) > n:
            lines.append(cur)
            cur = word
        else:
            cur = cand
    if cur:
        lines.append(cur)
    # 末行只剩一个短词时并回上一行（略超行宽可接受）
    if len(lines) >= 2 and len(lines[-1].split()) == 1 and len(lines[-2]) + 1 + len(lines[-1]) <= n + 6:
        lines[-2] = f"{lines[-2]} {lines.pop()}"
    return lines


@dataclass(frozen=True)
class CaptionPage:
    """一屏字幕：时间窗 + 1~2 行文字。"""

    start_sec: float
    end_sec: float
    lines: tuple[str, ...]


def paginate_cues(cues: list[BurnCue], style: SubtitleStyle) -> list[CaptionPage]:
    """把每条 cue 断行后按两行一屏翻页，时间按字数比例分配。"""
    pages: list[CaptionPage] = []
    for cue in cues:
        lines = wrap_caption_lines(cue.text, style)
        if not lines:
            continue
        chunks = [lines[i : i + MAX_LINES_PER_PAGE] for i in range(0, len(lines), MAX_LINES_PER_PAGE)]
        weights = [max(1, sum(len(x) for x in chunk)) for chunk in chunks]
        total = float(sum(weights))
        span = max(0.0, cue.end_sec - cue.start_sec)
        cursor = cue.start_sec
        for chunk, weight in zip(chunks, weights):
            nxt = cursor + span * weight / total
            pages.append(CaptionPage(start_sec=round(cursor, 3), end_sec=round(nxt, 3), lines=tuple(chunk)))
            cursor = nxt
    return pages


def build_subtitle_filter(
    cues: list[BurnCue],
    *,
    width: int,
    height: int,
    text_dir: Path,
    latin_font: str | None,
    cjk_font: str | None,
) -> tuple[str, dict[str, str]]:
    """
    构造 drawtext 滤镜链。
    @param text_dir 每行文字写入的目录（textfile 路径前缀）
    @returns (滤镜字符串, {文件名: 行文字})；无可烧录字幕时滤镜为空串
    """
    style = subtitle_style(width, height)
    pages = paginate_cues(cues, style)
    files: dict[str, str] = {}
    parts: list[str] = []
    for p_idx, page in enumerate(pages):
        n = len(page.lines)
        for l_idx, line in enumerate(page.lines):
            name = f"cue_{p_idx:05d}_{l_idx}.txt"
            files[name] = line
            font = cjk_font if has_cjk(line) else (latin_font or cjk_font)
            font_opt = f"fontfile='{_escape_fontfile(font)}':" if font else ""
            text_path = _escape_fontfile(str(text_dir / name))
            # 自下而上排行：最后一行贴安全边距
            y = height - style.bottom_margin - style.font_size - (n - 1 - l_idx) * style.line_height
            parts.append(
                f"drawtext={font_opt}textfile='{text_path}':expansion=none:"
                f"fontsize={style.font_size}:fontcolor=white:"
                f"borderw={style.border}:bordercolor=black@0.9:"
                f"shadowx={style.shadow}:shadowy={style.shadow}:shadowcolor=black@0.55:"
                f"x=(w-text_w)/2:y={max(0, y)}:"
                f"enable='between(t\\,{page.start_sec:.3f}\\,{page.end_sec:.3f})'"
            )
    return ",".join(parts), files


def burn_subtitles(video_in: Path, video_out: Path, cues: list[BurnCue], *, width: int, height: int) -> int:
    """
    把字幕烧进视频（视频重编码，音频直通）。
    @returns 实际烧录的字幕行数；0 表示无字幕，此时直接拷贝原文件
    """
    video_out.parent.mkdir(parents=True, exist_ok=True)
    latin_font = find_latin_font()
    cjk_font = _find_cjk_font()
    with tempfile.TemporaryDirectory(prefix="drama_subs_") as tmp:
        tmp_path = Path(tmp)
        vf, files = build_subtitle_filter(
            cues, width=width, height=height, text_dir=tmp_path, latin_font=latin_font, cjk_font=cjk_font
        )
        if not vf:
            video_out.write_bytes(video_in.read_bytes())
            return 0
        for name, text in files.items():
            (tmp_path / name).write_text(text, encoding="utf-8")
        script = tmp_path / "filter.txt"
        script.write_text(vf, encoding="utf-8")
        _run(
            [
                _which("ffmpeg"),
                "-y",
                "-i",
                str(video_in),
                "-filter_script:v",
                str(script),
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "copy",
                "-movflags",
                "+faststart",
                str(video_out),
            ]
        )
    logger.info("burned subtitles lines=%s size=%sx%s out=%s", len(files), width, height, video_out.name)
    return len(files)
