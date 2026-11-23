from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.i18n import _, get_locale
from app.models import Template
from app.schemas import TemplateDetailOut
from app.services.templates_prompts_en import localize_template_prompt_fields

router = APIRouter(prefix="/templates", tags=["templates"])


class LocalizedTemplateOut(TemplateDetailOut):
    """用户端模板：name / description 按界面语言翻译；category 保留原值作筛选键。

    category_labels 与 category 一一对应，为翻译后的展示文案。
    视觉提示词（style_prefix / negative_prompt / extra_prompt / character_prompt / motion_bias / bgm_mood）
    在非中文界面返回英文版（内置模板；与 vi / en 项目生成时使用的一致），llm_system_addon 原样返回。
    """

    category_labels: list[str] = []


def localize_template(tpl: Template) -> LocalizedTemplateOut:
    """以中文种子文案为 key 翻译；管理员自定义文案在目录里查不到，原样回退。"""
    out = LocalizedTemplateOut.model_validate(tpl)
    category = [str(c) for c in (out.category or [])]
    prompts = localize_template_prompt_fields(
        {
            "style_prefix": out.style_prefix,
            "negative_prompt": out.negative_prompt,
            "seedream_config": out.seedream_config,
            "seedance_config": out.seedance_config,
            "audio_config": out.audio_config,
        },
        get_locale(),
    )
    return out.model_copy(
        update={
            **prompts,
            "name": _(out.name) if out.name else out.name,
            "description": _(out.description) if out.description else out.description,
            "category_labels": [_(c) for c in category],
        }
    )


@router.get("", response_model=list[LocalizedTemplateOut])
async def list_templates(db: AsyncSession = Depends(get_db)) -> list[LocalizedTemplateOut]:
    result = await db.execute(
        select(Template).where(Template.is_active.is_(True)).order_by(Template.sort_order)
    )
    return [localize_template(t) for t in result.scalars().all()]


@router.get("/{template_id}", response_model=LocalizedTemplateOut)
async def get_template(template_id: str, db: AsyncSession = Depends(get_db)) -> LocalizedTemplateOut:
    tpl = await db.get(Template, template_id)
    if not tpl or not tpl.is_active:
        raise HTTPException(status_code=404, detail=_("模板不存在"))
    return localize_template(tpl)
