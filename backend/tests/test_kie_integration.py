"""kie.ai 媒体渠道：客户端解析/错误/重试、参数映射与钳制、路由选择、计费换算、管理端渠道保存。

全部用 httpx.MockTransport，不访问真实 kie.ai。
"""

from __future__ import annotations

import json
import logging

import httpx
import pytest

import app.services.model_settings as model_settings
from app.i18n import use_locale
from app.schemas_routing import DefaultModels, LogicalModel, LogicalModelBinding, SystemModelChannel
from app.services import kie_models as km
from app.services import upstream_channels as uc
from app.services.kie_client import KieClient, KieError, kie_error_message, map_kie_state, parse_record
from app.services.kie_media import (
    KieInputError,
    build_kie_image_request,
    build_kie_video_input,
    record_usage,
    tag_kie_task_id,
)

KIE_KEY = "kie-secret-key-123"


def _kie_channel(**kw) -> SystemModelChannel:
    """kie 渠道（带 Key）。"""
    data = dict(
        id="kie", name="Kie.ai", base_url="https://api.kie.ai", api_key=KIE_KEY, has_api_key=True,
        api_format="kie", protocol="kie",
        models=[km.SEEDANCE_2, km.SEEDANCE_2_FAST, km.SEEDANCE_2_MINI, km.SEEDREAM_45_T2I], enabled=True, sort_order=1,
    )
    data.update(kw)
    return SystemModelChannel(**data)


def _tf_channel() -> SystemModelChannel:
    """TokenFree 渠道（带 Key）。"""
    return SystemModelChannel(
        id="tokenfree", name="TF", base_url="https://www.tokenfree.com/v1", api_key="tf-key", has_api_key=True,
        models=["seedance-2.0", "seedance-2.5"], enabled=True, sort_order=0,
    )


def _record(state: str, **data) -> dict:
    """构造 recordInfo 响应体。"""
    return {"code": 200, "msg": "success", "data": {"taskId": "t1", "state": state, **data}}


@pytest.fixture(autouse=True)
def _clean_breaker():
    uc.reset_channel_health()
    yield
    uc.reset_channel_health()


@pytest.fixture
def kie_snapshot(monkeypatch: pytest.MonkeyPatch):
    """TokenFree（主）+ kie；seedance-2.0 双绑定（TokenFree 优先），fast/mini 只绑 kie。"""
    channels = [_tf_channel(), _kie_channel()]
    snapshot = model_settings.RoutingSnapshot(
        channels=channels,
        logical_models=[
            LogicalModel(id="seedance-2.0", capability="video", bindings=[
                LogicalModelBinding(id="1", channel_id="tokenfree", upstream_model="seedance-2.0", priority=1),
                LogicalModelBinding(id="2", channel_id="kie", upstream_model=km.SEEDANCE_2, priority=2),
            ]),
            LogicalModel(id="seedance-2.0-fast", capability="video", bindings=[
                LogicalModelBinding(id="3", channel_id="kie", upstream_model=km.SEEDANCE_2_FAST, priority=2),
            ]),
            LogicalModel(id="seedance-2.0-mini", capability="video", bindings=[
                LogicalModelBinding(id="4", channel_id="kie", upstream_model=km.SEEDANCE_2_MINI, priority=2),
            ]),
            LogicalModel(id="seedream-4.5", capability="image", bindings=[
                LogicalModelBinding(id="5", channel_id="kie", upstream_model=km.SEEDREAM_45_T2I, priority=2),
            ]),
        ],
        default_models=DefaultModels(video_model="seedance-2.0-fast"),
    )
    monkeypatch.setattr(model_settings, "_routing_snapshot", snapshot)
    return channels


def _patch_httpx(monkeypatch, handler):
    """所有 httpx.AsyncClient 改走 MockTransport。"""
    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: real_client(**{**kw, "transport": transport}))


async def _no_sleep(_sec: float) -> None:
    return None


# ── 解析 / 状态 / 错误码 ──────────────────────────────────────────────


def test_parse_record_success_parses_result_json_string():
    payload = _record(
        "success",
        resultJson=json.dumps({"resultUrls": ["https://cdn.kie/a.mp4"], "lastFrameUrl": "https://cdn.kie/a.jpg"}),
        creditsConsumed=82, costTime=95,
    )
    record = parse_record(payload)
    assert record.status == "succeeded"
    assert record.result_urls == ["https://cdn.kie/a.mp4"]
    assert record.last_frame_url == "https://cdn.kie/a.jpg"
    assert record.credits_consumed == 82.0
    assert record.cost_time == 95.0


