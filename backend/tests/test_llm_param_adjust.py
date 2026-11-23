"""上游参数不兼容时自动调整（Claude / OpenAI 推理模型）。"""
from app.services.llm_client import adjust_payload_for_param_error as adj

BASE = {"model": "m", "temperature": 0.6, "max_tokens": 100, "messages": [], "response_format": {"type": "json_object"}}


def test_claude_temperature_deprecated():
    out = adj(BASE, '{"message":"`temperature` is deprecated for this model."}')
    assert "temperature" not in out and out["max_tokens"] == 100


def test_claude_json_object_unsupported():
    p = {k: v for k, v in BASE.items() if k != "temperature"}
    out = adj(p, "response_format.type: Input should be 'json_schema'")
    assert "response_format" not in out


def test_openai_max_completion_tokens():
    out = adj(BASE, "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.")
    assert out["max_completion_tokens"] == 100 and "max_tokens" not in out


def test_unrelated_error_returns_none():
    assert adj(BASE, "invalid api key") is None


def test_strip_json_fence():
    from app.services.llm_client import strip_json_fence

    assert strip_json_fence('```json\n{"a": 1}\n```') == '{"a": 1}'
    assert strip_json_fence('{"a": 1}') == '{"a": 1}'


def test_quota_exhausted_is_failover():
    from app.services.llm_client import is_quota_exhausted

    body = '{"error":{"message":"用户额度不足","code":"insufficient_user_quota"}}'
    assert is_quota_exhausted(403, body)
    assert not is_quota_exhausted(403, '{"error":"forbidden"}')
    assert not is_quota_exhausted(400, body)


def test_text_mock_follows_ark_mock_text(monkeypatch):
    from app.config import get_settings
    from app.services.ark import ArkGateway

    base = get_settings()
    for mock_text, expected in ((False, False), (True, True)):
        cfg = base.model_copy(update={"ark_mock": True, "ark_mock_text": mock_text})
        monkeypatch.setattr(ArkGateway, "settings", property(lambda self, c=cfg: c))
        gw = ArkGateway()
        assert gw.mock and gw.text_mock is expected
