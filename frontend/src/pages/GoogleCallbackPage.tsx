import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import BrandMark from '../components/BrandMark'
import { useI18n } from '../i18n'

/** Google 授权回调：把 code + state 交给后端换 token，然后回到原页面 */
export default function GoogleCallbackPage() {
  const nav = useNavigate()
  const { t } = useI18n()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  // StrictMode 下 effect 会跑两次，授权码只能用一次
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const code = params.get('code') || ''
    const state = params.get('state') || ''
    if (params.get('error') || !code || !state) {
      setError(t('auth.googleCancelled'))
      return
    }
    api
      .googleExchange(code, state)
      .then((res) => {
        localStorage.setItem('token', res.access_token)
        nav(res.next || '/', { replace: true })
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('common.fail')))
  }, [nav, params, t])

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-panel-top">
          <BrandMark />
        </div>
        <h1>{t('auth.google')}</h1>
        {error ? (
          <>
            <p className="error" role="alert">
              {error}
            </p>
            <Link className="linkish" to="/auth">
              {t('auth.backToLogin')}
            </Link>
          </>
        ) : (
          <p className="auth-notice" role="status">
            {t('auth.processing')}
          </p>
        )}
      </div>
      <div className="auth-visual" aria-hidden>
        <div className="ink-wash" />
      </div>
    </div>
  )
}
