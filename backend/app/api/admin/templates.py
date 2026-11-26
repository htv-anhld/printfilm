# Admin template CRUD
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import cast, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_admin
from app.i18n import _
from app.models import Project, Template, User
from app.schemas import (
    AdminTemplateCreate,
    AdminTemplateListOut,
    AdminTemplateOut,
    AdminTemplatePatch,
    PageMeta,
)

router = APIRouter()


def _admin_template_out(tpl: Template) -> AdminTemplateOut:
    """管理端模板输出：附带按界面语言翻译的展示字段（种子中文文案在 i18n 目录里有译文）。"""
    out = AdminTemplateOut.model_validate(tpl)
    return out.model_copy(
        update={
            "display_name": _(out.name) if out.name else "",
            "display_description": _(out.description) if out.description else "",
            "category_labels": [_(str(c)) for c in (out.category or [])],
        }
    )


@router.get("/templates/meta",
    summary="获取模板分类选项",
    description="管理员读取全库模板的分类标签，返回去重并排序后的 categories、各分类模板数 category_counts 与模板总数 total，用于管理端筛选。",
    response_description="操作成功，返回结果详见响应结构",
)
async def templates_meta(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # 汇总全库分类标签（用于管理端筛选）
    result = await db.execute(select(Template.category))
    counts: dict[str, int] = {}
    total = 0
    for (cat_list,) in result.all():
        total += 1
        if not isinstance(cat_list, list):
            continue
        for item in {i.strip() for i in cat_list if isinstance(i, str) and i.strip()}:
            counts[item] = counts.get(item, 0) + 1
    ordered = sorted(counts)
    return {
        "categories": ordered,
        "category_labels": {c: _(c) for c in ordered},
        "category_counts": {c: counts[c] for c in ordered},
        "total": total,
    }


@router.get("/templates", response_model=AdminTemplateListOut,
    summary="分页查询全部模板",
    description="管理员查询模板，包含未启用模板；支持编号、名称、描述关键词、启用状态、Premium 及分类筛选，按排序值和模板编号排列。",
    response_description="操作成功，返回结果详见响应结构",
)
async def list_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    q: str | None = None,
    is_active: bool | None = None,
    is_premium: bool | None = None,
    category: str | None = None,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminTemplateListOut:
    # All templates including inactive
    stmt = select(Template)
    count_stmt = select(func.count()).select_from(Template)
    if q and q.strip():
        like = f"%{q.strip()}%"
        filt = or_(Template.id.ilike(like), Template.name.ilike(like), Template.description.ilike(like))
        stmt = stmt.where(filt)
        count_stmt = count_stmt.where(filt)
    if is_active is not None:
        stmt = stmt.where(Template.is_active == is_active)
        count_stmt = count_stmt.where(Template.is_active == is_active)
    if is_premium is not None:
        stmt = stmt.where(Template.is_premium == is_premium)
        count_stmt = count_stmt.where(Template.is_premium == is_premium)
    if category and category.strip():
        cat = category.strip()
        cat_filter = cast(Template.category, JSONB).contains([cat])
        stmt = stmt.where(cat_filter)
        count_stmt = count_stmt.where(cat_filter)

    total = int((await db.execute(count_stmt)).scalar_one() or 0)
    result = await db.execute(
        stmt.order_by(Template.sort_order, Template.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [_admin_template_out(t) for t in result.scalars().all()]
    return AdminTemplateListOut(
        items=items, meta=PageMeta(page=page, page_size=page_size, total=total)
    )


@router.get("/templates/{template_id}", response_model=AdminTemplateOut,
    summary="查看模板管理详情",
    description="管理员按模板编号读取完整模板配置。模板不存在时返回 404。",
    response_description="操作成功，返回结果详见响应结构",
)
async def get_template(
    template_id: str,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminTemplateOut:
    tpl = await db.get(Template, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail=_("模板不存在"))
    return _admin_template_out(tpl)


@router.post("/templates", response_model=AdminTemplateOut,
    summary="创建创作模板",
    description="管理员创建模板并返回保存后的配置。模板编号已存在时返回 400。",
    response_description="操作成功，返回结果详见响应结构",
)
async def create_template(
    body: AdminTemplateCreate,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminTemplateOut:
    # Create a new template row
    existing = await db.get(Template, body.id)
    if existing:
        raise HTTPException(status_code=400, detail=_("模板 ID 已存在"))
    tpl = Template(**body.model_dump())
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return _admin_template_out(tpl)


@router.patch("/templates/{template_id}", response_model=AdminTemplateOut,
    summary="局部更新创作模板",
    description="管理员仅更新请求中显式提供的模板字段，包括启用状态和付费标记。模板不存在时返回 404。",
    response_description="操作成功，返回结果详见响应结构",
)
async def patch_template(
    template_id: str,
    body: AdminTemplatePatch,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminTemplateOut:
    # Partial update including is_active / is_premium
    tpl = await db.get(Template, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail=_("模板不存在"))
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(tpl, key, value)
    await db.commit()
    await db.refresh(tpl)
    return _admin_template_out(tpl)


@router.delete("/templates/{template_id}",
    summary="删除未被引用的模板",
    description="管理员删除指定模板，成功返回 {\"ok\": true}。模板不存在时返回 404；仍被科普项目引用时返回 400。",
    response_description="操作成功，返回结果详见响应结构",
)
async def delete_template(
    template_id: str,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Refuse delete when projects still reference the template
    tpl = await db.get(Template, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail=_("模板不存在"))
    used = int(
        (
            await db.execute(
                select(func.count()).select_from(Project).where(Project.template_id == template_id)
            )
        ).scalar_one()
        or 0
    )
    if used > 0:
        raise HTTPException(status_code=400, detail=_("模板仍被 {n} 个项目引用，无法删除", n=used))
    await db.delete(tpl)
    await db.commit()
    return {"ok": True}
