import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, type AdminDramaAsset, type PageMeta } from "@/api/client";
import { AdminEntityLink } from "@/components/admin/AdminEntityLink";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminUserSearchSelect } from "@/components/admin/AdminUserSearchSelect";
import { PaginationBar } from "@/components/PaginationBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import {
  DRAMA_GENERATION_STATUSES,
  dramaAssetTypeLabel,
  formatDramaGenerationStatus,
} from "@/lib/dramaLabels";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { formatDateTime, useI18n } from "@/i18n";

type ListRes = { items: AdminDramaAsset[]; meta: PageMeta };

const ASSET_TYPES = ["character", "scene", "prop", "material", "none"] as const;

/** 全站漫剧资产库列表 */
export function DramaAssetsPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get("project_id");

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [type, setType] = useState("");
  const [generationStatus, setGenerationStatus] = useState("");
  const [data, setData] = useState<ListRes | null>(null);

  async function load(nextPage = page) {
    try {
      const params = new URLSearchParams({ page: String(nextPage), page_size: String(DEFAULT_PAGE_SIZE) });
      if (q.trim()) params.set("q", q.trim());
      if (userId) params.set("user_id", String(userId));
      if (projectId.trim()) params.set("project_id", projectId.trim());
      if (type.trim()) params.set("type", type.trim());
      if (generationStatus.trim()) params.set("generation_status", generationStatus.trim());
      setData(await api<ListRes>(`/api/admin/drama-assets?${params}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="admin-list-page">
      <PageHeader description={t("drama.assets.desc")} />
      <AdminFilterBar>
        <Input placeholder={t("drama.assets.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        <AdminUserSearchSelect value={userId} onChange={setUserId} />
        <Input placeholder={t("drama.fields.projectId")} value={projectId} onChange={(e) => setProjectId(e.target.value)} />
        <select className="admin-native-select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t("orders.allTypes")}</option>
          {ASSET_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {dramaAssetTypeLabel(ty)}
            </option>
          ))}
        </select>
        <select
          className="admin-native-select"
          value={generationStatus}
          onChange={(e) => setGenerationStatus(e.target.value)}
        >
          <option value="">{t("drama.allGenerationStatuses")}</option>
          {DRAMA_GENERATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatDramaGenerationStatus(s)}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="secondary"
          className="admin-filter-action"
          onClick={() => {
            setPage(1);
            void load(1);
          }}
        >
          {t("common.filter")}
        </Button>
      </AdminFilterBar>

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{t("drama.fields.preview")}</th>
              <th>{t("templates.editor.name")}</th>
              <th>{t("common.type")}</th>
              <th>{t("orders.cols.project")}</th>
              <th>{t("orders.cols.user")}</th>
              <th>{t("drama.fields.generation")}</th>
              <th>{t("drama.fields.updatedAt")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>
                  {row.cover || row.url ? (
                    <img
                      src={row.cover || row.url || ""}
                      alt={row.name ?? ""}
                      className="admin-thumb"
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-[140px] truncate">{row.name || "—"}</td>
                <td>{dramaAssetTypeLabel(row.type)}</td>
                <td>
                  <AdminEntityLink kind="drama" id={row.project_id} label={row.project_title ?? undefined} />
                </td>
                <td>
                  {row.user_id ? (
                    <AdminEntityLink kind="user" id={row.user_id} label={row.user_email ?? undefined} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-xs text-[var(--admin-muted)]">
                  {formatDramaGenerationStatus(row.generation_status)}
                </td>
                <td className="text-xs text-[var(--admin-muted)]">
                  {formatDateTime(row.updated_at)}
                </td>
                <td>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/drama-assets/${row.id}`}>{t("common.view")}</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {(data?.items.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={9} className="!text-center text-[var(--admin-muted)]">
                  {t("drama.noAssets")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {data?.meta ? (
        <PaginationBar
          page={data.meta.page}
          pageSize={data.meta.page_size}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
