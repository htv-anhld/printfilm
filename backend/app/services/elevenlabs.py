# -*- coding: utf-8 -*-
"""ElevenLabs 文字转语音（https://elevenlabs.io/docs）。

- speaker 约定：``el:<voice_id>``（与豆包 speaker、edge ``vi-VN-*`` 并存）
- 默认模型 eleven_flash_v2_5：支持越南语；eleven_multilingual_v2 不含越南语
- 成本按字符计（ELEVENLABS_USD_PER_1K_CHARS），通过 tts_cost_hint 交给用量行
"""
from __future__ import annotations

import contextvars
import logging
import math
import time
from pathlib import Path
from typing import Any

import httpx

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

API_BASE = "https://api.elevenlabs.io/v1"
PREFIX = "el:"
VOICES_TTL_SEC = 600
TIMEOUT = httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0)

_voices_cache: tuple[float, list[dict[str, Any]]] | None = None
# 最近一次 ElevenLabs 合成的上游成本（计费最小单位）；record_line 记 tts 用量时取走
_tts_cost_hint: contextvars.ContextVar[int | None] = contextvars.ContextVar("elevenlabs_tts_cost", default=None)


def configured(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    return bool((s.elevenlabs_api_key or "").strip())


def is_elevenlabs_voice(speaker: str | None) -> bool:
    return (speaker or "").strip().startswith(PREFIX)


def voice_id_of(speaker: str) -> str:
    return (speaker or "").strip()[len(PREFIX):]


def voice_map(settings: Settings | None = None) -> dict[str, str]:
    """ELEVENLABS_VOICE_MAP：edge 音色 → ElevenLabs voice_id。"""
    s = settings or get_settings()
    out: dict[str, str] = {}
    for part in (s.elevenlabs_voice_map or "").split(","):
        if ":" in part:
            src, dst = part.split(":", 1)
            if src.strip() and dst.strip():
                out[src.strip()] = dst.strip()
    return out


def upgrade_speaker(speaker: str, settings: Settings | None = None) -> str:
    """已配置 ElevenLabs 时，把映射过的 edge 音色换成 el:<id>；否则原样返回。"""
    if not configured(settings) or is_elevenlabs_voice(speaker):
        return speaker
    mapped = voice_map(settings).get((speaker or "").strip())
    return f"{PREFIX}{mapped}" if mapped else speaker


def cost_minor_for_chars(chars: int, settings: Settings | None = None) -> int:
    """字符数 → 计费最小单位的上游成本。"""
    from app.services.billing.currency import minor_per_usd

    s = settings or get_settings()
    usd = max(0, int(chars)) / 1000.0 * float(s.elevenlabs_usd_per_1k_chars or 0)
    return max(1, int(math.ceil(usd * minor_per_usd(s)))) if chars > 0 else 0


def pop_tts_cost_hint() -> int | None:
    """取走并清空最近一次 ElevenLabs 成本。"""
    value = _tts_cost_hint.get()
    _tts_cost_hint.set(None)
    return value


async def synthesize(text: str, speaker: str, dest: Path, *, language_code: str | None = None) -> bool:
    """POST /text-to-speech/{voice_id} → mp3 落盘；失败返回 False（交给下一个 TTS 兜底）。"""
    s = get_settings()
    if not configured(s):
        return False
    voice_id = voice_id_of(speaker)
    if not voice_id:
        return False
    body: dict[str, Any] = {"text": text, "model_id": s.elevenlabs_model or "eleven_flash_v2_5"}
    if language_code:
        body["language_code"] = language_code
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{API_BASE}/text-to-speech/{voice_id}",
                params={"output_format": "mp3_44100_128"},
                headers={"xi-api-key": s.elevenlabs_api_key.strip(), "Content-Type": "application/json"},
                json=body,
            )
    except httpx.HTTPError as exc:
        logger.warning("elevenlabs network error: %s", exc)
        return False
    if resp.status_code >= 400 or len(resp.content) < 1000:
        logger.warning("elevenlabs HTTP %s: %s", resp.status_code, resp.text[:300] if resp.status_code >= 400 else "short body")
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(resp.content)
    _tts_cost_hint.set(cost_minor_for_chars(len(text), s))
    return True


def _language_of(voice: dict[str, Any]) -> str:
    """音色语言：verified_languages 优先，其次 labels.language。"""
    for item in voice.get("verified_languages") or []:
        lang = str((item or {}).get("language") or "").lower()
        if lang:
            return lang[:2]
    labels = voice.get("labels") or {}
    lang = str(labels.get("language") or "").lower()
    if lang.startswith("viet"):
        return "vi"
    return lang[:2]


async def list_voices(*, force: bool = False) -> list[dict[str, Any]]:
    """账号可用音色（10 分钟缓存），转换成本地音色预设结构。"""
    global _voices_cache
    s = get_settings()
    if not configured(s):
        return []
    now = time.monotonic()
    if not force and _voices_cache and now - _voices_cache[0] < VOICES_TTL_SEC:
        return list(_voices_cache[1])
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.get(f"{API_BASE}/voices", headers={"xi-api-key": s.elevenlabs_api_key.strip()})
        resp.raise_for_status()
        raw = resp.json().get("voices") or []
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("elevenlabs list voices failed: %s", exc)
        return list(_voices_cache[1]) if _voices_cache else []
    out = []
    for voice in raw:
        vid = str(voice.get("voice_id") or "")
        if not vid:
            continue
        labels = voice.get("labels") or {}
        out.append(
            {
                "id": f"{PREFIX}{vid}",
                "speaker": f"{PREFIX}{vid}",
                "label": f"{voice.get('name') or vid} · ElevenLabs",
                "gender": str(labels.get("gender") or "") or None,
                "locale": _language_of(voice) or "multi",
                "provider": "elevenlabs",
                "preview_url": voice.get("preview_url"),
            }
        )
    _voices_cache = (now, out)
    return list(out)


def cached_voice(speaker: str) -> dict[str, Any] | None:
    """从缓存取音色元数据（兜底 edge 音色时用来判断语言 / 性别）。"""
    if not _voices_cache:
        return None
    return next((v for v in _voices_cache[1] if v["speaker"] == speaker), None)


def fallback_edge_voice(speaker: str, settings: Settings | None = None) -> str:
    """ElevenLabs 失败时的 edge 兜底：反查映射表，否则按缓存的语言 / 性别挑越南语或英语音色。"""
    vid = voice_id_of(speaker)
    for edge, mapped in voice_map(settings).items():
        if mapped == vid:
            return edge
    meta = cached_voice(speaker) or {}
    male = str(meta.get("gender") or "").lower() == "male"
    if meta.get("locale") == "en":
        return "en-US-GuyNeural" if male else "en-US-JennyNeural"
    return "vi-VN-NamMinhNeural" if male else "vi-VN-HoaiMyNeural"


def reset_cache() -> None:
    """测试用。"""
    global _voices_cache
    _voices_cache = None
