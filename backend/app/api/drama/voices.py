"""漫剧音色目录：越南语音色（对齐 Dravelio /drama/voices/vietnamese）。"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.models import User
from app.services.voices import vietnamese_voices

router = APIRouter()


@router.get("/voices/vietnamese")
async def drama_vietnamese_voices(_user: User = Depends(get_current_user)) -> dict:
    """越南语配音音色；ElevenLabs 未配置时只返回 edge 音色。"""
    from app.services import elevenlabs

    return {"voices": await vietnamese_voices(), "elevenlabs": elevenlabs.configured()}