def test_parse_record_bad_json_and_fail_state():
    record = parse_record(_record("fail", resultJson="{not json", failCode="501", failMsg="nsfw"))
    assert record.status == "failed"
    assert record.result_urls == []
    assert record.fail_code == "501" and record.fail_msg == "nsfw"


@pytest.mark.parametrize(
    ("state", "expected"),
    [("waiting", "pending"), ("queuing", "pending"), ("generating", "running"), ("success", "succeeded"), ("fail", "failed")],
)
def test_map_kie_state(state, expected):
    assert map_kie_state(state) == expected


@pytest.mark.parametrize("code", [401, 402, 422, 429, 455, 501, 505])
def test_error_codes_translate_to_vietnamese(code):
    with use_locale("vi"):
        msg = kie_error_message(code)
    assert "Kie.ai" in msg
    assert not any("一" <= ch <= "鿿" for ch in msg), msg


def test_unknown_error_code_keeps_detail():
    with use_locale("en"):
        msg = kie_error_message(999, "weird")
    assert "999" in msg and "weird" in msg


# ── 客户端 HTTP ──────────────────────────────────────────────────────


async def test_create_task_success_sends_bearer_and_body():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"code": 200, "msg": "success", "data": {"taskId": "task-9"}})

    client = KieClient(KIE_KEY, transport=httpx.MockTransport(handler), sleep=_no_sleep)
    task_id = await client.create_task(km.SEEDANCE_2_FAST, {"prompt": "hello"})
    assert task_id == "task-9"
    req = seen[0]
    assert str(req.url) == "https://api.kie.ai/api/v1/jobs/createTask"
    assert req.headers["authorization"] == f"Bearer {KIE_KEY}"
    assert json.loads(req.content) == {"model": km.SEEDANCE_2_FAST, "input": {"prompt": "hello"}}


async def test_business_error_in_http_200_is_not_retried():
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"code": 402, "msg": "Insufficient credits"})

    client = KieClient(KIE_KEY, transport=httpx.MockTransport(handler), sleep=_no_sleep)
    with use_locale("vi"), pytest.raises(KieError) as info:
        await client.create_task(km.SEEDANCE_2, {"prompt": "x"})
    assert info.value.code == 402 and calls == 1
    assert "credit" in str(info.value)


async def test_rate_limit_retried_with_backoff_then_succeeds():
    calls = 0
    delays: list[float] = []

    async def fake_sleep(sec: float) -> None:
        delays.append(sec)

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls < 3:
            return httpx.Response(200, json={"code": 429, "msg": "rate limited"})
        return httpx.Response(200, json={"code": 200, "data": {"taskId": "ok"}})

    client = KieClient(KIE_KEY, transport=httpx.MockTransport(handler), sleep=fake_sleep, backoff=1.0)
    assert await client.create_task(km.SEEDANCE_2, {"prompt": "x"}) == "ok"
    assert calls == 3 and delays == [1.0, 2.0]


async def test_create_read_timeout_is_not_resubmitted():
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        raise httpx.ReadTimeout("slow", request=request)

    client = KieClient(KIE_KEY, transport=httpx.MockTransport(handler), sleep=_no_sleep)
    with pytest.raises(KieError):
        await client.create_task(km.SEEDANCE_2, {"prompt": "x"})
    assert calls == 1


async def test_query_retries_5xx_and_logs_no_key(caplog):
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert request.url.params["taskId"] == "t1"
        if calls == 1:
            return httpx.Response(503, text="busy")
        return httpx.Response(200, json=_record("generating"))

    caplog.set_level(logging.DEBUG)
    client = KieClient(KIE_KEY, transport=httpx.MockTransport(handler), sleep=_no_sleep)
    record = await client.get_task("t1")
    assert record.status == "running" and calls == 2
    assert KIE_KEY not in caplog.text
    assert KIE_KEY not in repr(client)


async def test_missing_key_fails_fast():
    with pytest.raises(KieError) as info:
        await KieClient("").get_task("t1")
    assert info.value.code == 401


