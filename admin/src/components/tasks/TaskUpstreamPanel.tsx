import { useMemo } from "react";
import type { AdminTaskDetail } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/PaginationBar";
import { useTaskEventPage } from "@/hooks/useTaskEventPage";
import { prettyJson } from "@/lib/jsonPreview";
import { CopyText } from "@/components/tasks/TaskDetailSummary";
import { groupUpstreamRecords, redactTaskData, redactTaskText, shortEndpoint, taskUpstream, upstreamRecords } from "@/lib/taskObservability";
import { upstreamPhaseText, upstreamStateText, upstreamSummaryText } from "@/lib/taskObservabilityText";
import { tr } from "@/i18n";
import { cn } from "@/lib/utils";

function time(value?: string | null) {
  return value ? new Date(value).toLocaleString() : tr("tasks.obs.notRecorded");
}

function JsonRecord({ title, value, paginated = false }: { title: string; value: unknown; paginated?: boolean }) {
  return (
    <details className="task-json-toggle">
      <summary>{title}<span>{tr("tasks.upstreamPanel.redacted")}</span></summary>
      {value === undefined ? <p className="mt-3 text-xs text-[var(--admin-muted)]">{paginated ? tr("tasks.upstreamPanel.notOnPage") : tr("tasks.obs.notRecorded")}</p> : <pre className="task-detail-json mt-3">{prettyJson(redactTaskData(value))}</pre>}
    </details>
  );
}

