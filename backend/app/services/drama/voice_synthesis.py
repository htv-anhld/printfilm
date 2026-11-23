"""漫剧音色资产：音色设计或 TTS 合成参考音频（供 Seedance reference_audio 使用）。"""
from __future__ import annotations
import logging
import re
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.models import User
from app.models_drama import DramaAsset, DramaProject
from app.services.ark import get_ark
from app.services.logical_model_router import resolve_upstream_model
from app.services.billing import record_line
from app.services.drama.voice_design import (
    design_voice,
    parse_speaker_pool,
    persist_demo_audio,
    resolve_speaker_slot,
    voice_design_enabled,
)
from app.services.drama.voice_reference_audio import finalize_voice_reference_url
from app.services.voices import infer_drama_speaker_from_prompt
from app.services.kepu_locale import default_voice_for_locale, speaker_supports_locale
from app.i18n import _
from app.services.drama.content_locale import content_text, get_content_locale
logger = logging.getLogger(__name__)
NAME_SUFFIX_PATTERN = re.compile(r"(音色|的声音|语音|\s*(?:voice|giọng(?: đọc| nói)?))$", re.IGNORECASE)
# 英/越音色描述里的性别词 → 中文提示词（infer_drama_speaker_from_prompt 只认中文关键词）
_GENDER_HINT_PATTERNS = (
    (re.compile(r"\b(?:female|woman|girl|lady)\b|\bnữ\b|cô gái|thiếu nữ|phụ nữ|bà\b", re.IGNORECASE), "女声"),
    (re.compile(r"\b(?:male|man|boy|gentleman)\b|\bnam\b|chàng trai|thiếu niên|đàn ông|ông\b", re.IGNORECASE), "男"),
)


def speaker_inference_text(voice_prompt: str) -> str:
    """为音色推断补中文性别关键词（中文描述原样返回）。"""
    text = voice_prompt or ""
    hints = [hint for pattern, hint in _GENDER_HINT_PATTERNS if pattern.search(text)]
    if not hints:
        return text
    return f"{text} {' '.join(hints)}"
# 从 voice 资产名还原角色名（如「禹音色」→「禹」）
def normalize_character_name(name: str | None) -> str:
    raw = (name or "我").strip() or "我"
    return NAME_SUFFIX_PATTERN.sub("", raw).strip() or "我"
# 生成 Seedance 参考音试听句（须 ≥2s，避免 r2v 拒收过短音频）
def build_voice_sample_line_short(character_name: str | None = None) -> str:
    name = normalize_character_name(character_name)
    display = name[:8] if len(name) > 8 else name
    if get_content_locale() != "zh":
        display = name[:24]
    # 试听句按项目内容语言（TTS 念出来的就是这句）
    return content_text(
        "你好，我是{name}。请听我的语气与声线，之后我会用这样的声音来讲述故事。",
        name=display,
    )
# 生成角色差异化试听台词
def build_voice_sample_text(
    voice_prompt: str,
    character_name: str | None = None,
    *,
    short: bool = False,
) -> str:
    if short:
        return build_voice_sample_line_short(character_name)
    name = normalize_character_name(character_name)
    prompt = (voice_prompt or "").strip()
    blob = f"{name} {prompt}"
    t = content_text
    if any(k in blob for k in ("老", "翁", "族老", "首领", "青叔")):
        line = t("{name}：诸位且听我说，此事关乎两岸百姓，不可延误。", name=name)
    elif any(k in blob for k in ("禹", "治水", "领袖", "帝王", "君主")):
        line = t("{name}：疏堵并举，通川达海，方能安民。", name=name)
    elif any(k in blob for k in ("伯益", "谋士", "儒雅", "书生")):
        line = t("{name}：依我之见，当先察水势，再定工段。", name=name)
    elif any(k in blob for k in ("青壮", "少年", "青年", "小伙")):
        line = t("{name}：跟我上，这点工程算不了什么！", name=name)
    elif any(k in blob for k in ("百姓", "群众", "平民", "妇人")):
        line = t("{name}：只求河道通畅，我们也好安心过日子。", name=name)
    elif any(k in blob for k in ("女", "姑娘", "少女")):
        line = t("{name}：请放心，我会把情况说明白。", name=name)
    elif prompt and get_content_locale() == "zh":
        snippet = prompt[:36].rstrip("，。；、 ")
        line = f"{name}：{snippet}。"
    else:
        # 非中文项目不拿音色描述当台词（描述是选角说明，念出来不自然）
        line = t("{name}：请听我的语气与声线。", name=name)
    return line[:180]
# 解析可用于 voice_design image_prompt 的公网角色图 URL
def resolve_character_image_url(character: DramaAsset | None) -> str | None:
    if not character:
        return None
    from app.services import storage as storage_svc
    for field in ("cover", "url"):
        raw = str(getattr(character, field) or "").strip()
        if not raw:
            continue
        if raw.startswith("https://"):
            return raw
        published = storage_svc.republish_url(raw, sync=True)
        if published and str(published).startswith("https://"):
            return str(published)
    return None
