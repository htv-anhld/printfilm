import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  api,
  type AdminLedger,
  type AdminOrder,
  type AdminUsageEvent,
  type AdminUserRow,
  type PageResult,
} from "@/api/client";
import { listAdminLedger, listAdminOrders, listAdminUsageEvents } from "@/api/finance";
import {
  AdminDetailMeta,
  AdminDetailSection,
  AdminDetailTableWrap,
} from "@/components/admin/AdminDetailLayout";
import { AdminEntityLink } from "@/components/admin/AdminEntityLink";
import { AdminModal } from "@/components/admin/AdminModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAccountId } from "@/lib/admin-account";

import { formatDateTime, tr, useI18n } from "@/i18n";
import { ledgerKindLabel, orderStatusLabel } from "@/lib/statusLabels";
import { money } from "@/lib/money";

type ListRes<T> = PageResult<T>;

type UserDetailDrawerProps = {
  userId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUser?: AdminUserRow | null;
};

/** 用户只读明细：基本信息 + 订单/流水/用量聚合 */
export function UserDetailDrawer({ userId, open, onOpenChange, initialUser }: UserDetailDrawerProps) {
  const { t } = useI18n();
  const [user, setUser] = useState<AdminUserRow | null>(initialUser ?? null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ledger, setLedger] = useState<AdminLedger[]>([]);
  const [usage, setUsage] = useState<AdminUsageEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    void (async () => {
      try {
        const [userRes, orderRes, ledgerRes, usageRes] = await Promise.all([
          initialUser?.id === userId
            ? Promise.resolve({ items: [initialUser], meta: { page: 1, page_size: 1, total: 1 } })
            : api<ListRes<AdminUserRow>>(`/api/admin/users?page=1&page_size=1&q=${userId}`),
          listAdminOrders(1, { pageSize: 8, userId }),
          listAdminLedger(1, { pageSize: 8, userId }),
          listAdminUsageEvents(1, { pageSize: 20, userId }),
        ]);
        setUser(userRes.items[0] ?? initialUser ?? null);
        setOrders(orderRes.items);
        setLedger(ledgerRes.items);
        setUsage(usageRes.items);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : tr("users.detail.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, userId, initialUser]);

  return (
    <AdminModal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t("users.detail.title")}
      subtitle={
        user
          ? `${user.email} · ID：${formatAccountId(user.id)}`
          : loading
            ? t("common.loading")
            : "—"
      }
      bodyClassName="!pt-2"
    >
      {user ? (
        <Tabs defaultValue="info" className="admin-detail-tabs">
          <TabsList>
            <TabsTrigger value="info">{t("users.detail.tabInfo")}</TabsTrigger>
            <TabsTrigger value="orders">{t("users.detail.tabOrders")}</TabsTrigger>
            <TabsTrigger value="ledger">{t("users.detail.tabLedger")}</TabsTrigger>
            <TabsTrigger value="usage">{t("users.detail.tabUsage")}</TabsTrigger>
          </TabsList>
          <TabsContent value="info">
            <AdminDetailSection>
              <AdminDetailMeta
                items={[
                  { label: t("users.fields.nickname"), value: user.nickname || "—" },
                  { label: t("users.fields.phone"), value: user.phone || "—" },
                  { label: t("users.fields.role"), value: user.role === "admin" ? t("users.role.admin") : t("users.role.user") },
                  { label: t("users.fields.balance"), value: money(user.balance_fen) },
                  { label: t("users.fields.frozen"), value: money(user.frozen_fen) },
                  {
                    label: t("users.fields.createdAt"),
                    value: formatDateTime(user.created_at),
                    full: true,
                  },
                ]}
              />
            </AdminDetailSection>
          </TabsContent>
          <TabsContent value="orders">
            <AdminDetailTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>{t("users.detail.colOrderNo")}</th>
                    <th>{t("users.detail.colAmount")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("common.time")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="!text-center text-[var(--admin-muted)]">
                        {t("users.detail.emptyOrders")}
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id}>
                        <td className="font-mono text-xs">{o.out_trade_no}</td>
                        <td>{money(o.amount_fen)}</td>
                        <td>{orderStatusLabel(o.status)}</td>
                        <td className="text-xs">{formatDateTime(o.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </AdminDetailTableWrap>
          </TabsContent>
          <TabsContent value="ledger">
            <AdminDetailTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>{t("common.type")}</th>
                    <th>{t("users.detail.colDelta")}</th>
                    <th>{t("users.detail.colBalanceAfter")}</th>
                    <th>{t("users.detail.colNote")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="!text-center text-[var(--admin-muted)]">
                        {t("users.detail.emptyLedger")}
                      </td>
                    </tr>
                  ) : (
                    ledger.map((row) => (
                      <tr key={row.id}>
                        <td>{ledgerKindLabel(row.kind)}</td>
                        <td>{money(row.delta_fen)}</td>
                        <td>{money(row.balance_after)}</td>
                        <td className="max-w-[200px] truncate text-xs">{row.note || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </AdminDetailTableWrap>
          </TabsContent>
          <TabsContent value="usage">
            <AdminDetailTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>{t("common.time")}</th>
                    <th>{t("users.detail.colCapability")}</th>
                    <th>{t("users.detail.colCharge")}</th>
                    <th>{t("users.detail.colCost")}</th>
                    <th>{t("users.detail.colTask")}</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="!text-center text-[var(--admin-muted)]">
                        {t("users.detail.emptyUsage")}
                      </td>
                    </tr>
                  ) : (
                    usage.map((row) => (
                      <tr key={row.id}>
                        <td className="text-xs">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td>{row.capability || "—"}</td>
                        <td>{money(row.charge_fen ?? 0)}</td>
                        <td>{money(row.cost_fen ?? 0)}</td>
                        <td>
                          {row.task_run_id ? (
                            <AdminEntityLink kind="task" id={row.task_run_id} />
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </AdminDetailTableWrap>
          </TabsContent>
        </Tabs>
      ) : loading ? (
        <div className="py-10 text-center text-sm text-[var(--admin-muted)]">{t("common.loading")}</div>
      ) : null}
    </AdminModal>
  );
}
