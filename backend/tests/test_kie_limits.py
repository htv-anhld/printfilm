"""kie 三项增强：1080p/4k 按清晰度选渠道、本地素材上传到 kie、完成回调唤醒轮询。"""

from __future__ import annotations

import asyncio
import base64
import time
from types import SimpleNamespace

import httpx
import pytest

from app.services import kie_callback as kc
from app.services import kie_models as km
from app.services import kie_upload as ku
from tests.test_kie_integration import kie_snapshot  # noqa: F401 — 复用 TokenFree + kie 路由快照

KEY = "kie-secret-key-123"


# ---------- 1080p / 4k ----------


def test_seedance_20_resolutions_include_kie_tiers(kie_snapshot):  # noqa: F811
    """seedance-2.0 有 kie 绑定时开放 1080p / 4k；fast / mini 仍只有两档。"""
    from app.services.seedance_resolutions import allowed_video_resolutions

    assert allowed_video_resolutions("seedance-2.0") == ["480p", "720p", "1080p", "4k"]
    assert allowed_video_resolutions("seedance-2.0-fast") == ["480p", "720p"]
    assert allowed_video_resolutions("seedance-2.0-mini") == ["480p", "720p"]


def test_seedance_20_without_kie_stays_two_tiers(monkeypatch):
    """没有 kie 渠道时 seedance-2.0 不出现 1080p / 4k。"""
    import app.services.model_settings as model_settings
    from app.schemas_routing import LogicalModel, LogicalModelBinding, SystemModelChannel
    from app.services.seedance_resolutions import allowed_video_resolutions

    tf = SystemModelChannel(id="tokenfree", name="TF", base_url="https://www.tokenfree.com/v1", api_key="k",
                            has_api_key=True, models=["seedance-2.0"], enabled=True, sort_order=0)
    from app.schemas_routing import DefaultModels

    snapshot = model_settings.RoutingSnapshot(channels=[tf], default_models=DefaultModels(), logical_models=[
        LogicalModel(id="seedance-2.0", capability="video", bindings=[
            LogicalModelBinding(id="1", channel_id="tokenfree", upstream_model="seedance-2.0", priority=1)]),
    ])
    monkeypatch.setattr(model_settings, "_routing_snapshot", snapshot)
    assert allowed_video_resolutions("seedance-2.0") == ["480p", "720p"]


@pytest.mark.parametrize("resolution,channel", [("480p", "tokenfree"), ("720p", "tokenfree"),
                                                ("1080p", "kie"), ("4k", "kie")])
def test_pin_route_picks_channel_by_resolution(kie_snapshot, resolution, channel):  # noqa: F811
    """低档按渠道顺序走 TokenFree；1080p / 4k 自动改走 kie。"""
    from app.services.media_models.runtime import pin_route

    route = pin_route("video", "seedance-2.0", resolution=resolution)
    assert route["channel_id"] == channel


def test_pin_route_rejects_unroutable_resolution(kie_snapshot):  # noqa: F811
    """没有渠道支持的档位直接拒绝，不静默降档。"""
    from app.services.media_models.runtime import pin_route

    with pytest.raises(ValueError, match="resolution"):
        pin_route("video", "seedance-2.0-fast", resolution="1080p")


def test_kie_4k_price_and_clamp():
    """kie Seedance 2.0 的 4k 按 208 credit/秒估价，Fast 请求 4k 钳到 720p。"""
    assert km.kie_video_credits(km.SEEDANCE_2, "4k", 5) == pytest.approx(1040.0)
    assert km.clamp_kie_video_resolution(km.SEEDANCE_2, "4k") == "4k"
    assert km.clamp_kie_video_resolution(km.SEEDANCE_2_FAST, "4k") == "720p"


# ---------- 上传 ----------


@pytest.mark.parametrize("url,expected", [
    ("https://cdn.example.com/a.png", False),
    ("asset://abc", False),
    ("/static/generated/p1/a.png", True),
    ("data:image/png;base64,AAAA", True),
    ("http://localhost:18000/static/a.png", True),
    ("http://127.0.0.1:8000/static/a.png", True),
    ("http://192.168.1.5/a.png", True),
    ("http://api:8000/static/a.png", True),
    ("http://host.docker.internal/a.png", True),
    ("", False),
])
def test_needs_kie_upload(url, expected):
    assert ku.needs_kie_upload(url) is expected


