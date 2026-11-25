import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { PaginationBar } from "@/components/PaginationBar";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type RemoteColumn<T> = {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type ListOut<T> = { items: T[]; meta: { page: number; page_size: number; total: number } };

/**
 * 通用服务端分页列表页：endpoint 返回 {items, meta}；支持关键词与额外查询参数。
 * 商业化管理页（订阅、团队、合作伙伴、OAuth 应用）共用。
 */
export function RemoteListPage<T extends { id: number | string }>({
  endpoint,
  description,
  searchPlaceholder,
  columns,
  emptyText,
  extraParams,
  filters,
  reloadKey,
}: {
  endpoint: string;
  description: string;
  searchPlaceholder: string;
  columns: RemoteColumn<T>[];
  emptyText: string;
  extraParams?: Record<string, string>;
  filters?: ReactNode;
  reloadKey?: number;
}) {
  /* 查询条件 */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  /* 数据 */
  const [data, setData] = useState<ListOut<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const extra = JSON.stringify(extraParams || {});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), page_size: String(pageSize), q, ...JSON.parse(extra) });
      setData(await api<ListOut<T>>(`${endpoint}?${qs}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize, q, extra]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [extra]);

  return (
    <div className="admin-list-page">
      <PageHeader description={description} />
      <AdminFilterBar>
        <AdminSearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
        />
        {filters}
      </AdminFilterBar>
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.title}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && (data?.items.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyState title={emptyText} />
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
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
