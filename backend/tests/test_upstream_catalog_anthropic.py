"""Anthropic /v1/models 需要 x-api-key + anthropic-version 头。"""
import httpx

from app.services import upstream_model_catalog as cat


async def test_anthropic_catalog_uses_native_headers(monkeypatch):
    seen = {}

    async def fake_get(self, url, headers=None, **kw):
        seen["url"], seen["headers"] = url, headers
        return httpx.Response(200, json={"data": [{"id": "claude-sonnet-5-5", "display_name": "Claude Sonnet 5.5"}]})

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    rows = await cat._list_openai_compatible_models(base_url="https://api.anthropic.com/v1", api_key="sk-ant-x")
    assert seen["headers"] == {"x-api-key": "sk-ant-x", "anthropic-version": "2023-06-01"}
    assert seen["url"].endswith("/models?limit=1000")
    assert rows == [{"id": "claude-sonnet-5-5", "label": "Claude Sonnet 5.5", "capability": "text"}]


async def test_openai_catalog_keeps_bearer(monkeypatch):
    seen = {}

    async def fake_get(self, url, headers=None, **kw):
        seen["headers"] = headers
        return httpx.Response(200, json={"data": []})

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    await cat._list_openai_compatible_models(base_url="https://api.openai.com/v1", api_key="sk-x")
    assert seen["headers"] == {"Authorization": "Bearer sk-x"}
