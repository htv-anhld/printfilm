import {
  Activity,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clapperboard,
  Film,
  Layers,
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AdminStats, AdminUpstreamUsage } from "@/api/client";
import type { DashboardInsightItem } from "@/pages/dashboard/DashboardInsightGrid";
import { calcProfitFen, sumDailyUsage, sumProjectStatuses } from "@/pages/dashboard/dashboardMetrics";
import { fenToYuan } from "@/lib/utils";
import { projectStatusLabel } from "@/lib/statusLabels";
import { tr } from "@/i18n";

/** 财务账单 Tab 图标指标 */
export function buildFinanceInsights(
  stats: AdminStats | null,
  upstream: AdminUpstreamUsage | null,
): DashboardInsightItem[] {
  if (!stats) return [];

  const monthCharge = stats.usage_charge_month_fen ?? 0;
  const monthCost = stats.usage_cost_month_fen ?? 0;
  const profitFen = calcProfitFen(monthCharge, monthCost);
  const recent = (upstream?.series ?? []).slice(-7);
  const localCost7 = recent.reduce((sum, row) => sum + row.local_cost_fen, 0);
  const officialCost7 = recent.reduce((sum, row) => sum + row.official_cost_fen, 0);
  const delta7 = localCost7 - officialCost7;

  const items: DashboardInsightItem[] = [
    {
      key: "paid-total",
      label: tr("dashboard.fin.totalTopup"),
      value: `¥${fenToYuan(stats.order_paid_total_fen)}`,
      hint: tr("dashboard.todayAmount", { amount: fenToYuan(stats.order_paid_today_fen) }),
      icon: Banknote,
      tone: "blue",
    },
    {
      key: "charge-month",
      label: tr("dashboard.fin.monthCharge"),
      value: `¥${fenToYuan(monthCharge)}`,
      hint: tr("dashboard.todayAmount", { amount: fenToYuan(stats.usage_charge_today_fen ?? 0) }),
      icon: Zap,
      tone: "purple",
    },
    {
      key: "cost-month",
      label: tr("dashboard.fin.monthCost"),
      value: `¥${fenToYuan(monthCost)}`,
      hint: tr("dashboard.todayAmount", { amount: fenToYuan(stats.usage_cost_today_fen ?? 0) }),
      icon: Wallet,
      tone: "sand",
    },
    {
      key: "profit-month",
      label: tr("dashboard.fin.monthProfit"),
      value: `¥${fenToYuan(profitFen)}`,
      hint: monthCharge > 0 ? tr("dashboard.profitRate", { pct: `${((profitFen / monthCharge) * 100).toFixed(1)}%` }) : undefined,
      icon: Percent,
      tone: profitFen >= 0 ? "mint" : "rose",
    },
  ];

  if (upstream?.configured && officialCost7 > 0) {
    items.push({
      key: "upstream-delta",
      label: tr("dashboard.fin.costDiff7"),
      value: `¥${fenToYuan(delta7)}`,
      hint: tr("dashboard.fin.localVsOfficial", { local: fenToYuan(localCost7), official: fenToYuan(officialCost7) }),
      icon: delta7 >= 0 ? TrendingUp : TrendingDown,
      tone: delta7 >= 0 ? "teal" : "rose",
    });
  }

  items.push({
    key: "paid-today",
    label: tr("dashboard.fin.todayReceived"),
    value: `¥${fenToYuan(stats.order_paid_today_fen)}`,
    hint: tr("orders.tabs.orders"),
    icon: CircleDollarSign,
    tone: "teal",
  });

  return items;
}

const STATUS_META: Record<string, { icon: LucideIcon; tone: DashboardInsightItem["tone"] }> = {
  DONE: { icon: CheckCircle2, tone: "mint" },
  DRAFT: { icon: Layers, tone: "slate" },
  FAILED: { icon: TrendingDown, tone: "rose" },
  SCRIPTING: { icon: Clapperboard, tone: "blue" },
  IMAGING: { icon: Film, tone: "purple" },
  VIDEOING: { icon: Activity, tone: "teal" },
};

/** 项目运维 Tab 图标指标 */
export function buildProjectInsights(stats: AdminStats | null, periodDaily: ReturnType<typeof sumDailyUsage>): DashboardInsightItem[] {
  if (!stats) return [];

  const kepuTotal = sumProjectStatuses(stats.project_status_counts);
  const items: DashboardInsightItem[] = [
    {
      key: "kepu-total",
      label: tr("layout.nav.projects"),
      value: kepuTotal,
      hint: tr("dashboard.dramaCount", { n: stats.drama_project_count ?? 0 }),
      icon: Clapperboard,
      tone: "blue",
    },
    {
      key: "drama-total",
      label: tr("layout.nav.dramaProjects"),
      value: stats.drama_project_count ?? 0,
      hint: tr("dashboard.allProjects"),
      icon: Film,
      tone: "teal",
    },
    {
      key: "calls-today",
      label: tr("dashboard.callsToday"),
      value: (stats.usage_calls_today ?? 0).toLocaleString(),
      hint: tr("dashboard.monthCalls", { n: stats.usage_calls_month ?? 0 }),
      icon: Activity,
      tone: "mint",
    },
    {
      key: "calls-total",
      label: tr("users.stats.totalCalls"),
      value: (stats.usage_calls_total ?? 0).toLocaleString(),
      hint: tr("dashboard.windowCalls", { n: periodDaily.calls.toLocaleString() }),
      icon: Layers,
      tone: "slate",
    },
  ];

  const statusEntries = Object.entries(stats.project_status_counts ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  for (const [status, count] of statusEntries) {
    const meta = STATUS_META[status] ?? { icon: Layers, tone: "sand" as const };
    items.push({
      key: `status-${status}`,
      label: projectStatusLabel(status),
      value: count,
      hint: kepuTotal > 0 ? tr("dashboard.shareOfKepu", { pct: ((count / kepuTotal) * 100).toFixed(1) }) : undefined,
      icon: meta.icon,
      tone: meta.tone,
    });
  }

  return items;
}