/** 展示真实 HTTP 留痕及明确标记的本地模拟参数，模拟事件不代表实际网络请求。 */
export function TaskUpstreamPanel({ task }: { task: AdminTaskDetail }) {
  const summary = useMemo(() => taskUpstream(task), [task]);
  const refreshToken = `${task.upstream_events_total}:${task.updated_at}:${task.status}`;
  const history = useTaskEventPage(task.id, refreshToken, "upstream.request.");
  const pageRecords = useMemo(() => upstreamRecords(history.data?.items), [history.data]);
  const requests = useMemo(() => groupUpstreamRecords(pageRecords), [pageRecords]);
  return (
    <div className="space-y-3">
      <div className="task-upstream-toolbar">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span><span className="text-[var(--admin-muted)]">{tr("tasks.upstreamPanel.latestPhase")}</span> <strong>{upstreamSummaryText(summary)}</strong></span>
          <span className="text-[var(--admin-muted)]">{tr("tasks.upstreamPanel.pageCount", { page: pageRecords.length, total: history.data?.total ?? task.upstream_events_total ?? "—" })}</span>
        </div>
        <Button variant="outline" size="sm" disabled={history.loading} onClick={history.refresh}>{tr("tasks.upstreamPanel.refresh")}</Button>
      </div>
      <p className="text-[11px] leading-5 text-[var(--admin-muted)]">{tr("tasks.upstreamPanel.hint")}</p>
      {history.error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{history.error}<Button className="ml-3" variant="outline" size="sm" onClick={history.refresh}>{tr("tasks.upstreamPanel.retry")}</Button></div> : null}

      {history.loading ? <p className="py-8 text-center text-sm text-[var(--admin-muted)]" role="status">{tr("tasks.upstreamPanel.loading")}</p> : history.error ? null : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--admin-border)] px-5 py-8 text-sm text-[var(--admin-muted)]">{tr("tasks.upstreamPanel.empty")}</div>
      ) : requests.map((request) => {
        const failed = request.latest.phase === "failed" || (request.httpStatus ?? 0) >= 400;
        const simulated = request.latest.phase === "simulated";
        return (
          <section key={request.key} className={cn("task-upstream-card", failed && "is-fail")}>
            <header className="task-upstream-head">
              <Badge variant={failed ? "destructive" : request.latest.phase === "started" ? "warning" : "info"}>{upstreamPhaseText(request.latest.phase)}</Badge>
              {request.latest.upstreamStatus ? <Badge variant="secondary">{upstreamStateText(request.latest.upstreamStatus)}</Badge> : null}
              <code className="task-upstream-endpoint" title={request.endpoint}>
                <strong>{request.method || (simulated ? tr("tasks.upstreamPanel.localMock") : "METHOD?")}</strong> {request.endpoint ? shortEndpoint(request.endpoint) : simulated ? request.operation || tr("tasks.upstreamPanel.mediaGeneration") : tr("tasks.upstreamPanel.endpointMissing")}
              </code>
              <span className="ml-auto flex items-center gap-3 text-xs tabular-nums">
                <span className={cn("task-http-chip", failed && "is-fail")}>{simulated ? tr("tasks.upstreamPanel.noHttp") : request.httpStatus ?? "—"}</span>
                <span>{request.elapsedMs == null ? "—" : `${Math.round(request.elapsedMs)} ms`}</span>
                <span className="text-[var(--admin-muted)]">{time(request.latest.createdAt)}</span>
              </span>
            </header>
            <div className="task-upstream-meta">
              <span><span className="text-[var(--admin-muted)]">{tr("tasks.upstreamPanel.model")}</span> {request.model || tr("tasks.obs.notRecorded")} / {request.provider || tr("tasks.obs.notRecorded")}</span>
              <span className="flex min-w-0 items-center gap-1"><span className="text-[var(--admin-muted)]">{tr("tasks.upstreamPanel.providerTask")}</span> {request.providerTaskId ? <CopyText value={request.providerTaskId} /> : tr("tasks.obs.notRecorded")}</span>
              <span className="flex min-w-0 items-center gap-1"><span className="text-[var(--admin-muted)]">{tr("tasks.upstreamPanel.requestId")}</span> {request.requestId ? <CopyText value={request.requestId} /> : tr("tasks.upstreamPanel.eventRef", { id: request.latest.id })}</span>
            </div>
            {request.records.length > 1 ? (
              <ol className="task-upstream-steps">
                {request.records.map((record) => (
                  <li key={record.id}>
                    <span className="font-medium">{upstreamPhaseText(record.phase)}</span>
                    {record.upstreamStatus ? <span>{upstreamStateText(record.upstreamStatus)}</span> : null}
                    <span className="text-[var(--admin-muted)]">{record.createdAt ? new Date(record.createdAt).toLocaleTimeString() : "—"}</span>
                    {record.elapsedMs != null ? <span className="text-[var(--admin-muted)]">{Math.round(record.elapsedMs)} ms</span> : null}
                  </li>
                ))}
              </ol>
            ) : null}
            {simulated ? <p className="mb-3 text-sm text-[var(--admin-muted)]">{request.endpoint ? tr("tasks.upstreamPanel.simulatedFinal") : tr("tasks.upstreamPanel.simulatedLegacy")}</p> : null}
            <div className={cn("grid items-start gap-2", !simulated && "xl:grid-cols-2")}>
              <JsonRecord title={simulated ? tr("tasks.upstreamPanel.mockParams") : tr("tasks.upstreamPanel.request")} value={request.request} paginated />
              {!simulated ? <JsonRecord title={tr("tasks.upstreamPanel.response")} value={request.response} paginated /> : null}
            </div>
            {request.error !== undefined ? <div className="mt-2"><JsonRecord title={tr("tasks.upstreamPanel.error")} value={request.error} paginated /></div> : null}
          </section>
        );
      })}

      {history.data ? <PaginationBar page={history.page} pageSize={history.pageSize} total={history.data.total} onPageChange={history.setPage} onPageSizeChange={history.changePageSize} pageSizeOptions={[20, 50, 100]} /> : null}

      {(task.steps || []).some((step) => step.input_payload || step.output_payload) ? (
        <details className="task-detail-section">
          <summary className="cursor-pointer text-sm font-semibold">{tr("tasks.upstreamPanel.stepData")}</summary>
          <p className="my-3 text-xs text-[var(--admin-muted)]">{tr("tasks.upstreamPanel.stepDataHint")}</p>
          <div className="space-y-4">{task.steps.filter((step) => step.input_payload || step.output_payload).map((step) => <section key={step.id}><h5 className="mb-2 text-xs font-semibold">{step.step_key}{step.provider_name ? ` · ${redactTaskText(step.provider_name)}` : ""}</h5><div className="grid items-start gap-3 xl:grid-cols-2"><JsonRecord title={tr("tasks.upstreamPanel.stepInput")} value={step.input_payload ?? undefined} /><JsonRecord title={tr("tasks.upstreamPanel.stepOutput")} value={step.output_payload ?? undefined} /></div></section>)}</div>
        </details>
      ) : null}
    </div>
  );
}
