"""一次性迁移：本分支旧版席位团队占用了 teams / team_members / team_invites 表名。

与上游合并后，teams 等表名归上游团队模型所有（drama_projects.team_id 等外键指向它），
本分支的席位团队改用 seat_teams / seat_team_members / seat_team_invites。
必须在 create_all 之前执行：检测到旧结构（teams 有 seats 列、没有 owner_user_id 列）时，
把三张表连同主键、索引、序列一起改名，数据原样保留；之后 create_all 再按上游结构新建 teams 等表。
不满足条件（新库或已迁移）时什么都不做，可重复执行。
"""
from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)

_TABLES = (
    ("team_invites", "seat_team_invites"),
    ("team_members", "seat_team_members"),
    ("teams", "seat_teams"),
)


async def _columns(conn: AsyncConnection, table: str) -> set[str]:
    """读取 public 下某表的列名；表不存在返回空集。"""
    rows = await conn.execute(
        text("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :t"),
        {"t": table},
    )
    return {r[0] for r in rows.fetchall()}


async def _relations_of(conn: AsyncConnection, table: str) -> list[tuple[str, str]]:
    """列出属于某表的全部索引（含主键/唯一约束）与 id 序列，用于跟随改名。"""
    rows = await conn.execute(
        text(
            """
            SELECT i.relname, 'i' FROM pg_index x
            JOIN pg_class i ON i.oid = x.indexrelid
            JOIN pg_class t ON t.oid = x.indrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = :t
            UNION ALL
            SELECT c.relname, 'S' FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname = :seq
            """
        ),
        {"t": table, "seq": f"{table}_id_seq"},
    )
    return [(r[0], r[1]) for r in rows.fetchall()]


def _renamed(rel: str, old: str, new: str) -> str:
    """附属对象新名字：名字里含旧表名则替换，否则加 seat_ 前缀。"""
    if old in rel:
        return rel.replace(old, new, 1)
    return f"seat_{rel}"


async def migrate_legacy_seat_teams(conn: AsyncConnection) -> bool:
    """旧席位团队表改名为 seat_*；返回是否执行了迁移（仅 PostgreSQL）。"""
    if conn.dialect.name != "postgresql":
        return False
    cols = await _columns(conn, "teams")
    if not cols or "seats" not in cols or "owner_user_id" in cols:
        return False
    if await _columns(conn, "seat_teams"):
        # 新表可能已被 create_all 建好但仍为空：确认三张都没有数据才清掉，有数据则交给人工处理
        for _old, seat in _TABLES:
            if await _columns(conn, seat):
                count = (await conn.execute(text(f'SELECT count(*) FROM "{seat}"'))).scalar_one()
                if int(count or 0) > 0:
                    logger.warning("teams 为旧席位结构但 %s 已有数据，跳过自动迁移，请人工处理", seat)
                    return False
        for _old, seat in _TABLES:
            await conn.execute(text(f'DROP TABLE IF EXISTS "{seat}"'))
    for old, new in _TABLES:
        if not await _columns(conn, old):
            continue
        # 先改名附属对象（索引含主键、序列），避免与上游新表的同名对象冲突
        for rel, kind in await _relations_of(conn, old):
            stmt = "ALTER SEQUENCE" if kind == "S" else "ALTER INDEX"
            await conn.execute(text(f'{stmt} "{rel}" RENAME TO "{_renamed(rel, old, new)}"'))
        await conn.execute(text(f'ALTER TABLE "{old}" RENAME TO "{new}"'))
    logger.info("已把旧席位团队表迁移为 seat_teams / seat_team_members / seat_team_invites")
    return True


async def repoint_team_foreign_keys(conn: AsyncConnection) -> int:
    """改名后，非席位表上原本指向旧 teams 的外键会跟着指向 seat_teams；建表后把它们改回指向上游 teams。

    用 NOT VALID 重建，避免历史数据里的旧团队编号阻塞启动；返回处理的外键数量（仅 PostgreSQL）。
    """
    if conn.dialect.name != "postgresql" or not await _columns(conn, "seat_teams") or not await _columns(conn, "teams"):
        return 0
    rows = await conn.execute(
        text(
            """
            SELECT c.conname, t.relname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_class r ON r.oid = c.confrelid
            WHERE c.contype = 'f' AND r.relname IN ('seat_teams', 'seat_team_members')
              AND t.relname NOT IN ('seat_teams', 'seat_team_members', 'seat_team_invites')
            """
        )
    )
    fixed = 0
    for conname, table, definition in rows.fetchall():
        target = definition.replace("seat_team_members(", "team_members(").replace("seat_teams(", "teams(")
        await conn.execute(text(f'ALTER TABLE "{table}" DROP CONSTRAINT "{conname}"'))
        await conn.execute(text(f'ALTER TABLE "{table}" ADD CONSTRAINT "{conname}" {target} NOT VALID'))
        fixed += 1
    if fixed:
        logger.info("已把 %s 个外键从 seat_teams 改回指向 teams", fixed)
    return fixed
