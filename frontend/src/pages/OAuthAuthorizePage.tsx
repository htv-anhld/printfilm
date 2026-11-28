import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import BrandMark from '../components/BrandMark'
import { useI18n } from '../i18n'

/** OAuth 同意页（authorization_endpoint）：第三方应用 / MCP 客户端请求代用户调用 Prismreel */
export default function OAuthAuthorizePage() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const clientId = params.get('client_id') || ''
  const redirectUri = params.get('redirect_uri') || ''
  const loggedIn = Boolean(localStorage.getItem('token'))
  const [info, setInfo] = useState<{ name: string; redirect_host: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (params.get('response_type') && params.get('response_type') !== 'code') {
      setError(t('oauth.unsupported'))
      return
    }
    api
      .oauthAuthorizePreview(clientId, redirectUri)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.fail')))
  }, [clientId, redirectUri, params, t])

  // 同意 / 拒绝：后端返回要跳转的回调地址
  async function decide(approve: boolean) {
    setBusy(true)
    setError('')
    try {
      const res = await api.oauthAuthorize({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: params.get('scope'),
        state: params.get('state'),
        code_challenge: params.get('code_challenge') || '',
        code_challenge_method: params.get('code_challenge_method') || 'S256',
        approve,
      })
      window.location.assign(res.redirect_url)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
      setBusy(false)
    }
  }

  const next = encodeURIComponent(`/oauth/authorize?${params.toString()}`)
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-panel-top">
          <BrandMark />
        </div>
        <h1>{t('oauth.title')}</h1>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <>
            <p>{t('oauth.request', { app: info.name })}</p>
            <ul className="pf-oauth-scopes">
              <li>{t('oauth.scopeGenerate')}</li>
              <li>{t('oauth.scopeRead')}</li>
            </ul>
            <p className="pf-muted">{t('oauth.redirect', { host: info.redirect_host })}</p>
            {loggedIn ? (
              <div className="stack">
                <button type="button" className="btn primary" disabled={busy} onClick={() => void decide(true)}>
                  {t('oauth.allow')}
                </button>
                <button type="button" className="linkish" disabled={busy} onClick={() => void decide(false)}>
                  {t('oauth.deny')}
                </button>
              </div>
            ) : (
              <Link className="btn primary" to={`/auth?next=${next}`}>
                {t('oauth.login')}
              </Link>
            )}
          </>
        ) : null}
      </div>
      <div className="auth-visual" aria-hidden>
        <div className="ink-wash" />
      </div>
    </div>
  )
}
