"""TokenFree 渠道停用时不再请求 /api/log/self（避免每次结算 401）。"""
from unittest.mock import AsyncMock

from app.schemas_routing import SystemModelChannel
from app.services import model_settings, tokenfree_gateway, tokenfree_usage
from app.services.model_settings import RoutingSnapshot


def _snapshot(monkeypatch, channels):
    snap = RoutingSnapshot(channels=channels, logical_models=[], default_models=model_settings.DefaultModels())
    monkeypatch.setattr(model_settings, "_routing_snapshot", snap)


def _tf(enabled: bool, key: str = "sk-x") -> SystemModelChannel:
    return SystemModelChannel(id="tokenfree", name="TokenFree", api_key=key, has_api_key=bool(key), enabled=enabled)


def test_channel_active_flags(monkeypatch):
    _snapshot(monkeypatch, [_tf(True)])
    assert tokenfree_gateway.tokenfree_channel_active()
    _snapshot(monkeypatch, [_tf(False)])
    assert not tokenfree_gateway.tokenfree_channel_active()
    _snapshot(monkeypatch, [_tf(True, key="")])
    assert not tokenfree_gateway.tokenfree_channel_active()
    _snapshot(monkeypatch, [SystemModelChannel(id="claude", name="Claude", api_key="k", enabled=True)])
    assert not tokenfree_gateway.tokenfree_channel_active()


async def test_consume_logs_skipped_when_disabled(monkeypatch):
    _snapshot(monkeypatch, [_tf(False), SystemModelChannel(id="claude", name="Claude", api_key="k")])
    get = AsyncMock(side_effect=AssertionError("must not call TokenFree"))
    monkeypatch.setattr(tokenfree_usage, "_tokenfree_get", get)
    assert await tokenfree_usage.fetch_tokenfree_consume_logs(0, 10) == []
    get.assert_not_awaited()


async def test_consume_logs_fetched_when_enabled(monkeypatch):
    _snapshot(monkeypatch, [_tf(True)])
    get = AsyncMock(return_value={"data": {"items": [{"id": 1, "quota": 5}], "total": 1}})
    monkeypatch.setattr(tokenfree_usage, "_tokenfree_get", get)
    assert await tokenfree_usage.fetch_tokenfree_consume_logs(0, 10) == [{"id": 1, "quota": 5}]
    get.assert_awaited_once()