async def test_get_credit_parses_number():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/chat/credit"
        return httpx.Response(200, json={"code": 200, "msg": "success", "data": 1234.5})

    assert await KieClient(KIE_KEY, transport=httpx.MockTransport(handler)).get_credit() == 1234.5


async def test_kie_credit_summary_with_unsaved_key():
    from app.services.kie_account import kie_credit_summary

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer tmp-key"
        return httpx.Response(200, json={"code": 200, "data": 200})

    out = await kie_credit_summary(None, api_key="tmp-key", client_kwargs={"transport": httpx.MockTransport(handler)})
    assert out["credits"] == 200 and out["usd_estimate"] == 1.0
    assert "tmp-key" not in json.dumps(out)


# ── 参数映射 / 钳制 ──────────────────────────────────────────────────


def _body(content, **kw) -> dict:
    return {"model": "x", "content": content, "duration": 8, "resolution": "720p", "ratio": "9:16", **kw}


def test_video_input_first_frame_mode():
    payload = build_kie_video_input(_body([
        {"type": "text", "text": "a cat runs"},
        {"type": "image_url", "image_url": {"url": "https://cdn/x.jpg"}, "role": "first_frame"},
        {"type": "image_url", "image_url": {"url": "https://cdn/y.jpg"}, "role": "last_frame"},
    ], generate_audio=True), upstream_model=km.SEEDANCE_2)
    assert payload == {
        "prompt": "a cat runs", "aspect_ratio": "9:16", "resolution": "720p", "duration": 8,
        "generate_audio": True, "first_frame_url": "https://cdn/x.jpg", "last_frame_url": "https://cdn/y.jpg",
    }


def test_video_input_frames_dropped_when_references_present(caplog):
    caplog.set_level(logging.WARNING)
    payload = build_kie_video_input(_body([
        {"type": "text", "text": "scene"},
        {"type": "image_url", "image_url": {"url": "https://cdn/f.jpg"}, "role": "first_frame"},
        {"type": "image_url", "image_url": {"url": "https://cdn/r1.jpg"}, "role": "reference_image"},
        {"type": "audio_url", "audio_url": {"url": "https://cdn/v.mp3"}, "role": "reference_audio"},
    ]), upstream_model=km.SEEDANCE_2)
    assert "first_frame_url" not in payload
    assert payload["reference_image_urls"] == ["https://cdn/r1.jpg"]
    assert payload["reference_audio_urls"] == ["https://cdn/v.mp3"]
    assert "首尾帧" in caplog.text


@pytest.mark.parametrize(
    ("model", "resolution", "expected"),
    [(km.SEEDANCE_2_FAST, "1080p", "720p"), (km.SEEDANCE_2_MINI, "1080p", "720p"),
     (km.SEEDANCE_2, "1080p", "1080p"), (km.SEEDANCE_2_MINI, "480p", "480p")],
)
def test_video_resolution_clamp(model, resolution, expected):
    payload = build_kie_video_input(_body([{"type": "text", "text": "abc"}], resolution=resolution), upstream_model=model)
    assert payload["resolution"] == expected


@pytest.mark.parametrize(("duration", "expected"), [(2, 4), (8.4, 8), (30, 15)])
def test_video_duration_clamp(duration, expected):
    payload = build_kie_video_input(_body([{"type": "text", "text": "abc"}], duration=duration), upstream_model=km.SEEDANCE_2)
    assert payload["duration"] == expected


def test_video_ratio_and_short_prompt_defaults():
    payload = build_kie_video_input({"content": [{"type": "text", "text": "x"}], "ratio": "5:4"}, upstream_model=km.SEEDANCE_2)
    assert payload["aspect_ratio"] == "adaptive"
    assert len(payload["prompt"]) >= 3
    assert payload["generate_audio"] is False


def test_video_local_media_rejected_with_message():
    with use_locale("vi"), pytest.raises(KieInputError) as info:
        build_kie_video_input(_body([
            {"type": "image_url", "image_url": {"url": "/static/generated/p1/a.png"}, "role": "reference_image"},
        ]), upstream_model=km.SEEDANCE_2)
    assert "HTTPS" in str(info.value) and "OSS" in str(info.value)


def test_video_draft_finalize_rejected():
    with pytest.raises(KieInputError):
        build_kie_video_input({"content": [{"type": "draft_task", "draft_task": {"id": "d"}}]}, upstream_model=km.SEEDANCE_2)


