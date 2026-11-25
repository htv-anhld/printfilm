import { AlertCircle, ArrowLeft, LogIn, RefreshCw } from 'lucide-react'
import type { WorkspaceIssue } from './workspaceAccess'
import { tr } from '../../i18n'

export function WorkspaceAccessNotice({ issue, waiting, centered, hasDraft, onLogin, onRetry, onBack }: {
  issue: WorkspaceIssue | null; waiting: string; centered: boolean; hasDraft: boolean
  onLogin: () => void; onRetry: () => void; onBack: () => void
}) {
  return <section className={`pf-workspace-access${centered ? ' is-centered' : ''}`} role={issue ? 'alert' : 'status'} aria-live="polite">
    <div className="pf-access-icon">{issue ? <AlertCircle size={21} /> : <RefreshCw size={21} />}</div>
    <div className="pf-access-copy"><strong>{issue?.title || waiting}</strong><p>{issue?.message || tr('studioCanvas.workspaceAccessNotice.waitingHint')}</p></div>
    {issue && <div className="pf-access-actions">
      {issue.action === 'login' && <button type="button" onClick={onLogin}><LogIn size={16} />{hasDraft ? tr('studioCanvas.workspaceAccessNotice.exportAndLogin') : tr('studioCanvas.workspaceAccessNotice.loginAgain')}</button>}
      {issue.action === 'retry' && <button type="button" onClick={onRetry}><RefreshCw size={16} />{tr('studioCanvas.common.retry')}</button>}
      <button type="button" className="is-secondary" onClick={onBack}><ArrowLeft size={16} />{tr('studioCanvas.common.backToProjects')}</button>
    </div>}
  </section>
}
