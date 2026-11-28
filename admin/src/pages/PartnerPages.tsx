import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { RemoteListPage } from "@/components/admin/RemoteListPage";
import { Button } from "@/components/ui/button";
import { formatDateTime, useI18n } from "@/i18n";
import { money } from "@/lib/money";

type PartnerRow = {
  id: number;
  email: string;
  status: string;
  ref_code: string;
  commission_rate: number;
  channel: string;
  website: string;
  audience: string;
  note: string;
  signups: number;
  open_fen: number;
  available_fen: number;
  created_at?: string | null;
};

type SubmissionRow = {
  id: number;
  email: string;
  url: string;
  platform: string;
  status: string;
  reward_fen: number;
  created_at?: string | null;
};

const PARTNER_STATUSES = ["", "pending", "approved", "rejected", "suspended"];

/** 合作伙伴 / 推广内容状态显示文案；未知状态原样返回 */
function partnerStatusLabel(t: (path: string) => string, status: string): string {
  const key = `commerce.partners.statuses.${status}`;
  const text = t(key);
  return text === key ? status : text;
}

/** 管理端：合作伙伴审核 / 佣金结算 */
export function PartnersAdminPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState("pending");
  const [reload, setReload] = useState(0);

  async function review(row: PartnerRow, next: string) {
    let rate: number | null = row.commission_rate;
    if (next === "approved") {
      const raw = window.prompt(t("commerce.partners.ratePrompt"), String(Math.round((row.commission_rate || 0.2) * 100)));
      if (raw === null) return;
      const pct = Number(raw.trim());
      if (!raw.trim() || !Number.isFinite(pct) || pct < 0 || pct > 100) {
        toast.error(t("commerce.partners.rateInvalid"));
        return;
      }
      rate = pct / 100;
    } else if (next === "rejected" || next === "suspended") {
      // 拒绝 / 暂停属于危险操作，需二次确认
      const msg = next === "rejected" ? "commerce.partners.rejectConfirm" : "commerce.partners.suspendConfirm";
      if (!window.confirm(t(msg, { email: row.email }))) return;
    }
    try {
      await api(`/api/admin/partners/${row.id}/review`, {
        method: "POST",
        body: JSON.stringify({ status: next, commission_rate: rate, note: "" }),
      });
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function markPaid(row: PartnerRow) {
    if (!window.confirm(t("commerce.partners.markPaidConfirm", { amount: money(row.available_fen), email: row.email }))) return;
    try {
      await api(`/api/admin/partners/${row.id}/mark-paid`, { method: "POST" });
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <RemoteListPage<PartnerRow>
      endpoint="/api/admin/partners"
      description={t("commerce.partners.desc")}
      searchPlaceholder={t("commerce.partners.search")}
      emptyText={t("commerce.partners.empty")}
      extraParams={{ status }}
      reloadKey={reload}
      filters={
        <select className="settings-select max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          {PARTNER_STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? partnerStatusLabel(t, s) : t("common.all")}
            </option>
          ))}
        </select>
      }
      columns={[
        { key: "email", title: t("commerce.partners.user"), render: (r) => r.email },
        {
          key: "profile",
          title: t("commerce.partners.profile"),
          render: (r) => (
            <span className="text-xs" title={r.note}>
              {[r.channel, r.website, r.audience].filter(Boolean).join(" · ") || "—"}
            </span>
          ),
        },
        { key: "status", title: t("commerce.partners.status"), render: (r) => `${partnerStatusLabel(t, r.status)} · ${Math.round(r.commission_rate * 100)}%` },
        { key: "code", title: t("commerce.partners.code"), render: (r) => <span className="font-mono text-xs">{r.ref_code}</span> },
        { key: "signups", title: t("commerce.partners.signups"), render: (r) => r.signups, className: "tabular-nums" },
        {
          key: "money",
          title: t("commerce.partners.commission"),
          render: (r) => `${money(r.open_fen)} / ${money(r.available_fen)}`,
          className: "tabular-nums",
        },
        {
          key: "actions",
          title: "",
          render: (r) => (
            <div className="flex flex-wrap gap-1">
              {r.status !== "approved" ? (
                <Button size="sm" onClick={() => void review(r, "approved")}>
                  {t("commerce.partners.approve")}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void review(r, "suspended")}>
                  {t("commerce.partners.suspend")}
                </Button>
              )}
              {r.status === "pending" ? (
                <Button size="sm" variant="outline" onClick={() => void review(r, "rejected")}>
                  {t("commerce.partners.reject")}
                </Button>
              ) : null}
              {r.available_fen > 0 ? (
                <Button size="sm" variant="outline" onClick={() => void markPaid(r)}>
                  {t("commerce.partners.markPaid")}
                </Button>
              ) : null}
            </div>
          ),
        },
      ]}
    />
  );
}

/** 管理端：推广内容审核 */
export function PartnerSubmissionsPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState("pending");
  const [reload, setReload] = useState(0);

  async function review(row: SubmissionRow, next: "approved" | "rejected") {
    let reward = 0;
    if (next === "approved") {
      const raw = window.prompt(t("commerce.submissions.rewardPrompt"), "5");
      if (raw === null) return;
      const amount = Number(raw.trim());
      if (!raw.trim() || !Number.isFinite(amount) || amount < 0) {
        toast.error(t("commerce.partners.rewardInvalid"));
        return;
      }
      reward = Math.round(amount * 100);
    } else if (!window.confirm(t("commerce.partners.submissionRejectConfirm", { email: row.email }))) {
      return;
    }
    try {
      await api(`/api/admin/partner-submissions/${row.id}/review`, {
        method: "POST",
        body: JSON.stringify({ status: next, reward_fen: reward, note: "" }),
      });
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <RemoteListPage<SubmissionRow>
      endpoint="/api/admin/partner-submissions"
      description={t("commerce.submissions.desc")}
      searchPlaceholder={t("commerce.submissions.search")}
      emptyText={t("commerce.submissions.empty")}
      extraParams={{ status }}
      reloadKey={reload}
      filters={
        <select className="settings-select max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["pending", "approved", "rejected", ""].map((s) => (
            <option key={s || "all"} value={s}>
              {s ? partnerStatusLabel(t, s) : t("common.all")}
            </option>
          ))}
        </select>
      }
      columns={[
        { key: "email", title: t("commerce.partners.user"), render: (r) => r.email },
        {
          key: "url",
          title: t("commerce.submissions.url"),
          render: (r) => (
            <a className="text-[#0068d4] hover:underline" href={r.url} target="_blank" rel="noreferrer noopener">
              {r.platform || r.url}
            </a>
          ),
        },
        { key: "status", title: t("commerce.partners.status"), render: (r) => `${partnerStatusLabel(t, r.status)}${r.reward_fen ? ` · +${money(r.reward_fen)}` : ""}` },
        { key: "created", title: t("commerce.teams.created"), render: (r) => (r.created_at ? formatDateTime(r.created_at) : "—") },
        {
          key: "actions",
          title: "",
          render: (r) =>
            r.status === "pending" ? (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => void review(r, "approved")}>
                  {t("commerce.partners.approve")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void review(r, "rejected")}>
                  {t("commerce.partners.reject")}
                </Button>
              </div>
            ) : null,
        },
      ]}
    />
  );
}
