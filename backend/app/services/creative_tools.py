# -*- coding: utf-8 -*-
"""额外创作工具（对齐 Dravelio）：cinema-look、subtitle-translate、script-format、video-script、营销预设。

- cinema-look 走现有生图工具链（tool_id="cinema"，按张计费）
- 文本工具走 LLM，统一计费任务 ("studio", "tool_text")
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.i18n import _
from app.services.drama.llm import _extract_json
from app.services.llm_client import chat_completions

logger = logging.getLogger(__name__)

LANG_NAMES = {"vi": "Vietnamese", "en": "English", "zh": "Simplified Chinese", "ja": "Japanese", "ko": "Korean", "th": "Thai", "id": "Indonesian", "es": "Spanish"}

# ── cinema-look：电影调色预设（提示词给生图模型，名称走前端 i18n） ──
CINEMA_LOOKS: dict[str, str] = {
    "teal_orange": "cinematic teal and orange color grade, warm skin tones, cool shadows, anamorphic film look, subtle film grain",
    "noir": "black and white film noir, high contrast hard light, deep shadows, 1940s cinematography, film grain",
    "wes": "symmetrical pastel palette, soft even lighting, whimsical storybook color grade like a Wes Anderson film",
    "kodak": "Kodak Portra 400 film emulation, soft warm highlights, natural skin, gentle grain, 35mm photography",
    "cyberpunk": "neon cyberpunk grade, magenta and cyan lights, wet reflective surfaces, night city atmosphere",
    "golden_hour": "golden hour backlight, warm amber glow, long soft shadows, dreamy lens flare",
    "bleach": "bleach bypass look, desaturated colors, crushed blacks, gritty war-film contrast",
    "anime": "Japanese anime film color grade, vivid sky, soft cel shading, Makoto Shinkai style lighting",
}


def cinema_prompt(look: str | None, extra: str | None) -> str:
    """调色预设 + 用户补充描述；保持主体与构图。"""
    base = CINEMA_LOOKS.get((look or "").strip(), CINEMA_LOOKS["teal_orange"])
    keep = "keep the same subject, composition and framing as the reference image, only change color grading and lighting mood"
    return ", ".join(p for p in (base, keep, (extra or "").strip()) if p)


# ── 营销视频预设 ───────────────────────────────────────
MARKETING_PRESETS: list[dict[str, Any]] = [
    {"id": "product_hero", "ratio": "9:16", "duration": 15, "template_hint": "product", "prompt": "Hero product reveal: dramatic lighting, slow orbit around the product, macro details of materials, end on logo and tagline."},
    {"id": "ugc_testimonial", "ratio": "9:16", "duration": 20, "template_hint": "ugc", "prompt": "Authentic UGC-style testimonial: a customer talks to the phone camera at home, shows the product in use, natural light, casual tone."},
    {"id": "unboxing", "ratio": "9:16", "duration": 15, "template_hint": "product", "prompt": "Top-down unboxing: hands open the package, reveal the product, quick cuts of key features, satisfying sounds."},
    {"id": "flash_sale", "ratio": "1:1", "duration": 10, "template_hint": "promo", "prompt": "Flash sale promo: bold kinetic typography, price drop animation, countdown, energetic music, clear call to action."},
    {"id": "before_after", "ratio": "9:16", "duration": 12, "template_hint": "promo", "prompt": "Before / after comparison: split screen showing the problem then the result with the product, clear on-screen labels."},
    {"id": "how_to", "ratio": "16:9", "duration": 30, "template_hint": "tutorial", "prompt": "Three-step how-to tutorial using the product, numbered steps on screen, clean studio background, friendly narration."},
    {"id": "brand_story", "ratio": "16:9", "duration": 45, "template_hint": "story", "prompt": "Brand origin story: founder voice-over, workshop b-roll, close-ups of craftsmanship, emotional music, ends on mission statement."},
    {"id": "app_demo", "ratio": "9:16", "duration": 15, "template_hint": "tutorial", "prompt": "Mobile app demo: phone mockup with screen recording, finger taps highlighted, benefit captions, download CTA."},
]


def marketing_presets() -> list[dict[str, Any]]:
    """预设列表（名称与说明由前端按 id 做 i18n）。"""
    return [dict(p) for p in MARKETING_PRESETS]


# ── 字幕翻译 ─────────────────────────────────────────
_SRT_TIME = re.compile(r"^\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}")
BATCH = 60
MAX_SUBTITLE_CHARS = 60_000


def parse_cues(content: str) -> tuple[list[dict[str, Any]], str]:
    """解析 SRT / VTT：返回 ([{head: [序号/时间行], text: [台词行]}], 头部（WEBVTT 等）)。"""
    lines = (content or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    header = ""
    if lines and lines[0].strip().upper().startswith("WEBVTT"):
        header = lines[0].strip()
        lines = lines[1:]
    cues: list[dict[str, Any]] = []
    block: list[str] = []
    for line in [*lines, ""]:
        if line.strip():
            block.append(line)
            continue
        if block:
            idx = next((i for i, item in enumerate(block) if _SRT_TIME.match(item)), None)
            if idx is not None:
                cues.append({"head": block[: idx + 1], "text": block[idx + 1 :]})
            block = []
    return cues, header


def render_cues(cues: list[dict[str, Any]], header: str) -> str:
    out = [header, ""] if header else []
    for cue in cues:
        out.extend(cue["head"])
        out.extend(cue["text"])
        out.append("")
    return "\n".join(out).rstrip() + "\n"


async def translate_subtitles(content: str, target: str, source: str | None = None) -> str:
    """只翻译台词行，序号与时间轴原样保留；分批调用 LLM，按编号回填，缺失则保留原文。"""
    if len(content or "") > MAX_SUBTITLE_CHARS:
        raise ValueError(_("字幕过长，请拆分后再翻译"))
    cues, header = parse_cues(content)
    if not cues:
        raise ValueError(_("未识别到 SRT / VTT 字幕"))
    lang = LANG_NAMES.get(target, target)
    system = (
        f"You are a professional subtitle translator. Translate each numbered subtitle into {lang}. "
        "Keep meaning, tone and natural spoken style; keep line breaks as \\n; keep names; do not merge or split items. "
        'Reply with JSON only: {"items": [{"i": <number>, "t": "<translation>"}]}.'
    )
    if source:
        system += f" Source language: {LANG_NAMES.get(source, source)}."
    for start in range(0, len(cues), BATCH):
        chunk = cues[start : start + BATCH]
        payload = [{"i": start + n, "t": "\n".join(c["text"])} for n, c in enumerate(chunk)]
        raw = await chat_completions(system, json.dumps(payload, ensure_ascii=False), temperature=0.3, max_tokens=8000)
        data = _extract_json(raw) or {}
        items = data.get("items") if isinstance(data, dict) else data
        mapped = {int(x["i"]): str(x.get("t") or "") for x in items or [] if isinstance(x, dict) and str(x.get("i", "")).isdigit()}
        for n, cue in enumerate(chunk):
            text = mapped.get(start + n, "").strip()
            if text:
                cue["text"] = text.split("\n")
    return render_cues(cues, header)


# ── 剧本格式化 ───────────────────────────────────────
SCRIPT_FORMATS = {
    "screenplay": "a standard screenplay: scene headings (INT./EXT. LOCATION - TIME), action lines, CHARACTER names in caps above dialogue, parentheticals when needed",
    "shotlist": "a numbered shot list table in Markdown with columns: Shot | Framing | Camera move | Action | Dialogue/VO | Duration (s)",
    "narration": "a voice-over narration script split into short paragraphs, each with a [visual] note in brackets describing what is on screen",
    "episodes": "an episode outline: series logline, then for each episode a title, a 3-5 sentence synopsis and the cliffhanger",
}


async def format_script(content: str, fmt: str, lang: str) -> str:
    """把粗糙文本整理成指定剧本格式（不改剧情，只重排与补全格式）。"""
    if fmt not in SCRIPT_FORMATS:
        raise ValueError(_("不支持的格式"))
    text = (content or "").strip()
    if len(text) < 20:
        raise ValueError(_("内容太短"))
    system = (
        f"Rewrite the user's raw story text as {SCRIPT_FORMATS[fmt]}. "
        f"Write in {LANG_NAMES.get(lang, lang)}. Keep the plot, characters and dialogue meaning; fix structure and formatting only. "
        "Output only the formatted script."
    )
    return (await chat_completions(system, text[:30_000], temperature=0.4, max_tokens=12000)).strip()


# ── 视频脚本（从 YouTube 链接 / 文本素材） ─────────────
def youtube_id(url: str) -> str | None:
    """支持 watch?v=、youtu.be/、shorts/、embed/。"""
    try:
        parts = urlsplit((url or "").strip())
    except ValueError:
        return None
    host = (parts.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    if host == "youtu.be":
        vid = parts.path.strip("/").split("/")[0]
    elif host.endswith("youtube.com"):
        if parts.path == "/watch":
            vid = dict(p.split("=", 1) for p in parts.query.split("&") if "=" in p).get("v", "")
        else:
            segs = [s for s in parts.path.split("/") if s]
            vid = segs[1] if len(segs) >= 2 and segs[0] in {"shorts", "embed", "live"} else ""
    else:
        return None
    return vid if re.fullmatch(r"[A-Za-z0-9_-]{6,20}", vid or "") else None


async def youtube_context(url: str) -> dict[str, str]:
    """公开信息：oEmbed 标题 / 作者 + 页面 meta 描述（不下载视频、不抓字幕）。"""
    vid = youtube_id(url)
    if not vid:
        raise ValueError(_("请填写有效的 YouTube 链接"))
    watch = f"https://www.youtube.com/watch?v={vid}"
    out = {"url": watch, "title": "", "author": "", "description": ""}
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0), follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (compatible; PrintfilmBot/1.0)", "Accept-Language": "en"}) as client:
        try:
            meta = await client.get("https://www.youtube.com/oembed", params={"url": watch, "format": "json"})
            if meta.status_code == 200:
                data = meta.json()
                out["title"] = str(data.get("title") or "")[:300]
                out["author"] = str(data.get("author_name") or "")[:120]
            page = await client.get(watch)
            if page.status_code == 200:
                m = re.search(r'<meta name="description" content="([^"]*)"', page.text)
                if m:
                    import html

                    out["description"] = html.unescape(m.group(1))[:2000]
        except httpx.HTTPError as exc:
            logger.warning("youtube fetch failed %s: %s", vid, exc)
    if not out["title"]:
        raise ValueError(_("无法读取该视频信息（可能是私密或已删除）"))
    return out


async def video_script(*, url: str | None, material: str | None, lang: str, duration: int, style: str) -> dict[str, str]:
    """生成原创短视频脚本：以视频主题 / 素材为灵感，不复述原文。"""
    context = ""
    source: dict[str, str] = {}
    if url:
        source = await youtube_context(url)
        context = f"Reference video title: {source['title']}\nChannel: {source['author']}\nDescription: {source['description']}"
    if material and material.strip():
        context += f"\n\nUser notes / material:\n{material.strip()[:8000]}"
    if not context.strip():
        raise ValueError(_("请填写 YouTube 链接或素材文本"))
    duration = max(15, min(int(duration or 60), 600))
    system = (
        f"You are a short-video scriptwriter. Using the reference only as inspiration for the topic, write an ORIGINAL script in "
        f"{LANG_NAMES.get(lang, lang)} for a {duration}-second video in a {style or 'engaging explainer'} style. "
        "Never copy sentences from the reference. Structure: a 3-second hook, numbered scenes each with [visual] and VO lines, "
        "and a closing call to action. Also give a short title on the first line prefixed with 'Title: '."
    )
    text = (await chat_completions(system, context, temperature=0.7, max_tokens=6000)).strip()
    title = ""
    first, _sep, rest = text.partition("\n")
    if first.lower().startswith("title:"):
        title, text = first.split(":", 1)[1].strip(), rest.strip()
    return {"title": title or source.get("title", ""), "script": text, "source_title": source.get("title", "")}
