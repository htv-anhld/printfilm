"""额外创作工具：字幕解析 / 翻译回填、剧本格式化、YouTube 链接解析、视频脚本、计费任务登记、调色提示词。"""

from __future__ import annotations

import json

import pytest

from app.services import creative_tools as ct
from app.services.tasks.handlers import TASK_HANDLERS as HANDLERS

SRT = """1
00:00:01,000 --> 00:00:03,000
你好，世界

2
00:00:04,000 --> 00:00:06,500
第二句
有两行
"""


def test_parse_and_render_roundtrip():
    cues, header = ct.parse_cues(SRT)
    assert header == "" and len(cues) == 2
    assert cues[1]["text"] == ["第二句", "有两行"]
    assert ct.render_cues(cues, header).strip() == SRT.strip()
    vtt_cues, vtt_header = ct.parse_cues("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n")
    assert vtt_header == "WEBVTT" and vtt_cues[0]["text"] == ["Hi"]


async def test_translate_keeps_timing_and_falls_back(monkeypatch):
    async def fake_chat(system, user, **_kw):
        items = json.loads(user)
        # 只翻第 0 条，模拟模型漏了一条
        return json.dumps({"items": [{"i": items[0]["i"], "t": "Xin chào, thế giới"}]})

    monkeypatch.setattr(ct, "chat_completions", fake_chat)
    out = await ct.translate_subtitles(SRT, "vi")
    assert "00:00:01,000 --> 00:00:03,000\nXin chào, thế giới" in out
    assert "第二句\n有两行" in out  # 缺失时保留原文
    with pytest.raises(ValueError):
        await ct.translate_subtitles("no subtitles here", "vi")


async def test_format_script_validates(monkeypatch):
    async def fake_chat(system, user, **_kw):
        assert "screenplay" in system and "Vietnamese" in system
        return "INT. NHÀ - NGÀY\n..."

    monkeypatch.setattr(ct, "chat_completions", fake_chat)
    assert (await ct.format_script("Một câu chuyện dài hơn hai mươi ký tự.", "screenplay", "vi")).startswith("INT.")
    with pytest.raises(ValueError):
        await ct.format_script("ngắn", "screenplay", "vi")
    with pytest.raises(ValueError):
        await ct.format_script("x" * 50, "poem", "vi")


@pytest.mark.parametrize(
    "url,vid",
    [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ?si=x", "dQw4w9WgXcQ"),
        ("https://m.youtube.com/shorts/abcDEF12345", "abcDEF12345"),
        ("https://vimeo.com/123", None),
        ("https://www.youtube.com/watch?v=<script>", None),
    ],
)
def test_youtube_id(url, vid):
    assert ct.youtube_id(url) == vid


async def test_video_script_uses_context_and_parses_title(monkeypatch):
    async def fake_ctx(url):
        return {"url": url, "title": "How bees fly", "author": "Nat", "description": "bees"}

    seen = {}

    async def fake_chat(system, user, **_kw):
        seen["system"], seen["user"] = system, user
        return "Title: Bí mật đôi cánh ong\n1. [visual] ... VO: ..."

    monkeypatch.setattr(ct, "youtube_context", fake_ctx)
    monkeypatch.setattr(ct, "chat_completions", fake_chat)
    out = await ct.video_script(url="https://youtu.be/dQw4w9WgXcQ", material="", lang="vi", duration=60, style="")
    assert out["title"] == "Bí mật đôi cánh ong" and out["source_title"] == "How bees fly"
    assert "ORIGINAL" in seen["system"] and "How bees fly" in seen["user"]
    with pytest.raises(ValueError):
        await ct.video_script(url=None, material="  ", lang="vi", duration=60, style="")


def test_cinema_prompt_and_registry():
    assert "noir" in ct.cinema_prompt("noir", "") and "keep the same subject" in ct.cinema_prompt("unknown", "rain")
    assert ("studio", "tool_text") in HANDLERS
    assert {p["id"] for p in ct.marketing_presets()} >= {"product_hero", "ugc_testimonial"}


async def test_script_format_endpoint_bills(db_session, monkeypatch):
    from app.api.creative_tools import ScriptFormatBody, script_format
    from app.models_tasks import TaskRun
    from tests.conftest import make_user

    async def fake_format(content, fmt, lang):
        return "formatted"

    monkeypatch.setattr(ct, "format_script", fake_format)
    user = await make_user(db_session, balance_fen=100_000)
    out = await script_format(ScriptFormatBody(content="x" * 40, format="shotlist", lang="en"), db=db_session, user=user)
    assert out["content"] == "formatted"
    task = await db_session.get(TaskRun, out["task_id"])
    assert (task.domain, task.task_type, task.billing_status) == ("studio", "tool_text", "settled")
