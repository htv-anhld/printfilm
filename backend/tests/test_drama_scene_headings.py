"""越/英编号场头（Cảnh 1. 地点 – 时段）抽取场景资产名回归。"""

from app.services.drama.build_fragments import SCENE_LOCATION_RE, extract_scene_meta, normalize_scene_location_name
from app.services.drama.seed import _extract_scene_names_from_bodies


def _loc(line: str) -> str | None:
    """匹配场头并返回规范化地点名。"""
    m = SCENE_LOCATION_RE.match(line)
    return normalize_scene_location_name(m.group(1)) if m else None


def test_vi_numbered_scene_headings():
    assert _loc("Cảnh 1. Trạm xe buýt – chiều mưa") == "Trạm xe buýt"
    assert _loc("Cảnh 1. Ngoại cảnh - Cầu đá trấn Giang Nam - Đêm mưa") == "Cầu đá trấn Giang Nam"
    assert _loc("CẢNH 2. PHÒNG ĐIỀU KHIỂN – ĐÊM") == "PHÒNG ĐIỀU KHIỂN"


def test_en_numbered_and_legacy_headings():
    assert _loc("SCENE 3: INT. KITCHEN - NIGHT") == "KITCHEN"
    assert _loc("INT. HALL - NIGHT") == "HALL"
    assert _loc("NGÀY - NỘI - Phòng học") == "Phòng học"
    assert _loc("日 内 客厅") == "客厅"


def test_narrative_line_starting_with_canh_is_not_heading():
    assert _loc("Cảnh vật thật đẹp dưới mưa") is None


def test_seed_scene_names_dedupe_same_location():
    body = (
        "Cảnh 1. Trạm xe buýt – chiều mưa\nMai đứng chờ.\n"
        "Cảnh 2. Trạm xe buýt – tiếp\nMinh chạy tới.\n"
        "Cảnh 3. Phố cổ – mưa nặng hạt\nMinh chạy đi.\n"
    )
    assert _extract_scene_names_from_bodies([body]) == ["Trạm xe buýt", "Phố cổ"]
    assert extract_scene_meta(body)["sceneName"] == "Trạm xe buýt"


def test_inline_duration_tag_keeps_following_text():
    """编辑器在时长 chip 后同行续写：「@duration:7 文字」不能让整段被丢弃。"""
    from app.services.drama.build_fragments import parse_fragment_timed_blocks, repair_fragment_timed_layout

    content = "【BGM：x】\n@duration:3\n【对白】A：hi\n@duration:7 Gió biển thổi nhẹ.\n【对白】B：bye"
    _, blocks = parse_fragment_timed_blocks(content)
    assert [d for d, _ in blocks] == [3, 7]
    assert blocks[1][1] == ["@duration:7", "Gió biển thổi nhẹ.", "【对白】B：bye"]
    repaired = repair_fragment_timed_layout(content, duration_sec=10)
    assert "Gió biển thổi nhẹ." in repaired and "B：bye" in repaired


def test_location_opener_uses_latin_period_for_vi():
    from app.services.drama.build_fragments import _format_location_opener
    from app.services.drama.content_locale import use_content_locale

    with use_content_locale("vi"):
        out = _format_location_opener("Cảnh 1. Trạm xe buýt – chiều mưa", 12, "Trạm xe buýt")
    assert out.endswith(".") and "。" not in out and "@asset:12" in out
    with use_content_locale("zh"):
        assert _format_location_opener(None, 3, "客厅").endswith("。")
