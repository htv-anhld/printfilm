import { useEffect, useState } from "react";
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
import { fenToYuan } from "@/lib/utils";
import { formatDateTime, tr, useI18n } from "@/i18n";
import { money } from "@/lib/money";

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
    balance_yuan: "0",
    balance_note: "",
  });
  const [saving, setSaving] = useState(false);
  const userDetail = useAdminDetailQuery("user");

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
    setEditing(user);
    setForm({
      role: user.role || "user",
      balance_yuan: fenToYuan(user.balance_fen),
      balance_note: "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const balanceFen = Math.round(parseFloat(form.balance_yuan || "0") * 100);
      if (Number.isNaN(balanceFen)) throw new Error(t("users.invalidBalance"));
      await api(`/api/admin/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: form.role,
          balance_fen: balanceFen,
          balance_note: form.balance_note || undefined,
        }),
      });
      toast.success(t("common.saved"));
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.toast.saveFailed"));
    } finally {
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
          <option value="user">user</option>
          <option value="admin">admin</option>
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
                <TableCell className="font-mono text-xs text-[#909399]">{formatAccountId(u.id)}</TableCell>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>{u.nickname || "—"}</TableCell>
                <TableCell className="text-xs">{u.phone || "—"}</TableCell>
                <TableCell className="tabular-nums">{money(u.balance_fen)}</TableCell>
                <TableCell className="tabular-nums">{money(u.frozen_fen)}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "success" : "secondary"}>{u.role}</Badge>
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
        onOpenChange={(open) => !open && setEditing(null)}
        size="md"
        title={t("users.editTitle")}
        subtitle={editing?.email}
        footer={
          <Button className="w-full sm:w-auto" disabled={saving} onClick={() => void saveEdit()}>
            {saving ? t("common.saving") : t("common.saveChanges")}
          </Button>
        }
      >
        <div className="admin-form-grid admin-form-grid--2">
          <AdminField label={t("users.fields.role")}>
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </Select>
          </AdminField>
          <AdminField label={t("users.fields.balanceYuan")}>
            <Input
              value={form.balance_yuan}
              onChange={(e) => setForm((f) => ({ ...f, balance_yuan: e.target.value }))}
            />
          </AdminField>
          <AdminField label={t("users.adjustNote")} hint={t("common.optional")}>
            <Input
              value={form.balance_note}
              onChange={(e) => setForm((f) => ({ ...f, balance_note: e.target.value }))}
              placeholder={t("users.adminNote")}
            />
          </AdminField>
        </div>
      </AdminModal>
    </div>
  );
}
