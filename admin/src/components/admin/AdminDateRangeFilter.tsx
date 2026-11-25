import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { useI18n } from "@/i18n";
import "@/styles/admin-controls.css";

type AdminDateRangeFilterProps = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  className?: string;
};

/** 日期范围筛选（ISO date 字符串 YYYY-MM-DD） */
export function AdminDateRangeFilter({ from, to, onChange, className }: AdminDateRangeFilterProps) {
  const { t } = useI18n();
  return (
    <div className={cn("admin-date-range admin-range-control", className)} role="group" aria-label={t("common.dateRange.label")}>
      <CalendarDays size={16} className="admin-range-icon" aria-hidden="true" />
      <label className="admin-field">
        <span className="sr-only">{t("common.dateRange.start")}</span>
        <input
          type="date"
          className="admin-input"
          value={from}
          max={to || undefined}
          onChange={(e) => onChange({ from: e.target.value, to })}
        />
      </label>
      <span className="admin-date-range-sep" aria-hidden="true">{t("common.dateRange.to")}</span>
      <label className="admin-field">
        <span className="sr-only">{t("common.dateRange.end")}</span>
        <input
          type="date"
          className="admin-input"
          value={to}
          min={from || undefined}
          onChange={(e) => onChange({ from, to: e.target.value })}
        />
      </label>
    </div>
  );
}
