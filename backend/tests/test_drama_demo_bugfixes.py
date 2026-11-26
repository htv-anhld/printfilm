"""漫剧演示回归：vi 分镜整集上限、口播按词切分、导入集自动分镜、上传剧本片名。"""

from types import SimpleNamespace

import pytest

from app.services.drama.content_locale import use_content_locale
from app.services.drama.episode_length import set_episode_length_from_project
from app.services.drama.episode_plan_skip import clear_episode_plan_skip, record_episode_plan_skip
from app.services.drama.fragment_budget import (
    draft_duration_sec,
    llm_episode_budget_caps,
    trim_episode_fragment_drafts,
)
from app.services.drama.fragment_dialogue import timed_spoken_lines
from app.services.drama.script_import import derive_script_title, humanize_filename_title, split_script_episodes
from app.services.drama.seed import EpisodeBodyTooShortError, require_confirmable_episode_body


@pytest.fixture(autouse=True)
def _default_episode_length():
    """每个用例都从默认短剧规格开始。"""
    set_episode_length_from_project(SimpleNamespace(params={}))
    yield
    set_episode_length_from_project(SimpleNamespace(params={}))


# ---------- 1. 整集镜数 / 时长上限 ----------


def test_budget_caps_zh_unlimited_vi_default_spec():
    """zh 默认规格保持上游不设上限；vi/en 按 DEFAULT_SPEC ≤10 镜 / 90 秒；长集两者都按规格。"""
    with use_content_locale("zh"):
        assert llm_episode_budget_caps() == (0, 0)
    with use_content_locale("vi"):
        assert llm_episode_budget_caps() == (10, 90)
    with use_content_locale("en"):
        assert llm_episode_budget_caps() == (10, 90)
    set_episode_length_from_project(SimpleNamespace(params={"episode_duration_sec": 180}))
    with use_content_locale("zh"):
        assert llm_episode_budget_caps() == (23, 206)


def test_vi_19_fragments_trimmed_to_cap_and_budget():
    """演示复现：19 镜约 194 秒 → 合并后 ≤10 镜、总时长 ≤90 秒，台词全部保留。"""
    durations = [10, 12, 9, 11, 10, 8, 12, 10, 11, 9, 10, 12, 8, 11, 10, 9, 12, 10, 10]
    assert sum(durations) == 194
    drafts = [
        {
            "content": f"@duration:{d}\n【对白·慢速清晰】Thanh Nguyệt：Câu thoại số {i}.",
            "duration_sec": d,
            "asset_ids": [],
            "scene_name": "Cầu đá" if i < 10 else "Y quán",
            "character_names": [],
            "is_opening": i == 0,
        }
        for i, d in enumerate(durations)
    ]
    with use_content_locale("vi"):
        max_count, max_total = llm_episode_budget_caps()
        out = trim_episode_fragment_drafts(drafts, max_count=max_count, max_total_sec=max_total)
    assert len(out) <= 10
    assert sum(draft_duration_sec(d) for d in out) <= 90
    joined = "\n".join(d["content"] for d in out)
    for i in range(len(durations)):
        assert f"Câu thoại số {i}." in joined


def test_zh_default_spec_keeps_all_fragments():
    """zh 不受新上限影响：15 条短镜全部保留。"""
    drafts = [
        {"content": f"@duration:8\n镜{i}内容。", "duration_sec": 8, "asset_ids": [], "scene_name": "教室", "character_names": []}
        for i in range(15)
    ]
    with use_content_locale("zh"):
        max_count, max_total = llm_episode_budget_caps()
        assert len(trim_episode_fragment_drafts(drafts, max_count=max_count, max_total_sec=max_total)) == 15


