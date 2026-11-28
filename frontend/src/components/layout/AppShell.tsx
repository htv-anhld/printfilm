import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { GITHUB_REPO_URL } from '../../lib/siteLinks'
import type { NavActive as SiteNavActive } from '../../lib/siteNavigation'
import EmailVerifyBanner from './EmailVerifyBanner'
import AppSidebar, { type NavActive as SidebarNavActive } from './AppSidebar'

/** 页面可传侧栏 key，也可传上游新页面的导航 key（如 canvas / tasks）；侧栏不认识的 key 交给路径匹配 */
export type NavActive = SidebarNavActive | SiteNavActive

const SIDEBAR_KEYS = new Set<string>(['home', 'drama', 'kepu', 'tools', 'assets', 'pricing', 'templates', 'studio', 'history'])

/** 只把侧栏支持的 active 透传给 AppSidebar */
function sidebarActive(active?: NavActive): SidebarNavActive | undefined {
  return active && SIDEBAR_KEYS.has(active) ? (active as SidebarNavActive) : undefined
}

type Props = {
  children: ReactNode
  active?: NavActive
  wide?: boolean
  flush?: boolean
  /** 隐藏页脚（全屏工作台） */
  hideFooter?: boolean
}

export default function AppShell({ children, active, wide, flush, hideFooter }: Props) {
  const { t } = useI18n()

  return (
    <div className="pf-shell pf-shell-app">
      <a className="pf-skip-content" href="#pf-main-content">{t('nav.skipContent')}</a>
      <AppSidebar active={sidebarActive(active)} />
      <div className="pf-shell-body">
      <EmailVerifyBanner />
      <main id="pf-main-content" tabIndex={-1} className={['pf-shell-main', wide ? 'wide' : '', flush ? 'flush' : ''].filter(Boolean).join(' ')}>
        {children}
      </main>
      {!hideFooter && !flush ? (
        <footer className="pf-shell-footer">
          <nav className="pf-shell-footer-links" aria-label={t('footer.links')}>
            <Link to="/terms">{t('footer.terms')}</Link>
            <Link to="/privacy">{t('footer.privacy')}</Link>
            <Link to="/refund">{t('footer.refund')}</Link>
            <Link to="/acceptable-use">{t('footer.acceptableUse')}</Link>
            <Link to="/partners">{t('footer.partners')}</Link>
            <Link to="/contact">{t('footer.contact')}</Link>
            <Link to="/help">{t('footer.help')}</Link>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
              {t('footer.github')}
            </a>
          </nav>
          <p>© {new Date().getFullYear()} Prismreel. All rights reserved.</p>
        </footer>
      ) : null}
      </div>
    </div>
  )
}
