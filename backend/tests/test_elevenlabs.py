"""ElevenLabs：音色升级 / 兜底、语言识别、合成与计费成本、音色目录。"""

from __future__ import annotations

import httpx
import pytest

from app.config import get_settings
from app.services import elevenlabs as el
from app.services.ark import _tts_language_code


@pytest.fixture
def el_on(monkeypatch: pytest.MonkeyPatch):
    s = get_settings()
    monkeypatch.setattr(s, "elevenlabs_api_key", "xi-test")
    monkeypatch.setattr(s, "elevenlabs_voice_map", "vi-VN-HoaiMyNeural:voiceF,vi-VN-NamMinhNeural:voiceM")
    monkeypatch.setattr(s, "elevenlabs_usd_per_1k_chars", 0.1)
    monkeypatch.setattr(s, "billing_currency", "USD")
    el.reset_cache()
    yield s
    el.reset_cache()


def _mock_httpx(monkeypatch, handler):
    transport = httpx.MockTransport(handler)
    real = httpx.AsyncClient
    monkeypatch.setattr(el.httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw))


def test_upgrade_and_fallback(el_on):
    assert el.upgrade_speaker("vi-VN-HoaiMyNeural") == "el:voiceF"
    assert el.upgrade_speaker("zh_female_cancan_uranus_bigtts") == "zh_female_cancan_uranus_bigtts"
    assert el.fallback_edge_voice("el:voiceM") == "vi-VN-NamMinhNeural"
    # 未映射、无缓存：默认越南语女声，而不是中文豆包
    assert el.fallback_edge_voice("el:unknown") == "vi-VN-HoaiMyNeural"
    el_on.elevenlabs_api_key = ""
    assert el.upgrade_speaker("vi-VN-HoaiMyNeural") == "vi-VN-HoaiMyNeural"


def test_language_code_detection():
    assert _tts_language_code("Xin chào, hôm nay trời đẹp quá") == "vi"
    assert _tts_language_code("Hello there, welcome to the show") == "en"
    assert _tts_language_code("今天天气很好") is None


def test_cost_minor_for_chars(el_on):
    assert el.cost_minor_for_chars(0) == 0
    assert el.cost_minor_for_chars(1000) == 10  # $0.10 → 10 美分
    assert el.cost_minor_for_chars(1) == 1  # 至少 1


async def test_synthesize_writes_file_and_sets_cost(el_on, monkeypatch, tmp_path):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["key"] = request.headers.get("xi-api-key")
        seen["body"] = request.content.decode()
        return httpx.Response(200, content=b"ID3" + b"\0" * 2000)

    _mock_httpx(monkeypatch, handler)
    dest = tmp_path / "a.mp3"
    assert await el.synthesize("Xin chào" * 250, "el:voiceF", dest, language_code="vi")
    assert dest.stat().st_size > 1000
    assert "/text-to-speech/voiceF" in seen["url"] and seen["key"] == "xi-test"
    assert '"eleven_flash_v2_5"' in seen["body"] and '"language_code":"vi"' in seen["body"].replace(" ", "")
    assert el.pop_tts_cost_hint() == 20  # 2000 字符 × $0.1/千
    assert el.pop_tts_cost_hint() is None


async def test_synthesize_failure_returns_false(el_on, monkeypatch, tmp_path):
    _mock_httpx(monkeypatch, lambda request: httpx.Response(401, text="bad key"))
    assert await el.synthesize("Xin chào", "el:voiceF", tmp_path / "b.mp3") is False


async def test_list_voices_maps_language(el_on, monkeypatch):
    payload = {
        "voices": [
            {"voice_id": "v1", "name": "Linh", "labels": {"gender": "female"}, "verified_languages": [{"language": "vi"}]},
            {"voice_id": "v2", "name": "Adam", "labels": {"gender": "male", "language": "en"}},
        ]
    }
    _mock_httpx(monkeypatch, lambda request: httpx.Response(200, json=payload))
    voices = await el.list_voices()
    assert [(v["id"], v["locale"], v["gender"]) for v in voices] == [("el:v1", "vi", "female"), ("el:v2", "en", "male")]
    assert el.fallback_edge_voice("el:v2") == "en-US-GuyNeural"


async def test_tts_usage_uses_elevenlabs_cost(db_session, el_on):
    from app.services.billing.usage import record_line
    from tests.conftest import make_user

    el_on.billing_markup = 2.0
    user = await make_user(db_session)
    el._tts_cost_hint.set(25)
    ev = await record_line(db_session, user_id=user.id, billing_key="tts")
    assert (ev.cost_fen, ev.charge_fen, ev.provider, ev.estimated) == (25, 50, "elevenlabs", False)