def test_image_request_switches_to_edit_with_references():
    model, payload = build_kie_image_request(
        km.SEEDREAM_45_T2I, prompt="hero", aspect_ratio="3:4", resolution="4K", image_urls=["https://cdn/r.png"],
    )
    assert model == km.SEEDREAM_45_EDIT
    assert payload == {"prompt": "hero", "aspect_ratio": "3:4", "quality": "high", "image_urls": ["https://cdn/r.png"]}


def test_image_request_55_text_to_image_and_edit_fallback():
    model, payload = build_kie_image_request(
        km.SEEDREAM_55_I2I, prompt="hero", aspect_ratio="auto", resolution="2K", image_urls=[],
    )
    assert model == km.SEEDREAM_55_T2I
    assert payload["aspect_ratio"] == "1:1" and payload["size"] == "2K" and "image_urls" not in payload


def test_tag_kie_task_id_always_prefixes():
    assert tag_kie_task_id("kie", "abc") == "kie::abc"
    assert uc.split_channel_task_id("kie::abc") == ("kie", "abc")


# ── 计费 ─────────────────────────────────────────────────────────────


def _usd_settings(**kw):
    from app.config import get_settings

    return get_settings().model_copy(update={
        "billing_currency": "USD", "billing_usd_cny": 7.0, "billing_kie_fen_per_credit": 3.5, "billing_markup": 1.0, **kw,
    })


def test_credits_to_usd_cents_matches_kie_price():
    from app.services.billing.pricing import kie_credits_to_cost_fen

    # 1 credit ≈ $0.005：3.5 人民币分 ÷ 7 = 0.5 美分
    assert kie_credits_to_cost_fen(100, _usd_settings()) == 50
    assert kie_credits_to_cost_fen(1, _usd_settings()) == 1  # 向上取整，最少 1
    assert kie_credits_to_cost_fen(0, _usd_settings()) is None


def test_video_estimate_from_price_table():
    s = _usd_settings()
    # Fast 720p 24.8 credit/秒 × 10 秒 = 248 credit = $1.24
    assert km.kie_video_credits(km.SEEDANCE_2_FAST, "720p", 10) == pytest.approx(248.0)
    assert km.kie_video_cost_fen(km.SEEDANCE_2_FAST, "720p", 10, s) == 124
    # Mini 请求 1080p 时按 720p 档预估
    assert km.kie_video_credits(km.SEEDANCE_2_MINI, "1080p", 5) == pytest.approx(41.0)
    assert km.kie_image_cost_fen(km.SEEDREAM_45_T2I, "2K", s) == 4  # 6.5 credit ≈ 3.25 美分 → 4


def test_official_video_estimate_uses_kie_route(kie_snapshot):
    from app.services.tokenfree_pricing import cost_fen_official_video

    s = _usd_settings()
    assert cost_fen_official_video(10, s, model="seedance-2.0-fast", resolution="720p") == 124
    assert cost_fen_official_video(10, s, model=km.SEEDANCE_2_MINI, resolution="480p") == 19


def test_record_usage_failed_is_free():
    failed = parse_record(_record("fail", creditsConsumed=0, failCode="501"))
    _usage, cost = record_usage(failed)
    assert cost is None
    ok = parse_record(_record("success", resultJson='{"resultUrls":["https://x/v.mp4"]}', creditsConsumed=100))
    usage, cost = record_usage(ok)
    assert usage["creditsConsumed"] == 100 and cost == usage["cost_fen"] and cost > 0


def test_parse_upstream_cost_reads_credits():
    from app.services.billing.pricing import parse_upstream_cost_fen

    assert parse_upstream_cost_fen({"usage": {"creditsConsumed": 100}}, _usd_settings()) == 50


# ── 路由 ─────────────────────────────────────────────────────────────


def test_routing_selects_kie_vs_tokenfree(kie_snapshot):
    from app.services.logical_model_router import resolve_logical_model

    fast = resolve_logical_model("video", "seedance-2.0-fast")
    assert fast and km.is_kie_route(fast) and fast.upstream_model == km.SEEDANCE_2_FAST
    std = resolve_logical_model("video", "seedance-2.0")
    assert std and std.channel_id == "tokenfree" and not km.is_kie_route(std)
    mini = resolve_logical_model("video", "seedance-2.0-mini")
    assert mini and mini.upstream_model == km.SEEDANCE_2_MINI


