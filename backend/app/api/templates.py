from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.i18n import _, get_locale
from app.models import Template
from app.schemas import TemplateDetailOut
from app.services.creation_templates import CREATION_TEMPLATE_IDS, normalize_creation_template
from app.services.templates_prompts_en import localize_template_prompt_fields

router = APIRouter(prefix="/templates", tags=["templates"])


class LocalizedTemplateOut(TemplateDetailOut):
    """用户端模板：name / description 按界面语言翻译；category 保留原值作筛选键。

    category_labels 与 category 一一对应，为翻译后的展示文案。
    视觉提示词（style_prefix / negative_prompt / extra_prompt / character_prompt / motion_bias / bgm_mood）
    在非中文界面返回英文版（内置模板；与 vi / en 项目生成时使用的一致），llm_system_addon 原样返回。
    """

    category_labels: list[str] = []


def localize_template(tpl: Template | dict) -> LocalizedTemplateOut:
    """以中文种子文案为 key 翻译；管理员自定义文案在目录里查不到，原样回退。

    tpl 可以是 ORM 行，也可以是 normalize_creation_template() 规范化后的 dict。
    """
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


@router.get(
    "",
    response_model=list[LocalizedTemplateOut],
    summary="获取可用创作模板",
    description="无需登录，按预设顺序返回已启用且允许前台创作使用的动画模板，包含规范化后的模板详情；名称、简介与分类标签按界面语言翻译。",
    response_description="可用创作模板列表",
)
async def list_templates(db: AsyncSession = Depends(get_db)) -> list[LocalizedTemplateOut]:
    result = await db.execute(
        select(Template).where(Template.is_active.is_(True), Template.id.in_(CREATION_TEMPLATE_IDS))
    )
    by_id = {template.id: template for template in result.scalars().all()}
    return [
        localize_template(normalize_creation_template(by_id[template_id]))
        for template_id in CREATION_TEMPLATE_IDS
        if template_id in by_id
    ]


@router.get(
    "/{template_id}",
    response_model=LocalizedTemplateOut,
    summary="获取创作模板详情",
    description="无需登录，按模板标识读取已启用模板并返回规范化详情；不存在或已停用时返回 404。",
    response_description="模板详情",
)
async def get_template(template_id: str, db: AsyncSession = Depends(get_db)) -> LocalizedTemplateOut:
    tpl = await db.get(Template, template_id)
    if not tpl or not tpl.is_active:
        raise HTTPException(status_code=404, detail=_("模板不存在"))
    return localize_template(normalize_creation_template(tpl))
