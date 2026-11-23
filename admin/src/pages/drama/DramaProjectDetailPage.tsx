import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, type AdminDramaProject } from "@/api/client";
import {
  AdminDetailMeta,
  AdminDetailSection,
  AdminDetailStatGrid,
  AdminDetailTableWrap,
} from "@/components/admin/AdminDetailLayout";
import { AdminEntityLink } from "@/components/admin/AdminEntityLink";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dramaAssetTypeLabel, formatDramaGenerationStatus } from "@/lib/dramaLabels";
import { taskStatusLabel, taskTypeLabel } from "@/lib/statusLabels";
import { fenToYuan } from "@/lib/utils";
import { formatDateTime, tr, useI18n } from "@/i18n";

const TABS = ["overview", "episodes", "assets", "tasks"] as const;
type TabKey = (typeof TABS)[number];

function isTabKey(value: string | null): value is TabKey {
  return TABS.includes(value as TabKey);
}

/** 漫剧项目二级详情：概览 / 分集 / 资产 / 任务 */
export function DramaProjectDetailPage() {
  const { t } = useI18n();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabKey = isTabKey(tabParam) ? tabParam : "overview";

  const [detail, setDetail] = useState<AdminDramaProject | null>(null);
  const [loading, setLoading] = useState(true);

  const id = Number(projectId);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      navigate("/drama-projects", { replace: true });
      return;
    }
    setLoading(true);
    void api<AdminDramaProject>(`/api/admin/drama-projects/${id}`)
      .then(setDetail)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : tr("common.loadFailed"));
        navigate("/drama-projects", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  function setTab(next: TabKey) {
    const params = new URLSearchParams(searchParams);
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  const usage = detail?.usage;

  if (loading && !detail) {
    return <div className="admin-detail-page-loading">{t("common.loading")}</div>;
  }
  if (!detail) return null;

  return (
    <div className="admin-detail-page">
      <div className="admin-detail-page-toolbar">
        <Button variant="ghost" size="sm" className="admin-detail-back" asChild>
          <Link to="/drama-projects">
            <ArrowLeft className="h-4 w-4" />
            {t("drama.projectDetail.back")}
          </Link>
        </Button>
        <div className="admin-detail-page-heading">
          <h2 className="admin-detail-page-title">
            {t("drama.projectDetail.title", { id: detail.id, title: detail.title })}
          </h2>
          <p className="admin-detail-page-sub">
            <AdminEntityLink kind="user" id={detail.user_id} label={detail.user_email ?? undefined} />
            {detail.summary_status ? t("drama.projectDetail.summarySuffix", { status: detail.summary_status }) : ""}
          </p>
        </div>
        <div className="admin-detail-page-actions">
          <Button size="sm" variant="outline" asChild>
            <Link to={`/drama-assets?project_id=${detail.id}`}>{t("drama.projectDetail.viewAssets")}</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/drama-episodes?project_id=${detail.id}`}>{t("drama.projectDetail.viewEpisodes")}</Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="admin-detail-tabs">
        <TabsList className="admin-detail-tabs-list">
          <TabsTrigger value="overview">{t("tasks.detail.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="episodes">{t("drama.projectDetail.tabEpisodes", { n: detail.episode_count ?? 0 })}</TabsTrigger>
          <TabsTrigger value="assets">{t("drama.projectDetail.tabAssets", { n: detail.asset_count ?? 0 })}</TabsTrigger>
          <TabsTrigger value="tasks">{t("drama.projectDetail.tabTasks", { n: (detail.recent_tasks ?? []).length })}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="admin-detail-tab-panel">
          <AdminDetailSection title={t("users.detail.tabInfo")}>
            <AdminDetailMeta
              items={[
                {
                  label: t("orders.cols.user"),
                  value: (
                    <AdminEntityLink
                      kind="user"
                      id={detail.user_id}
                      label={detail.user_email ?? undefined}
                    />
                  ),
                },
                { label: t("templates.editor.desc"), value: detail.description || t("templates.noDesc"), full: true },
                { label: t("drama.fields.summaryStatus"), value: detail.summary_status || "—" },
                { label: t("drama.fields.episodeStatus"), value: detail.episode_content_status || "—" },
                { label: t("drama.fields.assetSeed"), value: detail.assets_seed_status || "—" },
                { label: t("drama.fields.episodeCount"), value: detail.episode_count ?? 0 },
                { label: t("drama.fields.assetCount"), value: detail.asset_count ?? 0 },
                { label: t("drama.fields.fragmentCount"), value: detail.fragment_count ?? 0 },
                {
                  label: t("drama.fields.updatedAt"),
                  value: formatDateTime(detail.updated_at),
                  full: true,
                },
              ]}
            />
          </AdminDetailSection>

          <AdminDetailSection title={t("projects.costSummary")}>
            <AdminDetailStatGrid
              items={[
                { label: t("users.detail.colCharge"), value: `¥${fenToYuan(usage?.charge_fen ?? detail.charge_fen ?? 0)}` },
                { label: t("users.detail.colCost"), value: `¥${fenToYuan(usage?.cost_fen ?? 0)}` },
                { label: t("drama.fields.calls"), value: usage?.calls ?? 0 },
                {
                  label: t("projects.fields.genCounts"),
                  value: `${usage?.image_gens ?? 0}/${usage?.video_gens ?? 0}/${usage?.llm_calls ?? 0}/${usage?.tts_gens ?? 0}`,
                },
              ]}
            />
          </AdminDetailSection>
        </TabsContent>

        <TabsContent value="episodes" className="admin-detail-tab-panel">
          <AdminDetailSection title={t("drama.projectDetail.episodeList", { n: (detail.episodes ?? []).length })}>
            <AdminDetailTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t("templates.editor.name")}</th>
                    <th>{t("drama.fields.fragmentCount")}</th>
                    <th>{t("drama.fields.fragmentPlan")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.episodes ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="!text-center text-[var(--admin-muted)]">
                        {t("drama.noEpisodes")}
                      </td>
                    </tr>
                  ) : (
                    (detail.episodes ?? []).map((ep) => (
                      <tr key={ep.id}>
                        <td>{ep.id}</td>
                        <td>{ep.name}</td>
                        <td>{ep.fragment_count}</td>
                        <td>{ep.fragment_plan_status || "—"}</td>
                        <td>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/drama-episodes/${ep.id}`}>{t("common.view")}</Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </AdminDetailTableWrap>
          </AdminDetailSection>
        </TabsContent>

        <TabsContent value="assets" className="admin-detail-tab-panel">
          <AdminDetailSection title={t("drama.projectDetail.assetList", { n: (detail.assets ?? []).length })}>
            <AdminDetailTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t("common.type")}</th>
                    <th>{t("templates.editor.name")}</th>
                    <th>{t("projects.cover")}</th>
                    <th>{t("drama.fields.generation")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.assets ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="!text-center text-[var(--admin-muted)]">
                        {t("drama.noAssets")}
                      </td>
                    </tr>
                  ) : (
                    (detail.assets ?? []).map((a) => (
                      <tr key={a.id}>
                        <td>{a.id}</td>
                        <td>{dramaAssetTypeLabel(a.type)}</td>
                        <td className="max-w-[160px] truncate">{a.name || "—"}</td>
                        <td>{a.has_cover ? t("drama.projectDetail.hasCover") : "—"}</td>
                        <td>{formatDramaGenerationStatus(a.generation_status)}</td>
                        <td>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/drama-assets/${a.id}`}>{t("common.view")}</Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </AdminDetailTableWrap>
          </AdminDetailSection>
        </TabsContent>

        <TabsContent value="tasks" className="admin-detail-tab-panel">
          <AdminDetailSection title={t("projects.recentTasks", { n: (detail.recent_tasks ?? []).length })}>
            <AdminDetailTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t("common.type")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("projects.fields.chargedEstimate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.recent_tasks ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="!text-center text-[var(--admin-muted)]">
                        {t("projects.noTasks")}
                      </td>
                    </tr>
                  ) : (
                    (detail.recent_tasks ?? []).map((t) => (
                      <tr key={t.id}>
                        <td>
                          <AdminEntityLink kind="task" id={t.id} />
                        </td>
                        <td>{taskTypeLabel(t.task_type)}</td>
                        <td>{taskStatusLabel(t.status)}</td>
                        <td>
                          ¥{fenToYuan(t.billing_charged_fen)} / ¥{fenToYuan(t.billing_estimate_fen)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </AdminDetailTableWrap>
          </AdminDetailSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
