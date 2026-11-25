import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useI18n } from './i18n'
import DialogHost from './components/ui/DialogHost'
import BillingAlertHost from './components/billing/BillingAlertHost'
import { DramaGenQueuePanel } from './components/drama/DramaGenQueuePanel'
import WeChatGroupFab from './components/layout/WeChatGroupFab'
import AuthPage from './pages/AuthPage'
import GoogleCallbackPage from './pages/GoogleCallbackPage'
import TeamInvitePage from './pages/TeamInvitePage'
import PartnersPage from './pages/PartnersPage'
import OAuthAuthorizePage from './pages/OAuthAuthorizePage'
import TextToolPage from './pages/TextToolPage'
import UpscalePage from './pages/UpscalePage'
// three.js 较大，3D 工作室按需加载
const Studio3DPage = lazy(() => import('./pages/Studio3DPage'))
import LibraryPage from './pages/LibraryPage'
import CreativeBoardsPage from './pages/CreativeBoardsPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import MethodPage from './pages/MethodPage'
import GenerationPage from './pages/GenerationPage'
import GenerationTasksPage from './pages/GenerationTasksPage'
import ToolsPage from './pages/ToolsPage'
import ToolDetailPage from './pages/ToolDetailPage'
import HelpPage from './pages/HelpPage'
import ContactPage from './pages/ContactPage'
import { AcceptableUsePage, PrivacyPage, RefundPage, TermsPage } from './pages/LegalDocPage'
import SettingsPage from './pages/SettingsPage'
import PricingPage from './pages/PricingPage'
import PaymentReturnPage from './pages/PaymentReturnPage'
import StudioPage from './pages/StudioPage'
import TemplatesPage from './pages/TemplatesPage'
import CreateProjectPage from './pages/studio/CreateProjectPage'
import CreationSessionEditorBridge from './pages/studio/CreationSessionEditorBridge'
import StyleConfigPage from './pages/studio/StyleConfigPage'
import StoryboardPage from './pages/studio/StoryboardPage'
import EditorPage from './pages/studio/EditorPage'
import DramaListPage from './pages/drama/DramaListPage'
import CanvasListPage from './pages/drama/CanvasListPage'
import AssetLibraryPage from './pages/drama/AssetLibraryPage'
import ProjectWorkspacePage from './pages/drama/ProjectWorkspacePage'
import EpisodeEditPage from './pages/drama/EpisodeEditPage'
import EpisodesPage from './pages/drama/EpisodesPage'
import CanvasRoute from './pages/drama/canvas/CanvasRoute'
import EpisodeStoryboardPage from './pages/drama/episodeCanvas/EpisodeStoryboardPage'
import ProjectInvitationPage from './features/printfilm-studio/ProjectInvitationPage'
import RequireAuth from './pages/drama/RequireAuth'
import './styles/printfilm.css'
import './styles/appShell.css'
import './styles/picker.css'
import './App.css'

const Marketplace = lazy(() => import('./features/marketplace/Marketplace'))

/** 生成和余额均属于当前登录用户。 */
function PersonalBusinessOverlays() {
  return <><DramaGenQueuePanel /><BillingAlertHost /></>
}

/** 用户端路由及全局交互宿主；旧团队书签转向项目团队。 */
export default function App() {
  const { t } = useI18n()
  return (
    <BrowserRouter>
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
      <WeChatGroupFab />
      <PersonalBusinessOverlays />
      <DialogHost />
    </BrowserRouter>
  )
}