def test_mini_alias_kept_when_logical_model_exists(kie_snapshot):
    from app.services.logical_model_router import resolve_logical_model_id

    assert resolve_logical_model_id("video", "seedance-2.0-mini") == "seedance-2.0-mini"


def test_kie_channel_never_primary():
    kie = _kie_channel(sort_order=0)
    tf = _tf_channel().model_copy(update={"sort_order": 1})
    assert uc.primary_channel([kie, tf]).id == "tokenfree"
    assert uc.primary_channel([kie]) is None


def test_kie_ids_not_folded_into_tokenfree_aliases():
    from app.services.media_models import get_strategy
    from app.services.tokenfree_pricing import canonicalize_channel_models

    ids = [km.SEEDANCE_2, km.SEEDANCE_2_FAST, km.SEEDANCE_2_MINI]
    assert canonicalize_channel_models(ids) == ids
    assert [get_strategy(i).model_id for i in ids] == ["seedance-2.0", "seedance-2.0-fast", "seedance-2.0-mini"]
    assert get_strategy("seedance-2-0-mini").model_id == "seedance-2.0"  # TokenFree 历史别名不变


def test_sync_merges_kie_into_friendly_logical_models():
    from app.services.model_routing_config import model_routing_validation_errors, synchronize_logical_models_with_channels

    channels = [_tf_channel(), _kie_channel()]
    synced = synchronize_logical_models_with_channels([], channels)
    by_id = {m.id: m for m in synced}
    assert {(b.channel_id, b.upstream_model) for b in by_id["seedance-2.0"].bindings} == {
        ("tokenfree", "seedance-2.0"), ("kie", km.SEEDANCE_2),
    }
    assert by_id["seedance-2.0"].bindings[0].channel_id == "tokenfree"
    assert [b.upstream_model for b in by_id["seedance-2.0-fast"].bindings] == [km.SEEDANCE_2_FAST]
    assert "seedance-2.0-mini" in by_id and "seedream-4.5" in by_id
    assert not any(mid.startswith("bytedance/") for mid in by_id)
    # 二次同步稳定
    again = synchronize_logical_models_with_channels(synced, channels)
    assert [m.id for m in again] == [m.id for m in synced]
    assert not model_routing_validation_errors(again, channels, DefaultModels())


async def test_gateway_submits_and_polls_on_kie(monkeypatch, kie_snapshot, tmp_path):
    """逻辑 seedance-2.0-fast → kie createTask；任务号带渠道前缀；recordInfo 成功 → TaskResult + credit 成本。"""
    from app.config import get_settings
    from app.services.ark import ArkGateway

    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path.endswith("/createTask"):
            return httpx.Response(200, json={"code": 200, "msg": "success", "data": {"taskId": "kt-1"}})
        assert request.url.path.endswith("/recordInfo")
        return httpx.Response(200, json=_record(
            "success", resultJson=json.dumps({"resultUrls": ["https://cdn.kie/out.mp4"]}), creditsConsumed=124,
        ))

    _patch_httpx(monkeypatch, handler)
    settings = get_settings().model_copy(update={"ark_mock": False, "local_media_mock": False})
    gw = ArkGateway(settings)
    task_id = await gw.gen_video_seedance_body({
        "model": "seedance-2.0-fast", "duration": 6, "resolution": "720p", "ratio": "16:9", "generate_audio": False,
        "content": [{"type": "text", "text": "a dragon flies over the city"}],
    })
    assert task_id == "kie::kt-1"
    create = seen[0]
    assert str(create.url) == "https://api.kie.ai/api/v1/jobs/createTask"
    assert create.headers["authorization"] == f"Bearer {KIE_KEY}"
    body = json.loads(create.content)
    assert body["model"] == km.SEEDANCE_2_FAST
    assert body["input"]["duration"] == 6 and body["input"]["aspect_ratio"] == "16:9"

    result = await gw.fetch_task_once(task_id)
    assert result.status == "succeeded" and result.url == "https://cdn.kie/out.mp4"
    assert result.provider_task_id == "kie::kt-1"
    assert result.upstream_cost_fen and result.raw_usage["creditsConsumed"] == 124
    assert seen[-1].url.params["taskId"] == "kt-1"


