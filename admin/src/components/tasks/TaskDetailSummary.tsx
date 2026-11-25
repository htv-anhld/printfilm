import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { AdminTaskDetail } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { taskBilling, taskDurations, taskStatusTone, taskUpstream } from "@/lib/taskObservability";
import { taskStatusLabel } from "@/lib/statusLabels";
import { cn } from "@/lib/utils";
import { money as formatMoney } from "@/lib/money";
import { tr } from "@/i18n";
import { queueTypeText, taskDurationText as formatTaskDuration, upstreamSummaryText } from "@/lib/taskObservabilityText";

type TaskDetailSummaryProps = {
  task: AdminTaskDetail;
  now: number;
  onJump: (tab: "upstream" | "billing") => void;
};

function money(value: number | null | undefined): string {
  return value == null ? "—" : formatMoney(value);
}

// 可复制的等宽文本，长 ID 截断显示、完整值放 title
export function CopyText({ value, className }: { value: string; className?: string }) {
  async function copy(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      toast.success(tr("tasks.obs.copied"));
    } catch {
      toast.error(tr("tasks.obs.copyFailed"));
    }
  }
  return (
    <span className={cn("task-copy", className)} title={value}>
      <span className="truncate">{value}</span>
      <button type="button" aria-label={tr("tasks.obs.copy")} onClick={(e) => void copy(e)}>
        <Copy className="h-3 w-3" />
      </button>
    </span>
  );
}

// 详情弹窗顶部关键指标条：切换标签页时始终可见，概览不再重复这些信息
export function TaskDetailSummary({ task, now, onJump }: TaskDetailSummaryProps) {
  const tone = taskStatusTone(task.status);
  const duration = taskDurations(task, now);
  const billing = taskBilling(task);
  const upstream = taskUpstream(task);
  const waitingActivation = task.status === "pending" && task.next_action_at === null;
  const charged = billing.settled || (billing.chargedFen ?? 0) > 0;
  return (
    <div className={cn("task-summary", `is-${tone}`)}>
      <div className="task-summary-item">
        <span className="task-summary-label">{tr("tasks.obs.status")}</span>
        <div className="flex items-center gap-2">
          <span className={`admin-status-pill is-${tone}`}>{waitingActivation ? tr("tasks.obs.waitingActivation") : taskStatusLabel(task.status)}</span>
          <span className="text-xs tabular-nums text-[var(--admin-muted)]">{task.progress_percent}%</span>
        </div>
        <div className="task-progress"><span style={{ width: `${task.progress_percent}%` }} /></div>
        <span className="task-summary-sub font-mono">{task.current_step_key || tr("tasks.obs.stepNotRecorded")}{task.current_step_status ? ` · ${task.current_step_status}` : ""}</span>
        {task.execution_mode === "direct" ? <span className="task-summary-sub">{tr("tasks.obs.directDesc")}</span> : task.queue_type ? <span className="task-summary-sub">{tr("tasks.obs.queueBadge", { type: queueTypeText(task.queue_type) })}{task.provider_status ? tr("tasks.obs.providerSuffix", { status: task.provider_status }) : ""}</span> : null}
      </div>

      <div className="task-summary-item">
        <span className="task-summary-label">{upstream.latest?.phase === "simulated" ? tr("tasks.obs.simulatedModel") : upstream.modelFromRequest ? tr("tasks.obs.actualModelShort") : tr("tasks.obs.selectedModel")}</span>
        <span className="task-summary-value break-all">{upstream.model || tr("tasks.obs.notRecorded")}</span>
        <span className="task-summary-sub">Provider · {upstream.provider || tr("tasks.obs.notRecorded")}</span>
      </div>

      <div className="task-summary-item">
        <span className="task-summary-label">{tr("tasks.obs.upstream")}<button type="button" className="task-summary-jump" onClick={() => onJump("upstream")}>{tr("tasks.obs.viewRequests")}</button></span>
        <Badge variant={upstream.latest?.phase === "failed" ? "destructive" : upstream.records.length ? "info" : "secondary"}>{upstreamSummaryText(upstream)}</Badge>
        {upstream.providerTaskId ? <CopyText value={upstream.providerTaskId} className="task-summary-sub" /> : <span className="task-summary-sub">{tr("tasks.obs.providerTaskMissing")}</span>}
      </div>

      <div className="task-summary-item">
        <span className="task-summary-label">{tr("tasks.obs.elapsed")}{duration.live ? <span className="task-live-dot" title={tr("tasks.obs.timing")} /> : null}</span>
        <span className="task-summary-value tabular-nums">{formatTaskDuration(duration.totalMs)}</span>
        <span className="task-summary-sub tabular-nums">
          {tr("tasks.obs.waitRun", { wait: formatTaskDuration(duration.waitingMs), run: duration.runningMs == null && !task.started_at && duration.live ? tr("tasks.obs.notStarted") : formatTaskDuration(duration.runningMs) })}
        </span>
      </div>

      <div className="task-summary-item">
        <span className="task-summary-label">{tr("tasks.obs.billingLabel", { state: billing.settled ? tr("tasks.obs.settled") : tr("tasks.obs.unsettled") })}<button type="button" className="task-summary-jump" onClick={() => onJump("billing")}>{tr("tasks.obs.breakdown")}</button></span>
        <span className="task-summary-value tabular-nums">{charged ? money(billing.chargedFen) : (billing.frozenFen ?? 0) > 0 ? tr("tasks.obs.frozenAmount", { amount: money(billing.frozenFen) }) : tr("tasks.obs.notCharged")}</span>
        <span className="task-summary-sub tabular-nums">
          {tr("tasks.obs.estimate", { amount: money(billing.estimateFen) })}{charged ? tr("tasks.obs.refund", { amount: money(billing.refundedFen) }) : ""}
        </span>
      </div>
    </div>
  );
}
