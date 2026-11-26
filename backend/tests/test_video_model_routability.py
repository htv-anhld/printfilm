"""视频模型必须有可路由渠道才出现在前台目录 / 才能存进项目（seedance-2.0-fast 未上架场景）。"""

from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.config import Settings
from app.i18n import use_locale
from app.schemas_routing import DefaultModels, SystemModelChannel
from app.services.model_settings import RoutingSnapshot


@pytest.fixture
def tokenfree_without_fast(monkeypatch):
    """模拟开发库：TokenFree 渠道只勾选了 seedance-2.5 / seedance-2.0 / MiniMax-H3，没有 fast。"""
    settings = Settings(_env_file=None, debug=False, ark_mock=False, local_media_mock=False)
    monkeypatch.setattr("app.config.get_settings", lambda: settings)
    monkeypatch.setattr("app.services.media_models.runtime.get_settings", lambda: settings)
    monkeypatch.setattr("app.services.media_catalog.get_settings", lambda: settings)
    from app.services.media_models.runtime import current_operation, current_snapshot

    snapshot_token = current_snapshot.set(None)
    operation_token = current_operation.set(None)
    channel = SystemModelChannel(
        id="tokenfree", name="TokenFree", base_url="https://www.tokenfree.com/v1",
        api_key="test-key", has_api_key=True,
        models=["seedance-2.5", "seedance-2.0", "MiniMax-H3", "seedream-5.0"],
    )
    snapshot = RoutingSnapshot(
        channels=[channel], logical_models=[],
        default_models=DefaultModels(image_model="seedream-5.0", video_model="seedance-2.0-fast"),
    )
    monkeypatch.setattr("app.services.model_settings._routing_snapshot", snapshot)
    yield snapshot
    current_operation.reset(operation_token)
    current_snapshot.reset(snapshot_token)


def test_routability_matches_channel_models(tokenfree_without_fast):
    from app.services.media_catalog import is_enabled_video_model, is_media_model_routable

    assert is_media_model_routable("video", "seedance-2.5") is True
    assert is_media_model_routable("video", "MiniMax-H3") is True
    assert is_media_model_routable("video", "seedance-2.0-fast") is False
    assert is_media_model_routable("video", "") is False
    assert is_enabled_video_model("seedance-2.5") is True
    assert is_enabled_video_model("seedance-2.0-fast") is False


async def test_priced_catalog_hides_unroutable_model_and_keeps_default_valid(tokenfree_without_fast, monkeypatch):
    from app.services.media_models.catalog import priced_catalog

    monkeypatch.setattr("app.services.media_models.catalog.active_book", AsyncMock(return_value=None))
    result = await priced_catalog(None, {
        "image_models": [],
        "video_models": [{"id": "seedance-2.5"}, {"id": "seedance-2.0-fast"}, {"id": "MiniMax-H3"}],
        "defaults": {"image_model": "", "video_model": "seedance-2.0-fast"},
    })
    ids = [row["id"] for row in result["video_models"]]
    assert ids == ["seedance-2.5", "MiniMax-H3"]
    assert result["defaults"]["video_model"] == "seedance-2.5"
    assert [row["recommended"] for row in result["video_models"]] == [True, False]


async def test_priced_catalog_keeps_routable_default(tokenfree_without_fast, monkeypatch):
    from app.services.media_models.catalog import priced_catalog

    monkeypatch.setattr("app.services.media_models.catalog.active_book", AsyncMock(return_value=None))
    rows = [{"id": "seedance-2.5", "recommended": False}, {"id": "MiniMax-H3", "recommended": True}]
    result = await priced_catalog(None, {
        "image_models": [], "video_models": rows,
        "defaults": {"image_model": "", "video_model": "MiniMax-H3"},
    })
    assert result["defaults"]["video_model"] == "MiniMax-H3"
    assert [row["recommended"] for row in result["video_models"]] == [False, True]


def test_drama_project_params_reject_new_unroutable_model(tokenfree_without_fast):
    from app.services.drama.output_settings import clean_project_generation_params

    assert clean_project_generation_params({"video_model": "seedance-2.5"}) == {"video_model": "seedance-2.5"}
    with pytest.raises(ValueError):
        clean_project_generation_params({"video_model": "seedance-2.0-fast"})
    # 旧项目里已存的失效值原样回传：剔除（回落默认），不拦整次保存
    out = clean_project_generation_params(
        {"video_model": "seedance-2.0-fast", "resolution": "720p"},
        {"video_model": "seedance-2.0-fast"},
    )
    assert out == {"resolution": "720p"}


def test_stored_unroutable_model_is_not_shown(tokenfree_without_fast):
    from app.services.drama.output_settings import routable_video_model, without_unroutable_video_model

    assert routable_video_model("seedance-2.0-fast") is None
    assert routable_video_model("seedance-2.5") == "seedance-2.5"
    assert without_unroutable_video_model({"video_model": "seedance-2.0-fast", "x": 1}) == {"x": 1}
    kept = {"video_model": "seedance-2.5"}
    assert without_unroutable_video_model(kept) is kept
    assert without_unroutable_video_model(None) is None


def test_episode_params_reject_newly_picked_unroutable_model(tokenfree_without_fast):
    from app.api.drama.episodes import _checked_episode_params

    assert _checked_episode_params({"video_model": "seedance-2.5"}, {}) == {"video_model": "seedance-2.5"}
    with pytest.raises(HTTPException) as exc:
        _checked_episode_params({"video_model": "seedance-2.0-fast"}, {"video_model": "seedance-2.5"})
    assert exc.value.status_code == 400
    assert _checked_episode_params({"video_model": "seedance-2.0-fast", "a": 1}, {"video_model": "seedance-2.0-fast"}) == {"a": 1}


def test_kepu_project_rejects_known_but_unroutable_video_model(tokenfree_without_fast):
    from app.services.media_catalog import is_valid_project_media_model

    assert is_valid_project_media_model("seedance-2.5", "video") is True
    assert is_valid_project_media_model("seedance-2.0-fast", "video") is False


def test_pin_route_error_is_translated(tokenfree_without_fast):
    from app.services.media_models.runtime import pin_route

    with use_locale("vi"):
        with pytest.raises(ValueError) as exc:
            pin_route("video", "seedance-2.0-fast")
    assert "seedance-2.0-fast hiện không có kênh nào khả dụng" in str(exc.value)
