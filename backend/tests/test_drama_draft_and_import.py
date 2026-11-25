"""Draft 样片（Seedance 2.5）与上传剧本分集。"""

import io
import zipfile
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.services.drama.generation import (
    is_draft_capable_model,
    prepare_fragment_finalize,
    read_fragment_draft,
)
from app.services.drama.script_import import extract_script_text, split_script_episodes
from app.services.tokenfree_video import wrap_seedance_payload_for_newapi

SCRIPT = (
    "PHIM: Trạm cuối\n\n"
    "TẬP 1: Tín hiệu lạ\n" + "An tỉnh dậy trên trạm vũ trụ bỏ hoang. " * 4 + "\n\n"
    "Tập 2 - Liên lạc\n" + "Bình nhận được tín hiệu từ Trái Đất. " * 4
)


def test_draft_capable_only_seedance_25():
    """只有 Seedance 2.5 正式版支持 Draft。"""
    assert is_draft_capable_model("doubao-seedance-2-5-260628")
    assert is_draft_capable_model("seedance-2.5")
    assert not is_draft_capable_model("seedance-2.0-fast")
    assert not is_draft_capable_model("seedance-2-0")
    assert not is_draft_capable_model("")


def test_tokenfree_wrapper_forwards_draft_flag():
    """TokenFree 包装要把 draft 写进 metadata（上游已取消 metadata.input 嵌套）。"""
    out = wrap_seedance_payload_for_newapi(
        {"model": "seedance-2-5", "content": [{"type": "text", "text": "hi"}], "draft": True}
    )
    assert out["metadata"]["draft"] is True
    assert "input" not in out["metadata"]


def test_finalize_body_references_draft_task():
    """转正片请求只带 draft_task，清晰度 1080p。"""
    frag = SimpleNamespace(duration_sec=6, params={})
    prepared = prepare_fragment_finalize(
        SimpleNamespace(params={}), frag, draft_task_id="cgt-1", model_id="seedance-2.5", aspect_ratio="9:16"
    )
    body = prepared.seedance_body
    assert body["content"] == [{"type": "draft_task", "draft_task": {"id": "cgt-1"}}]
    assert body["resolution"] == "1080p" and prepared.resolution == "1080p"
    assert "draft" not in body


def test_read_fragment_draft_expires_after_7_days():
    """样片 7 天后视为不可用。"""
    fresh = SimpleNamespace(params={"draft": {"task_id": "t1", "created_at": datetime.now(UTC).isoformat()}})
    old = SimpleNamespace(
        params={"draft": {"task_id": "t1", "created_at": (datetime.now(UTC) - timedelta(days=8)).isoformat()}}
    )
    assert read_fragment_draft(fresh)["task_id"] == "t1"
    assert read_fragment_draft(old) is None
    assert read_fragment_draft(SimpleNamespace(params={})) is None


def test_split_keeps_original_text_per_episode():
    """按「TẬP 1 / Tập 2」切分，正文原样保留，片头单独返回。"""
    header, eps = split_script_episodes(SCRIPT)
    assert header == "PHIM: Trạm cuối"
    assert [e["title"] for e in eps] == ["Tín hiệu lạ", "Liên lạc"]
    assert eps[1]["body"].startswith("Bình nhận được")


def test_extract_docx_and_txt():
    """docx 按段落取文本；txt 支持 UTF-8 BOM。"""
    paras = "".join(
        f"<w:p><w:r><w:t>{line}</w:t></w:r></w:p>" for line in SCRIPT.split("\n")
    )
    xml = (
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{paras}</w:body></w:document>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", xml)
    docx_text = extract_script_text("a.docx", buf.getvalue())
    assert "TẬP 1: Tín hiệu lạ" in docx_text
    assert len(split_script_episodes(docx_text)[1]) == 2
    assert extract_script_text("a.txt", ("﻿" + SCRIPT).encode("utf-8")).startswith("PHIM")


def test_extract_rejects_bad_files():
    """不支持的格式与过短内容报错。"""
    with pytest.raises(ValueError):
        extract_script_text("a.exe", b"x" * 500)
    with pytest.raises(ValueError):
        extract_script_text("a.txt", "quá ngắn".encode())


def test_imported_short_episodes_count_as_complete():
    """上传剧本的集再短也算完成，自动流水线不得补写/改写。"""
    from app.services.drama.agents import auto_missing_episode_numbers, count_completed_episodes

    eps = [
        {"episodeNumber": 1, "title": "Tập 1", "body": "An tỉnh dậy.", "origin": "import"},
        {"episodeNumber": 2, "title": "Tập 2", "body": "", "origin": "import"},
    ]
    assert count_completed_episodes(eps, 2) == 1
    assert auto_missing_episode_numbers(eps, 2) == [2]
