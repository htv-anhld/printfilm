"""任务列表瘦身：只留最近事件且去掉事件 payload。"""
from types import SimpleNamespace

from app.api.tasks import LIST_EVENTS_LIMIT, list_task_summary, public_task


def _task(n_events: int):
    events = [
        SimpleNamespace(id=i, event_type="upstream.request.started", message=f"m{i}", payload={"body": "x" * 1000})
        for i in reversed(range(1, n_events + 1))
    ]
    return SimpleNamespace(id=1, domain="drama", task_type="asset_image", status="running", priority=100,
                           requested_by=2, team_id=None, events=events, steps=[], targets=[])


def test_list_summary_keeps_latest_events_without_payload():
    out = list_task_summary(public_task(_task(12)))
    assert [e.id for e in out.events] == list(range(12 - LIST_EVENTS_LIMIT + 1, 13))
    assert all(e.payload is None for e in out.events)


def test_detail_output_untouched():
    out = public_task(_task(12))
    assert len(out.events) == 12 and out.events[0].payload
