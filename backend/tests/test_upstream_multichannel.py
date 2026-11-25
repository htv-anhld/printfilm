"""多上游渠道：熔断降级、LLM failover、视频任务绑定渠道、解锁模式保存渠道。"""

from __future__ import annotations

import httpx
import pytest

import app.services.model_settings as model_settings
from app.schemas_routing import DefaultModels, LogicalModel, LogicalModelBinding, SystemModelChannel
from app.services import upstream_channels as uc
from app.services.logical_model_router import resolve_logical_model_candidates


def _channel(cid: str, base: str, *, sort: int = 0, enabled: bool = True) -> SystemModelChannel:
    """构造测试渠道（带 Key）。"""
    return SystemModelChannel(
        id=cid,
        name=cid.upper(),
        base_url=base,
        api_key=f"key-{cid}",
        has_api_key=True,
        models=["gpt-test", "seedance-test"],
        enabled=enabled,
        sort_order=sort,
    )


@pytest.fixture(autouse=True)
def _clean_breaker():
    """每个用例前后清空熔断状态。"""
    uc.reset_channel_health()
    yield
    uc.reset_channel_health()


@pytest.fixture
def two_channel_snapshot(monkeypatch: pytest.MonkeyPatch):
    """主渠道 a（sort 0）+ 备用渠道 b（sort 1），文字模型 gpt 双绑定。"""
    channels = [_channel("a", "https://a.example/v1", sort=0), _channel("b", "https://b.example/v1", sort=1)]
    snapshot = model_settings.RoutingSnapshot(
        channels=channels,
        logical_models=[
            LogicalModel(
                id="gpt",
                capability="text",
                bindings=[
                    LogicalModelBinding(id="1", channel_id="a", upstream_model="gpt-test", priority=1),
                    LogicalModelBinding(id="2", channel_id="b", upstream_model="gpt-test", priority=2),
                ],
            )
        ],
        default_models=DefaultModels(text_model="gpt"),
    )
    monkeypatch.setattr(model_settings, "_routing_snapshot", snapshot)
    return channels


def test_breaker_opens_after_threshold_and_recovers():
    now = 1000.0
    uc.record_channel_failure("a", now=now)
    assert not uc.is_channel_cooling("a", now=now)
    uc.record_channel_failure("a", now=now)
    assert uc.is_channel_cooling("a", now=now + 1)
    assert not uc.is_channel_cooling("a", now=now + uc.BREAKER_COOLDOWN_SEC + 1)
    uc.record_channel_success("a")
    assert uc.channel_health_snapshot() == {}


def test_router_demotes_cooling_channel(two_channel_snapshot):
    assert [r.channel_id for r in resolve_logical_model_candidates("text", "gpt")] == ["a", "b"]
    uc.record_channel_failure("a")
    uc.record_channel_failure("a")
    assert [r.channel_id for r in resolve_logical_model_candidates("text", "gpt")] == ["b", "a"]


def test_router_skips_disabled_channel(monkeypatch, two_channel_snapshot):
    """后台关掉渠道 a 后，请求直接走渠道 b。"""
    channels = [two_channel_snapshot[0].model_copy(update={"enabled": False}), two_channel_snapshot[1]]
    snap = model_settings.get_routing_snapshot()
    monkeypatch.setattr(
        model_settings,
        "_routing_snapshot",
        model_settings.RoutingSnapshot(channels=channels, logical_models=snap.logical_models, default_models=snap.default_models),
    )
    assert [r.channel_id for r in resolve_logical_model_candidates("text", "gpt")] == ["b"]


async def test_llm_fails_over_to_backup_channel(monkeypatch, two_channel_snapshot):
    from app.services import llm_client

    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.host)
        if request.url.host == "a.example":
            return httpx.Response(503, text="down")
        return httpx.Response(200, json={"choices": [{"message": {"content": "xin chào"}}]})

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient
    monkeypatch.setattr(llm_client.httpx, "AsyncClient", lambda **kw: real_client(transport=transport, **kw))

    out = await llm_client.chat_completions("sys", "user")
    assert out == "xin chào"
    assert calls == ["a.example", "b.example"]
    assert uc.channel_health_snapshot()["a"]["failures"] == 1


async def test_llm_business_error_does_not_fail_over(monkeypatch, two_channel_snapshot):
    """400 是请求本身的问题，换渠道没用，直接报错。"""
    from app.services import llm_client

    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.host)
        return httpx.Response(400, text="bad prompt")

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient
    monkeypatch.setattr(llm_client.httpx, "AsyncClient", lambda **kw: real_client(transport=transport, **kw))

    with pytest.raises(RuntimeError, match="400"):
        await llm_client.chat_completions("sys", "user")
    assert calls == ["a.example"]