def _upload_transport(calls: list):
    """模拟 kie 流式上传：记录请求，返回 downloadUrl。"""
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        assert request.url.host == "kieai.redpandaai.co"
        assert request.url.path == "/api/file-stream-upload"
        assert request.headers["Authorization"] == f"Bearer {KEY}"
        return httpx.Response(200, json={"success": True, "code": 200, "msg": "ok",
                                         "data": {"downloadUrl": f"https://tempfile.redpandaai.co/u/{len(calls)}.png"}})
    return httpx.MockTransport(handler)


async def test_upload_local_static_file_and_cache(monkeypatch, tmp_path):
    """本地 /static 文件上传一次，同内容第二次直接复用缓存链接。"""
    from app.services import storage

    ku._cache.clear()
    img = tmp_path / "shot.png"
    img.write_bytes(b"\x89PNG fake image bytes")
    monkeypatch.setattr(storage, "local_path_from_url", lambda url: img if "shot.png" in url else None)
    calls: list = []
    route = SimpleNamespace(api_key=KEY)
    first = await ku.ensure_kie_media_url(route, "/static/generated/p1/shot.png", transport=_upload_transport(calls))
    again = await ku.ensure_kie_media_url(route, "http://localhost:18000/static/generated/p1/shot.png",
                                          transport=_upload_transport(calls))
    assert first == again == "https://tempfile.redpandaai.co/u/1.png"
    assert len(calls) == 1
    body = calls[0].content
    assert b'name="uploadPath"' in body and b"printfilm" in body and b"fake image bytes" in body


async def test_upload_data_uri(monkeypatch):
    """data URI 解码后上传。"""
    ku._cache.clear()
    calls: list = []
    payload = base64.b64encode(b"hello-image").decode()
    url = await ku.ensure_kie_media_url(SimpleNamespace(api_key=KEY), f"data:image/png;base64,{payload}",
                                        transport=_upload_transport(calls))
    assert url.startswith("https://tempfile.redpandaai.co/")
    assert b"hello-image" in calls[0].content


async def test_public_url_untouched():
    """公网链接不上传。"""
    assert await ku.ensure_kie_media_url(SimpleNamespace(api_key=KEY), "https://cdn.example.com/a.png") == \
        "https://cdn.example.com/a.png"


async def test_upload_business_error_is_translated():
    """HTTP 200 + code 401 → 可读错误。"""
    transport = httpx.MockTransport(lambda r: httpx.Response(200, json={"success": False, "code": 401, "msg": "bad key"}))
    with pytest.raises(ku.KieUploadError, match="Kie.ai"):
        await ku.upload_bytes(KEY, b"x", file_name="a.png", mime="image/png", transport=transport)


async def test_localize_video_body_rewrites_only_private(monkeypatch):
    """只替换本地 / 内网素材，公网链接与文本原样保留。"""
    async def fake_ensure(route, url, **kw):
        return "https://tempfile.redpandaai.co/x.png"

    monkeypatch.setattr(ku, "ensure_kie_media_url", fake_ensure)
    body = {"content": [
        {"type": "text", "text": "hi"},
        {"type": "image_url", "image_url": {"url": "/static/a.png"}, "role": "first_frame"},
        {"type": "image_url", "image_url": {"url": "https://cdn.example.com/b.png"}, "role": "reference_image"},
    ]}
    out = await ku.localize_kie_video_body(SimpleNamespace(api_key=KEY), body)
    assert out["content"][1]["image_url"]["url"] == "https://tempfile.redpandaai.co/x.png"
    assert out["content"][1]["role"] == "first_frame"
    assert out["content"][2]["image_url"]["url"] == "https://cdn.example.com/b.png"
    assert body["content"][1]["image_url"]["url"] == "/static/a.png"  # 原对象不变


# ---------- 回调 ----------


def test_signature_verification(monkeypatch):
    """配置密钥后：正确签名通过，错签 / 过期 / 缺头拒绝；未配置时放行。"""
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "kie_webhook_hmac_key", "")
    assert kc.verify_signature("t1", None, None)
    monkeypatch.setattr(settings, "kie_webhook_hmac_key", "hmac-secret")
    now = time.time()
    ts = str(int(now))
    good = kc.sign("t1", ts, "hmac-secret")
    assert kc.verify_signature("t1", ts, good, now=now)
    assert kc.verify_signature("t1", str(int(now * 1000)), kc.sign("t1", str(int(now * 1000)), "hmac-secret"), now=now)
    assert not kc.verify_signature("t2", ts, good, now=now)
    assert not kc.verify_signature("t1", ts, "bad", now=now)
    assert not kc.verify_signature("t1", str(int(now) - 3600), kc.sign("t1", str(int(now) - 3600), "hmac-secret"), now=now)
    assert not kc.verify_signature("t1", None, good, now=now)


