import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { PaginationBar } from "@/components/PaginationBar";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, tr, useI18n } from "@/i18n";

type ErrorReport = {
  id: number;
  message: string;
  stack?: string | null;
  url?: string | null;
  source: string;
  user_agent?: string | null;
  release?: string | null;
  user_id?: number | null;
  count: number;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
};

type ListOut = { items: ErrorReport[]; meta: { page: number; page_size: number; total: number } };

/** 前端错误列表（服务端分页 + 搜索），点击行展开堆栈 */
export function ErrorReportsPage() {
  const { t } = useI18n();
  /* 查询条件 */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  /* 数据与展开行 */
  const [data, setData] = useState<ListOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), page_size: String(pageSize), q });
      setData(await api<ListOut>(`/api/admin/error-reports?${qs}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("commerce.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="admin-list-page">
      <PageHeader description={t("commerce.errors.desc")} />
      <AdminFilterBar>
        <AdminSearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder={t("commerce.errors.search")}
        />
      </AdminFilterBar>
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("commerce.errors.message")}</TableHead>
              <TableHead>{t("commerce.errors.count")}</TableHead>
              <TableHead>{t("commerce.errors.url")}</TableHead>
              <TableHead>{t("commerce.errors.user")}</TableHead>
              <TableHead>{t("commerce.errors.release")}</TableHead>
              <TableHead>{t("commerce.errors.lastSeen")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && (data?.items.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState title={t("commerce.errors.empty")} />
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setOpenId((cur) => (cur === row.id ? null : row.id))}
                  >
                    <TableCell className="max-w-[420px] truncate font-mono text-xs" title={row.message}>
                      {row.message}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.count}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{row.url || "—"}</TableCell>
                    <TableCell>{row.user_id ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.release || "—"}</TableCell>
                    <TableCell className="text-xs">{row.last_seen_at ? formatDateTime(row.last_seen_at) : "—"}</TableCell>
                  </TableRow>
                  {openId === row.id ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <p className="mb-1 text-xs text-[#909399]">
                          {t("commerce.errors.firstSeen")}: {row.first_seen_at ? formatDateTime(row.first_seen_at) : "—"} ·{" "}
                          {row.user_agent || ""}
                        </p>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-[#f5f7fa] p-3 text-xs">
                          {row.stack || t("commerce.errors.stack") + ": —"}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))
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
    </div>
  );
}
