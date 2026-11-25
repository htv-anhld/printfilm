"""后端核心 i18n：语言归一、翻译回退、中间件语言头、项目 content_locale、任务 locale 传播。"""
from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import patch

import httpx
import pytest
from httpx import ASGITransport
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

import app.i18n as i18n
from app.i18n import _, get_locale, normalize_locale, translate, use_locale
from app.models_tasks import TaskRun
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate

from tests.conftest import make_task, make_user


# ---- normalize / translate ----


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("vi", "vi"),
        ("vi-VN", "vi"),
        ("en_US", "en"),
        ("EN", "en"),
        ("zh-CN,zh;q=0.9", "zh"),
        ("fr", "zh"),
        ("", "zh"),
        (None, "zh"),
    ],
)
def test_normalize_locale(raw, expected) -> None:
    assert normalize_locale(raw) == expected


def test_translate_zh_returns_source_and_interpolates() -> None:
    assert translate("项目不存在", "zh") == "项目不存在"
    assert translate("集 #{id}", "zh", id=3) == "集 #3"


def test_translate_en_vi_from_catalog() -> None:
    assert translate("项目不存在", "en") == "Project not found"
    assert translate("项目不存在", "vi") == "Dự án không tồn tại"
    assert translate("集 #{id}", "vi", id=7) == "Tập #7"


def test_translate_unknown_key_falls_back_to_source() -> None:
    assert translate("这条文案没有译文 {x}", "en", x=1) == "这条文案没有译文 1"


def test_translate_bad_placeholder_falls_back_to_source(monkeypatch: pytest.MonkeyPatch) -> None:
    """译文占位写错时退回中文原文插值，不抛 KeyError。"""
    broken = {"en": {"测试 {n} 项": "Test {count} items"}, "vi": {}}
    monkeypatch.setattr(i18n, "_catalogs", broken)
    assert translate("测试 {n} 项", "en", n=2) == "测试 2 项"


def test_underscore_uses_context_locale() -> None:
    assert get_locale() == "zh"
    assert _("任务不存在") == "任务不存在"
    with use_locale("en"):
        assert _("任务不存在") == "Task not found"
        with use_locale("vi-VN"):
            assert _("任务不存在") == "Tác vụ không tồn tại"
        assert get_locale() == "en"
    assert get_locale() == "zh"


def test_insufficient_balance_translations_keep_402_prefix() -> None:
    """余额不足类译文以「余额不足」译文开头 → http 映射仍返回 402。"""
    from app.services.billing.http import http_exception_for_value_error
    from app.services.billing.settlement import _insufficient

    for loc in ("zh", "en", "vi"):
        with use_locale(loc):
            exc = http_exception_for_value_error(ValueError(_insufficient(150, 20)))
            assert exc.status_code == 402, (loc, exc.detail)
            assert "1.50" in exc.detail and "0.20" in exc.detail


def test_format_exception_message_localized() -> None:
    from app.services.exc_format import format_exception_message

    class ConnectError(Exception):
        pass

    assert format_exception_message(ConnectError()).startswith("网络错误（ConnectError）")
    with use_locale("en"):
        assert format_exception_message(ConnectError()).startswith("Network error (ConnectError)")
        assert format_exception_message(RuntimeError()) == "RuntimeError: Unknown error"


# ---- 中间件：请求头 → HTTPException detail ----


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        ({}, "未登录"),
        ({"X-Locale": "en"}, "Not signed in"),
        ({"X-Locale": "vi"}, "Bạn chưa đăng nhập"),
        ({"Accept-Language": "vi-VN,vi;q=0.9"}, "Bạn chưa đăng nhập"),
        ({"X-Locale": "zh", "Accept-Language": "en"}, "未登录"),
    ],
)
async def test_middleware_translates_http_exception_detail(headers, expected) -> None:
    from app.main import app

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/projects", headers=headers)
    assert res.status_code == 401
    assert res.json()["detail"] == expected


# ---- 科普项目 content_locale ----


def test_project_schema_content_locale_validation() -> None:
    body = ProjectCreate(template_id="t", source_text="hello", content_locale="vi-VN")
    assert body.content_locale == "vi"
    assert ProjectCreate(template_id="t", source_text="hello").content_locale is None
    assert ProjectUpdate(content_locale="EN").content_locale == "en"
    with pytest.raises(ValidationError):
        ProjectCreate(template_id="t", source_text="hello", content_locale="fr")


