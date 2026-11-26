import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useI18n } from './i18n'
import DialogHost from './components/ui/DialogHost'
import BillingAlertHost from './components/billing/BillingAlertHost'
import { DramaGenQueuePanel } from './components/drama/DramaGenQueuePanel'
import WeChatGroupFab from './components/layout/WeChatGroupFab'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import RequireAuth from './pages/drama/RequireAuth'
import './styles/printfilm.css'
import './styles/appShell.css'
import './styles/picker.css'
import './App.css'

// 路由页面全部按需加载（首页 / 登录页除外），避免首屏下载整站 JS
const GoogleCallbackPage = lazy(() => import('./pages/GoogleCallbackPage'))
const TeamInvitePage = lazy(() => import('./pages/TeamInvitePage'))
const PartnersPage = lazy(() => import('./pages/PartnersPage'))
const OAuthAuthorizePage = lazy(() => import('./pages/OAuthAuthorizePage'))
const TextToolPage = lazy(() => import('./pages/TextToolPage'))
const UpscalePage = lazy(() => import('./pages/UpscalePage'))
const Studio3DPage = lazy(() => import('./pages/Studio3DPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const CreativeBoardsPage = lazy(() => import('./pages/CreativeBoardsPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const MethodPage = lazy(() => import('./pages/MethodPage'))
const GenerationPage = lazy(() => import('./pages/GenerationPage'))
const GenerationTasksPage = lazy(() => import('./pages/GenerationTasksPage'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const ToolDetailPage = lazy(() => import('./pages/ToolDetailPage'))
const HelpPage = lazy(() => import('./pages/HelpPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
// 法务页同一模块的具名导出：共用一次动态加载
const loadLegal = () => import('./pages/LegalDocPage')
const AcceptableUsePage = lazy(() => loadLegal().then((m) => ({ default: m.AcceptableUsePage })))
const PrivacyPage = lazy(() => loadLegal().then((m) => ({ default: m.PrivacyPage })))
const RefundPage = lazy(() => loadLegal().then((m) => ({ default: m.RefundPage })))
const TermsPage = lazy(() => loadLegal().then((m) => ({ default: m.TermsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const PaymentReturnPage = lazy(() => import('./pages/PaymentReturnPage'))
const StudioPage = lazy(() => import('./pages/StudioPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const CreateProjectPage = lazy(() => import('./pages/studio/CreateProjectPage'))
const CreationSessionEditorBridge = lazy(() => import('./pages/studio/CreationSessionEditorBridge'))
const StyleConfigPage = lazy(() => import('./pages/studio/StyleConfigPage'))
const StoryboardPage = lazy(() => import('./pages/studio/StoryboardPage'))
const EditorPage = lazy(() => import('./pages/studio/EditorPage'))
const DramaListPage = lazy(() => import('./pages/drama/DramaListPage'))
const CanvasListPage = lazy(() => import('./pages/drama/CanvasListPage'))
const AssetLibraryPage = lazy(() => import('./pages/drama/AssetLibraryPage'))
const ProjectWorkspacePage = lazy(() => import('./pages/drama/ProjectWorkspacePage'))
const EpisodeEditPage = lazy(() => import('./pages/drama/EpisodeEditPage'))
const EpisodesPage = lazy(() => import('./pages/drama/EpisodesPage'))
const CanvasRoute = lazy(() => import('./pages/drama/canvas/CanvasRoute'))
const EpisodeStoryboardPage = lazy(() => import('./pages/drama/episodeCanvas/EpisodeStoryboardPage'))
const ProjectInvitationPage = lazy(() => import('./features/printfilm-studio/ProjectInvitationPage'))

const Marketplace = lazy(() => import('./features/marketplace/Marketplace'))

/** 按需加载页面时的占位（与页面背景一致，避免白屏闪烁） */
function RouteFallback() {
  const { t } = useI18n()
  return <div className="pf-route-fallback" role="status" aria-live="polite">{t('common.loading')}</div>
}

/** 生成和余额均属于当前登录用户。 */
function PersonalBusinessOverlays() {
  return <><DramaGenQueuePanel /><BillingAlertHost /></>
}

/** 用户端路由及全局交互宿主；旧团队书签转向项目团队。 */
export default function App() {
  const { t } = useI18n()
  return (
    <BrowserRouter>
      {/* 路由级代码分割：除首页 / 登录外全部按需加载，首屏只下载当前页的 JS */}
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/marketplace/*" element={<Suspense fallback={<p>{t('common.loadingMarketplace')}</p>}><Marketplace /></Suspense>} />
        <Route path="/" element={<HomePage />} />
        <Route path="/method" element={<MethodPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/teams/invite" element={<TeamInvitePage />} />
        <Route path="/partners" element={<PartnersPage />} />
        <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/tools/text/:kind" element={<TextToolPage />} />
        <Route path="/tools/upscale" element={<UpscalePage />} />
        <Route
          path="/studio3d"
          element={
            <Suspense fallback={null}>
              <Studio3DPage />
            </Suspense>
          }
        />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/creative" element={<CreativeBoardsPage />} />
        <Route path="/tools/video" element={<RequireAuth><GenerationPage kind="video" /></RequireAuth>} />
        <Route path="/tools/image" element={<RequireAuth><GenerationPage kind="image" /></RequireAuth>} />
        <Route path="/tools/audio" element={<RequireAuth><GenerationPage kind="audio" /></RequireAuth>} />
        <Route path="/tasks" element={<RequireAuth><GenerationTasksPage /></RequireAuth>} />
        <Route path="/tools/:toolId" element={<ToolDetailPage />} />
        <Route path="/assets" element={<AssetLibraryPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refund" element={<RefundPage />} />
        <Route path="/acceptable-use" element={<AcceptableUsePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/teams" element={<Navigate to="/settings?tab=team" replace />} />
        <Route path="/teams/join" element={<Navigate to="/settings?tab=team" replace />} />
        <Route path="/team-invitations" element={<Navigate to="/settings?tab=team" replace />} />
        <Route path="/teams/:teamId" element={<Navigate to="/settings?tab=team" replace />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/studio/new" element={<CreateProjectPage />} />
        <Route path="/studio/sessions/:sessionId" element={<CreationSessionEditorBridge />} />
        <Route path="/studio/:id/style" element={<StyleConfigPage />} />
        <Route path="/studio/:id/editor" element={<EditorPage />} />
        <Route path="/studio/:id" element={<StoryboardPage />} />
        <Route path="/studio" element={<StudioPage />} />
        {/* Agent home (mirrors novel agent entry) */}
        <Route path="/drama" element={<DramaListPage />} />
        <Route path="/canvas" element={<CanvasListPage />} />
        <Route path="/canvas/join" element={<ProjectInvitationPage />} />
        <Route path="/drama/dramas" element={<DramaListPage />} />
        <Route path="/drama/assets" element={<AssetLibraryPage />} />
        <Route path="/drama/projects/:projectId" element={<ProjectWorkspacePage />} />
        <Route path="/drama/projects/:projectId/episodes" element={<EpisodesPage />} />
        <Route path="/drama/projects/:projectId/episodes/:episodeId" element={<EpisodeEditPage />} />
        <Route
          path="/drama/projects/:projectId/episodes/:episodeId/canvas"
          element={<EpisodeStoryboardPage />}
        />
        {/* Legacy URL remains routable for bookmarks but opens the new workspace. */}
        <Route path="/drama/projects/:projectId/canvas" element={<RequireAuth><CanvasRoute /></RequireAuth>} />
        <Route path="/drama/projects/:projectId/printfilm-studio" element={<RequireAuth><CanvasRoute /></RequireAuth>} />
        <Route path="/payments/return" element={<PaymentReturnPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <WeChatGroupFab />
      <PersonalBusinessOverlays />
      <DialogHost />
    </BrowserRouter>
  )
}