async def test_gateway_fetch_transient_error_is_running(monkeypatch, kie_snapshot):
    from app.config import get_settings
    from app.services.ark import ArkGateway

    _patch_httpx(monkeypatch, lambda request: httpx.Response(502, text="bad gateway"))
    gw = ArkGateway(get_settings().model_copy(update={"ark_mock": False, "local_media_mock": False}))
    monkeypatch.setattr("app.services.kie_client.asyncio.sleep", _no_sleep)
    result = await gw.fetch_task_once("kie::kt-2")
    assert result.status == "running"


async def test_gateway_fetch_failed_task_has_no_cost(monkeypatch, kie_snapshot):
    from app.config import get_settings
    from app.services.ark import ArkGateway

    _patch_httpx(monkeypatch, lambda request: httpx.Response(200, json=_record("fail", failCode="501", failMsg="x")))
    gw = ArkGateway(get_settings().model_copy(update={"ark_mock": False, "local_media_mock": False}))
    with use_locale("vi"):
        result = await gw.fetch_task_once("kie::kt-3")
    assert result.status == "failed" and result.upstream_cost_fen is None
    assert "Kie.ai" in (result.error or "")


def test_upstream_event_detects_kie_poll():
    from app.services.tasks.upstream import _video_request

    assert _video_request("GET", "https://api.kie.ai/api/v1/jobs/recordInfo", {"taskId": "t9"}) == (False, True, "t9")


# ── 管理端 ───────────────────────────────────────────────────────────


async def test_upstream_catalog_returns_static_kie_models(monkeypatch):
    from app.services.upstream_model_catalog import list_upstream_models

    monkeypatch.setattr("app.services.tokenfree_gateway.upstream_locked", lambda: False)
    rows = await list_upstream_models(None, protocol="kie", base_url="", api_key_override="k", capability="video")
    assert [row["id"] for row in rows] == [km.SEEDANCE_2, km.SEEDANCE_2_FAST, km.SEEDANCE_2_MINI]


async def test_admin_save_kie_channel_defaults(db_session):
    from sqlalchemy import select

    from app.models_settings import SystemModelChannelRow
    from app.schemas_routing import SystemModelChannelIn

    existing = {row.id: row for row in (await db_session.execute(select(SystemModelChannelRow))).scalars().all()}
    models = [km.SEEDANCE_2, km.SEEDANCE_2_FAST, km.SEEDANCE_2_MINI]
    await model_settings._save_unlocked_channels(
        db_session,
        [
            SystemModelChannelIn(id="tokenfree", name="TF", api_key="k1", models=["seedance-2.0"]),
            SystemModelChannelIn(id="kie", name="Kie.ai", protocol="kie", api_key="kk", models=models),
            SystemModelChannelIn(id="kie2", name="Kie 2", base_url="https://api.kie.ai/", api_key="kk2"),
        ],
        existing,
    )
    rows = {row.id: row for row in (await db_session.execute(select(SystemModelChannelRow))).scalars().all()}
    assert rows["kie"].base_url == "https://api.kie.ai"
    assert rows["kie"].protocol == "kie" and rows["kie"].api_format == "kie"
    assert list(rows["kie"].models) == models
    assert rows["kie2"].protocol == "kie"  # auto + kie.ai 主机 → kie
    with pytest.raises(ValueError):
        await model_settings._save_unlocked_channels(
            db_session, [SystemModelChannelIn(id="kie", name="Kie", protocol="kie", base_url="http://api.kie.ai")], rows
        )


def test_kie_credits_override_tokenfree_video_expression() -> None:
    """Kie 返回 creditsConsumed 时按实际 credit 结算，不套 TokenFree seedance 秒价（实测：Mini 19 credit 曾被算成 48 分）。"""
    from app.services.billing.pricing import charge_fen_for_usage

    raw = {
        "provider": "kie",
        "creditsConsumed": 19.0,
        "cost_fen": 10,
        "usage": {"creditsConsumed": 19.0, "cost_fen": 10, "seconds": 5.0, "resolution": "480p", "tokens": 50000, "tokens_estimated": True},
    }
    cost, _charge, from_upstream = charge_fen_for_usage(50000, "seedance2:video0", raw_usage=raw, model="seedance-2.0")
    assert cost == 10
    assert from_upstream is True