def test_vi_prompt_states_episode_cap():
    """vi 用户提示写明整集条数/总时长上限；zh 保持「不设上限」。"""
    from app.services.drama.fragment_plan_prompt import build_fragment_plan_user_prompt

    kwargs = dict(episode_name="Tập 1", episode_body="Thanh Nguyệt bước qua cầu.", asset_catalog=[])
    with use_content_locale("vi"):
        prompt = build_fragment_plan_user_prompt(**kwargs)
        assert "不得超过 10 条" in prompt and "约 90 秒" in prompt
    with use_content_locale("zh"):
        prompt = build_fragment_plan_user_prompt(**kwargs)
        assert "不设整集条数/总时长上限" in prompt and "不得超过 10 条" not in prompt


# ---------- 3. 口播按词边界切分 ----------

_VI_VO = (
    "旁白（VO）：Truyền thuyết kể rằng, vào thời xa xưa, có một vị thần nhân hậu đã cứu một vị tướng trẻ "
    "bị thương nặng, dấu vết ông tích nằm dưới cầu đá cổ suốt trăm năm, cho đến khi người con gái thầy "
    "thuốc tìm thấy chàng trong đêm mưa và mang về y quán chữa trị."
)


def _vo_text(line: str) -> str:
    return line.split("：", 1)[1]


def test_vi_narration_splits_on_word_boundaries():
    """vi 旁白拆段不得切断单词，拼回后与原文逐词一致。"""
    source_words = _vo_text(_VI_VO).split()
    with use_content_locale("vi"):
        parts = timed_spoken_lines(_VI_VO, {})
    assert parts is not None and len(parts) >= 2
    rebuilt: list[str] = []
    for seconds, line in parts:
        assert line.startswith("旁白（VO）：")
        text = _vo_text(line)
        assert text == text.strip() and text
        rebuilt.extend(text.split())
        assert 3 <= seconds <= 12
    assert rebuilt == source_words


def test_vi_narration_prefers_sentence_punctuation():
    """有逗号/句号可断时优先在句读处断开。"""
    line = "旁白（VO）：" + " ".join(["Mưa rơi trên mái ngói cũ kỹ của y quán nhỏ."] * 6)
    with use_content_locale("vi"):
        parts = timed_spoken_lines(line, {})
    assert parts and len(parts) >= 2
    for _, text in parts[:-1]:
        assert text.rstrip().endswith((".", ","))


def test_vi_speech_seconds_word_based():
    """vi 时长按词计（约 2.5 词/秒），不再按字母数把短台词估成十几秒。"""
    with use_content_locale("vi"):
        parts = timed_spoken_lines("【对白·慢速清晰】@asset:73：Công tử... công tử còn tỉnh không?", {73: "Thanh Nguyệt"})
    assert parts == [(3, "【对白·慢速清晰】@asset:73：Công tử... công tử còn tỉnh không?")]


def test_zh_narration_still_char_based():
    """zh 保持按字切分（每秒约 3 字、单段 ≤12 秒）。"""
    line = "旁白（VO）：" + "很久很久以前，" * 10
    with use_content_locale("zh"):
        parts = timed_spoken_lines(line, {})
    assert parts is not None and len(parts) == 2
    assert "".join(_vo_text(p[1]) for p in parts) == "很久很久以前，" * 10


# ---------- 2. 导入集 / 过短跳过记录 ----------


def _content(origin: str, body: str) -> dict:
    return {"episodes": [{"episodeNumber": 2, "title": "Tập 2", "body": body, "origin": origin}]}


def test_imported_short_episode_is_confirmable():
    """上传导入的集（约 270 词）是完整剧本：自动/手动分镜都放行。"""
    body = " ".join(["lời"] * 270)
    with use_content_locale("vi"):
        item = require_confirmable_episode_body(_content("import", body), 2)
    assert item["origin"] == "import"


def test_short_generated_episode_raises_with_units():
    """非导入的短正文仍拒绝，并带上篇幅与阈值供任务记录。"""
    body = " ".join(["lời"] * 270)
    with use_content_locale("vi"), pytest.raises(EpisodeBodyTooShortError) as info:
        require_confirmable_episode_body(_content("auto", body), 2)
    assert info.value.units == 432 and info.value.min_units == 450
    assert isinstance(info.value, ValueError)


