"""前台选择的视频模型要真正传到 Seedance；漫剧项目级生成设置要被校验清洗。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.ark import ArkGateway, TaskResult
from app.services.drama.output_settings import clean_project_generation_params


async def test_gen_and_wait_video_forwards_model():
    """gen_and_wait_video 的 model 参数必须透传给 gen_video_i2v（以前被丢弃）。"""
    gw = ArkGateway(SimpleNamespace())
    gw.gen_video_i2v = AsyncMock(return_value="task-1")
    gw.wait_video = AsyncMock(return_value=("/static/v.mp4", TaskResult(status="succeeded")))
    await gw.gen_and_wait_video("https://x/a.png", "p", 5, project_id=1, shot_no=1, model="seedance-2.0-fast")
    assert gw.gen_video_i2v.await_args.kwargs["model"] == "seedance-2.0-fast"


def test_clean_params_drops_invalid_ratio_and_resolution():
    """非法画幅/清晰度丢弃，合法值保留，其余键原样保留。"""
    out = clean_project_generation_params(
        {"aspect_ratio": "4:3", "resolution": "720p", "video_model": "", "foo": 1}
    )
    assert out == {"resolution": "720p", "foo": 1}


def test_clean_params_rejects_unknown_model(monkeypatch):
    """模型不在后台目录时抛 ValueError（API 层转 400）。"""
    import app.services.media_catalog as mc

    monkeypatch.setattr(mc, "is_enabled_video_model", lambda mid: mid == "seedance-2.5")
    assert clean_project_generation_params({"video_model": "seedance-2.5"}) == {"video_model": "seedance-2.5"}
    with pytest.raises(ValueError):
        clean_project_generation_params({"video_model": "not-a-model"})
