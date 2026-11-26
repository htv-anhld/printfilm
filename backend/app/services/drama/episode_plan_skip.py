"""分集自动分镜被跳过的记录：写在 DramaScript.params["episode_plan_skips"]，供大纲页显示可操作的提示。

跳过时还没有 DramaEpisode 行（正文过短，建行即失败），所以记在剧本上，按集号索引：
``{"2": {"status": "skipped", "reason": "...", "units": 432, "min_units": 450, "version": 3}}``。
``version`` 为记录时的分集内容版本（params.episode_versions），正文再保存后版本变化，前端即不再显示旧提示。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

PLAN_SKIPS_KEY = "episode_plan_skips"


def _episode_version(params: dict[str, Any], episode_number: int) -> int:
    """读取分集内容版本（缺省 0）。"""
    versions = params.get("episode_versions") if isinstance(params.get("episode_versions"), dict) else {}
    try:
        return int((versions or {}).get(str(episode_number), 0))
    except (TypeError, ValueError):
        return 0


def record_episode_plan_skip(
    script: Any,
    episode_number: int,
    *,
    reason: str,
    units: int | None = None,
    min_units: int | None = None,
    status: str = "skipped",
) -> dict[str, Any]:
    """
    记录某集自动分镜跳过/失败的原因（覆盖同集旧记录），返回写入的条目。
    script：DramaScript ORM 对象；整体替换 params 以触发 JSON 变更检测。
    """
    params = dict(script.params or {}) if isinstance(script.params, dict) else {}
    skips = dict(params.get(PLAN_SKIPS_KEY) or {}) if isinstance(params.get(PLAN_SKIPS_KEY), dict) else {}
    entry: dict[str, Any] = {
        "status": status,
        "reason": str(reason or "")[:500],
        "version": _episode_version(params, int(episode_number)),
        "at": datetime.now(UTC).isoformat(),
    }
    if units is not None:
        entry["units"] = int(units)
    if min_units is not None:
        entry["min_units"] = int(min_units)
    skips[str(int(episode_number))] = entry
    params[PLAN_SKIPS_KEY] = skips
    script.params = params
    return entry


def clear_episode_plan_skip(script: Any, episode_number: int) -> bool:
    """建分集成功后清除该集的跳过记录；有改动返回 True。"""
    params = dict(script.params or {}) if isinstance(script.params, dict) else {}
    skips = params.get(PLAN_SKIPS_KEY)
    if not isinstance(skips, dict) or str(int(episode_number)) not in skips:
        return False
    skips = dict(skips)
    skips.pop(str(int(episode_number)), None)
    if skips:
        params[PLAN_SKIPS_KEY] = skips
    else:
        params.pop(PLAN_SKIPS_KEY, None)
    script.params = params
    return True
