"""漫剧后期字幕：cue 解析（与前端字幕板 / SRT 一致）、成片时间轴偏移、drawtext 滤镜构造。"""

from pathlib import Path
from types import SimpleNamespace

from app.services.drama.film_compose import collect_film_clip_items
from app.services.drama.subtitle_burn import (
    build_subtitle_filter,
    normalize_burn_text,
    paginate_cues,
    subtitle_style,
    wrap_caption_lines,
)
from app.services.drama.subtitle_cues import (
    BurnCue,
    TimelineClip,
    build_burn_timeline,
    build_subtitle_board,
    export_srt,
    parse_subtitle_line,
    resolve_effective_subtitle_mode,
)

FRAG_A = """【BGM：Nhẹ nhàng；âm lượng thấp】
@duration:4
【对白·慢速清晰】@asset:127（tò mò）：Cậu nhặt được gì vậy @asset:113?
@duration:8
【对白·慢速清晰】@asset:113（ngạc nhiên）：La bàn... Kim của nó không chỉ hướng Bắc."""

FRAG_B = """@duration:3
【画面·无配音仅环境音】△ Sương mù chưa tan.
@duration:5
Lời dẫn: Ông nội từng nói (khẽ) như vậy.
Viễn cảnh: bến cảng lúc bình minh"""


def _frag(fid, content):
    return SimpleNamespace(id=fid, content=content)


def test_parse_subtitle_line_handles_vi_dialogue_narration_and_labels():
    assert parse_subtitle_line("【对白】@asset:1（vui）：Chào bạn") == ("（vui）", "Chào bạn")
    assert parse_subtitle_line("旁白：河岸边风声渐起。") == ("narration", "河岸边风声渐起。")
    assert parse_subtitle_line("Độc thoại nội tâm: Mình phải đi") == ("inner_monologue", "Mình phải đi")
    assert parse_subtitle_line("Viễn cảnh: bến cảng") is None
    assert parse_subtitle_line("远景：江面") is None
    assert parse_subtitle_line("【BGM：piano】") is None
    assert parse_subtitle_line("Gió biển thổi nhẹ.") is None


def test_board_matches_frontend_timeline_and_srt():
    cues = build_subtitle_board([_frag(1, FRAG_A), _frag(2, FRAG_B)])
    assert [(c.fragment_id, c.start_sec, c.end_sec) for c in cues] == [(1, 0, 4), (1, 4, 12), (2, 15, 20)]
    srt = export_srt(cues)
    assert srt.split("\n\n")[0] == "1\n00:00:00,000 --> 00:00:04,000\nCậu nhặt được gì vậy ?"
    # （动作说明）/(...) 括注被清理
    assert "00:00:15,000 --> 00:00:20,000\nÔng nội từng nói như vậy." in srt


def test_effective_mode_project_first_then_episode_then_legacy():
    assert resolve_effective_subtitle_mode({"subtitleMode": "model"}, {"subtitleMode": "post"}) == "post"
    assert resolve_effective_subtitle_mode({"subtitleMode": "model"}, {}) == "model"
    assert resolve_effective_subtitle_mode({"subtitleEnabled": "true"}, None) == "model"
    assert resolve_effective_subtitle_mode(None, None) == "post"


def test_burn_timeline_offsets_by_actual_clip_durations_and_skips_model_clips():
    clips = [
        TimelineClip(content=FRAG_A, duration_sec=12.0),
        TimelineClip(content=FRAG_A, duration_sec=12.0, burn=False),
        TimelineClip(content=FRAG_B, duration_sec=8.0),
    ]
    cues = build_burn_timeline(clips)
    assert [(c.start_sec, c.end_sec) for c in cues] == [(0, 4), (4, 12), (24 + 3, 24 + 8)]
    assert cues[0].text == "Cậu nhặt được gì vậy ?"


def test_burn_timeline_compresses_when_video_shorter_than_declared():
    cues = build_burn_timeline([TimelineClip(content=FRAG_A, duration_sec=6.0), TimelineClip(content=FRAG_B, duration_sec=4.0)])
    # FRAG_A 声明 12s、实际 6s → 压缩一半；FRAG_B 声明 8s、实际 4s
    assert [(c.start_sec, c.end_sec) for c in cues] == [(0, 2), (2, 6), (6 + 1.5, 6 + 4)]


def test_burn_timeline_splits_lines_sharing_one_window():
    content = "@duration:6\nA：Một hai\nB：Ba bốn năm sáu"
    cues = build_burn_timeline([TimelineClip(content=content, duration_sec=6.0)])
    assert len(cues) == 2
    assert cues[0].start_sec == 0 and cues[0].end_sec == cues[1].start_sec and cues[1].end_sec == 6


