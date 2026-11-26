import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getCachedUser, getToken, isAdminUser } from "@/lib/auth";
import { LoginPage } from "@/pages/LoginPage";

// 路由级代码分割：登录页与布局同步加载，其余页面按需加载
const AdjustRecordsPage = lazy(() => import("@/pages/AdjustRecordsPage").then((m) => ({ default: m.AdjustRecordsPage })));
const FinanceListPage = lazy(() => import("@/pages/FinanceListPage").then((m) => ({ default: m.FinanceListPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const OrdersPage = lazy(() => import("@/pages/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const DramaProjectsPage = lazy(() => import("@/pages/DramaProjectsPage").then((m) => ({ default: m.DramaProjectsPage })));
const DramaAssetDetailPage = lazy(() => import("@/pages/drama/DramaAssetDetailPage").then((m) => ({ default: m.DramaAssetDetailPage })));
const DramaAssetsPage = lazy(() => import("@/pages/drama/DramaAssetsPage").then((m) => ({ default: m.DramaAssetsPage })));
const DramaEpisodeDetailPage = lazy(() => import("@/pages/drama/DramaEpisodeDetailPage").then((m) => ({ default: m.DramaEpisodeDetailPage })));
const DramaEpisodesPage = lazy(() => import("@/pages/drama/DramaEpisodesPage").then((m) => ({ default: m.DramaEpisodesPage })));
const DramaFragmentDetailPage = lazy(() => import("@/pages/drama/DramaFragmentDetailPage").then((m) => ({ default: m.DramaFragmentDetailPage })));
const DramaFragmentsPage = lazy(() => import("@/pages/drama/DramaFragmentsPage").then((m) => ({ default: m.DramaFragmentsPage })));
const DramaProjectDetailPage = lazy(() => import("@/pages/drama/DramaProjectDetailPage").then((m) => ({ default: m.DramaProjectDetailPage })));
const QueuesPage = lazy(() => import("@/pages/QueuesPage").then((m) => ({ default: m.QueuesPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const TemplatesPage = lazy(() => import("@/pages/TemplatesPage").then((m) => ({ default: m.TemplatesPage })));
const UsersPage = lazy(() => import("@/pages/UsersPage").then((m) => ({ default: m.UsersPage })));
const WorksPage = lazy(() => import("@/pages/WorksPage").then((m) => ({ default: m.WorksPage })));
const ErrorReportsPage = lazy(() => import("@/pages/ErrorReportsPage").then((m) => ({ default: m.ErrorReportsPage })));
const loadCommercePages = () => import("@/pages/CommercePages");
const SubscriptionsPage = lazy(() => loadCommercePages().then((m) => ({ default: m.SubscriptionsPage })));
const TeamsPage = lazy(() => loadCommercePages().then((m) => ({ default: m.TeamsPage })));
const LibraryAdminPage = lazy(() => import("@/pages/LibraryAdminPage").then((m) => ({ default: m.LibraryAdminPage })));
const loadPartnerPages = () => import("@/pages/PartnerPages");
const PartnerSubmissionsPage = lazy(() => loadPartnerPages().then((m) => ({ default: m.PartnerSubmissionsPage })));
const PartnersAdminPage = lazy(() => loadPartnerPages().then((m) => ({ default: m.PartnersAdminPage })));
const MarketplaceAdmin = lazy(() => import("@/features/marketplace/MarketplaceAdmin"));

// 页面按需加载时只替换内容区，保留侧边栏与顶栏
function PageSuspense() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground" role="status">…</div>}>
      <Outlet />
    </Suspense>
  );
}

// Guard: require JWT + admin role
function RequireAdmin() {
  const token = getToken();
  const user = getCachedUser();
  if (!token || !isAdminUser(user)) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

// Admin app routes
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route element={<PageSuspense />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          {/* 席位团队（本分支）；上游团队空间已停用，其 TeamsPage / TeamDetailPage 不挂路由 */}
          <Route path="teams" element={<TeamsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="adjustments" element={<AdjustRecordsPage />} />
          <Route path="finance" element={<FinanceListPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="drama-projects" element={<DramaProjectsPage />} />
          <Route path="drama-projects/:projectId" element={<DramaProjectDetailPage />} />
          <Route path="drama-assets" element={<DramaAssetsPage />} />
          <Route path="drama-assets/:assetId" element={<DramaAssetDetailPage />} />
          <Route path="drama-episodes" element={<DramaEpisodesPage />} />
          <Route path="drama-episodes/:episodeId" element={<DramaEpisodeDetailPage />} />
          <Route path="drama-fragments" element={<DramaFragmentsPage />} />
          <Route path="drama-fragments/:fragmentId" element={<DramaFragmentDetailPage />} />
          <Route path="works" element={<WorksPage />} />
          <Route path="marketplace" element={<MarketplaceAdmin />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="queues" element={<QueuesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="error-reports" element={<ErrorReportsPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="library" element={<LibraryAdminPage />} />
          <Route path="partners" element={<PartnersAdminPage />} />
          <Route path="partner-submissions" element={<PartnerSubmissionsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
