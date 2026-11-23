import { useCallback, useEffect, useState } from 'react'
import { API_BASE, api, type McpRequestRow, type OAuthAppRow } from '../../api'
import { useI18n } from '../../i18n'
import { dialog } from '../../lib/dialog'

/** 个人中心：MCP 连接说明、已授权应用、自建 OAuth 应用、MCP 调用记录 */
export default function OAuthAppsPanel() {
  const { t } = useI18n()
  /* 数据 */
  const [apps, setApps] = useState<OAuthAppRow[]>([])
  const [authorized, setAuthorized] = useState<{ id: number; name: string; authorized_at?: string | null }[]>([])
  const [logs, setLogs] = useState<McpRequestRow[]>([])
  /* 新建应用表单与刚创建的密钥 */
  const [name, setName] = useState('')
  const [redirect, setRedirect] = useState('')
  const [created, setCreated] = useState<OAuthAppRow | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mcpUrl = `${API_BASE || window.location.origin}/api/mcp`

  const load = useCallback(async () => {
    const [a, l] = await Promise.all([api.oauthApps(), api.mcpRequests()])
    setApps(a.items)
    setAuthorized(a.authorized)
    setLogs(l.items)
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : t('common.fail')))
  }, [load, t])

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="pf-settings-card">
      <h1>{t('oauth.panelTitle')}</h1>
      <p className="pf-muted">{t('oauth.panelLead')}</p>
      {error ? <p className="pf-error">{error}</p> : null}

      <h3>{t('oauth.mcpTitle')}</h3>
      <p className="pf-muted">{t('oauth.mcpLead')}</p>
      <div className="pf-api-secret">
        <code>{mcpUrl}</code>
        <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => void navigator.clipboard?.writeText(mcpUrl)}>
          {t('partners.copy')}
        </button>
      </div>

      <h3>{t('oauth.authorizedTitle')}</h3>
      {authorized.length === 0 ? (
        <div className="pf-settings-empty">
          <p>{t('oauth.noAuthorized')}</p>
        </div>
      ) : (
        <ul className="pf-settings-list">
          {authorized.map((a) => (
            <li key={a.id}>
              <div className="pf-settings-list-row">
                <span className="pf-settings-list-main">
                  <strong>{a.name}</strong>
                  <em className="pf-muted">{a.authorized_at ? new Date(a.authorized_at).toLocaleString() : ''}</em>
                </span>
                <button
                  type="button"
                  className="pf-btn pf-btn-ghost pf-btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await dialog.confirm({ message: t('oauth.revokeConfirm', { app: a.name }), tone: 'danger' })
                    if (ok) await run(() => api.revokeOAuthAuthorization(a.id))
                  }}
                >
                  {t('oauth.revoke')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>{t('oauth.appsTitle')}</h3>
      <div className="pf-api-create">
        <input value={name} maxLength={128} placeholder={t('oauth.appName')} onChange={(e) => setName(e.target.value)} />
        <input value={redirect} placeholder="https://your.app/callback" onChange={(e) => setRedirect(e.target.value)} />
        <button
          type="button"
          className="pf-btn pf-btn-lime pf-btn-sm"
          disabled={busy || !name.trim() || !redirect.trim()}
          onClick={() =>
            void run(async () => {
              setCreated(await api.createOAuthApp(name.trim(), redirect.split(/[\s,]+/).filter(Boolean)))
              setName('')
              setRedirect('')
            })
          }
        >
          {t('oauth.createApp')}
        </button>
      </div>
      {created?.client_secret ? (
        <div className="pf-api-secret">
          <p>
            <strong>{t('oauth.secretOnce')}</strong>
          </p>
          <code>client_id: {created.client_id}</code>
          <code>client_secret: {created.client_secret}</code>
        </div>
      ) : null}
      {apps.length > 0 ? (
        <ul className="pf-settings-list">
          {apps.map((a) => (
            <li key={a.id}>
              <div className="pf-settings-list-row">
                <span className="pf-settings-list-main">
                  <strong>{a.name}</strong>
                  <em className="pf-muted">
                    {a.client_id} · {a.redirect_uris.join(', ')}
                  </em>
                </span>
                <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" disabled={busy} onClick={() => void run(() => api.deleteOAuthApp(a.id))}>
                  {t('oauth.deleteApp')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <h3>{t('oauth.logsTitle')}</h3>
      {logs.length === 0 ? (
        <div className="pf-settings-empty">
          <p>{t('oauth.noLogs')}</p>
        </div>
      ) : (
        <ul className="pf-settings-list">
          {logs.map((l) => (
            <li key={l.id}>
              <div className="pf-settings-list-row">
                <span className="pf-settings-list-main">
                  <strong>
                    {l.tool || l.method} · {l.status}
                  </strong>
                  <em className="pf-muted">
                    {l.app || '—'} · {l.duration_ms} ms · {l.created_at ? new Date(l.created_at).toLocaleString() : ''}
                  </em>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
