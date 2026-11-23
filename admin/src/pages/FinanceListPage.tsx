import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminChipFilter } from "@/components/admin/AdminChipFilter";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { PageSection } from "@/components/admin/PageSection";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type AdminFinanceDaily } from "@/api/client";

import { formatDateTime, tr, useI18n } from "@/i18n";
import { money } from "@/lib/money";

type FinanceDays = "7" | "14" | "30" | "90";

const DAY_VALUES = ["7", "14", "30", "90"];

function profitClass(profitFen: number): string {
  if (profitFen > 0) return "text-[var(--admin-forest)] font-semibold";
  if (profitFen < 0) return "text-red-600 font-semibold";
  return "";
}

/** 管理端财务列表：按日展示扣费、成本、token、实际成本与利润 */
export function FinanceListPage() {
  const { t } = useI18n();
  const dayOptions = DAY_VALUES.map((value) => ({ value, label: t("common.lastNDays", { n: value }) }));
  const [days, setDays] = useState<FinanceDays>("30");
  const [data, setData] = useState<AdminFinanceDaily | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<AdminFinanceDaily>(`/api/admin/finance/daily?days=${days}`);
      setData(res);
    } catch (err) {
      setData(null);
      toast.error(err instanceof Error ? err.message : tr("finance.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [days]);

  const syncOfficial = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await api<AdminFinanceDaily>(`/api/admin/finance/daily/sync?days=${days}`, { method: "POST" });
      setData(res);
      toast.success(tr("finance.refreshed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("common.refreshFailed"));
    } finally {
      setSyncing(false);
    }
  }, [days]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = [...(data?.series ?? [])].reverse();
  const totals = data?.totals;
  const rangeMismatch = data != null && String(data.days) !== days;

  return (
    <div className="admin-page">
      <PageHeader description={t("finance.desc")} />

      <AdminFilterBar>
        <AdminChipFilter
          label={t("common.timeRange")}
          value={days}
          options={dayOptions}
          onChange={(v) => setDays(v as FinanceDays)}
          className="admin-chip-filter--segment"
        />
      </AdminFilterBar>

      <PageSection
        title={t("layout.nav.finance")}
        description={
          rangeMismatch
            ? t("finance.rangeMismatch")
            : data?.configured
            ? t("finance.configuredDesc", { n: days }) + (data.last_sync_at ? t("common.lastSync", { time: formatDateTime(data.last_sync_at) }) : "")
            : t("finance.notConfigured")
        }
        actions={
          data?.configured ? (
            <Button type="button" size="sm" variant="outline" disabled={syncing || loading} onClick={() => void syncOfficial()}>
              {syncing ? t("common.refreshing") : t("finance.refresh")}
            </Button>
          ) : null
        }
        bodyClassName="!pt-0"
      >
        <div className="admin-table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("finance.cols.date")}</TableHead>
                <TableHead>{t("finance.cols.charge")}</TableHead>
                <TableHead>{t("finance.cols.cost")}</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>{t("finance.cols.actualCost")}</TableHead>
                <TableHead>{t("finance.cols.profit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="!text-center text-[var(--admin-muted)]">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="!text-center text-[var(--admin-muted)]">
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="font-mono text-xs">{row.date}</TableCell>
                      <TableCell>{money(row.charge_fen)}</TableCell>
                      <TableCell>{money(row.cost_fen)}</TableCell>
                      <TableCell>{row.tokens.toLocaleString()}</TableCell>
                      <TableCell>
                        {row.actual_cost_fen > 0 ? money(row.actual_cost_fen) : "—"}
                      </TableCell>
                      <TableCell className={profitClass(row.profit_fen)}>
                        {money(row.profit_fen)}
                        {row.profit_pct != null ? ` (${row.profit_pct}%)` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  {totals ? (
                    <TableRow className="bg-[rgba(15,45,32,0.04)] font-medium">
                      <TableCell>{t("common.total")}</TableCell>
                      <TableCell>{money(totals.charge_fen)}</TableCell>
                      <TableCell>{money(totals.cost_fen)}</TableCell>
                      <TableCell>{totals.tokens.toLocaleString()}</TableCell>
                      <TableCell>
                        {totals.actual_cost_fen > 0 ? money(totals.actual_cost_fen) : "—"}
                      </TableCell>
                      <TableCell className={profitClass(totals.profit_fen)}>
                        {money(totals.profit_fen)}
                        {totals.profit_pct != null ? ` (${totals.profit_pct}%)` : ""}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>
    </div>
  );
}
