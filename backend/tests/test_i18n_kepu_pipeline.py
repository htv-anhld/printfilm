"""越南语 / 英语科普项目：mock 分镜生成后，用户可见可编辑的画面提示词与 cue 不含中文。"""

from __future__ import annotations

import re
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Project, Shot, Template
from app.services import pipeline
from app.services import seedance_segments as segplan
from app.services.ark import get_ark, reset_ark
from app.services.templates_seed import TEMPLATES

from tests.conftest import make_user

_CJK = re.compile(r"[㐀-鿿！-～　-〿]")
# cue 的括号「【】」本身允许（解析器靠它识别段落类型）
_ALLOWED = str.maketrans("", "", "【】")


def _no_cjk(text: str) -> bool:
    return not _CJK.search((text or "").translate(_ALLOWED))


@asynccontextmanager
async def _same_session(db: AsyncSession):
    yield db


def _template_row(seed: dict, suffix: str) -> Template:
    data = {k: v for k, v in seed.items() if k in Template.__table__.columns.keys()}
    data["id"] = f"{seed['id']}-{suffix}"[:64]
    return Template(**data)


@pytest.mark.asyncio
@pytest.mark.parametrize("locale", ["vi", "en"])
@pytest.mark.parametrize("source_type", ["theme", "script"])
async def test_vi_en_project_storyboard_has_no_cjk(
    db_session: AsyncSession, locale: str, source_type: str
) -> None:
    reset_ark()
    if not get_ark().mock:
        pytest.skip("needs ARK_MOCK=true")
    user = await make_user(db_session)
    source = (
        "Trí tuệ nhân tạo đang thay đổi cuộc sống hằng ngày"
        if source_type == "theme"
        else "Trí tuệ nhân tạo giúp chúng ta làm việc nhanh hơn. Nó cũng có những rủi ro. Hãy dùng nó một cách thông minh."
    )
    for idx, seed in enumerate(TEMPLATES):
        tpl = _template_row(seed, f"i18n{locale}{source_type}")
        db_session.add(tpl)
        await db_session.flush()
        project = Project(
            user_id=user.id,
            template_id=tpl.id,
            source_text=source,
            source_type=source_type,
            content_locale=locale,
            pipeline_mode="image_text" if idx % 2 else "full",
        )
        db_session.add(project)
        await db_session.flush()
        with (
            patch.object(pipeline, "AsyncSessionLocal", lambda: _same_session(db_session)),
            patch.object(pipeline, "publish_progress", AsyncMock()),
            patch.object(pipeline, "_record_usage_est", AsyncMock()),
        ):
            await pipeline.run_pipeline(project.id)

        shots = (
            await db_session.execute(select(Shot).where(Shot.project_id == project.id))
        ).scalars().all()
        assert shots, seed["id"]
        row = await db_session.get(Project, project.id)
        for field in (row.character_bible, row.bgm_lock):
            assert _no_cjk(field), (seed["id"], field)
        for shot in shots:
            for name in ("segment_script", "video_prompt", "img_prompt", "camera", "bgm_mood", "narration",
                         "overlay_title", "overlay_subtitle"):
                value = getattr(shot, name) or ""
                assert _no_cjk(value), (seed["id"], name, value)
            # 英文 cue 仍能被解析回来
            assert segplan.first_visual_prompt(shot.segment_script)
            if segplan.script_has_narration_cue(shot.segment_script):
                assert segplan.narration_from_script(shot.segment_script) == shot.narration
            prompt = segplan.build_seedance_prompt(
                shot.segment_script, burn_subtitles=False, content_locale=locale
            )
            assert "【Subtitles" not in prompt
    reset_ark()


def test_zh_cues_unchanged_and_english_cues_roundtrip() -> None:
    beats = [
        segplan.SegmentBeat(duration=4, kind="visual", text="Medium shot: a person at a desk"),
        segplan.SegmentBeat(duration=4, kind="narration", text="Xin chào các bạn"),
    ]
    zh = segplan.build_segment_script(beats, bgm_mood="轻快专业")
    assert zh.startswith(segplan.SUBTITLE_CUE)
    assert zh == segplan.build_segment_script(beats, bgm_mood="轻快专业", content_locale="zh")
    en = segplan.build_segment_script(beats, bgm_mood="轻快专业", content_locale="vi")
    assert en.startswith(segplan.SUBTITLE_CUE_EN)
    assert "light, upbeat and professional" in en
    assert _no_cjk(en)
    # 编辑后保持英文 cue；替换旁白 / 首帧仍生效
    edited = segplan.apply_segment_script_edit(
        segplan.replace_narration_in_script(en, "Tạm biệt các bạn")
    )
    assert _no_cjk(edited["segment_script"])
    assert edited["narration"] == "Tạm biệt các bạn"
    assert edited["img_prompt"] == "Medium shot: a person at a desk"
    # 送 Seedance 时去掉字幕 cue，并保留旁白（去掉「synced subtitles」）
    stripped = segplan.strip_model_burn_subtitle_cues(en)
    assert "【Subtitles" not in stripped
    assert segplan.NARRATION_PREFIX_EN_PLAIN in stripped
    assert segplan.script_bgm_mood(en).startswith("mixed in post")
