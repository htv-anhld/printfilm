import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Bot,
  Box,
  ChevronsLeft,
  ChevronsRight,
  Clapperboard,
  CreditCard,
  Film,
  FolderOpen,
  Handshake,
  HelpCircle,
  House,
  Library,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  Store,
  Sun,
  Wallet,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../../api'
import type { User } from '../../api'
import UserAvatar from '../UserAvatar'
import CreateChoiceModal from '../ui/CreateChoiceModal'
import { USER_UPDATED_EVENT } from '../../lib/userEvents'
import { getTheme, onThemeChange, setTheme, type Theme } from '../../lib/theme'
import { useI18n } from '../../i18n'
import LanguageSwitch from './LanguageSwitch'

export type NavActive = 'home' | 'drama' | 'kepu' | 'tools' | 'assets' | 'pricing' | 'templates' | 'studio' | 'history'

type NavItem = {
  key: string
  to: string
  label: string
  icon: LucideIcon
  tag?: 'new' | 'beta'
  /** 路径前缀命中即高亮（默认用 to 本身） */
  match?: string[]
}

type Props = {
  active?: NavActive
}

const COLLAPSE_KEY = 'pf-side-collapsed'

/** 旧页面传入的 active 别名 → 侧栏 key */
function legacyActiveKey(active: NavActive | undefined): string | undefined {
  if (!active) return undefined
  if (active === 'studio' || active === 'templates' || active === 'history') return 'kepu'
  return active
}

/** 按路径找当前高亮项（最长前缀优先） */
function activeKeyFromPath(items: NavItem[], pathname: string, search: string): string | undefined {
  let best: { key: string; len: number } | undefined
  for (const item of items) {
    const prefixes = item.match ?? [item.to]
    for (const raw of prefixes) {
      const [path, query] = raw.split('?')
      if (query && !search.includes(query)) continue
      const hit = path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
      const len = path.length + (query ? query.length : 0)
      if (hit && (!best || len > best.len)) best = { key: item.key, len }
    }
  }
  return best?.key
}

/** 读折叠偏好（存储不可用时默认展开） */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 应用左侧导航（参照 Dravelio 的 ax-side）：
 * 创作 / 账户两组链接，底部「更多」弹层放余额、帮助、语言、明暗主题与退出；
 * 桌面可折叠成图标栏，≤960px 变成顶栏 + 抽屉。
 */
