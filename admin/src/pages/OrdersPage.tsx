import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, type AdminLedger, type AdminOrder, type AdminUsageEventListRes, type PageMeta } from "@/api/client";
import { AdminDateRangeFilter } from "@/components/admin/AdminDateRangeFilter";
import { AdminDetailMeta, AdminDetailSection } from "@/components/admin/AdminDetailLayout";
import { AdminEntityLink } from "@/components/admin/AdminEntityLink";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminUserSearchSelect } from "@/components/admin/AdminUserSearchSelect";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page";
import { useAdminDetailQuery } from "@/hooks/useAdminDetailQuery";

import { formatDateTime, tr, useI18n } from "@/i18n";
import { ledgerKindLabel, orderStatusLabel, payTypeLabel, taskDomainLabel } from "@/lib/statusLabels";
import { money, orderMoney } from "@/lib/money";

type OrderRes = { items: AdminOrder[]; meta: PageMeta };
type LedgerRes = { items: AdminLedger[]; meta: PageMeta };

const ORDER_TABS = new Set(["orders", "ledger", "usage"]);

function tabFromSearch(raw: string | null): string {
  return raw && ORDER_TABS.has(raw) ? raw : "orders";
}

function ledgerRefLink(row: AdminLedger) {
  if (row.ref_type === "order" && row.ref_id) {
    const id = Number(row.ref_id);
    if (Number.isFinite(id) && id > 0) {
      return <AdminEntityLink kind="order" id={id} label={tr("common.entity.order", { id })} />;
    }
    return (
      <Link
        to={`/orders?tab=orders&trade=${encodeURIComponent(row.ref_id)}`}
        className="admin-link font-mono text-xs"
      >
        {row.ref_id}
      </Link>
    );
  }
  if (!row.ref_type && !row.ref_id) return "—";
  return (
    <span className="font-mono text-xs">
      {row.ref_type}/{row.ref_id}
    </span>
  );
}

