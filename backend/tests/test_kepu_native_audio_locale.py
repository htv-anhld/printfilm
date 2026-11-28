"""Seedance 内置口播只用于中文 / 英文内容；越南语走环境音 + 后期 TTS。"""

from types import SimpleNamespace

import pytest

from app.services.kepu_stages import kepu_native_audio_enabled, project_audio_ready
from app.services.pipeline import _kepu_seedance_native_audio, _kepu_seedance_sfx_audio


def _project(locale: str, mode: str = "full"):
    return SimpleNamespace(id=None, pipeline_mode=mode, content_locale=locale, shots=[])


@pytest.mark.parametrize("locale,native", [("zh", True), ("en", True), ("vi", False)])
def test_native_audio_follows_content_locale(locale, native):
    project = _project(locale)
    assert kepu_native_audio_enabled(project) is native
    assert _kepu_seedance_native_audio(project) is native
    # 越南语：Seedance 只出环境音，口播由后期 TTS
    assert _kepu_seedance_sfx_audio(project) is (not native)


def test_image_text_never_native():
    assert kepu_native_audio_enabled(_project("zh", "image_text")) is False


def test_vietnamese_full_requires_external_tts_before_videos():
    """越南语 full 素材阶段必须先有外部配音，不能因内置口播被视为已就绪。"""
    assert project_audio_ready(_project("vi")) is False
    assert project_audio_ready(_project("zh")) is True


def test_video_ref_prefers_local_copy_over_ephemeral_temp_url():
    """GPT Image 临时直链会失效：有本地落盘时用本地图作视频首图 / 衔接参考。"""
    from app.services.kepu_continuity import is_ephemeral_media_url, shot_last_frame_ref, video_image_ref

    shot = SimpleNamespace(
        image_url="/static/generated/p13/shot_001.png",
        image_ark_url="https://tempfile.aiquickdraw.com/images/chatgpt/file_1.png",
        last_frame_url=None,
    )
    assert is_ephemeral_media_url(shot.image_ark_url)
    assert not is_ephemeral_media_url("https://cdn.example.com/a.png")
    assert video_image_ref(shot) == "/static/generated/p13/shot_001.png"
    assert shot_last_frame_ref(shot) == "/static/generated/p13/shot_001.png"
