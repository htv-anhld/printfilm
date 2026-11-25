"""角色判重：称谓 / 括号注记变体视为同一角色；合并重复资产时改写分镜里的 @asset 引用。"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models_drama import DramaAsset, DramaEpisode, DramaEpisodeFragment, DramaProject
from app.services.drama.seed import (
    _extract_cast_names_from_bodies,
    character_identity_key,
    merge_duplicate_library_assets,
)
from tests.conftest import make_user


def test_identity_key_merges_titles_and_parentheses_only():
    """Tiến sĩ / Đội trưởng / Dr. 与括号注记去掉；Anh Tuấn 这类可能是真名的不动。"""
    assert character_identity_key("Tiến sĩ Dương Vĩnh Thụy") == character_identity_key("Dương Vĩnh Thụy")
    assert character_identity_key("Đội trưởng Vũ-9") == "vũ-9"
    assert character_identity_key("Minh (hình chiếu ký ức)") == character_identity_key("Minh")
    assert character_identity_key("Dr. Elena Park") == "elena park"
    assert character_identity_key("Anh Tuấn") == "anh tuấn"
    assert character_identity_key("Ông") == "ông"


def test_cast_extraction_keeps_first_spelling_per_identity():
    """出场人物行里同一人不同写法只保留首次出现的写法。"""
    bodies = [
        "出场人物：Đội trưởng Vũ-9、Linh\n△ ...",
        "出场人物：Vũ-9、Tiến sĩ Dương Vĩnh Thụy、Dương Vĩnh Thụy\n△ ...",
    ]
    assert _extract_cast_names_from_bodies(bodies) == ["Đội trưởng Vũ-9", "Linh", "Tiến sĩ Dương Vĩnh Thụy"]


@pytest.mark.asyncio
async def test_merge_duplicates_rewrites_fragment_mentions(db_session: AsyncSession):
    """合并「Vũ-9」与「Đội trưởng Vũ-9」：保留有图的一条，分镜里引用被删那条的 @asset 改指保留项。"""
    user = await make_user(db_session)
    project = DramaProject(user_id=user.id, title="dedupe")
    db_session.add(project)
    await db_session.flush()
    keep = DramaAsset(project_id=project.id, type="character", name="Vũ-9", url="/static/a.png", cover="/static/a.png")
    dup = DramaAsset(project_id=project.id, type="character", name="Đội trưởng Vũ-9")
    other = DramaAsset(project_id=project.id, type="character", name="Linh")
    db_session.add_all([keep, dup, other])
    await db_session.flush()
    ep = DramaEpisode(project_id=project.id, name="Tập 1")
    db_session.add(ep)
    await db_session.flush()
    frag = DramaEpisodeFragment(
        episode_id=ep.id,
        sort_order=0,
        duration_sec=8,
        content=f"@asset:{dup.id}（lạnh lùng）：Lõi ký ức. @asset:{other.id} gật đầu. @asset:{dup.id}0",
    )
    db_session.add(frag)
    await db_session.flush()

    removed = await merge_duplicate_library_assets(db_session, project.id)
    await db_session.flush()
    await db_session.refresh(frag)

    assert removed == 1
    assert f"@asset:{keep.id}（lạnh lùng）" in frag.content
    assert f"@asset:{other.id} gật đầu" in frag.content
    # 只替换完整 id，不误伤以它开头的更长数字
    assert frag.content.endswith(f"@asset:{dup.id}0")
