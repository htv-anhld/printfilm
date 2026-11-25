"""越南语项目：服务端写进剧本/资产的固定文案不应出现中文（结构标记前缀除外）。"""

import re

from app.services.drama.build_fragments import _build_production_cues
from app.services.drama.content_locale import localize_role_type, use_content_locale
from app.services.drama.seed_asset_params import (
    build_character_params,
    build_scene_params,
    manju_join_character_prompt,
)

CJK = re.compile(r"[一-鿿]")


def test_role_type_localized_for_vi_only():
    """roleType 展示按内容语言翻译，zh 原样。"""
    with use_content_locale("vi"):
        assert localize_role_type("主角（重要配角）") == "Vai chính (Vai phụ quan trọng)"
        assert localize_role_type("Nhân vật chính") == "Nhân vật chính"
    with use_content_locale("zh"):
        assert localize_role_type("反派") == "反派"


def test_asset_prompts_have_no_chinese_in_vi():
    """角色/场景生图 prompt 与默认形象名按越南语写。"""
    with use_content_locale("vi"):
        char = {"name": "An", "visualImage": "Nữ, 30 tuổi", "title": "Phi hành gia", "roleType": "主角", "coreTags": "Kiên cường"}
        assert not CJK.search(manju_join_character_prompt(char))
        assert not CJK.search(build_character_params(char)["canvas"]["appearanceName"])
        assert not CJK.search(str(build_scene_params("Xưởng cũ")))


def test_bgm_cue_text_localized_in_vi():
    """BGM 行只保留「【BGM：」结构前缀，描述文字为越南语。"""
    with use_content_locale("vi"):
        lines = _build_production_cues("夜 内 Xưởng cũ", [], [], include_subtitles=False)
    bgm = lines[0]
    assert bgm.startswith("【BGM：")
    assert not CJK.search(bgm.removeprefix("【BGM："))
