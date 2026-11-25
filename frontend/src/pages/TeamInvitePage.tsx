import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import AppShell from '../components/layout/AppShell'
import { useI18n } from '../i18n'

type Preview = { team_name: string; inviter: string; email: string; role: string }

/** 团队邀请落地页：预览邀请 → 登录（受邀邮箱）→ 接受 */
export default function TeamInvitePage() {
  const { t } = useI18n()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const loggedIn = Boolean(localStorage.getItem('token'))
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) {
      setError(t('team.inviteInvalid'))
      return
    }
    api
      .previewTeamInvite(token)
      .then(setPreview)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.fail')))
  }, [token, t])

  async function accept() {
    setBusy(true)
    setError('')
    try {
      await api.acceptTeamInvite(token)
      nav('/settings?tab=team')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
    } finally {
      setBusy(false)
    }
  }

  const next = encodeURIComponent(`/teams/invite?token=${token}`)
  return (
    <AppShell>
      <section className="pf-settings-card pf-team-invite">
        <h1>{t('team.inviteHeading')}</h1>
        {error ? <p className="pf-error">{error}</p> : null}
        {preview ? (
          <>
            <p>{t('team.inviteBody', { who: preview.inviter, team: preview.team_name })}</p>
            <p className="pf-muted">{t('team.inviteFor', { email: preview.email })}</p>
            {loggedIn ? (
              <button type="button" className="pf-btn pf-btn-lime" disabled={busy} onClick={() => void accept()}>
                {t('team.accept')}
              </button>
            ) : (
              <Link className="pf-btn pf-btn-lime" to={`/auth?next=${next}`}>
                {t('team.loginToAccept')}
              </Link>
            )}
          </>
        ) : null}
      </section>
    </AppShell>
  )
}
