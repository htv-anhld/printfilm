import { BarChart3, Clapperboard, LayoutDashboard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/i18n";

/** 仪表盘主板块 */
export type DashboardSection = "overview" | "usage" | "finance" | "projects";

const SECTIONS: {
  id: DashboardSection;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", icon: LayoutDashboard },
  { id: "usage", icon: BarChart3 },
  { id: "finance", icon: Wallet },
  { id: "projects", icon: Clapperboard },
];

type DashboardSectionTabsProps = {
  value: DashboardSection;
  onChange: (next: DashboardSection) => void;
};

/** 仪表盘板块切换 */
export function DashboardSectionTabs({ value, onChange }: DashboardSectionTabsProps) {
  return (
    <div className="admin-dashboard-section-tabs" role="tablist" aria-label={tr("dashboard.sections.aria")}>
      {SECTIONS.map((item) => {
        const active = value === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn("admin-dashboard-section-tab", active && "is-active")}
            onClick={() => onChange(item.id)}
          >
            <span className="admin-dashboard-section-tab-icon">
              <Icon className="h-4 w-4" />
            </span>
            <span className="admin-dashboard-section-tab-text">
              <span className="admin-dashboard-section-tab-label">{tr(`dashboard.sections.${item.id}.label`)}</span>
              <span className="admin-dashboard-section-tab-desc">{tr(`dashboard.sections.${item.id}.desc`)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
