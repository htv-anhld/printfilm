/**
 * 任务可观测性的界面文案：taskObservability.ts 保持纯函数（测试按中文断言），
 * 界面展示一律经此处按当前语言取文案。
 */
import { tr } from "@/i18n";
import type { taskUpstream, UpstreamPhase } from "@/lib/taskObservability";

const UPSTREAM_STATE_GROUPS: Record<string, "queued" | "running" | "succeeded" | "failed" | "cancelled"> = {
  pending: "queued", queued: "queued", submitted: "queued", waiting: "queued",
  running: "running", processing: "running", generating: "running", in_progress: "running",
  succeeded: "succeeded", success: "succeeded", completed: "succeeded", done: "succeeded", finished: "succeeded",
  failed: "failed", error: "failed", failure: "failed", cancelled: "cancelled", canceled: "cancelled",
};

/** 上游请求阶段（开始请求 / 上游响应 …） */
export function upstreamPhaseText(phase: UpstreamPhase): string {
  return tr(`tasks.obs.phase.${phase}`);
}

/** 上游返回的任务状态归类后展示；未知状态原样带出（已脱敏） */
export function upstreamStateText(status: string): string {
  const group = UPSTREAM_STATE_GROUPS[status.toLowerCase()];
  return group ? tr(`tasks.obs.state.${group}`) : tr("tasks.obs.state.other", { status });
}

/** 列表 / 摘要里的「最近上游阶段」 */
export function upstreamSummaryText(summary: ReturnType<typeof taskUpstream>): string {
  const latest = summary.latest;
  if (latest?.upstreamStatus) return upstreamStateText(latest.upstreamStatus);
  if (latest) return upstreamPhaseText(latest.phase);
  return summary.providerTaskId ? tr("tasks.obs.providerOnly") : tr("tasks.obs.noUpstream");
}

/** 毫秒 → 本地化时长；空值显示「未记录」 */
export function taskDurationText(milliseconds: number | null | undefined): string {
  if (milliseconds == null || !Number.isFinite(milliseconds)) return tr("tasks.detail.notRecorded");
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return tr("tasks.runtime.secs", { s: seconds });
  if (seconds < 3600) return tr("tasks.runtime.minsSecs", { m: Math.floor(seconds / 60), s: seconds % 60 });
  return tr("tasks.runtime.hoursMins", { h: Math.floor(seconds / 3600), m: Math.floor((seconds % 3600) / 60) });
}

/** 任务计费状态说明（未预扣 / 已冻结 / 已结算 …） */
export function taskBillingText(status: string | null | undefined): string {
  if (!status) return tr("tasks.obs.billing.unknown");
  return ["none", "frozen", "settled", "skipped"].includes(status) ? tr(`tasks.obs.billing.${status}`) : status;
}

/** 队列类型名（文字 / 图片 / 视频） */
export function queueTypeText(queueType: string): string {
  return ["text", "image", "video"].includes(queueType) ? tr(`tasks.obs.queueType.${queueType}`) : queueType;
}

/** 调度队列名称：后端 label 为中文，按队列 key 本地化，未知 key 回退后端 label */
export function queueLaneText(name: string, fallback: string): string {
  return ["text", "image", "video"].includes(name) ? tr(`tasks.obs.lane.${name}`) : fallback;
}
