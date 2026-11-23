"""AI 短视频（科普）多语言：内容语言指令、越南语字幕断行 / 时长、模板翻译、音色。"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.i18n import use_locale
from app.services import ark as ark_mod
from app.services import seedance_segments as segplan
from app.services.ark import ArkGateway
from app.services.ffmpeg_compose import _split_caption_chunks, _timed_caption_windows
from app.services.kepu_locale import (
    default_voice_for_locale,
    speaker_supports_locale,
    storyboard_language_addon,
)

_SHOTS_JSON = json.dumps(
    {
        "character_bible": "无固定人物",
        "bgm_lock": "轻快专业",
        "shots": [
            {
                "shot": 1,
                "duration": 5,
                "title": "Mở đầu",
                "subtitle": "Trí tuệ nhân tạo quanh ta",
                "text": "Trí tuệ nhân tạo đang thay đổi cuộc sống hằng ngày của chúng ta.",
                "segments": [
                    {"duration": 3, "kind": "visual", "text": "中景：人物在工位操作电脑"},
                    {
                        "duration": 4,
                        "kind": "narration",
                        "text": "Trí tuệ nhân tạo đang thay đổi cuộc sống hằng ngày của chúng ta.",
                    },
                ],
                "img_prompt": "中景：人物在工位操作电脑",
                "camera": "轻推",
                "bgm": "轻快专业",
            }
        ],
    },
    ensure_ascii=False,
)


@pytest.fixture
def captured_llm(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """非 mock 模式跑分镜 / 扩写，截获系统提示词。"""
    systems: list[str] = []

    async def _fake_chat(system: str, user: str, **_kw) -> str:
        systems.append(system)
        if "作品名" in system:
            return json.dumps({"title": "AI và cuộc sống", "content": "Nội dung chủ đề"}, ensure_ascii=False)
        return _SHOTS_JSON

    monkeypatch.setattr(ArkGateway, "mock", property(lambda self: False))
    monkeypatch.setattr(ark_mod, "chat_completions", _fake_chat)
    return systems


async def _storyboard(locale: str | None):
    return await ArkGateway().chat_storyboard(
        source_text="AI thay đổi cuộc sống",
        source_type="theme",
        style_prefix="扁平插画",
        llm_system_addon="",
        duration_min=4,
        duration_max=12,
        max_shot_duration=12,
        content_locale=locale,
    )


@pytest.mark.asyncio
async def test_storyboard_directive_appended_for_vi_and_en(captured_llm: list[str]) -> None:
    result = await _storyboard("vi")
    assert "OUTPUT LANGUAGE" in captured_llm[-1]
    assert "Vietnamese" in captured_llm[-1]
    # 越南语旁白不被去空格 / 截断，叠字标题保持原文
    assert result.shots[0].text.startswith("Trí tuệ nhân tạo đang")
    assert result.shots[0].overlay_title == "Mở đầu"

    await _storyboard("en")
    assert "English" in captured_llm[-1]


@pytest.mark.asyncio
async def test_storyboard_directive_absent_for_zh(captured_llm: list[str]) -> None:
    await _storyboard("zh")
    zh_system = captured_llm[-1]
    assert "OUTPUT LANGUAGE" not in zh_system
    # 未传 content_locale 且无请求语言（默认 zh）时与显式 zh 一致
    await _storyboard(None)
    assert captured_llm[-1] == zh_system
    assert storyboard_language_addon("zh") == ""


@pytest.mark.asyncio
async def test_expand_content_follows_request_locale(captured_llm: list[str]) -> None:
    with use_locale("vi"):
        out = await ArkGateway().expand_content("AI trong đời sống", "theme")
    assert "Vietnamese" in captured_llm[-1]
    assert out["title"] == "AI và cuộc sống"
    await ArkGateway().expand_content("人工智能", "theme")
    assert "OUTPUT LANGUAGE" not in captured_llm[-1]


def test_vietnamese_subtitle_breaks_on_spaces() -> None:
    text = (
        "Xin chào các bạn, hôm nay chúng ta sẽ cùng tìm hiểu trí tuệ nhân tạo "
        "đang thay đổi cuộc sống hằng ngày như thế nào."
    )
    chunks = _split_caption_chunks(text, max_chars=14)
    words = set(text.replace(",", " ").replace(".", " ").split())
    assert len(chunks) >= 2
    for chunk in chunks:
        # 每个词都是原文完整的词（没有被从中间切开），且声调符号保留
        assert all(w in words for w in chunk.split()), chunk
        assert len(chunk) <= int(14 * 2.2) + 8
    assert "hằng ngày" in " ".join(chunks)
    windows = _timed_caption_windows(text, start=0.0, duration=8.0, max_chars=14)
    assert windows[-1][1] == pytest.approx(8.0)


def test_chinese_subtitle_breaking_unchanged() -> None:
    chunks = _split_caption_chunks("今天我们用三分钟把这件事讲清楚，先从生活里最常见的现象说起", max_chars=8)
    assert chunks[0] == "今天我们用三分钟"
    assert all(len(c) <= 10 for c in chunks)


def test_narration_duration_counts_words_for_vietnamese() -> None:
    vi = "Trí tuệ nhân tạo đang thay đổi cuộc sống hằng ngày của chúng ta"  # 14 từ
    assert segplan.estimate_narration_duration(vi) == 7  # ceil(14/2.7)=6 +1
    # 中文仍按字：20 字 → (20+4)//5+1 = 5
    assert segplan.estimate_narration_duration("一" * 20) == 5
    assert segplan.narration_from_script(
        "【旁白·自然语速·同步字幕】Xin chào.\n【旁白·自然语速·同步字幕】Tạm biệt."
    ) == "Xin chào. Tạm biệt."


def test_seedance_prompt_follows_content_language() -> None:
    script = segplan.build_segment_script(
        [segplan.SegmentBeat(duration=4, kind="narration", text="Xin chào các bạn")],
        bgm_mood="轻快专业",
    )
    vi_prompt = segplan.build_seedance_prompt(script, burn_subtitles=True, content_locale="vi")
    assert "Vietnamese" in vi_prompt
    assert "简体中文" not in vi_prompt
    zh_prompt = segplan.build_seedance_prompt(script, burn_subtitles=True)
    assert zh_prompt == segplan.build_seedance_prompt(script, burn_subtitles=True, content_locale="zh")
    assert "简体中文" in zh_prompt


def test_latin_visual_shot_labels_are_visual() -> None:
    assert segplan.classify_voice_body("Wide shot: a city at dawn") == "visual"
    assert segplan.classify_voice_body("Viễn cảnh: thành phố lúc bình minh") == "visual"
    assert segplan.is_visual_description_body("Cảnh trống: con phố vắng")


def test_template_name_translation() -> None:
    from app.api.templates import localize_template
    from app.models import Template
    from app.services.templates_seed import TEMPLATES

    seed = dict(TEMPLATES[0])
    seed.pop("is_active", None)
    tpl = Template(**seed, is_active=True)
    with use_locale("vi"):
        out = localize_template(tpl)
    assert out.name == "Giới thiệu dự án mã nguồn mở"
    assert out.category == ["开源", "图文", "商业"]  # 原值保留作筛选键
    assert out.category_labels == ["Mã nguồn mở", "Ảnh + chữ", "Kinh doanh"]
    # 非中文界面：内置模板视觉提示词给英文版（与 vi / en 项目生成时一致）
    assert out.style_prefix.startswith("High-quality product demo still")
    assert out.seedream_config["extra_prompt"].startswith("The subject is a person")
    assert out.llm_system_addon == seed["llm_system_addon"]
    with use_locale("en"):
        assert localize_template(tpl).name == "Open-source project showcase"
    with use_locale("zh"):
        zh_out = localize_template(tpl)
        assert zh_out.name == "开源项目展示"
        assert zh_out.style_prefix == seed["style_prefix"]
    tpl.name = "管理员自定义名称"
    with use_locale("vi"):
        assert localize_template(tpl).name == "管理员自定义名称"


def test_voice_defaults_by_content_locale() -> None:
    from app.services.pipeline import _project_voice

    assert not speaker_supports_locale("zh_female_cancan_uranus_bigtts", "vi")
    assert speaker_supports_locale("vi-VN-HoaiMyNeural", "vi")
    assert default_voice_for_locale("en", "male") == "en-US-GuyNeural"
    tpl = SimpleNamespace(audio_config={"voice_preset": "teacher_clear"})
    vi_project = SimpleNamespace(template=tpl, voice_id="", content_locale="vi")
    assert _project_voice(vi_project) == "vi-VN-NamMinhNeural"
    zh_project = SimpleNamespace(template=tpl, voice_id="", content_locale="zh")
    assert _project_voice(zh_project) == "zh_male_shaonianzixin_uranus_bigtts"