async def _synthesize_via_voice_design(
    *,
    settings,
    project: DramaProject,
    asset: DramaAsset,
    prompt: str,
    text: str,
    display_name: str,
    image_url: str | None,
) -> tuple[str, str]:
    """调用音色设计 API，返回 (audio_url, designed_speaker_id)。"""
    pool = parse_speaker_pool(settings.volc_tts_voice_design_speaker_ids)
    speaker_slot = resolve_speaker_slot(
        asset.id,
        asset.params if isinstance(asset.params, dict) else {},
        pool,
    )
    logger.info(
        "音色设计 project_id=%s asset_id=%s speaker=%s name=%s image=%s",
        project.id,
        asset.id,
        speaker_slot,
        display_name,
        bool(image_url),
    )
    result = await design_voice(
        speaker_id=speaker_slot,
        text_prompt=prompt,
        sample_text=text,
        image_url=image_url,
        settings=settings,
    )
    audio_url = await persist_demo_audio(
        result.demo_audio_url,
        project_id=project.id,
        asset_id=asset.id,
    )
    logger.info(
        "音色设计完成 project_id=%s asset_id=%s speaker=%s logid=%s url=%s",
        project.id,
        asset.id,
        result.speaker_id,
        result.log_id,
        audio_url[:80],
    )
    return audio_url, result.speaker_id
async def synthesize_voice_asset(
    db: AsyncSession,
    user: User,
    project: DramaProject,
    asset: DramaAsset,
    *,
    voice_prompt: str,
    sample_text: str | None = None,
    speaker: str | None = None,
    character_name: str | None = None,
    character_asset: DramaAsset | None = None,
) -> DramaAsset:
    """按提示词合成音色参考音频并写回 voice 资产。"""
    settings = get_settings()
    ark = get_ark()
    prompt = (voice_prompt or "").strip()
    if not prompt:
        raise ValueError(_("缺少音色描述 prompt"))
    display_name = normalize_character_name(character_name or asset.name)
    # Seedance reference_audio 须 ≥1.8s（落盘目标 ≥2s）；默认用较长试听句
    text = (sample_text or "").strip() or build_voice_sample_text(prompt, display_name, short=False)
    image_url = resolve_character_image_url(character_asset)
    audio_url: str | None = None
    resolved_speaker = (speaker or "").strip()
    voice_design_meta: dict[str, Any] = {}
    if voice_design_enabled(settings) and not settings.ark_mock:
        try:
            audio_url, designed_speaker = await _synthesize_via_voice_design(
                settings=settings,
                project=project,
                asset=asset,
                prompt=prompt,
                text=text,
                display_name=display_name,
                image_url=image_url,
            )
            resolved_speaker = designed_speaker
            voice_design_meta = {"voiceDesign": True, "voiceDesignStatus": "success"}
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "音色设计失败，回退 preset TTS project_id=%s asset_id=%s err=%s",
                project.id,
                asset.id,
                exc,
            )
            voice_design_meta = {
                "voiceDesign": True,
                "voiceDesignStatus": "fallback",
                "voiceDesignError": str(exc)[:500],
            }
    if not audio_url:
        if not resolved_speaker or not resolved_speaker.startswith("S_"):
            resolved_speaker = infer_drama_speaker_from_prompt(
                speaker_inference_text(prompt),
                character_name=display_name,
                asset_id=asset.id,
            )
        content_loc = get_content_locale()
        if not speaker_supports_locale(resolved_speaker, content_loc):
            # 非中文项目：中文音色念不了越南语/英语试听句，换成该语言的默认音色
            low = resolved_speaker.lower()
            gender = "male" if "_male_" in low or low.startswith("male") else "female"
            resolved_speaker = default_voice_for_locale(content_loc, gender) or resolved_speaker
        logger.info(
            "合成音色资产(TTS) project_id=%s asset_id=%s speaker=%s name=%s",
            project.id,
            asset.id,
            resolved_speaker,
            display_name,
        )
        audio_url = await ark.tts(
            text,
            resolved_speaker,
            project_id=project.id,
            shot_no=asset.id,
            emotion_hint=prompt,
        )
    audio_url = finalize_voice_reference_url(
        audio_url or "",
        project_id=project.id,
        asset_id=asset.id,
    )
    asset.url = audio_url
    asset.cover = asset.cover or audio_url
    params: dict[str, Any] = dict(asset.params or {})
    params["voicePrompt"] = prompt
    params["sampleText"] = text
    params["speaker"] = resolved_speaker
    if resolved_speaker.startswith("S_"):
        params["designedSpeakerId"] = resolved_speaker
    params["characterName"] = display_name
    if character_asset:
        params["sourceCharacterAssetId"] = character_asset.id
    params.update(voice_design_meta)
    gen = params.get("generation") if isinstance(params.get("generation"), dict) else {}
    params["generation"] = {**gen, "status": "done", "url": audio_url}
    asset.params = params
    await record_line(
        db,
        user_id=user.id,
        project_id=None,
        drama_project_id=project.id,
        billing_key="tts",
        model=(resolve_upstream_model("audio", None) or settings.model_audio),
        estimated=True,
        domain="drama",
    )
    await db.commit()
    await db.refresh(asset)
    return asset

