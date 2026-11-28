import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminStats, type AdminUserRow, type PageMeta } from "@/api/client";
import { AdminField } from "@/components/admin/AdminField";
import { ChangePasswordDialog } from "@/components/admin/ChangePasswordDialog";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminListStats } from "@/components/admin/AdminListStats";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { UserDetailDrawer } from "@/components/admin/UserDetailDrawer";
import { PaginationBar } from "@/components/PaginationBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminDetailQuery } from "@/hooks/useAdminDetailQuery";
import { formatAccountId } from "@/lib/admin-account";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { formatDateTime, tr, useI18n } from "@/i18n";
import { money } from "@/lib/money";
import { yuanInputToFen } from "@/lib/moneyInput";
import { Switch } from "@/components/ui/switch";

type ListRes = { items: AdminUserRow[]; meta: PageMeta };

// 用户管理：搜索、筛选、只读明细与编辑
export function UsersPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState<ListRes | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null);
  const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null);
  const [form, setForm] = useState({
    role: "user",
    /** increase=增加 / decrease=减少 */
    balance_dir: "increase" as "increase" | "decrease",
    /** 调账金额（主单位，如 10.00），空表示不调整 */
    balance_amount: "",
    balance_note: "",
  });
  const [saving, setSaving] = useState(false);
  const [adjustBalance, setAdjustBalance] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saveError, setSaveError] = useState("");
  const pendingSave = useRef(false);
  const editFormId = useId();
  const adjustmentToggleId = useId();
  const userDetail = useAdminDetailQuery("user");

  const amountFen = yuanInputToFen(form.balance_amount);
  const balanceAfterFen = editing && adjustBalance && amountFen !== null
    ? editing.balance_fen + (form.balance_dir === "decrease" ? -amountFen : amountFen)
    : editing?.balance_fen ?? 0;
  const amountError = !adjustBalance ? "" : !form.balance_amount.trim()
    ? t("users.edit.errEmpty")
    : amountFen === null ? t("users.edit.errInvalid")
    : amountFen === 0 ? t("users.edit.errZero")
    : !Number.isSafeInteger(balanceAfterFen) ? t("users.edit.errTooLarge")
    : balanceAfterFen < 0 ? t("users.edit.errNegative")
    : "";
  const visibleAmountError = amountTouched || submitAttempted ? amountError : "";
  const roleChanged = editing !== null && form.role !== editing.role;
  const hasChanges = roleChanged || adjustBalance;

  async function load(nextPage = page, nextQ = q, nextSize = pageSize) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        page_size: String(nextSize),
      });
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (roleFilter) params.set("role", roleFilter);
      const res = await api<ListRes>(`/api/admin/users?${params}`);
      setData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    void api<AdminStats>("/api/admin/stats?days=7")
      .then(setStats)
      .catch((err) => {
        setStats(null);
        toast.error(err instanceof Error ? err.message : tr("common.statsLoadFailed"));
      });
  }, []);

  useEffect(() => {
    if (!userDetail.id || !data?.items) return;
    const hit = data.items.find((u) => u.id === userDetail.id);
    if (hit) setDetailUser(hit);
  }, [userDetail.id, data?.items]);

  function openEdit(user: AdminUserRow) {
    if (pendingSave.current) return;
    setEditing(user);
    setAdjustBalance(false);
    setAmountTouched(false);
    setSubmitAttempted(false);
    setSaveError("");
    setForm({
      role: user.role || "user",
      balance_dir: "increase",
      balance_amount: "",
      balance_note: "",
    });
  }

  async function saveEdit() {
    if (!editing || pendingSave.current || !hasChanges) return;
    setSubmitAttempted(true);
    setSaveError("");
    if (amountError) return;
    pendingSave.current = true;
    setSaving(true);
    try {
      const payload: {
        role: string;
        balance_delta_fen?: number;
        balance_note?: string;
      } = { role: form.role };

      if (adjustBalance && amountFen !== null && amountFen > 0) {
        payload.balance_delta_fen = form.balance_dir === "decrease" ? -amountFen : amountFen;
        payload.balance_note = form.balance_note.trim() || undefined;
      }
      await api(`/api/admin/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success(payload.balance_delta_fen ? t("users.edit.adjustedSaved") : t("common.saved"));
      setEditing(null);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("users.edit.saveFailedRetry"));
    } finally {
      pendingSave.current = false;
      setSaving(false);
    }
  }

  function applyFilters() {
    setPage(1);
    void load(1, q, pageSize);
  }

  return (
    <div className="admin-list-page">
      <PageHeader description={t("users.desc")} />

      <AdminFilterBar>
        <AdminSearchInput
          value={q}
          onChange={setQ}
          placeholder={t("users.searchPlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilters();
          }}
        />
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">{t("users.allRoles")}</option>
          <option value="user">{t("users.role.user")}</option>
          <option value="admin">{t("users.role.admin")}</option>
        </Select>
        <Button size="sm" className="admin-filter-action" onClick={applyFilters} disabled={loading}>
          {loading ? t("common.loading") : t("common.search")}
        </Button>
      </AdminFilterBar>

      <AdminListStats
        items={[
          { label: t("users.stats.total"), value: stats?.user_count ?? (loading ? "…" : "—") },
          {
            label: t("users.stats.monthCalls"),
            value: stats != null ? (stats.usage_calls_month ?? 0) : loading ? "…" : "—",
            hint: stats ? t("users.stats.todayCalls", { n: stats.usage_calls_today ?? 0 }) : undefined,
          },
          {
            label: t("users.stats.totalCalls"),
            value: stats != null ? (stats.usage_calls_total ?? 0) : loading ? "…" : "—",
          },
        ]}
      />

      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("users.fields.accountId")}</TableHead>
              <TableHead>{t("users.fields.email")}</TableHead>
              <TableHead>{t("users.fields.nickname")}</TableHead>
              <TableHead>{t("users.fields.phone")}</TableHead>
              <TableHead>{t("users.fields.balance")}</TableHead>
              <TableHead>{t("users.fields.frozen")}</TableHead>
              <TableHead>{t("users.fields.role")}</TableHead>
              <TableHead>{t("users.fields.createdAt")}</TableHead>
              <TableHead className="w-[220px]">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs text-[#6f687a]">{formatAccountId(u.id)}</TableCell>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>{u.nickname || "—"}</TableCell>
                <TableCell className="text-xs">{u.phone || "—"}</TableCell>
                <TableCell className="tabular-nums">{money(u.balance_fen)}</TableCell>
                <TableCell className="tabular-nums">{money(u.frozen_fen)}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "success" : "secondary"}>{u.role === "admin" ? t("users.role.admin") : t("users.role.user")}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(u.created_at)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDetailUser(u);
                        userDetail.open(u.id);
                      }}
                    >
                      {t("common.view")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                      {t("common.edit")}
                    </Button>
                    {u.role === "user" && <Button size="sm" variant="ghost" onClick={() => setResetTarget(u)}>{t("users.resetPassword")}</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && (data?.items.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <EmptyState title={t("users.empty")} description={t("users.emptyHint")} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {data && (
          <PaginationBar
            page={data.meta.page}
            pageSize={pageSize}
            total={data.meta.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </div>

      {resetTarget && <ChangePasswordDialog resetUserId={resetTarget.id} email={resetTarget.email} onClose={() => setResetTarget(null)} />}
      <UserDetailDrawer
        userId={userDetail.id}
        open={userDetail.isOpen}
        onOpenChange={(open) => {
          if (!open) userDetail.close();
        }}
        initialUser={detailUser}
      />

      <AdminModal
        open={!!editing}
        onOpenChange={(open) => { if (!open && !pendingSave.current) setEditing(null); }}
        size="lg"
        title={t("users.editTitle")}
        subtitle={editing?.email}
        footer={
          <>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button type="submit" form={editFormId} disabled={saving || !hasChanges} aria-busy={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {saving ? t("common.saving") : adjustBalance ? t("users.edit.saveAdjust") : t("users.edit.saveRole")}
            </Button>
          </>
        }
      >
        <form id={editFormId} noValidate onSubmit={(event) => { event.preventDefault(); void saveEdit(); }} className="space-y-6">
          <div className="admin-form-summary grid gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-soft,#f7f9f4)] p-4 sm:grid-cols-2">
            <div className="admin-form-summary-item">
              <div className="text-xs text-[var(--admin-muted)]">{t("users.edit.currentBalance")}</div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--admin-text)]">{money(editing?.balance_fen ?? 0)}</div>
            </div>
            <div className="admin-form-summary-item">
              <div className="text-xs text-[var(--admin-muted)]">{t("users.edit.frozen")}</div>
              <div className="mt-1.5 text-lg font-medium tabular-nums text-[var(--admin-text)]">{money(editing?.frozen_fen ?? 0)}</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--admin-muted)]">{t("users.edit.frozenHint")}</p>
            </div>
          </div>
          <fieldset disabled={saving} className="admin-form-section min-w-0 space-y-4">
            <legend className="admin-form-section-title mb-1 text-sm font-semibold text-[var(--admin-text)]">{t("users.edit.permissions")}</legend>
            <AdminField label={t("users.fields.role")} required hint={t("users.edit.roleHint")}>
              <Select value={form.role} onChange={(e) => { setSaveError(""); setForm((f) => ({ ...f, role: e.target.value })); }} disabled={saving}>
                <option value="user">{t("users.role.user")}</option>
                <option value="admin">{t("users.role.admin")}</option>
              </Select>
            </AdminField>
          </fieldset>
          <section className="admin-form-section space-y-4 border-t border-[var(--admin-border)] pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <label htmlFor={adjustmentToggleId} className="text-sm font-semibold text-[var(--admin-text)]">{t("users.edit.adjustTitle")}</label>
                <p className="mt-1 text-xs leading-relaxed text-[var(--admin-muted)]">{t("users.edit.adjustDesc")}</p>
              </div>
              <Switch id={adjustmentToggleId} checked={adjustBalance} disabled={saving} onCheckedChange={(checked) => { setAdjustBalance(checked); setSaveError(""); }} />
            </div>
            {adjustBalance ? <fieldset disabled={saving} className="min-w-0 space-y-4">
              <div className="admin-form-grid admin-form-grid--2">
                <AdminField label={t("users.edit.direction")} required>
                  <Select value={form.balance_dir} disabled={saving} onChange={(e) => { setSaveError(""); setForm((f) => ({ ...f, balance_dir: e.target.value === "decrease" ? "decrease" : "increase" })); }}>
                    <option value="increase">{t("users.edit.increase")}</option>
                    <option value="decrease">{t("users.edit.decrease")}</option>
                  </Select>
                </AdminField>
                <AdminField label={t("users.edit.amount")} required hint={t("users.edit.amountHint")} error={visibleAmountError}>
                  <Input inputMode="decimal" value={form.balance_amount} disabled={saving} placeholder="10.00" onBlur={() => setAmountTouched(true)} onChange={(e) => { setSaveError(""); setForm((f) => ({ ...f, balance_amount: e.target.value })); }} />
                </AdminField>
              </div>
              <AdminField label={t("users.adjustNote")} optional hint={t("users.edit.noteHint")}>
                <Input value={form.balance_note} disabled={saving} onChange={(e) => setForm((f) => ({ ...f, balance_note: e.target.value }))} placeholder={t("users.edit.notePlaceholder")} />
              </AdminField>
              {!amountError && amountFen !== null ? <div className="admin-form-preview rounded-xl border border-[var(--admin-border)] bg-[var(--admin-accent-soft)] p-4" aria-live="polite">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--admin-forest)]"><Wallet className="h-4 w-4" aria-hidden="true" />{t("users.edit.afterSave")}</div>
                <div className="flex flex-wrap items-center gap-3 text-lg font-semibold tabular-nums text-[var(--admin-text)]">
                  <span className="text-[var(--admin-muted)]">{money(editing?.balance_fen ?? 0)}</span>
                  <ArrowRight className="h-4 w-4 text-[var(--admin-muted)]" aria-hidden="true" />
                  <span>{money(balanceAfterFen)}</span>
                  <span className="text-xs font-medium text-[var(--admin-forest)]">{form.balance_dir === "decrease" ? t("users.edit.decrease") : t("users.edit.increase")} {money(amountFen)}</span>
                </div>
              </div> : null}
            </fieldset> : null}
          </section>
          {saveError ? <p role="alert" className="admin-form-error rounded-lg border border-[#f0d9d5] bg-[#fcf0ee] px-3 py-2.5 text-sm leading-relaxed text-[#aa3d37]">{saveError}</p> : null}
        </form>
      </AdminModal>
    </div>
  );
}