def test_task_id_tagging_roundtrip():
    assert uc.tag_channel_task_id("a", "cgt-1", primary_id="a") == "cgt-1"
    tagged = uc.tag_channel_task_id("b", "cgt-1", primary_id="a")
    assert tagged == "b::cgt-1"
    assert uc.split_channel_task_id(tagged) == ("b", "cgt-1")
    assert uc.split_channel_task_id("cgt-1") == (None, "cgt-1")
    # 已带前缀不重复加；非法渠道前缀原样返回
    assert uc.tag_channel_task_id("c", tagged, primary_id="a") == tagged
    assert uc.split_channel_task_id("Bad ID::x") == (None, "Bad ID::x")


async def test_video_task_polls_on_creating_channel(monkeypatch, two_channel_snapshot):
    """渠道 b 创建的任务必须到渠道 b 轮询，且用 b 的 Key。"""
    from app.config import get_settings
    from app.services.ark import ArkGateway

    seen: list[tuple[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((str(request.url), request.headers.get("authorization", "")))
        return httpx.Response(200, json={"id": "cgt-9", "status": "running"})

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient
    import app.services.ark as ark_mod

    monkeypatch.setattr(ark_mod.httpx, "AsyncClient", lambda **kw: real_client(transport=transport, **kw))
    settings = get_settings().model_copy(
        update={"ark_mock": False, "ark_api_key": "key-a", "ark_base_url": "https://a.example/v1"}
    )
    gw = ArkGateway(settings)
    result = await gw.fetch_task_once("b::cgt-9")
    assert result.provider_task_id == "b::cgt-9"
    url, auth = seen[-1]
    assert url.startswith("https://b.example/v1/") and url.endswith("/cgt-9")
    assert auth == "Bearer key-b"


def test_flat_overlay_uses_primary_channel(monkeypatch):
    from app.services.tokenfree_gateway import apply_tokenfree_flat_overlay

    monkeypatch.setattr("app.services.tokenfree_gateway.upstream_locked", lambda: False)
    channels = [_channel("b", "https://b.example/v1", sort=5), _channel("a", "https://a.example/v1/", sort=1)]
    flat = apply_tokenfree_flat_overlay({}, channels)
    assert flat["openai_base_url"] == "https://a.example/v1"
    assert flat["ark_api_key"] == "key-a"


def test_flat_overlay_locked_keeps_tokenfree(monkeypatch):
    from app.services.tokenfree_gateway import TOKENFREE_BASE_URL, apply_tokenfree_flat_overlay

    monkeypatch.setattr("app.services.tokenfree_gateway.upstream_locked", lambda: True)
    channels = [_channel("a", "https://a.example/v1"), _channel("tokenfree", "https://evil.example", sort=9)]
    flat = apply_tokenfree_flat_overlay({}, channels)
    assert flat["openai_base_url"] == TOKENFREE_BASE_URL


async def test_save_unlocked_channels_validates_and_replaces(db_session, monkeypatch):
    from sqlalchemy import select

    from app.models_settings import SystemModelChannelRow
    from app.schemas_routing import SystemModelChannelIn

    existing = {row.id: row for row in (await db_session.execute(select(SystemModelChannelRow))).scalars().all()}
    with pytest.raises(ValueError):
        await model_settings._save_unlocked_channels(
            db_session, [SystemModelChannelIn(id="Bad Id", name="x", base_url="https://x")], existing
        )
    with pytest.raises(ValueError):
        await model_settings._save_unlocked_channels(
            db_session, [SystemModelChannelIn(id="ok", name="x", base_url="ftp://x")], existing
        )
    await model_settings._save_unlocked_channels(
        db_session,
        [
            SystemModelChannelIn(id="tokenfree", name="TF", base_url="https://ignored", api_key="k1", models=["m1"]),
            SystemModelChannelIn(id="apistore", name="ApiStore", base_url="https://api.store/v1/", api_key="k2"),
        ],
        existing,
    )
    rows = {row.id: row for row in (await db_session.execute(select(SystemModelChannelRow))).scalars().all()}
    assert set(rows) == {"tokenfree", "apistore"}
    assert rows["tokenfree"].base_url == "https://www.tokenfree.com/v1"
    assert rows["apistore"].base_url == "https://api.store/v1"
    assert model_settings._decrypt_secret(rows["apistore"].api_key_ciphertext) == "k2"
    # 不传 Key → 保留原 Key
    await model_settings._save_unlocked_channels(
        db_session,
        [SystemModelChannelIn(id="apistore", name="ApiStore", base_url="https://api.store/v1")],
        rows,
    )
    rows = {row.id: row for row in (await db_session.execute(select(SystemModelChannelRow))).scalars().all()}
    assert set(rows) == {"apistore"}
    assert model_settings._decrypt_secret(rows["apistore"].api_key_ciphertext) == "k2"
