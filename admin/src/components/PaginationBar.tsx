import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPageItems, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { Select } from "@/components/ui/select";
import "@/styles/admin-primitives.css";

type Props = {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
};

/**
 * Global admin pagination — default 10 / page, numbered pages + optional size
 */
export function PaginationBar({
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className,
}: Props) {
  const { t } = useI18n();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = buildPageItems(page, totalPages);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn("admin-pagination admin-ui-pagination", className)}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="admin-ui-pagination-summary">
          {t("common.pagination.totalPrefix")}<em className="not-italic font-semibold text-[var(--admin-text)]">{total}</em>{t("common.pagination.totalSuffix")}
          <span className="mx-1.5 text-[var(--admin-border)]">·</span>
          {from}-{to}
        </span>
        {onPageSizeChange && (
          <label className="admin-ui-pagination-size flex items-center gap-2 text-xs">
            <span>{t("common.pagination.perPage")}</span>
            <Select
              className="admin-ui-pagination-select !h-9 !min-w-[4.5rem] !text-xs"
              aria-label={t("common.pagination.perPageAria")}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <span>{t("common.pagination.perPageSuffix")}</span>
          </label>
        )}
      </div>

      <nav className="admin-ui-pagination-pages flex items-center gap-1" aria-label={t("common.pagination.nav")}>
        <button
          type="button"
          className="admin-page-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("common.pagination.prev")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {items.map((n, idx) =>
          n === -1 ? (
            <span key={`e-${idx}`} className="px-1.5 text-[#c5bfcd]">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={cn("admin-page-btn", n === page && "is-active")}
              aria-current={n === page ? "page" : undefined}
              aria-label={t("common.pagination.pageN", { n })}
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          className="admin-page-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("common.pagination.next")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
