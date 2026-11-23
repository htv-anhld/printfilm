"""漫剧模块多语言：项目内容语言、LLM 输出语言指令、时长估算与报错文案。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.i18n import translate, use_locale
from app.schemas_drama import DramaProjectCreate, DramaProjectUpdate
from app.services.drama.build_fragments import (
    CAST_LINE_RE,
    SCENE_HEADER_RE,
    _estimate_line_duration,
    _format_narrative_line,
    _shorten_intro,
)
from app.services.drama.build_seedance_generate_body import build_seedance_prompt_text
from app.services.drama.content_locale import (
    default_episode_title,
    is_default_episode_title,
    text_units,
    use_content_locale,
    with_output_language,
)
from tests.conftest import make_user

SOURCE = "少年禹在洪水肆虐的年代立志治水，历经十三年三过家门而不入，最终疏通九河。"


# ---------------------------------------------------------------------------
# 项目 content_locale
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_project_content_locale_defaults_to_request_locale(db_session):
    from app.api.drama.projects import create_project

    user = await make_user(db_session)
    # 无语言头 → zh（与原行为一致）
    out_zh = await create_project(DramaProjectCreate(source=SOURCE), db=db_session, user=user)
    assert out_zh.content_locale == "zh"
    assert out_zh.title == "未命名漫剧"

    # 界面语言 vi → 默认内容语言 vi，默认标题按内容语言
    with use_locale("vi"):
        out_vi = await create_project(DramaProjectCreate(source=SOURCE), db=db_session, user=user)
    assert out_vi.content_locale == "vi"
    assert out_vi.title == translate("未命名漫剧", "vi")


@pytest.mark.asyncio
async def test_create_and_patch_project_explicit_content_locale(db_session):
    from app.api.drama.projects import create_project, update_project

    user = await make_user(db_session)
    with use_locale("vi"):
        out = await create_project(
            DramaProjectCreate(source=SOURCE, content_locale="en-US"),
            db=db_session,
            user=user,
        )
    assert out.content_locale == "en"

    patched = await update_project(
        out.id, DramaProjectUpdate(content_locale="vi"), db=db_session, user=user
    )
    assert patched.content_locale == "vi"
    # 非法值保留原值
    patched2 = await update_project(
        out.id, DramaProjectUpdate(content_locale="xx"), db=db_session, user=user
    )
    assert patched2.content_locale == "vi"


@pytest.mark.asyncio
async def test_create_project_error_follows_ui_locale(db_session):
    from app.api.drama.projects import create_project

    user = await make_user(db_session)
    with use_locale("en"):
        with pytest.raises(HTTPException) as exc:
            await create_project(DramaProjectCreate(source="too short"), db=db_session, user=user)
    assert exc.value.detail == "The original idea needs at least 20 characters"


# ---------------------------------------------------------------------------
# LLM 输出语言指令
# ---------------------------------------------------------------------------


def _capture_chat(reply: str = '{"episodes": []}'):
    calls: list[dict] = []

    async def _fake(system, user, **kwargs):
        calls.append({"system": system, "user": user})
        return reply

    return calls, _fake


@pytest.mark.asyncio
async def test_script_summary_prompt_has_directive_for_vi_only():
    from app.services.drama.agents import run_script_summary

    calls, fake = _capture_chat('{"seriesTitle": "x", "characters": []}')
    with patch("app.services.drama.llm.chat_completions", new=AsyncMock(side_effect=fake)):
        with use_content_locale("vi"):
            await run_script_summary(SOURCE, episode_count=3)
        with use_content_locale("zh"):
            await run_script_summary(SOURCE, episode_count=3)
    vi_system, zh_system = calls[0]["system"], calls[1]["system"]
    assert "OUTPUT LANGUAGE" in vi_system and "Vietnamese" in vi_system
    # 结构标记保持中文，保证下游解析
    assert "### 场1-2" in vi_system
    assert "OUTPUT LANGUAGE" not in zh_system


@pytest.mark.asyncio
async def test_episode_outline_and_props_prompts_have_directive():
    from app.services.drama.agents import run_episode_outline
    from app.services.drama.extract_props_materials import extract_props_materials

    calls, fake = _capture_chat('{"episodes": [{"episodeNumber": 1, "title": "Khởi đầu"}], "props": []}')
    with patch("app.services.drama.llm.chat_completions", new=AsyncMock(side_effect=fake)):
        with use_content_locale("vi"):
            outline = await run_episode_outline(SOURCE, {"seriesTitle": "Đại Vũ"}, 2)
            await extract_props_materials(summary={}, episode_bodies=[])
        with use_content_locale("zh"):
            await run_episode_outline(SOURCE, {"seriesTitle": "大禹"}, 2)
    assert "OUTPUT LANGUAGE" in calls[0]["system"]
    assert "OUTPUT LANGUAGE" in calls[1]["system"]
    # 道具 visualPrompt 为生图提示词 → 英文
    assert "visualPrompt" in calls[1]["system"] and "English" in calls[1]["system"]
    assert "OUTPUT LANGUAGE" not in calls[2]["system"]
    # 补齐的缺失集按内容语言命名
    assert outline[1]["title"] == "Tập 2"


def test_with_output_language_is_idempotent_and_empty_for_zh():
    base = "你是编剧"
    assert with_output_language(base, "zh") == base
    once = with_output_language(base, "en")
    assert once != base and with_output_language(once, "en") == once
    assert "English" in with_output_language(base, "vi", mode="visual")
    assert with_output_language(base, "vi", mode="none") == base


# ---------------------------------------------------------------------------
# 时长 / 篇幅启发式
# ---------------------------------------------------------------------------


def test_text_units_zh_unchanged_and_vi_counts_words():
    zh = "禹：疏堵并举，通川达海。"
    assert text_units(zh, "zh") == len(zh)
    vi = "Chúng ta phải khơi thông dòng sông trước khi mùa lũ tới"
    # 12 词 ≈ 19 汉字当量（而不是 45 个字母）
    assert text_units(vi, "vi") == round(12 * 1.6)


def test_dialogue_duration_uses_words_for_vietnamese():
    line = (
        "【对白·慢速清晰·同步字幕】Vũ：Chúng ta phải khơi thông dòng sông trước khi mùa lũ tới, "
        "nếu không cả làng sẽ bị cuốn trôi"
    )
    with use_content_locale("zh"):
        zh_estimate = _estimate_line_duration(line)
    with use_content_locale("vi"):
        vi_estimate = _estimate_line_duration(line)
    # 按字母计会顶到上限 12s；按词（约 21 词 ≈ 8s）更贴近真实语速
    assert zh_estimate == 12
    assert 6 <= vi_estimate <= 10


def test_episode_min_length_counts_words_for_vi():
    from app.services.drama.agents import MIN_EPISODE_CONTENT_CHARS, _content_char_len

    body = " ".join(["từ"] * 300)  # 300 词 ≈ 480 汉字当量
    with use_content_locale("vi"):
        assert _content_char_len(body) >= MIN_EPISODE_CONTENT_CHARS
    short = " ".join(["từ"] * 100)
    with use_content_locale("vi"):
        assert _content_char_len(short) < MIN_EPISODE_CONTENT_CHARS


def test_shorten_intro_keeps_spaces_for_vi():
    with use_content_locale("vi"):
        intro = _shorten_intro("Thủ lĩnh trị thủy. Thủy tổ nhà Hạ")
    assert intro == "Thủ lĩnh trị thủy"
    with use_content_locale("zh"):
        assert _shorten_intro("治水 首领。夏朝始祖") == "治水首领"


# ---------------------------------------------------------------------------
# 解析容错 / Seedance 口播语言
# ---------------------------------------------------------------------------


def test_parsers_accept_translated_markers():
    assert SCENE_HEADER_RE.match("### 场1-2")
    assert SCENE_HEADER_RE.match("### Scene 1-2")
    assert SCENE_HEADER_RE.match("### Cảnh 2-1")
    assert CAST_LINE_RE.match("Nhân vật: Vũ, Bá Ích").group(1) == "Vũ, Bá Ích"
    assert CAST_LINE_RE.match("出场人物：禹、伯益").group(1) == "禹、伯益"


def test_localized_shot_label_is_visual_not_dialogue():
    out = _format_narrative_line("Viễn cảnh: dòng sông cuộn trào dưới mưa")
    assert out.startswith("【画面")
    out_en = _format_narrative_line("Wide shot: the river floods the valley")
    assert out_en.startswith("【画面")


def test_seedance_prompt_speech_language_follows_content_locale():
    script = "@duration:5\n【对白·慢速清晰·同步字幕】Vũ：Theo tôi nào!\n【字幕：底部居中·简体中文·逐句轮换·与口播同步】"
    vi_prompt = build_seedance_prompt_text(script, [], content_locale="vi")
    assert "越南语" in vi_prompt and "Vietnamese" in vi_prompt
    assert "简体中文" not in vi_prompt
    zh_prompt = build_seedance_prompt_text(script, [], content_locale="zh")
    assert "【强制约束：语言】" not in zh_prompt


def test_default_episode_titles():
    assert default_episode_title(3, "zh") == "第 3 集"
    assert default_episode_title(3, "vi") == "Tập 3"
    assert default_episode_title(3, "en") == "Episode 3"
    assert is_default_episode_title("Tập 3", 3)
    assert is_default_episode_title("Episode 7")
    assert not is_default_episode_title("Khởi đầu", 1)
