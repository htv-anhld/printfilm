import type { ReactNode } from "react";
import { Ban, Eye, Loader2 } from "lucide-react";
import type { AdminTaskRow } from "@/api/client";
import { AdminEntityLink } from "@/components/admin/AdminEntityLink";
import { Badge } from "@/components/ui/badge";
import {
  canCancelTask,
  redactTaskText,
  shortEndpoint,
  taskBilling,
  taskDurations,
  taskStatusTone,
  taskUpstream,
} from "@/lib/taskObservability";
import { cn } from "@/lib/utils";
import { money as formatMoney } from "@/lib/money";
import { tr } from "@/i18n";
import { queueTypeText, taskBillingText, taskDurationText as formatTaskDuration, upstreamSummaryText } from "@/lib/taskObservabilityText";
import { taskDomainLabel, taskStatusLabel, taskTypeLabel } from "@/lib/statusLabels";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

type TaskListRowProps = {
  task: AdminTaskRow;
  upstream: ReturnType<typeof taskUpstream>;
  billing: ReturnType<typeof taskBilling>;
  now: number;
  cancelling: boolean;
  onOpen: (taskId: number) => void;
  onCancel: (task: AdminTaskRow) => void;
};

// 待处理任务细分为待激活 / 延时等待 / 待调度
function queueStatusLabel(task: AdminTaskRow): string {
  if (task.status !== "pending") return taskStatusLabel(task.status);
  if (task.next_action_at === undefined) return tr("tasks.obs.pendingGeneric");
  if (task.next_action_at === null) return tr("tasks.obs.waitingActivation");
  return new Date(task.next_action_at).getTime() > Date.now() ? tr("tasks.obs.delayed") : tr("tasks.obs.ready");
}

// 列表内只显示月日时分，完整时间放 title
function shortTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function money(value: number | null | undefined): string {
  return value == null ? "—" : formatMoney(value);
}

