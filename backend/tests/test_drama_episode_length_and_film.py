"""单集时长规格（长集放宽分镜上限与篇幅）与整部成片的集序收集。"""

from types import SimpleNamespace

from app.services.drama.episode_length import (
    DEFAULT_SPEC,
    adapt_episode_prompt,
    episode_length_spec,
    set_episode_length_from_project,
)
from app.services.drama.film_compose import collect_film_clips
from app.services.drama.fragment_budget import cap_llm_fragment_items
from app.services.drama.output_settings import clean_project_generation_params


def test_default_spec_keeps_short_drama_rules():
    """未设置或 ≤90 秒保持原规格：≤10 镜、60–90 秒、450-600 字。"""
    assert episode_length_spec(None) is DEFAULT_SPEC
    assert episode_length_spec(90) is DEFAULT_SPEC
    prompt = "整集 fragments 不得超过 10 条，目标成片 60–90 秒；整集 content 约 450-600 汉字"
    assert adapt_episode_prompt(prompt, DEFAULT_SPEC) == prompt


def test_three_minute_episode_scales_prompt_and_limits():
    """3 分钟一集：约 23 镜、正文约 1170-1440 字，提示词随之改写。"""
    spec = episode_length_spec(180)
    assert spec.fragment_max == 23
    assert (spec.chars_min, spec.chars_max) == (1170, 1440)
    out = adapt_episode_prompt("不得超过 10 条（含开幕镜），目标 60–90 秒；每集 2-3 场；约 450-600 汉字", spec)
    assert "不得超过 23 条" in out and "153–198 秒" in out and "1170-1440 汉字" in out and "2-3 场" not in out


def test_fragment_cap_follows_project_duration():
    """LLM 分镜条数上限跟随项目单集时长（上下文变量）。"""
    items = [{"lines": [f"空镜：{i}"], "duration_sec": 8} for i in range(30)]
    set_episode_length_from_project(SimpleNamespace(params={}))
    assert len(cap_llm_fragment_items(list(items))) == 10
    set_episode_length_from_project(SimpleNamespace(params={"episode_duration_sec": 180}))
    assert len(cap_llm_fragment_items(list(items))) == 23
    set_episode_length_from_project(SimpleNamespace(params={}))


def test_clean_params_normalizes_episode_duration():
    """非法 / ≤90 的单集时长丢弃；超长钳到 600 秒。"""
    assert clean_project_generation_params({"episode_duration_sec": 0}) == {}
    assert clean_project_generation_params({"episode_duration_sec": "180"}) == {"episode_duration_sec": 180}
    assert clean_project_generation_params({"episode_duration_sec": 9999}) == {"episode_duration_sec": 600}


def test_collect_film_clips_orders_by_episode_number_and_skips_empty():
    """按集号 → 镜序收集视频；没有视频的集记入 skipped。"""

    def frag(order, video):
        return SimpleNamespace(sort_order=order, id=order + 1, video=video)

    ep2 = SimpleNamespace(id=10, params={"episodeNumber": 2}, fragments=[frag(1, "/b2.mp4"), frag(0, "/b1.mp4")])
    ep1 = SimpleNamespace(id=11, params={"episodeNumber": 1}, fragments=[frag(0, "/a1.mp4")])
    ep3 = SimpleNamespace(id=12, params={"episodeNumber": 3}, fragments=[frag(0, "")])
    urls, included, skipped = collect_film_clips([ep2, ep3, ep1])
    assert urls == ["/a1.mp4", "/b1.mp4", "/b2.mp4"]
    assert included == [1, 2] and skipped == [3]


async def test_long_episode_plan_retries_when_too_short(monkeypatch):
    """长集首轮分镜合计时长不足 85% 时带反馈重拆一次，取更长的结果；默认规格不重拆。"""
    import app.services.drama.fragment_plan as fp

    calls = []

    async def fake_run_task_json(db, user_id, *, task, system, user, temperature, skill_ids):
        calls.append(user)
        return {"fragments": [{"lines": ["空镜：x"], "duration_sec": 12} for _ in range(15)]}

    monkeypatch.setattr(fp, "run_task_json", fake_run_task_json)
    short = [{"lines": ["空镜：x"], "duration_sec": 10} for _ in range(8)]

    set_episode_length_from_project(SimpleNamespace(params={"episode_duration_sec": 180}))
    out = await fp._retry_if_long_episode_too_short(list(short), db=None, user_id=None, user_prompt="P", skill_ids=None)
    assert len(out) == 15 and len(calls) == 1 and "上一版不合格" in calls[0]

    set_episode_length_from_project(SimpleNamespace(params={}))
    out = await fp._retry_if_long_episode_too_short(list(short), db=None, user_id=None, user_prompt="P", skill_ids=None)
    assert out == short and len(calls) == 1
