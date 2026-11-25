import { USER_UPDATED_EVENT } from '../lib/userEvents'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import BrandMark from '../components/BrandMark'
import LanguageSwitch from '../components/layout/LanguageSwitch'
import { useI18n } from '../i18n'
import { referralCode } from '../lib/referral'
import { isValidAuthPassword, isValidEmailInput } from '../lib/validateAuthForm'

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify'

// 仅允许站内相对路径回跳，防止开放重定向
function safeNextPath(raw: string | null, fallback = '/') {
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return fallback
  return raw
}

// 由 URL ?mode= / ?token= 决定初始 Auth 模式
function modeFromParams(params: URLSearchParams): AuthMode {
  const mode = (params.get('mode') || '').toLowerCase()
  // 邮箱验证（链接带 token 或登录后输入验证码）必须先于「有 token 即重置」判断
  if (mode === 'verify') return 'verify'
  if (mode === 'reset' || params.get('token')) return 'reset'
  if (mode === 'forgot') return 'forgot'
  if (mode === 'register') return 'register'
  return 'login'
}

export default function AuthPage() {
  const nav = useNavigate()
  const { t } = useI18n()
  const [params, setSearchParams] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'), '/')
  /*
   * mode 当前表单模式
   * email / password / confirmPassword / nickname 表单字段
   * notice 成功提示（找回已发送、重置成功）
   * error / loading 提交态
   */
  const [mode, setMode] = useState<AuthMode>(() => modeFromParams(params))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const resetToken = (params.get('token') || '').trim()
  /* 邮箱验证码与第三方登录 */
  const [code, setCode] = useState('')
  const [googleEnabled, setGoogleEnabled] = useState(false)

  useEffect(() => {
    api
      .authProviders()
      .then((r) => setGoogleEnabled(Boolean(r.google)))
      .catch(() => setGoogleEnabled(false))
  }, [])

  // 邮件链接：/auth?mode=verify&token=… 自动完成验证并登录
  useEffect(() => {
    if (mode !== 'verify' || !resetToken) return
    setLoading(true)
    api
      .verifyEmailToken(resetToken)
      .then((res) => {
        localStorage.setItem('token', res.access_token)
        window.dispatchEvent(new Event(USER_UPDATED_EVENT))
        nav(nextPath)
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('common.fail')))
      .finally(() => setLoading(false))
    // 只在进入页面时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Google 登录：拿授权地址后整页跳转
  async function loginWithGoogle() {
    setError('')
    setLoading(true)
    try {
      const res = await api.googleStart(nextPath)
      window.location.assign(res.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.fail'))
      setLoading(false)
    }
  }

  // 重发验证邮件
  async function resend() {
    setError('')
    try {
      const res = await api.resendVerification()
      if (res.verified) {
        nav(nextPath)
        return
      }
      setNotice(res.cooldown ? t('auth.verify.cooldown', { n: res.cooldown }) : t('auth.verify.resent'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.fail'))
    }
  }

  // 切换模式并同步 URL（保留 next）
  function switchMode(next: AuthMode) {
    setMode(next)
    setError('')
    setNotice('')
    setPassword('')
    setConfirmPassword('')
    if (next === 'register') setNickname('')
    const nextParams = new URLSearchParams()
    if (nextPath && nextPath !== '/') nextParams.set('next', nextPath)
    if (next === 'forgot') nextParams.set('mode', 'forgot')
    else if (next === 'reset' && resetToken) {
      nextParams.set('mode', 'reset')
      nextParams.set('token', resetToken)
    } else if (next === 'register') nextParams.set('mode', 'register')
    setSearchParams(nextParams, { replace: true })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')

    if (mode === 'forgot') {
      const trimmedEmail = email.trim()
      if (!isValidEmailInput(trimmedEmail)) {
        setError(t('auth.emailInvalid'))
        return
      }
      setLoading(true)
      try {
        const res = await api.forgotPassword(trimmedEmail)
        setNotice(res.message || t('auth.forgotSent'))
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.fail'))
      } finally {
        setLoading(false)
      }
      return
    }

    if (mode === 'verify') {
      if (!/^\d{6}$/.test(code.trim())) {
        setError(t('auth.verify.codeInvalid'))
        return
      }
      setLoading(true)
      try {
        await api.verifyEmailCode(code.trim())
        nav(nextPath)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.fail'))
      } finally {
        setLoading(false)
      }
      return
    }

    if (mode === 'reset') {
      if (!resetToken) {
        setError(t('auth.resetTokenMissing'))
        return
      }
      if (!isValidAuthPassword(password)) {
        setError(password.length > 64 ? t('auth.passwordTooLong') : t('auth.passwordTooShort'))
        return
      }
      if (password !== confirmPassword) {
        setError(t('auth.passwordMismatch'))
        return
      }
      setLoading(true)
      try {
        await api.resetPassword(resetToken, password)
        setPassword('')
        setConfirmPassword('')
        switchMode('login')
        setNotice(t('auth.resetSuccess'))
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.fail'))
      } finally {
        setLoading(false)
      }
      return
    }

    const trimmedEmail = email.trim()
    if (mode === 'register' && !nickname.trim()) {
      setError(t('auth.nicknameRequired'))
      return
    }
    if (!isValidEmailInput(trimmedEmail)) {
      setError(t('auth.emailInvalid'))
      return
    }
    if (!isValidAuthPassword(password)) {
      setError(password.length > 64 ? t('auth.passwordTooLong') : t('auth.passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      const res =
        mode === 'login'
          ? await api.login(trimmedEmail, password)
          : await api.register(trimmedEmail, password, nickname.trim(), referralCode())
      localStorage.setItem('token', res.access_token)
      if ('email_verification_required' in res && res.email_verification_required) {
        // 注册后先验证邮箱（赠送额度在验证后到账）
        setMode('verify')
        setNotice(t('auth.verify.sent', { email: trimmedEmail }))
        return
      }
      window.dispatchEvent(new Event(USER_UPDATED_EVENT))
      nav(nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.fail'))
    } finally {
      setLoading(false)
    }
  }

  const title =
    mode === 'login'
      ? t('auth.loginTitle')
      : mode === 'register'
        ? t('auth.registerTitle')
        : mode === 'forgot'
          ? t('auth.forgotTitle')
          : mode === 'verify'
            ? t('auth.verify.title')
            : t('auth.resetTitle')

  const submitLabel =
    mode === 'login'
      ? t('auth.login')
      : mode === 'register'
        ? t('auth.register')
        : mode === 'forgot'
          ? t('auth.sendReset')
          : mode === 'verify'
            ? t('auth.verify.submit')
            : t('auth.savePassword')

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-panel-top">
          <BrandMark />
          <LanguageSwitch />
        </div>
        <h1>{title}</h1>
        <form onSubmit={onSubmit} className="stack" noValidate>
          {mode === 'verify' && (
            <label>
              {t('auth.verify.code')}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''))
                  if (error) setError('')
                }}
              />
            </label>
          )}
          {mode === 'register' && (
            <label>
              {t('auth.nickname')}
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </label>
          )}
          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <label>
              {t('auth.email')}
              <input
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError('')
                }}
              />
            </label>
          )}
          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <label>
              {mode === 'reset' ? t('auth.newPassword') : t('auth.password')}
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError('')
                }}
              />
            </label>
          )}
          {mode === 'reset' && (
            <label>
              {t('auth.confirmPassword')}
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (error) setError('')
                }}
              />
            </label>
          )}
          {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button className="btn primary" disabled={loading}>
            {loading ? t('auth.processing') : submitLabel}
          </button>
        </form>
        {(mode === 'login' || mode === 'register') && googleEnabled ? (
          <>
            <div className="auth-divider" role="separator">
              <span>{t('auth.or')}</span>
            </div>
            <button type="button" className="btn auth-google" disabled={loading} onClick={() => void loginWithGoogle()}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              {t('auth.google')}
            </button>
          </>
        ) : null}
        {mode === 'verify' && !resetToken && (
          <button type="button" className="linkish" onClick={() => void resend()}>
            {t('auth.verify.resend')}
          </button>
        )}
        {mode === 'login' && (
          <button type="button" className="linkish" onClick={() => switchMode('forgot')}>
            {t('auth.forgotLink')}
          </button>
        )}
        {(mode === 'login' || mode === 'register') && (
          <button
            type="button"
            className="linkish"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
          </button>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <button type="button" className="linkish" onClick={() => switchMode('login')}>
            {t('auth.backToLogin')}
          </button>
        )}
      </div>
      <div className="auth-visual" aria-hidden>
        <div className="ink-wash" />
      </div>
    </div>
  )
}
