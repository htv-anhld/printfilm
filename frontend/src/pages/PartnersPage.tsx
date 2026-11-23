import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type PartnerDashboard, type PartnerInfo, type PartnerSubmission } from '../api'
import AppShell from '../components/layout/AppShell'
import { useI18n } from '../i18n'
import { formatMoney, useBillingConfig } from '../lib/money'

/** 合作伙伴计划：介绍 → 申请 → 看板（推广链接、佣金、兑换、推广内容提交） */
export default function PartnersPage() {
  const { t } = useI18n()
  useBillingConfig()
  const loggedIn = Boolean(localStorage.getItem('token'))
  /* 我的合作伙伴状态与看板 */
  const [me, setMe] = useState<PartnerInfo | null>(null)
  const [dash, setDash] = useState<PartnerDashboard | null>(null)
  const [subs, setSubs] = useState<PartnerSubmission[]>([])
  /* 申请表单 / 提交表单 */
  const [form, setForm] = useState({ channel: '', website: '', audience: '', note: '' })
  const [sub, setSub] = useState({ url: '', platform: '', note: '' })
  /* 状态 */
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!loggedIn) return
    const info = await api.partnerMe()
    setMe(info)
    if (info.status === 'approved') {
      const [d, s] = await Promise.all([api.partnerDashboard(), api.partnerSubmissions()])
      setDash(d)
      setSubs(s.items)
    }
  }, [loggedIn])

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : t('common.fail')))
  }, [load, t])

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      if (ok) setNotice(ok)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
    } finally {
      setBusy(false)
    }
  }

  const rate = Math.round((me?.commission_rate ?? 0.2) * 100)

  return (
    <AppShell>
      <div className="pf-partners">
        <header className="pf-partners-hero">
          <h1>{t('partners.title')}</h1>
          <p>{t('partners.lead', { rate })}</p>
          <ul>
            <li>{t('partners.point1', { rate })}</li>
            <li>{t('partners.point2')}</li>
            <li>{t('partners.point3')}</li>
          </ul>
        </header>

        {error ? <p className="pf-error">{error}</p> : null}
        {notice ? <p className="pf-pricing-hint">{notice}</p> : null}

        {!loggedIn ? (
          <Link className="pf-btn pf-btn-lime" to="/auth?next=%2Fpartners">
            {t('partners.loginToApply')}
          </Link>
        ) : null}

        {loggedIn && me && me.status !== 'approved' ? (
          <section className="pf-settings-card">
            <h2>{t('partners.applyTitle')}</h2>
            {me.status === 'pending' ? <p className="pf-muted">{t('partners.pending')}</p> : null}
            {me.status === 'rejected' ? <p className="pf-error">{t('partners.rejected', { note: me.review_note || '—' })}</p> : null}
            {me.status === 'suspended' ? <p className="pf-error">{t('partners.suspended')}</p> : null}
            <div className="pf-partners-form">
              <label>
                {t('partners.channel')}
                <input value={form.channel} maxLength={64} placeholder="YouTube, TikTok, Blog…" onChange={(e) => setForm({ ...form, channel: e.target.value })} />
              </label>
              <label>
                {t('partners.website')}
                <input value={form.website} maxLength={512} placeholder="https://" onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </label>
              <label>
                {t('partners.audience')}
                <input value={form.audience} maxLength={64} placeholder="10k" onChange={(e) => setForm({ ...form, audience: e.target.value })} />
              </label>
              <label>
                {t('partners.note')}
                <textarea value={form.note} maxLength={1000} rows={3} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
              <button type="button" className="pf-btn pf-btn-lime" disabled={busy || me.status === 'suspended'} onClick={() => void run(() => api.partnerApply(form), t('partners.applied'))}>
                {me.status === 'none' ? t('partners.apply') : t('partners.update')}
              </button>
            </div>
          </section>
        ) : null}

        {dash ? (
          <>
            <section className="pf-settings-card">
              <h2>{t('partners.linkTitle')}</h2>
              <div className="pf-api-secret">
                <code>{dash.partner.ref_link}</code>
                <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => void navigator.clipboard?.writeText(dash.partner.ref_link || '')}>
                  {t('partners.copy')}
                </button>
              </div>
              <div className="pf-partners-stats">
                <div><span>{t('partners.signups')}</span><strong>{dash.signups}</strong></div>
                <div><span>{t('partners.paying')}</span><strong>{dash.paying_users}</strong></div>
                <div><span>{t('partners.held', { days: dash.hold_days })}</span><strong>{formatMoney(dash.held_fen)}</strong></div>
                <div><span>{t('partners.available')}</span><strong>{formatMoney(dash.available_fen)}</strong></div>
                <div><span>{t('partners.redeemed')}</span><strong>{formatMoney(dash.redeemed_fen)}</strong></div>
              </div>
              <button
                type="button"
                className="pf-btn pf-btn-lime"
                disabled={busy || dash.available_fen <= 0}
                onClick={() => void run(() => api.partnerRedeem(), t('partners.redeemedOk'))}
              >
                {t('partners.redeem')}
              </button>
              {dash.recent.length > 0 ? (
                <ul className="pf-settings-list">
                  {dash.recent.map((r) => (
                    <li key={r.id}>
                      <div className="pf-settings-list-row">
                        <span className="pf-settings-list-main">
                          <strong>{formatMoney(r.commission_fen)}</strong>
                          <em className="pf-muted">
                            {t(`partners.source.${r.source_type}`)} · {formatMoney(r.paid_fen)} · {t(`partners.status.${r.status}`)}
                          </em>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="pf-settings-card">
              <h2>{t('partners.submitTitle')}</h2>
              <p className="pf-muted">{t('partners.submitLead')}</p>
              <div className="pf-api-create">
                <input value={sub.url} placeholder="https://" onChange={(e) => setSub({ ...sub, url: e.target.value })} />
                <input value={sub.platform} placeholder="TikTok" maxLength={32} onChange={(e) => setSub({ ...sub, platform: e.target.value })} />
                <button
                  type="button"
                  className="pf-btn pf-btn-lime pf-btn-sm"
                  disabled={busy || !sub.url.trim()}
                  onClick={() =>
                    void run(async () => {
                      await api.partnerSubmit(sub)
                      setSub({ url: '', platform: '', note: '' })
                    }, t('partners.submitted'))
                  }
                >
                  {t('partners.submit')}
                </button>
              </div>
              {subs.length > 0 ? (
                <ul className="pf-settings-list">
                  {subs.map((s) => (
                    <li key={s.id}>
                      <div className="pf-settings-list-row">
                        <span className="pf-settings-list-main">
                          <a href={s.url} target="_blank" rel="noreferrer noopener">{s.url}</a>
                          <em className="pf-muted">
                            {t(`partners.subStatus.${s.status}`)}
                            {s.reward_fen ? ` · +${formatMoney(s.reward_fen)}` : ''}
                            {s.review_note ? ` · ${s.review_note}` : ''}
                          </em>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
