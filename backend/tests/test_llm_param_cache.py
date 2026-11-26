"""文字 LLM 参数兼容规则：已知模型族主动套用 + 400 后进程级记忆，不重复发失败变体。"""
import httpx
import pytest
from unittest.mock import AsyncMock

from app.services import llm_client


@pytest.fixture(autouse=True)
def _clear_cache():
    llm_client.clear_param_cache()
    yield
    llm_client.clear_param_cache()


def _payload(model: str, fmt: dict | None = {"type": "json_object"}) -> dict:
    p = {"model": model, "temperature": 0.6, "max_tokens": 100, "messages": []}
    if fmt:
        p["response_format"] = fmt
    return p


def test_claude_static_rules_drop_temperature_and_json_object():
    out = llm_client.apply_known_param_rules(_payload("claude-haiku-5-5"), "https://api.anthropic.com/v1")
    assert "temperature" not in out and "response_format" not in out and out["max_tokens"] == 100


def test_older_claude_keeps_temperature():
    for model in ("claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6", "claude-3-5-sonnet"):
        out = llm_client.apply_known_param_rules(_payload(model), "https://api.anthropic.com/v1")
        assert out["temperature"] == 0.6 and "response_format" not in out, model
    for model in ("claude-opus-4-7", "claude-opus-4-8", "claude-sonnet-5", "claude-fable-5-2", "claude-haiku-5-5"):
        assert "temperature" not in llm_client.apply_known_param_rules(_payload(model), "x"), model


def test_claude_keeps_json_schema():
    fmt = {"type": "json_schema", "json_schema": {"name": "x", "schema": {}}}
    out = llm_client.apply_known_param_rules(_payload("claude-sonnet-5", fmt), "https://x/v1")
    assert out["response_format"] == fmt and "temperature" not in out


def test_other_models_untouched_until_learned():
    base = "https://api.example.com/v1/"
    p = _payload("gpt-x")
    assert llm_client.apply_known_param_rules(p, base) == p
    llm_client.remember_unsupported_param(base, "gpt-x", "max_completion_tokens")
    out = llm_client.apply_known_param_rules(p, "https://api.example.com/v1")
    assert out["max_completion_tokens"] == 100 and "max_tokens" not in out
    # 其它渠道 / 模型不受影响
    assert llm_client.apply_known_param_rules(p, "https://other/v1") == p


def _route(monkeypatch, model: str, base: str = "https://gw.test/v1"):
    monkeypatch.setattr(llm_client, "_resolve_chat_attempts", lambda *_a, **_k: [("k", model, base, "c1")])


async def test_param_error_learned_once(monkeypatch):
    _route(monkeypatch, "gpt-reasoner")
    sent: list[dict] = []

    async def fake(client, method, url, **kwargs):
        body = dict(kwargs["json"])
        sent.append(body)
        if "max_tokens" in body:
            return httpx.Response(400, text="Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead.")
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    monkeypatch.setattr(llm_client, "observed_request", fake)
    assert await llm_client.chat_completions("s", "u") == "ok"
    assert len(sent) == 2
    sent.clear()
    assert await llm_client.chat_completions("s", "u") == "ok"
    # 第二次调用直接发正确变体，不再吃 400
    assert len(sent) == 1 and "max_completion_tokens" in sent[0]


async def test_claude_first_request_already_compatible(monkeypatch):
    _route(monkeypatch, "claude-haiku-5-5", "https://api.anthropic.com/v1")
    request = AsyncMock(return_value=httpx.Response(200, json={"choices": [{"message": {"content": '```json\n{"a":1}\n```'}}]}))
    monkeypatch.setattr(llm_client, "observed_request", request)
    out = await llm_client.chat_completions("s", "u", response_format={"type": "json_object"})
    assert out == '{"a":1}'
    assert request.await_count == 1
    body = request.await_args.kwargs["json"]
    assert "temperature" not in body and "response_format" not in body


def test_prepare_chat_request_applies_rules(monkeypatch):
    _route(monkeypatch, "claude-haiku-5-5")
    _url, _headers, payload = llm_client.prepare_chat_request("s", "u")
    assert "temperature" not in payload
