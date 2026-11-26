"""内置漫剧画面风格 ID / 文案保持对齐。"""

from app.services.drama.generation_prompt import append_style_prompt, build_generation_prompt
from app.services.drama.image_styles import (
    IMAGE_STYLE_IDS,
    IMAGE_STYLE_LABELS,
    IMAGE_STYLE_PROMPTS,
    STYLE_BOARD_PROMPT_HINT,
    _board_fail_cache,
    _board_url_cache,
    append_style_board_url,
    resolve_image_style_board_url,
    resolve_image_style_prompt,
    style_board_local_path,
)
from app.services.style_lock import seedream_ref_urls, split_seedream_subject_style_refs


def test_image_style_catalog_is_aligned():
    assert set(IMAGE_STYLE_IDS) == set(IMAGE_STYLE_LABELS)
    assert set(IMAGE_STYLE_IDS) == set(IMAGE_STYLE_PROMPTS)


def test_ghibli_handdrawn_style_resolves():
    prompt = resolve_image_style_prompt("ghibli-handdrawn-anime")
    assert "水彩" in prompt
    assert "赛璐璐" in prompt
    assert IMAGE_STYLE_LABELS["ghibli-handdrawn-anime"] == "宫崎骏气质手绘"


def test_style_board_prefers_backend_raster_and_skips_svg():
    path = style_board_local_path("palace-intrigue-cold")
    assert path is not None
    assert path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    ghibli = style_board_local_path("ghibli-handdrawn-anime")
    if ghibli is not None:
        assert ghibli.suffix.lower() != ".svg"


def test_style_board_rejects_unknown_and_path_traversal():
    assert style_board_local_path("../generated/p355") is None
    assert style_board_local_path("..\\generated") is None
    assert style_board_local_path("/etc/passwd") is None
    assert style_board_local_path("palace-intrigue-cold/../../secret") is None
    assert style_board_local_path("not-a-real-style") is None


def test_resolve_image_style_board_url_publishes_https(monkeypatch):
    _board_url_cache.clear()
    _board_fail_cache.clear()
    monkeypatch.setattr(
        "app.services.storage.publish_local",
        lambda path, sync=True: "https://cdn.example.com/style-board.png",
    )
    url = resolve_image_style_board_url("palace-intrigue-cold")
    assert url == "https://cdn.example.com/style-board.png"


def test_resolve_image_style_board_url_skips_localhost(monkeypatch):
    _board_url_cache.clear()
    _board_fail_cache.clear()
    monkeypatch.setattr(
        "app.services.storage.publish_local",
        lambda path, sync=True: "http://127.0.0.1:8000/static/board.png",
    )
    assert resolve_image_style_board_url("palace-intrigue-cold") == ""


def test_append_style_prompt_mentions_style_board():
    text = append_style_prompt("少女站在窗边", "ghibli-handdrawn-anime", has_style_board=True)
    assert STYLE_BOARD_PROMPT_HINT in text
    assert "禁止复制该图的人物" in text
    from app.services.drama.generation_prompt import ensure_structure_in_prompt

    locked = build_generation_prompt(
        ensure_structure_in_prompt("黑发少女", "character"),
        asset_type="character",
        style_id="ghibli-handdrawn-anime",
        has_style_board=True,
    )
    assert STYLE_BOARD_PROMPT_HINT in locked
    assert "全身三视图" in locked
    plain = append_style_prompt("少女站在窗边", "ghibli-handdrawn-anime", has_style_board=False)
    assert STYLE_BOARD_PROMPT_HINT not in plain


def test_seedream_ref_urls_default_two_drama_split_reserves_style():
    subjects = [f"https://cdn.example.com/c{i}.png" for i in range(8)]
    styles = ["https://cdn.example.com/style.png"]
    assert len(seedream_ref_urls(*subjects)) == 2
    assert len(seedream_ref_urls(*subjects, limit=6)) == 6
    subject_refs, style_refs = split_seedream_subject_style_refs(subjects, styles)
    assert len(subject_refs) == 5
    assert style_refs == styles
    merged = append_style_board_url(subjects, styles[0], max_total=30)
    assert merged[-1] == styles[0]
    assert len(merged) == 9