// 阻止冒泡到行 onClick，避免链接跳转时同时打开详情
function stopRowClick(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

// 关联实体：项目 / 资产链接 + 分集分镜编号
function scopeLinks(task: AdminTaskRow): ReactNode {
  const parts: ReactNode[] = [];
  if (task.drama_project_id) parts.push(<AdminEntityLink key="drama" kind="drama" id={task.drama_project_id} />);
  if (task.project_id) parts.push(<AdminEntityLink key="project" kind="project" id={task.project_id} />);
  if (task.asset_id) parts.push(<AdminEntityLink key="asset" kind="drama_asset" id={task.asset_id} />);
  if (task.episode_id) parts.push(<span key="ep">{tr("tasks.obs.episodeRef", { id: task.episode_id })}</span>);
  if (task.fragment_id) parts.push(<span key="frag">{tr("tasks.obs.fragmentRef", { id: task.fragment_id })}</span>);
  if (parts.length === 0) return null;
  return <div className="task-cell-sub flex flex-wrap gap-x-2" onClick={stopRowClick}>{parts}</div>;
}

// 计费格：主值为实扣 / 冻结，次行为预估与退还
function BillingCell({ billing }: { billing: ReturnType<typeof taskBilling> }) {
  const charged = billing.settled || (billing.chargedFen ?? 0) > 0;
  const frozen = !charged && (billing.frozenFen ?? 0) > 0;
  return (
    <>
      <div className={cn("task-cell-main tabular-nums", frozen && "text-[#b45309]", !charged && !frozen && "!font-normal text-[var(--admin-muted)]")}>
        {charged ? money(billing.chargedFen) : frozen ? tr("tasks.obs.frozenAmount", { amount: money(billing.frozenFen) }) : tr("tasks.obs.notCharged")}
      </div>
      <div className="task-cell-sub tabular-nums" title={taskBillingText(billing.status)}>
        {tr("tasks.obs.estimate", { amount: money(billing.estimateFen) })}
        {charged && (billing.refundedFen ?? 0) > 0 ? tr("tasks.obs.refundShort", { amount: money(billing.refundedFen) }) : ""}
        {!billing.settled ? tr("tasks.obs.unsettledSuffix") : ""}
      </div>
    </>
  );
}

// 任务中心列表行：每格「主值 + 次要信息」两层，完整内容进详情
export function TaskListRow({ task, upstream, billing, now, cancelling, onOpen, onCancel }: TaskListRowProps) {
  const tone = taskStatusTone(task.status);
  const duration = taskDurations(task, now);
  const error = task.error_message ? redactTaskText(task.error_message) : "";
  const latest = upstream.latest;
  const endpoint = latest?.endpoint ? shortEndpoint(latest.endpoint) : "";
  const showProgress = !TERMINAL_STATUSES.has(task.status) && task.progress_percent > 0;
  return (
    <tr className={cn("task-row cursor-pointer", `is-${tone}`)} onClick={() => onOpen(task.id)}>
      <td className="min-w-[200px]">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-semibold">#{task.id}</span>
          {task.execution_mode === "direct" ? <Badge variant="secondary">{tr("tasks.obs.direct")}</Badge> : task.queue_type ? <Badge variant="secondary">{tr("tasks.obs.queueBadge", { type: queueTypeText(task.queue_type) })}</Badge> : null}
          <span className="task-cell-main">{taskDomainLabel(task.domain)} · {taskTypeLabel(task.task_type)}</span>
        </div>
        <div
          className="task-model-chip"
          title={upstream.modelFromRequest ? `${tr("tasks.obs.actualModel")}${upstream.provider ? ` · ${upstream.provider}` : ""}` : tr("tasks.obs.selectedModel")}
        >
          {upstream.model || tr("tasks.obs.modelNotRecorded")}
        </div>
      </td>
      <td className="min-w-[170px]">
        <div className="flex items-center gap-2">
          <span className={`admin-status-pill ${tone === "fail" ? "is-fail" : tone === "done" ? "is-done" : tone === "run" ? "is-run" : "is-warn"}`}>
            {queueStatusLabel(task)}
          </span>
          {showProgress ? <span className="text-[11px] tabular-nums text-[var(--admin-muted)]">{task.progress_percent}%</span> : null}
        </div>
        {showProgress ? <div className="task-progress"><span style={{ width: `${task.progress_percent}%` }} /></div> : null}
        {error ? (
          <div className="task-cell-sub max-w-[220px] truncate !text-[#dc2626]" title={error}>{error}</div>
        ) : (
          <div className="task-cell-sub font-mono">{task.current_step_key || tr("tasks.obs.stepNotRecorded")}{task.current_step_status ? ` · ${task.current_step_status}` : ""}</div>
        )}
      </td>
      <td className="min-w-[210px]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={latest?.phase === "failed" ? "destructive" : upstream.records.length ? "info" : "secondary"}>{upstreamSummaryText(upstream)}</Badge>
          {latest?.httpStatus || latest?.elapsedMs != null ? (
            <span className={cn("text-[11px] tabular-nums", (latest?.httpStatus ?? 0) >= 400 ? "text-[#dc2626]" : "text-[var(--admin-muted)]")}>
              {latest?.httpStatus ? `HTTP ${latest.httpStatus}` : ""}
              {latest?.httpStatus && latest?.elapsedMs != null ? " · " : ""}
              {latest?.elapsedMs != null ? `${Math.round(latest.elapsedMs)}ms` : ""}
            </span>
          ) : null}
        </div>
        {endpoint ? (
          <div className="task-cell-sub max-w-[240px] truncate font-mono" title={`${latest?.method ?? ""} ${latest?.endpoint ?? ""}`}>
            <strong className="font-semibold">{latest?.method}</strong> {endpoint}
          </div>
        ) : null}
      </td>
      <td className="min-w-[140px]"><BillingCell billing={billing} /></td>
      <td className="min-w-[140px]">
        <div className="task-cell-main tabular-nums">
          {formatTaskDuration(duration.totalMs)}
          {duration.live ? <span className="task-live-dot" title={tr("tasks.obs.timing")} /> : null}
        </div>
        <div className="task-cell-sub tabular-nums">
          {tr("tasks.obs.waitRun", { wait: formatTaskDuration(duration.waitingMs), run: duration.runningMs == null && !task.started_at && duration.live ? tr("tasks.obs.notStarted") : formatTaskDuration(duration.runningMs) })}
        </div>
      </td>
      <td className="min-w-[170px]">
        <div onClick={stopRowClick}>
          <AdminEntityLink kind="user" id={task.requested_by} label={task.user_email ?? undefined} className="text-xs" />
        </div>
        {scopeLinks(task)}
        <div className="task-cell-sub" title={task.created_at ? new Date(task.created_at).toLocaleString() : undefined}>{tr("tasks.obs.created", { time: shortTime(task.created_at) })}</div>
      </td>
      <td className="text-right" onClick={stopRowClick}>
        <div className="inline-flex gap-1">
          <button type="button" className="task-icon-btn" title={tr("tasks.obs.detail")} aria-label={tr("tasks.obs.detail")} onClick={() => onOpen(task.id)}>
            <Eye className="h-4 w-4" />
          </button>
          {canCancelTask(task) ? (
            <button type="button" className="task-icon-btn is-danger" title={tr("tasks.obs.cancel")} aria-label={tr("tasks.obs.cancel")} disabled={cancelling} onClick={() => onCancel(task)}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
