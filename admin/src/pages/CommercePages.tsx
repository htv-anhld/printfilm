import { useState } from "react";
import { RemoteListPage } from "@/components/admin/RemoteListPage";
import { formatDateTime, useI18n } from "@/i18n";
import { money } from "@/lib/money";

type SubscriptionRow = {
  id: number;
  user_id: number;
  email: string;
  plan_id: string;
  interval: string;
  status: string;
  seats: number;
  team_id?: number | null;
  credits_per_period: number;
  current_period_end?: string | null;
  provider_sub_id: string;
};

type TeamRow = {
  id: number;
  name: string;
  owner_email: string;
  seats: number;
  members: number;
  created_at?: string | null;
};

const SUB_STATUSES = ["", "active", "scheduled_cancel", "past_due", "canceled", "expired"];

/** 管理端：订阅列表 */
export function SubscriptionsPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState("");
  return (
    <RemoteListPage<SubscriptionRow>
      endpoint="/api/admin/subscriptions"
      description={t("commerce.subs.desc")}
      searchPlaceholder={t("commerce.subs.search")}
      emptyText={t("commerce.subs.empty")}
      extraParams={{ status }}
      filters={
        <select className="settings-select max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          {SUB_STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s || t("common.all")}
            </option>
          ))}
        </select>
      }
      columns={[
        { key: "email", title: t("commerce.subs.user"), render: (r) => r.email },
        { key: "plan", title: t("commerce.subs.plan"), render: (r) => `${r.plan_id} · ${r.interval}${r.team_id ? ` · ${t("commerce.subs.seats", { n: r.seats })}` : ""}` },
        { key: "status", title: t("commerce.subs.status"), render: (r) => r.status },
        { key: "credits", title: t("commerce.subs.credits"), render: (r) => money(r.credits_per_period), className: "tabular-nums" },
        { key: "end", title: t("commerce.subs.periodEnd"), render: (r) => (r.current_period_end ? formatDateTime(r.current_period_end) : "—") },
        { key: "ref", title: "Creem", render: (r) => <span className="font-mono text-xs">{r.provider_sub_id}</span> },
      ]}
    />
  );
}

/** 管理端：团队列表 */
export function TeamsPage() {
  const { t } = useI18n();
  return (
    <RemoteListPage<TeamRow>
      endpoint="/api/admin/teams"
      description={t("commerce.teams.desc")}
      searchPlaceholder={t("commerce.teams.search")}
      emptyText={t("commerce.teams.empty")}
      columns={[
        { key: "name", title: t("commerce.teams.name"), render: (r) => r.name },
        { key: "owner", title: t("commerce.teams.owner"), render: (r) => r.owner_email },
        { key: "seats", title: t("commerce.teams.seats"), render: (r) => `${r.members}/${r.seats}`, className: "tabular-nums" },
        { key: "created", title: t("commerce.teams.created"), render: (r) => (r.created_at ? formatDateTime(r.created_at) : "—") },
      ]}
    />
  );
}