export default function AppSidebar({ active }: Props) {
  const nav = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  /*
   * user 当前用户；balance 余额展示串
   * collapsed 桌面折叠；drawerOpen 移动端抽屉；moreOpen「更多」弹层
   * theme 当前明暗；createOpen 新建选择弹层
   */
  const [user, setUser] = useState<User | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>(getTheme)
  const [createOpen, setCreateOpen] = useState(false)
  /* marketplaceOn：数字资产市场是否已在后台启用（读 /api/marketplace/capabilities） */
  const [marketplaceOn, setMarketplaceOn] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const createItems: NavItem[] = [
    { key: 'home', to: '/', label: t('appNav.home'), icon: House },
    { key: 'creative', to: '/creative', label: t('appNav.creativeStudio'), icon: Sparkles },
    { key: 'canvas', to: '/canvas', label: t('nav.canvas'), icon: Workflow },
    { key: 'drama', to: '/drama', label: t('appNav.dramaStudio'), icon: Clapperboard, tag: 'new' },
    {
      key: 'kepu',
      to: '/history',
      label: t('nav.kepu'),
      icon: Film,
      match: ['/history', '/studio', '/templates'],
    },
    {
      key: 'tools',
      to: '/tools',
      label: t('nav.tools'),
      icon: Wrench,
    },
    { key: 'studio3d', to: '/studio3d', label: t('appNav.studio3d'), icon: Box },
    { key: 'assets', to: '/assets', label: t('nav.assets'), icon: FolderOpen, match: ['/assets', '/drama/assets'] },
    { key: 'library', to: '/library', label: t('appNav.library'), icon: Library },
    // 数字资产市场：后台启用后才对普通用户展示；管理员始终可见以便检查启用状态
    ...(marketplaceOn || user?.role === 'admin'
      ? [{ key: 'marketplace', to: '/marketplace', label: t('appNav.marketplace'), icon: Store }]
      : []),
  ]
  const accountItems: NavItem[] = [
    { key: 'tasks', to: '/tasks', label: t('nav.tasks'), icon: ListChecks },
    { key: 'pricing', to: '/pricing', label: t('nav.pricing'), icon: CreditCard },
    { key: 'partners', to: '/partners', label: t('appNav.partners'), icon: Handshake },
    { key: 'mcp', to: '/settings?tab=api', label: t('appNav.mcp'), icon: Bot, tag: 'beta' },
    { key: 'settings', to: '/settings', label: t('appNav.settings'), icon: Settings },
  ]
  const allItems = [...createItems, ...accountItems]
  const current = activeKeyFromPath(allItems, location.pathname, location.search) ?? legacyActiveKey(active)

  // 市场开关是公开信息：访客也按后台开关显示入口
  useEffect(() => {
    let alive = true
    api.marketplaceCapabilities().then((c) => { if (alive) setMarketplaceOn(Boolean(c.enabled)) }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    api.me().then(setUser).catch(() => localStorage.removeItem('token'))
    api
      .wallet()
      .then((w) => setBalance(w.balance_display ?? `${w.symbol ?? ''}${w.balance_yuan.toFixed(2)}`))
      .catch(() => setBalance(null))
  }, [])

  useEffect(() => {
    const onUserUpdated = (event: Event) => {
      const detail = (event as CustomEvent<User>).detail
      if (detail) setUser(detail)
    }
    window.addEventListener(USER_UPDATED_EVENT, onUserUpdated)
    return () => window.removeEventListener(USER_UPDATED_EVENT, onUserUpdated)
  }, [])

  useEffect(() => onThemeChange(setThemeState), [])

  // 换页时收起抽屉与弹层
  useEffect(() => {
    setDrawerOpen(false)
    setMoreOpen(false)
  }, [location.pathname, location.search])

  // 点外部 / Esc 关闭「更多」
  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  // 折叠状态同步到 <html>，供主内容区让出侧栏宽度
  useEffect(() => {
    document.documentElement.classList.toggle('pf-side-collapsed', collapsed)
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  /** 未登录去登录；已登录弹出漫剧 / 科普选择 */
  function goCreate() {
    if (!user && !localStorage.getItem('token')) {
      nav('/auth?next=/')
      return
    }
    setCreateOpen(true)
  }

  function logout() {
    localStorage.removeItem('token')
    setUser(null)
    setMoreOpen(false)
    nav('/')
  }

  function renderItem(item: NavItem) {
    const Icon = item.icon
    const isOn = current === item.key
    return (
      <NavLink
        key={item.key}
        to={item.to}
        className={() => `pf-side-link${isOn ? ' is-active' : ''}`}
        title={collapsed ? item.label : undefined}
        aria-current={isOn ? 'page' : undefined}
      >
        <Icon size={18} strokeWidth={1.8} aria-hidden />
        <span className="pf-side-text">{item.label}</span>
        {item.tag ? (
          <span className={`pf-side-tag is-${item.tag}`}>{t(item.tag === 'new' ? 'appNav.tagNew' : 'appNav.tagBeta')}</span>
        ) : null}
      </NavLink>
    )
  }

  const isDark = theme === 'dark'

  return (
    <>
      {/* 移动端顶栏 */}
      <header className="pf-topbar">
        <button
          type="button"
          className="pf-topbar-burger"
          aria-label={drawerOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <Menu size={20} />
        </button>
        <Link to="/" className="pf-side-brand">
          <img src="/logo.svg" alt="" width={26} height={26} />
          <span>Prismreel</span>
        </Link>
        <button type="button" className="pf-btn pf-btn-lime pf-btn-sm" onClick={goCreate}>
          <Plus size={16} aria-hidden />
          {t('appNav.newProject')}
        </button>
      </header>

      <aside
        className={`pf-side${collapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-open' : ''}`}
        aria-label={t('nav.main')}
      >
        <div className="pf-side-head">
          <Link to="/" className="pf-side-brand" title="Prismreel">
            <img src="/logo.svg" alt="" width={28} height={28} />
            <span className="pf-side-text">Prismreel</span>
          </Link>
          <button
            type="button"
            className="pf-side-toggle"
            aria-label={collapsed ? t('appNav.expand') : t('appNav.collapse')}
            title={collapsed ? t('appNav.expand') : t('appNav.collapse')}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <button type="button" className="pf-side-create" onClick={goCreate} title={collapsed ? t('nav.startCreate') : undefined}>
          <Plus size={18} strokeWidth={2.2} aria-hidden />
          <span className="pf-side-text">{t('nav.startCreate')}</span>
        </button>

        <nav className="pf-side-nav">
          <p className="pf-side-section">{t('appNav.sectionCreate')}</p>
          {createItems.map(renderItem)}
          <p className="pf-side-section">{t('appNav.sectionAccount')}</p>
          {accountItems.map(renderItem)}
        </nav>

        <div className="pf-side-bottom">
          {!user ? (
            <div className="pf-side-guest">
              <strong>{t('appNav.guestTitle')}</strong>
              <p>{t('appNav.guestLead')}</p>
              <Link to="/auth?next=/" className="pf-btn pf-btn-lime pf-btn-sm">
                {t('appNav.guestCta')}
              </Link>
              <Link to="/auth?mode=register&next=/" className="pf-side-guest-signup">
                {t('appNav.guestSignup')}
              </Link>
            </div>
          ) : null}

          <div className="pf-side-more-wrap" ref={moreRef}>
            {moreOpen ? (
              <div className="pf-side-more-pop" role="menu">
                {user ? (
                  <Link to="/settings" className="pf-side-more-user" role="menuitem">
                    <UserAvatar user={user} size="sm" />
                    <span>
                      <strong>{user.nickname}</strong>
                      <small>{user.email}</small>
                    </span>
                  </Link>
                ) : null}
                {user ? (
                  <Link to="/settings?tab=subscription" className="pf-side-more-row" role="menuitem">
                    <Wallet size={16} aria-hidden />
                    <span>{t('appNav.balance')}</span>
                    {balance ? <span className="pf-side-badge">{balance}</span> : null}
                  </Link>
                ) : null}
                <Link to="/help" className="pf-side-more-row" role="menuitem">
                  <HelpCircle size={16} aria-hidden />
                  <span>{t('nav.help')}</span>
                </Link>
                <div className="pf-side-more-row is-static">
                  <span>{t('nav.language')}</span>
                  <LanguageSwitch />
                </div>
                <button
                  type="button"
                  className="pf-side-more-row"
                  role="menuitem"
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                >
                  {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
                  <span>{t('appNav.theme')}</span>
                  <span className="pf-side-badge">{isDark ? t('appNav.themeDark') : t('appNav.themeLight')}</span>
                </button>
                {user ? (
                  <button type="button" className="pf-side-more-row is-danger" role="menuitem" onClick={logout}>
                    <LogOut size={16} aria-hidden />
                    <span>{t('appNav.logout')}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className={`pf-side-link pf-side-more${moreOpen ? ' is-active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              title={collapsed ? t('appNav.more') : undefined}
              onClick={() => setMoreOpen((v) => !v)}
            >
              {user ? <UserAvatar user={user} size="sm" /> : <MoreHorizontal size={18} aria-hidden />}
              <span className="pf-side-text">{user ? user.nickname : t('appNav.more')}</span>
              {user && balance ? <span className="pf-side-badge pf-side-text">{balance}</span> : null}
            </button>
          </div>
        </div>
      </aside>
      {drawerOpen ? <div className="pf-side-scrim" onClick={() => setDrawerOpen(false)} aria-hidden /> : null}
      <CreateChoiceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  )
}
