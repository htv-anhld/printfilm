import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppShell from '../../components/layout/AppShell'
import Button from '../../components/ui/Button'
import { projectSharingApi } from './projectSharing'
import { tr } from '../../i18n'

/** Invitation secrets stay in the fragment and are submitted only in a POST body. */
export default function ProjectInvitationPage() {
  const location = useLocation(), navigate = useNavigate()
  const [token] = useState(() => {
    const incoming = new URLSearchParams(location.hash.slice(1)).get('token')
    if (incoming) return incoming
    const pending = sessionStorage.getItem('pf-project-invite')
    if (!pending) return ''
    try { const item = JSON.parse(pending); return item.expires > Date.now() ? String(item.token) : '' } catch { return '' }
  })
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const loggedIn = Boolean(localStorage.getItem('token'))
  async function accept() {
    setBusy(true); setError('')
    try {
      const result = await projectSharingApi.accept(token)
      sessionStorage.removeItem('pf-project-invite')
      navigate(`/drama/projects/${result.project_id}/canvas`, { replace: true })
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('studioCanvas.projectInvitationPage.joinFailed')) } finally { setBusy(false) }
  }
  function login() {
    sessionStorage.setItem('pf-project-invite', JSON.stringify({ token, expires: Date.now() + 30 * 60_000 }))
    navigate('/auth?next=%2Fcanvas%2Fjoin', { replace: true })
  }
  return <AppShell active="canvas"><section className="pf-team-panel pf-team-empty"><h1>{tr('studioCanvas.projectInvitationPage.title')}</h1><p>{tr('studioCanvas.projectInvitationPage.intro')}</p><p>{tr('studioCanvas.projectInvitationPage.costNote')}</p>{token ? <Button variant="lime" disabled={busy} onClick={() => loggedIn ? void accept() : login()}>{busy ? tr('studioCanvas.projectInvitationPage.joining') : loggedIn ? tr('studioCanvas.projectInvitationPage.accept') : tr('studioCanvas.projectInvitationPage.loginToJoin')}</Button> : <p role="alert">{tr('studioCanvas.projectInvitationPage.missingToken')}</p>}{error && <p role="alert">{error}</p>}<Button to="/canvas">{tr('studioCanvas.common.backToProjects')}</Button></section></AppShell>
}
