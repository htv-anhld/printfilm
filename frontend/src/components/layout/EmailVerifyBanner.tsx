import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../api'
import { useI18n } from '../../i18n'

/** 已登录但邮箱未验证时的顶部提示（赠送额度要验证后才到账） */
export default function EmailVerifyBanner() {
  const { t } = useI18n()
  const location = useLocation()
  const [unverified, setUnverified] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setUnverified(false)
      return
    }
    api
      .me()
      .then((u) => setUnverified(u.email_verified === false))
      .catch(() => setUnverified(false))
  }, [location.pathname])

  if (!unverified) return null
  const next = encodeURIComponent(location.pathname + location.search)
  return (
    <div className="pf-verify-banner" role="status">
      <span>{t('auth.verify.banner')}</span>
      <Link to={`/auth?mode=verify&next=${next}`}>{t('auth.verify.bannerCta')}</Link>
    </div>
  )
}