@pytest.mark.parametrize("payload,expected", [
    ({"code": 200, "data": {"taskId": "abc_123-x"}}, "abc_123-x"),
    ({"taskId": "abc"}, "abc"),
    ({"data": {"taskId": "a%b"}}, ""),
    ({"data": {"taskId": "x" * 200}}, ""),
    ("nope", ""),
])
def test_extract_task_id(payload, expected):
    assert kc.extract_task_id(payload) == expected


def test_callback_url_setting(monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "kie_callback_url", "")
    assert kc.callback_url() == ""
    monkeypatch.setattr(settings, "kie_callback_url", "https://example.com/api/kie/callback")
    assert kc.callback_url() == "https://example.com/api/kie/callback"
    monkeypatch.setattr(settings, "kie_callback_url", "javascript:alert(1)")
    assert kc.callback_url() == ""


async def test_callback_wakes_inline_poll(monkeypatch):
    """科普内联轮询：回调到达后立刻再查一次，不必等完退避间隔。"""
    from app.services import kie_media
    from app.services.ark import TaskResult

    calls = {"n": 0}

    async def fake_fetch(route, task_id):
        calls["n"] += 1
        return TaskResult(status="succeeded" if calls["n"] >= 2 else "running", provider_task_id=task_id)

    monkeypatch.setattr(kie_media, "fetch_kie_task", fake_fetch)

    async def no_db_wake(raw):  # 只测内联 Event，不碰数据库
        event = kc._waiters.get(raw)
        if event:
            event.set()

    started = time.monotonic()
    poll = asyncio.create_task(kie_media.poll_kie_task(SimpleNamespace(), "kie::t9", timeout_sec=60, interval_sec=30))
    await asyncio.sleep(0.05)
    await no_db_wake("t9")
    result = await poll
    assert result.status == "succeeded"
    assert time.monotonic() - started < 2.5  # 未回调时首轮至少等 3 秒
    assert "t9" not in kc._waiters


async def test_callback_endpoint_rejects_bad_signature(monkeypatch):
    """HTTP 入口：缺任务号 400，签名错 401，正常 200 并唤醒。"""
    from fastapi import FastAPI
    from app.api.kie_callback import router
    from app.config import get_settings

    woken: list[str] = []

    async def fake_wake(task_id):
        woken.append(task_id)
        return 1

    monkeypatch.setattr(kc, "wake_task", fake_wake)
    monkeypatch.setattr(get_settings(), "kie_webhook_hmac_key", "hmac-secret")
    app = FastAPI()
    app.include_router(router, prefix="/api")
    ts = str(int(time.time()))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.post("/api/kie/callback", json={"data": {}})).status_code == 400
        bad = await client.post("/api/kie/callback", json={"data": {"taskId": "t1"}},
                                headers={"X-Webhook-Timestamp": ts, "X-Webhook-Signature": "bad"})
        assert bad.status_code == 401
        ok = await client.post("/api/kie/callback", json={"code": 200, "data": {"taskId": "t1", "state": "success"}},
                               headers={"X-Webhook-Timestamp": ts, "X-Webhook-Signature": kc.sign("t1", ts, "hmac-secret")})
        assert ok.status_code == 200
    assert woken == ["t1"]


def test_official_estimate_routes_high_tiers_to_kie(kie_snapshot):  # noqa: F811
    """预估与提交一致：seedance-2.0 的 1080p / 4k 按 kie credit 价估算。"""
    from app.config import get_settings
    from app.services.tokenfree_pricing import cost_fen_official_video

    s = get_settings()
    assert cost_fen_official_video(5, s, model="seedance-2.0", resolution="4k") == km.kie_video_cost_fen(km.SEEDANCE_2, "4k", 5, s)
    assert cost_fen_official_video(5, s, model="seedance-2.0", resolution="1080p") == km.kie_video_cost_fen(km.SEEDANCE_2, "1080p", 5, s)
    assert km.resolve_kie_upstream("video", "seedance-2.0", "720p") == ""