// 充值订单、钱包流水与用量明细
export function OrdersPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(() => tabFromSearch(searchParams.get("tab")));
  const [orderStatus, setOrderStatus] = useState("");
  const [orderUserId, setOrderUserId] = useState<number | null>(null);
  const [ledgerKind, setLedgerKind] = useState("");
  const [ledgerUserId, setLedgerUserId] = useState<number | null>(null);
  const [orderPage, setOrderPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [usagePage, setUsagePage] = useState(1);
  const [usageUserId, setUsageUserId] = useState<number | null>(null);
  const [usageTaskId, setUsageTaskId] = useState("");
  const [usageDomain, setUsageDomain] = useState("");
  const [usageBillingKey, setUsageBillingKey] = useState("");
  const [usageCapability, setUsageCapability] = useState("");
  const [usageBasis, setUsageBasis] = useState("");
  const [usageDateFrom, setUsageDateFrom] = useState("");
  const [usageDateTo, setUsageDateTo] = useState("");
  const [orders, setOrders] = useState<OrderRes | null>(null);
  const [ledger, setLedger] = useState<LedgerRes | null>(null);
  const [usage, setUsage] = useState<AdminUsageEventListRes | null>(null);
  const [orderDetail, setOrderDetail] = useState<AdminOrder | null>(null);
  const [ledgerDetail, setLedgerDetail] = useState<AdminLedger | null>(null);
  const orderQuery = useAdminDetailQuery("order");

  async function loadOrders(page = orderPage) {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(DEFAULT_PAGE_SIZE) });
      if (orderStatus) params.set("status", orderStatus);
      if (orderUserId) params.set("user_id", String(orderUserId));
      setOrders(await api<OrderRes>(`/api/admin/orders?${params}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orders.loadOrdersFailed"));
    }
  }

  async function loadLedger(page = ledgerPage) {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(DEFAULT_PAGE_SIZE) });
      if (ledgerKind) params.set("kind", ledgerKind);
      if (ledgerUserId) params.set("user_id", String(ledgerUserId));
      setLedger(await api<LedgerRes>(`/api/admin/ledger?${params}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orders.loadLedgerFailed"));
    }
  }

  async function loadUsage(
    page = usagePage,
    overrides?: { billing_key?: string; capability?: string },
  ) {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(DEFAULT_PAGE_SIZE) });
      if (usageUserId) params.set("user_id", String(usageUserId));
      if (usageTaskId.trim()) params.set("task_run_id", usageTaskId.trim());
      if (usageDomain) params.set("domain", usageDomain);
      const billingKey = overrides?.billing_key ?? usageBillingKey.trim();
      const capability = overrides?.capability ?? usageCapability.trim();
      if (billingKey) params.set("billing_key", billingKey);
      if (capability) params.set("capability", capability);
      if (usageBasis) params.set("billing_basis", usageBasis);
      if (usageDateFrom) params.set("created_from", `${usageDateFrom}T00:00:00`);
      if (usageDateTo) params.set("created_to", `${usageDateTo}T23:59:59`);
      setUsage(await api<AdminUsageEventListRes>(`/api/admin/usage-events?${params}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orders.loadUsageFailed"));
    }
  }

  useEffect(() => {
    const next = tabFromSearch(searchParams.get("tab"));
    setTab((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderPage]);

  useEffect(() => {
    void loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerPage]);

  useEffect(() => {
    void loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usagePage]);

  useEffect(() => {
    if (!orderQuery.id || !orders?.items) return;
    const hit = orders.items.find((o) => o.id === orderQuery.id);
    if (hit) setOrderDetail(hit);
  }, [orderQuery.id, orders?.items]);

  useEffect(() => {
    const tradeNo = searchParams.get("trade");
    if (!tradeNo) return;
    void (async () => {
      try {
        const res = await api<OrderRes>(
          `/api/admin/orders?page=1&page_size=1&out_trade_no=${encodeURIComponent(tradeNo)}`,
        );
        const hit = res.items[0];
        if (hit) {
          setOrderDetail(hit);
          orderQuery.open(hit.id);
        }
      } catch {
        /* 深链失败时静默，用户仍可手动筛选 */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function onTabChange(next: string) {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "orders") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }

  return (
    <div className="admin-list-page">
      <PageHeader description={t("orders.desc")} />
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="orders">{t("orders.tabs.orders")}</TabsTrigger>
          <TabsTrigger value="ledger">{t("orders.tabs.ledger")}</TabsTrigger>
          <TabsTrigger value="usage">{t("orders.tabs.usage")}</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="space-y-4">
          <AdminFilterBar>
            <Select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)}>
              <option value="">{t("labels.allStatuses")}</option>
              <option value="pending">{t("labels.orderStatus.pending")}</option>
              <option value="paid">{t("labels.orderStatus.paid")}</option>
              <option value="closed">{t("labels.orderStatus.closed")}</option>
            </Select>
            <AdminUserSearchSelect value={orderUserId} onChange={(id) => setOrderUserId(id)} />
            <Button
              size="sm"
              variant="secondary"
              className="admin-filter-action"
              onClick={() => {
                setOrderPage(1);
                void loadOrders(1);
              }}
            >
              {t("common.filter")}
            </Button>
          </AdminFilterBar>
          <div className="rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t("orders.cols.outTradeNo")}</TableHead>
                  <TableHead>{t("orders.cols.user")}</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>{t("orders.cols.amount")}</TableHead>
                  <TableHead>{t("orders.cols.credit")}</TableHead>
                  <TableHead>{t("orders.cols.payType")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("orders.cols.tradeNo")}</TableHead>
                  <TableHead>{t("orders.cols.paidAt")}</TableHead>
                  <TableHead>{t("orders.cols.createdAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(orders?.items ?? []).map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setOrderDetail(o);
                      orderQuery.open(o.id);
                    }}
                  >
                    <TableCell>{o.id}</TableCell>
                    <TableCell className="font-mono text-xs">{o.out_trade_no}</TableCell>
                    <TableCell>
                      <AdminEntityLink kind="user" id={o.user_id} label={o.user_email ?? undefined} />
                    </TableCell>
                    <TableCell>{o.sku_id}</TableCell>
                    <TableCell>{orderMoney(o.amount_fen, o.currency)}</TableCell>
                    <TableCell>{orderMoney(o.credit_fen, o.currency)}</TableCell>
                    <TableCell>{payTypeLabel(o.pay_type)}</TableCell>
                    <TableCell>
                      <Badge variant={o.status === "paid" ? "success" : "secondary"}>
                        {orderStatusLabel(o.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{o.trade_no || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(o.paid_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(o.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {orders && (
            <PaginationBar
              page={orders.meta.page}
              pageSize={orders.meta.page_size}
              total={orders.meta.total}
              onPageChange={setOrderPage}
            />
          )}
        </TabsContent>
        <TabsContent value="ledger" className="space-y-4">
          <AdminFilterBar>
            <Select value={ledgerKind} onChange={(e) => setLedgerKind(e.target.value)}>
              <option value="">{t("orders.allTypes")}</option>
              <option value="topup">{t("labels.ledgerKind.topup")}</option>
              <option value="grant">{t("labels.ledgerKind.grant")}</option>
              <option value="adjust">{t("labels.ledgerKind.adjust")}</option>
              <option value="freeze">{t("labels.ledgerKind.freeze")}</option>
              <option value="unfreeze">{t("labels.ledgerKind.unfreeze")}</option>
              <option value="settle">{t("labels.ledgerKind.settle")}</option>
              <option value="refund">{t("labels.ledgerKind.refund")}</option>
            </Select>
            <AdminUserSearchSelect value={ledgerUserId} onChange={(id) => setLedgerUserId(id)} />
            <Button
              size="sm"
              variant="secondary"
              className="admin-filter-action"
              onClick={() => {
                setLedgerPage(1);
                void loadLedger(1);
              }}
            >
              {t("common.filter")}
            </Button>
          </AdminFilterBar>
          <div className="rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t("orders.cols.user")}</TableHead>
                  <TableHead>{t("users.detail.colDelta")}</TableHead>
                  <TableHead>{t("users.detail.colBalanceAfter")}</TableHead>
                  <TableHead>{t("common.type")}</TableHead>
                  <TableHead>{t("orders.cols.ref")}</TableHead>
                  <TableHead>{t("users.detail.colNote")}</TableHead>
                  <TableHead>{t("common.time")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ledger?.items ?? []).map((e) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => setLedgerDetail(e)}>
                    <TableCell>{e.id}</TableCell>
                    <TableCell>
                      <AdminEntityLink kind="user" id={e.user_id} label={e.user_email ?? undefined} />
                    </TableCell>
                    <TableCell className={e.delta_fen >= 0 ? "text-emerald-700" : "text-red-600"}>
                      {e.delta_fen >= 0 ? "+" : ""}
                      {money(e.delta_fen)}
                    </TableCell>
                    <TableCell>{money(e.balance_after)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ledgerKindLabel(e.kind)}</Badge>
                    </TableCell>
                    <TableCell>{ledgerRefLink(e)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{e.note}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(e.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {ledger && (
            <PaginationBar
              page={ledger.meta.page}
              pageSize={ledger.meta.page_size}
              total={ledger.meta.total}
              onPageChange={setLedgerPage}
            />
          )}
        </TabsContent>
        <TabsContent value="usage" className="space-y-4">
          <AdminFilterBar>
            <AdminUserSearchSelect value={usageUserId} onChange={(id) => setUsageUserId(id)} />
            <Input placeholder={t("orders.usage.taskId")} value={usageTaskId} onChange={(e) => setUsageTaskId(e.target.value)} />
            <Select value={usageDomain} onChange={(e) => setUsageDomain(e.target.value)}>
              <option value="">{t("orders.usage.allDomains")}</option>
              <option value="kepu">{t("orders.usage.domain.kepu")}</option>
              <option value="drama">{t("orders.usage.domain.drama")}</option>
              <option value="studio">{t("orders.usage.domain.studio")}</option>
              <option value="api">{t("orders.usage.domain.api")}</option>
            </Select>
            <Input
              placeholder="billing_key"
              value={usageBillingKey}
              onChange={(e) => setUsageBillingKey(e.target.value)}
            />
            <Select value={usageCapability} onChange={(e) => setUsageCapability(e.target.value)}>
              <option value="">{t("orders.usage.allCapabilities")}</option>
              <option value="llm">{t("orders.usage.capability.llm")}</option>
              <option value="image">{t("orders.usage.capability.image")}</option>
              <option value="video">{t("orders.usage.capability.video")}</option>
              <option value="tts">{t("orders.usage.capability.tts")}</option>
            </Select>
            <Select value={usageBasis} onChange={(e) => setUsageBasis(e.target.value)}>
              <option value="">{t("orders.usage.allBasis")}</option>
              <option value="estimate">{t("orders.usage.basis.estimate")}</option>
              <option value="upstream">{t("orders.usage.basis.upstream")}</option>
              <option value="upstream_usage">{t("orders.usage.basis.upstreamUsage")}</option>
              <option value="upstream_cost">{t("orders.usage.basis.upstreamCost")}</option>
            </Select>
            <AdminDateRangeFilter
              from={usageDateFrom}
              to={usageDateTo}
              onChange={({ from, to }) => {
                setUsageDateFrom(from);
                setUsageDateTo(to);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="admin-filter-action"
              onClick={() => {
                setUsageBillingKey("llm_chat");
                setUsageCapability("llm");
                setUsagePage(1);
                void loadUsage(1, { billing_key: "llm_chat", capability: "llm" });
              }}
            >
              {t("orders.usage.llmUsage")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="admin-filter-action"
              onClick={() => {
                setUsagePage(1);
                void loadUsage(1);
              }}
            >
              {t("common.filter")}
            </Button>
          </AdminFilterBar>
          <div className="rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.time")}</TableHead>
                  <TableHead>{t("orders.cols.user")}</TableHead>
                  <TableHead>{t("users.detail.colTask")}</TableHead>
                  <TableHead>{t("orders.cols.project")}</TableHead>
                  <TableHead>{t("orders.cols.domain")}</TableHead>
                  <TableHead>{t("users.detail.colCapability")}</TableHead>
                  <TableHead>{t("orders.cols.model")}</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>{t("users.detail.colCharge")}</TableHead>
                  <TableHead>{t("orders.cols.upstreamCost")}</TableHead>
                  <TableHead>{t("orders.cols.billingBasis")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usage?.items ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell>
                      <AdminEntityLink kind="user" id={row.user_id} label={row.user_email ?? undefined} />
                    </TableCell>
                    <TableCell>
                      {row.task_run_id ? (
                        <AdminEntityLink kind="task" id={row.task_run_id} />
                      ) : (
                        t("orders.usage.unlinked")
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.project_id ? (
                        <AdminEntityLink kind="project" id={row.project_id} />
                      ) : row.drama_project_id ? (
                        <AdminEntityLink kind="drama" id={row.drama_project_id} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{row.domain ? taskDomainLabel(row.domain) : "—"}</TableCell>
                    <TableCell>{row.capability ?? row.billing_key}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{row.model || "—"}</TableCell>
                    <TableCell>{row.total_tokens ?? 0}</TableCell>
                    <TableCell>{money(row.charge_fen ?? 0)}</TableCell>
                    <TableCell>{money(row.cost_fen ?? 0)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.billing_basis === "estimate" || row.estimated
                            ? "secondary"
                            : "success"
                        }
                        title={
                          row.billing_basis === "upstream_cost"
                            ? t("orders.usage.basisHint.upstreamCost")
                            : row.billing_basis === "upstream_usage"
                              ? t("orders.usage.basisHint.upstreamUsage")
                              : t("orders.usage.basisHint.estimate")
                        }
                      >
                        {row.billing_basis_label ?? (row.estimated ? t("orders.usage.basis.estimate") : t("orders.usage.measured"))}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {usage && (
            <PaginationBar
              page={usage.meta.page}
              pageSize={usage.meta.page_size}
              total={usage.meta.total}
              onPageChange={setUsagePage}
            />
          )}
        </TabsContent>
      </Tabs>

      <AdminModal
        open={orderQuery.isOpen && !!orderDetail}
        onOpenChange={(open) => {
          if (!open) {
            setOrderDetail(null);
            orderQuery.close();
          }
        }}
        size="md"
        title={orderDetail ? t("orders.orderDetailWithId", { id: orderDetail.id }) : t("orders.orderDetail")}
        subtitle={orderDetail?.out_trade_no}
        footer={
          orderDetail ? (
            <Button size="sm" variant="outline" onClick={() => void copyText(orderDetail.out_trade_no)}>
              {t("orders.copyOutTradeNo")}
            </Button>
          ) : undefined
        }
      >
        {orderDetail ? (
          <AdminDetailSection>
            <AdminDetailMeta
              items={[
                {
                  label: t("orders.cols.user"),
                  value: (
                    <AdminEntityLink
                      kind="user"
                      id={orderDetail.user_id}
                      label={orderDetail.user_email ?? undefined}
                    />
                  ),
                },
                { label: "SKU", value: orderDetail.sku_id },
                { label: t("orders.cols.amount"), value: orderMoney(orderDetail.amount_fen, orderDetail.currency) },
                { label: t("orders.cols.credit"), value: orderMoney(orderDetail.credit_fen, orderDetail.currency) },
                { label: t("orders.payMethod"), value: payTypeLabel(orderDetail.pay_type) },
                { label: t("common.status"), value: orderStatusLabel(orderDetail.status) },
                { label: t("orders.cols.tradeNo"), value: orderDetail.trade_no || "—" },
                {
                  label: t("orders.cols.paidAt"),
                  value: formatDateTime(orderDetail.paid_at),
                },
                {
                  label: t("orders.cols.createdAt"),
                  value: formatDateTime(orderDetail.created_at),
                  full: true,
                },
              ]}
            />
          </AdminDetailSection>
        ) : null}
      </AdminModal>

      <AdminModal
        open={!!ledgerDetail}
        onOpenChange={(open) => !open && setLedgerDetail(null)}
        size="md"
        title={ledgerDetail ? t("orders.ledgerDetailWithId", { id: ledgerDetail.id }) : t("orders.ledgerDetail")}
      >
        {ledgerDetail ? (
          <AdminDetailSection>
            <AdminDetailMeta
              items={[
                {
                  label: t("orders.cols.user"),
                  value: (
                    <AdminEntityLink
                      kind="user"
                      id={ledgerDetail.user_id}
                      label={ledgerDetail.user_email ?? undefined}
                    />
                  ),
                },
                { label: t("common.type"), value: ledgerKindLabel(ledgerDetail.kind) },
                { label: t("users.detail.colDelta"), value: money(ledgerDetail.delta_fen) },
                { label: t("users.detail.colBalanceAfter"), value: money(ledgerDetail.balance_after) },
                { label: t("orders.cols.ref"), value: ledgerRefLink(ledgerDetail) },
                { label: t("users.detail.colNote"), value: ledgerDetail.note || "—" },
                {
                  label: t("common.time"),
                  value: formatDateTime(ledgerDetail.created_at),
                  full: true,
                },
              ]}
            />
          </AdminDetailSection>
        ) : null}
      </AdminModal>
    </div>
  );
}