def test_plan_skip_record_and_clear():
    """跳过记录按集号写入 script.params，带当时的分集版本；建分集成功后清除。"""
    script = SimpleNamespace(params={"episode_versions": {"2": 3}, "summary_status": "completed"})
    entry = record_episode_plan_skip(script, 2, reason="quá ngắn", units=432, min_units=450)
    assert entry["status"] == "skipped" and entry["version"] == 3
    assert script.params["episode_plan_skips"]["2"]["min_units"] == 450
    assert script.params["summary_status"] == "completed"
    assert clear_episode_plan_skip(script, 2) is True
    assert "episode_plan_skips" not in script.params
    assert clear_episode_plan_skip(script, 2) is False


# ---------- 4. 上传剧本片名 ----------

_VI_SCRIPT = "TRÂM HOA LÊ\n\nTập 1: Đêm mưa\nThanh Nguyệt bước qua cầu.\n\nTập 2: Hoa lê nở\nCảnh Hành trở về."


def test_title_from_heading_line_before_episode_one():
    header, _ = split_script_episodes(_VI_SCRIPT)
    assert derive_script_title(header, _VI_SCRIPT, "tram_hoa_le.txt") == "Trâm Hoa Lê"


def test_title_from_label_line():
    text = "Tên phim: Trâm Hoa Lê\nThể loại: cổ trang\n\nTập 1\nNội dung."
    header, _ = split_script_episodes(text)
    assert derive_script_title(header, text, "x.txt") == "Trâm Hoa Lê"
    zh = "剧名：《梨花簪》\n\n第1集\n正文。"
    header, _ = split_script_episodes(zh)
    assert derive_script_title(header, zh, "a.txt") == "梨花簪"
    zh2 = "梨花簪\n\n第1集 雨夜\n正文。"
    header, _ = split_script_episodes(zh2)
    assert derive_script_title(header, zh2, "a.txt") == "梨花簪"


def test_title_falls_back_to_humanized_filename():
    """无集标题（整篇即第 1 集）且无片名标签：回退人性化文件名。"""
    text = "Mưa phùn giăng kín mặt sông, Thanh Nguyệt bước vội qua cầu đá."
    assert derive_script_title("", text, "tram_hoa_le.txt") == "Tram Hoa Le"
    assert humanize_filename_title("my-script.v2.md") == "My Script V2"
    assert humanize_filename_title("剧本_第一版.docx") == "剧本 第一版"
    assert humanize_filename_title("") == ""


async def test_plan_fragments_with_llm_vi_enforces_cap(monkeypatch):
    """端到端（假模型）：vi 项目模型返回 19 镜 → 落库草稿 ≤10 镜、≤90 秒。"""
    import app.services.drama.fragment_plan as fp

    async def fake_run_task_json(db, user_id, *, task, system, user, temperature, skill_ids):
        assert "不得超过 10 条" in user
        return {
            "fragments": [
                {
                    "duration_sec": 10,
                    "scene_name": "",
                    "is_opening": i == 0,
                    "lines": [
                        f"Toàn cảnh: Mưa phùn giăng kín mặt sông, cảnh số {i}, đèn y quán le lói phía xa.",
                        f"旁白（VO）：Đêm ấy là đêm thứ {i}, mưa rơi không ngớt trên cây cầu đá cổ.",
                    ],
                }
                for i in range(19)
            ]
        }

    monkeypatch.setattr(fp, "run_task_json", fake_run_task_json)
    with use_content_locale("vi"):
        drafts = await fp.plan_fragments_with_llm(
            episode_name="Đêm mưa",
            episode_body="Thanh Nguyệt bước qua cầu trong đêm mưa.",
            assets=[],
            episode_number=1,
            project_title="Trâm Hoa Lê",
        )
    assert 1 <= len(drafts) <= 10
    assert sum(draft_duration_sec(d) for d in drafts) <= 90
    joined = "\n".join(d["content"] for d in drafts)
    assert "đêm thứ 18" in joined and "【片头·剧名叠字】Trâm Hoa Lê" in joined