def test_every_builtin_style_is_tagged_realistic_or_illustrated():
    from app.services.drama.image_styles import IMAGE_STYLE_REALISTIC, list_image_styles

    assert set(IMAGE_STYLE_REALISTIC) == set(IMAGE_STYLE_IDS)
    assert all(isinstance(v, bool) for v in IMAGE_STYLE_REALISTIC.values())
    for sid in ("ancient-romance-soft", "chinese-urban-realistic", "wuxia-realistic-photo", "90s-realistic-film"):
        assert IMAGE_STYLE_REALISTIC[sid] is True
    for sid in ("cgi-3d-animation", "ghibli-handdrawn-anime", "pixel-art", "shadow-puppet-illustration"):
        assert IMAGE_STYLE_REALISTIC[sid] is False
    rows = {row["id"]: row for row in list_image_styles("vi")}
    assert rows["90s-realistic-film"]["realistic"] is True
    assert rows["90s-realistic-film"]["label"] == "Phim tả thực thập niên 90"
    assert rows["pixel-art"]["realistic"] is False


def test_frontend_realism_table_matches_backend():
    """前端 lib/dramaImageStyles.ts 的 IMAGE_STYLE_REALISTIC 与后端一致。"""
    import re
    from pathlib import Path

    from app.services.drama.image_styles import IMAGE_STYLE_REALISTIC

    ts = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "dramaImageStyles.ts"
    if not ts.is_file():
        import pytest

        pytest.skip("frontend 源码不在仓库内")
    block = ts.read_text(encoding="utf-8").split("IMAGE_STYLE_REALISTIC", 1)[1].split("}", 1)[0]
    pairs = dict(re.findall(r"'([a-z0-9-]+)':\s*(true|false)", block))
    assert {k: v == "true" for k, v in pairs.items()} == IMAGE_STYLE_REALISTIC


def test_privacy_error_gets_style_hint_only_for_realistic_project():
    from app.i18n import use_locale
    from app.services.drama.image_styles import append_realistic_style_hint, realistic_style_privacy_hint

    raw = "Ảnh tham chiếu có thể chứa người thật: Nhân vật「A」 (content[1], PrivacyInformation), vui lòng đổi hình tượng này sang anime hoặc minh họa rồi thử lại"
    with use_locale("vi"):
        hinted = append_realistic_style_hint(raw, "chinese-urban-realistic")
        assert hinted.startswith(raw)
        assert "«Đô thị Trung Quốc tả thực» là tả thực" in hinted
        # 幂等：再拼一次不重复
        assert append_realistic_style_hint(hinted, "chinese-urban-realistic") == hinted
        assert append_realistic_style_hint(raw, "ghibli-handdrawn-anime") == raw
        assert append_realistic_style_hint(raw, None) == raw
        assert append_realistic_style_hint("上游超时", "chinese-urban-realistic") == "上游超时"
    assert realistic_style_privacy_hint("pixel-art") == ""
    assert "是真人写实风格" in realistic_style_privacy_hint("90s-realistic-film", "zh")
    assert 'is photorealistic' in realistic_style_privacy_hint("90s-realistic-film", "en")


async def test_submit_fragment_video_appends_style_hint(monkeypatch):
    from types import SimpleNamespace

    import pytest

    from app.services.drama import generation

    async def boom(*_args, **_kwargs):
        raise RuntimeError("参考图疑似真人（PrivacyInformation），请更换角色/场景形象为动漫或插画后重试")

    async def style(_msg, _pid):
        from app.services.drama.image_styles import append_realistic_style_hint

        return append_realistic_style_hint(_msg, "wuxia-realistic-photo", "zh")

    monkeypatch.setattr(generation, "_submit_prepared_fragment_video", boom)
    monkeypatch.setattr(generation, "_privacy_error_with_style_hint", style)
    with pytest.raises(RuntimeError) as exc:
        await generation.submit_prepared_fragment_video(SimpleNamespace(), project_id=1)
    assert "武侠江湖写实摄影" in str(exc.value)