async def _make_template(db: AsyncSession):
    from app.models import Template
    from app.services.creation_templates import DEFAULT_CREATION_TEMPLATE_ID

    # 创建项目只接受公开的创作模板 id（上游收口）；测试库里没有则临时插入
    tpl = await db.get(Template, DEFAULT_CREATION_TEMPLATE_ID)
    if tpl is None:
        tpl = Template(id=DEFAULT_CREATION_TEMPLATE_ID, name="i18n", style_prefix="x")
        db.add(tpl)
        await db.flush()
    tpl.is_active = True
    return tpl


@pytest.mark.asyncio
async def test_create_project_content_locale_defaults_to_request_locale(db_session: AsyncSession) -> None:
    from app.api.projects import create_project

    user = await make_user(db_session)
    tpl = await _make_template(db_session)

    with use_locale("vi"):
        project = await create_project(
            ProjectCreate(template_id=tpl.id, source_text="chủ đề thử"), db=db_session, user=user
        )
    assert project.content_locale == "vi"
    assert project.title == "Dự án chưa đặt tên"
    assert ProjectOut.model_validate(project).content_locale == "vi"

    with use_locale("vi"):
        explicit = await create_project(
            ProjectCreate(template_id=tpl.id, source_text="topic", content_locale="en", title="My video"),
            db=db_session,
            user=user,
        )
    assert explicit.content_locale == "en"
    assert explicit.title == "My video"

    # 无语言头（默认 zh）保持旧行为
    legacy = await create_project(ProjectCreate(template_id=tpl.id, source_text="科普"), db=db_session, user=user)
    assert legacy.content_locale == "zh"
    assert legacy.title == "未命名作品"


@pytest.mark.asyncio
async def test_update_project_content_locale(db_session: AsyncSession) -> None:
    from app.api.projects import create_project, update_project

    user = await make_user(db_session)
    tpl = await _make_template(db_session)
    project = await create_project(ProjectCreate(template_id=tpl.id, source_text="科普"), db=db_session, user=user)

    updated = await update_project(project.id, ProjectUpdate(content_locale="vi"), db=db_session, user=user)
    assert updated.content_locale == "vi"
    # 空字符串视为未指定，不覆盖
    updated = await update_project(project.id, ProjectUpdate(content_locale=""), db=db_session, user=user)
    assert updated.content_locale == "vi"


# ---- 任务 locale 传播 ----


@pytest.mark.asyncio
async def test_task_run_locale_defaults_to_context_locale(db_session: AsyncSession) -> None:
    user = await make_user(db_session)
    legacy = await make_task(db_session, user)
    assert legacy.locale == "zh"
    with use_locale("vi"):
        task = await make_task(db_session, user)
    assert task.locale == "vi"


@pytest.mark.asyncio
async def test_executor_writes_error_in_task_locale(db_session: AsyncSession) -> None:
    """后台执行没有请求上下文：错误文案按任务发起时的语言写入。"""
    from app.services.tasks.executor import execute_task_run
    from app.services.tasks.service import get_task_for_runtime

    user = await make_user(db_session)
    with use_locale("en"):
        task = await make_task(db_session, user, domain="api", task_type="v1_image", status="leased")
    await db_session.commit()
    task_id = int(task.id)

    @asynccontextmanager
    async def same_session():
        yield db_session

    assert get_locale() == "zh"
    with (
        patch("app.services.tasks.executor.AsyncSessionLocal", same_session),
        patch("app.services.tasks.executor.get_task_handler", return_value=None),
    ):
        await execute_task_run(task_id)
    assert get_locale() == "zh"

    db_session.expire_all()
    done = await get_task_for_runtime(db_session, task_id)
    assert done is not None
    assert done.status == "failed"
    assert done.error_message == "No task handler registered: api/v1_image"
    # 运行时加载不再预取 events（上游收口），单独查询事件表
    from sqlalchemy import select

    from app.models_tasks import TaskEvent

    messages = (await db_session.scalars(select(TaskEvent.message).where(TaskEvent.task_id == task_id))).all()
    assert "No task handler registered: api/v1_image" in messages


def test_task_text_uses_task_locale() -> None:
    from app.services.tasks.service import task_text

    task = TaskRun(locale="vi")
    assert task_text(task, "任务已被调度器领取") == "Tác vụ đã được bộ lập lịch nhận"
    assert task_text(TaskRun(locale=None), "任务已被调度器领取") == "任务已被调度器领取"
    assert task_text(None, "任务已被调度器领取") == "任务已被调度器领取"
