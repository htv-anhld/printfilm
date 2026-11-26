"""合成阶段 ffmpeg 字幕：口播须烧进画面，split 布局也不能省略。"""

import re

from app.services.ffmpeg_compose import build_video_caption_vf


def test_split_layout_burns_narration_captions():
    """开源展示 split 布局仍要把旁白烧成底部字幕，不能只叠标题。"""
    vf = build_video_caption_vf(
        narration="搭物联网最耗时的，往往不是业务本身。",
        duration=12.0,
        w=720,
        h=1280,
        font=None,
        title="物模型",
        subtitle="统一管理设备",
        subtitle_layout="split",
    )
    assert "drawtext" in vf
    assert "搭物联网最耗时的" in vf
    assert "往往不是业务本身" in vf
    assert "enable='between(t\\," in vf
    assert ":y=70" in vf
    assert ":y=1176" in vf
    assert vf.count("drawtext=") >= 3


def test_overlay_subtitle_fits_portrait_width_for_vietnamese():
    """竖屏 720 宽：越南语副标题按字号限宽截断（整词），不超出画面左右。"""
    from app.services.ffmpeg_compose import _latin_fit_chars, _overlay_drawtext

    sub = "Một câu hỏi tưởng đơn giản nhưng rất nhiều người lớn cũng không trả lời được"
    vf = _overlay_drawtext(720, 1280, "Vì sao trời xanh", sub, None)
    m = re.search(r"drawtext=text='([^']*)':fontsize=(\d+):fontcolor=white:borderw=3", vf)
    assert m, vf
    text, size = m.group(1), int(m.group(2))
    assert len(text) <= _latin_fit_chars(720, size)
    assert sub.startswith(text)
    assert not sub[len(text):len(text) + 1].strip()  # 整词截断
