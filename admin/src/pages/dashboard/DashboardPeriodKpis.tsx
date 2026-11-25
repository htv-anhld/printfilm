import { Activity, Film, Percent, TrendingUp } from "lucide-react";
import type { AdminStats } from "@/api/client";

import { dashboardRangeLabel, type DashboardFilterState } from "@/pages/dashboard/DashboardFilters";
import { DashboardKpiCard } from "@/pages/dashboard/DashboardKpiCard";
import { calcProfitFen, sumDailyUsage } from "@/pages/dashboard/dashboardMetrics";
import { tr } from "@/i18n";
import { money } from "@/lib/money";

type DashboardPeriodKpisProps = {
  stats: AdminStats | null;
  filters: DashboardFilterState;
  loading: boolean;
};

/** 第二行 KPI：随筛选时间窗变化的调用/扣费/毛利/项目规模 */
export function DashboardPeriodKpis({ stats, filters, loading }: DashboardPeriodKpisProps) {
  const placeholder = loading ? "…" : "—";
  const rangeLabel = dashboardRangeLabel(filters.days);
  const period = sumDailyUsage(stats?.daily_usage ?? []);
  const profitFen = calcProfitFen(period.charge_fen, period.cost_fen);
  const profitPct =
    period.charge_fen > 0 ? `${((profitFen / period.charge_fen) * 100).toFixed(1)}%` : undefined;

  return (
    <div className="admin-dashboard-kpi-grid admin-dashboard-kpi-grid--secondary">
      <DashboardKpiCard
        label={tr("dashboard.period.calls", { range: rangeLabel })}
        value={stats ? period.calls.toLocaleString() : placeholder}
        hint={stats ? tr("dashboard.period.callsTotal", { n: stats.usage_calls_total ?? 0 }) : tr("dashboard.metricLong.calls")}
        icon={Activity}
        tone="mint"
      />
      <DashboardKpiCard
        label={tr("dashboard.period.charge", { range: rangeLabel })}
        value={stats ? money(period.charge_fen) : placeholder}
        hint={stats ? tr("dashboard.period.monthAmount", { amount: money(stats.usage_charge_month_fen ?? 0) }) : tr("dashboard.period.userCharge")}
        icon={TrendingUp}
        tone="blue"
      />
      <DashboardKpiCard
        label={tr("dashboard.period.profit", { range: rangeLabel })}
        value={stats ? money(profitFen) : placeholder}
        hint={stats ? tr("dashboard.period.costAmount", { amount: money(period.cost_fen) }) : tr("dashboard.period.profitHint")}
        icon={Percent}
        tone="rose"
        trend={profitPct ? tr("dashboard.profitRate", { pct: profitPct }) : undefined}
      />
      <DashboardKpiCard
        label={tr("layout.nav.dramaProjects")}
        value={stats ? stats.drama_project_count ?? 0 : placeholder}
        hint={stats ? tr("dashboard.period.users", { n: stats.user_count }) : tr("dashboard.period.scale")}
        icon={Film}
        tone="slate"
      />
    </div>
  );
}