def test_film_clip_items_follow_per_episode_mode():
    ep1 = SimpleNamespace(id=1, params={"episodeNumber": 1, "subtitleMode": "model"}, fragments=[
        SimpleNamespace(id=10, sort_order=0, video="/a.mp4", content=FRAG_A, duration_sec=12),
    ])
    ep2 = SimpleNamespace(id=2, params={"episodeNumber": 2}, fragments=[
        SimpleNamespace(id=20, sort_order=0, video="/b.mp4", content=FRAG_B, duration_sec=8),
    ])
    items, included, skipped = collect_film_clip_items([ep2, ep1], {})
    assert [(c.url, c.burn) for c in items] == [("/a.mp4", False), ("/b.mp4", True)]
    assert included == [1, 2] and skipped == []
    # 项目全局设置覆盖分集
    items, *_ = collect_film_clip_items([ep1, ep2], {"subtitleMode": "post"})
    assert all(c.burn for c in items)


def test_wrap_lines_by_word_for_latin_and_by_char_for_cjk():
    style = subtitle_style(480, 854)
    text = "Ông nội từng nói, người đi biển không bao giờ bỏ một chiếc la bàn chỉ sai đường."
    lines = wrap_caption_lines(text, style)
    assert len(lines) >= 2
    assert " ".join(lines) == text  # 不拆词、不丢字
    assert all(len(ln) <= style.max_chars_latin + 6 for ln in lines)
    zh = wrap_caption_lines("河岸边风声渐起，远处传来汽笛声，少年握紧了手里的罗盘。", style)
    assert all(len(ln) <= style.max_chars_cjk for ln in zh) and "".join(zh).startswith("河岸边")


def test_normalize_burn_text_fixes_latin_punctuation():
    assert normalize_burn_text("Cậu nhặt được gì vậy ?") == "Cậu nhặt được gì vậy?"
    assert normalize_burn_text("Đi thôi。") == "Đi thôi."
    assert normalize_burn_text("走吧。") == "走吧。"


def test_style_scales_for_portrait_and_landscape():
    portrait = subtitle_style(1080, 1920)
    landscape = subtitle_style(1920, 1080)
    assert portrait.font_size == 54 and portrait.bottom_margin == round(1920 * 0.12)
    assert landscape.font_size == 59 and landscape.bottom_margin == round(1080 * 0.07)
    assert portrait.max_chars_latin < landscape.max_chars_latin


def test_paginate_long_cue_into_two_line_pages():
    style = subtitle_style(480, 854)
    long_text = " ".join(["từ"] * 60)
    pages = paginate_cues([BurnCue(0.0, 9.0, long_text)], style)
    assert len(pages) >= 2 and all(1 <= len(p.lines) <= 2 for p in pages)
    assert pages[0].start_sec == 0 and pages[-1].end_sec == 9.0


def test_build_subtitle_filter_uses_textfiles_fonts_and_enable_windows(tmp_path: Path):
    cues = [BurnCue(0.0, 4.0, "Cậu nhặt được gì vậy?"), BurnCue(4.0, 6.5, "河岸边风声渐起")]
    vf, files = build_subtitle_filter(
        cues, width=720, height=1280, text_dir=tmp_path, latin_font="/f/latin.ttf", cjk_font="/f/cjk.ttc"
    )
    parts = vf.split(",drawtext=")
    assert len(parts) == 2 == len(files)
    assert "fontfile='/f/latin.ttf'" in parts[0] and "fontfile='/f/cjk.ttc'" in parts[1]
    assert "expansion=none" in vf and "x=(w-text_w)/2" in vf
    assert "enable='between(t\\,0.000\\,4.000)'" in vf
    assert "enable='between(t\\,4.000\\,6.500)'" in vf
    assert list(files.values()) == ["Cậu nhặt được gì vậy?", "河岸边风声渐起"]
    # 文本不进入滤镜字符串（转义安全）
    assert "nhặt" not in vf
    assert build_subtitle_filter([], width=720, height=1280, text_dir=tmp_path, latin_font=None, cjk_font=None) == ("", {})


def test_chained_leading_tags_and_leading_addressee_punctuation():
    # 连续【…】标签的空镜描述不是对白
    assert parse_subtitle_line("【空镜·可仅环境音与 BGM】【空镜：Mặt sông phẳng lặng】") is None
    content = "@duration:4\n【对白·慢速清晰】@asset:127（nhỏ giọng）：@asset:113, hay mình quay về..."
    cues = build_subtitle_board([_frag(1, content)])
    assert export_srt(cues).endswith("\nhay mình quay về...")
