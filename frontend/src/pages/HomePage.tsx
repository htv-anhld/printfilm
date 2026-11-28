/** Prismreel 首页仪表盘（参照 Dravelio）：Hero + 创作输入框 + 快捷入口 + 精选风格 + 最近作品 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clapperboard, Film, FolderOpen, LayoutGrid, Wrench } from 'lucide-react'
import { api, type User } from '../api'
import AppShell from '../components/layout/AppShell'
import HomeComposer from '../components/home/HomeComposer'
import HomeRecent from '../components/home/HomeRecent'
import { useI18n } from '../i18n'
import { IMAGE_STYLE_OPTIONS, type ImageStyleId } from '../lib/dramaImageStyles'
import {
  getDramaImageStylePreviewFallbackUrl,
  getDramaImageStylePreviewUrl,
} from '../lib/dramaImageStylePreviews'
import { USER_UPDATED_EVENT } from '../lib/userEvents'
import '../styles/dashboard.css'

/** Hero 背景拼贴用的风格图（深色、电影感优先） */
const HERO_TILES: ImageStyleId[] = [
  'neon-cyberpunk-film',
  'retro-sci-fi-atompunk',
  'wuxia-realistic-photo',
  'domestic-suspense-cold',
  'american-retro-hollywood',
  'palace-intrigue-cold',
  'japanese-youth-film',
  'ghibli-handdrawn-anime',
  '90s-realistic-film',
  'korean-urban-soft',
  'ancient-chinese-mythology',
  'retro-narrative-film',
]

// 按当前小时选问候语 key
function greetingKey(): 'home.dash.greetMorning' | 'home.dash.greetAfternoon' | 'home.dash.greetEvening' {
  const h = new Date().getHours()
  if (h < 12) return 'home.dash.greetMorning'
  if (h < 18) return 'home.dash.greetAfternoon'
  return 'home.dash.greetEvening'
}

export default function HomePage() {
  const nav = useNavigate()
  const { t } = useI18n()
  const loggedIn = Boolean(localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(null)

  // 已登录时取昵称用于问候；资料更新事件后刷新
  useEffect(() => {
    if (!loggedIn) return
    let alive = true
    const load = () =>
      api
        .me()
        .then((u) => alive && setUser(u))
        .catch(() => undefined)
    load()
    window.addEventListener(USER_UPDATED_EVENT, load)
    return () => {
      alive = false
      window.removeEventListener(USER_UPDATED_EVENT, load)
    }
  }, [loggedIn])

  const shortcuts = [
    { to: '/drama', icon: Clapperboard, label: t('home.dash.quickDrama') },
    { to: '/studio/new', icon: Film, label: t('home.dash.quickKepu') },
    { to: '/creative', icon: LayoutGrid, label: t('home.dash.quickCreative') },
    { to: '/tools', icon: Wrench, label: t('home.dash.quickTools') },
    { to: '/assets', icon: FolderOpen, label: t('home.dash.quickAssets') },
  ]

  // 精选风格：带上风格进入漫剧新建面板；未登录先登录
  function pickStyle(id: ImageStyleId) {
    if (!loggedIn) {
      nav('/auth?next=/drama')
      return
    }
    nav('/drama', { state: { imageStyleId: id } })
  }

  const name = user?.nickname || user?.email?.split('@')[0] || ''

  return (
    <AppShell active="home" wide hideFooter>
      <div className="pf-dash">
        <section className="pf-dash-hero">
          <div className="pf-dash-hero-bg" aria-hidden>
            {HERO_TILES.map((id) => (
              <img key={id} src={getDramaImageStylePreviewUrl(id)} alt="" />
            ))}
          </div>
          <div className="pf-dash-hero-inner">
            <h1 className="pf-dash-headline">{t('home.dash.heroTitle')}</h1>
            <p className="pf-dash-greet">
              {name ? `${t(greetingKey(), { name })} · ` : ''}
              {t('home.dash.lead')}
            </p>
            <HomeComposer loggedIn={loggedIn} />
            <nav className="pf-dash-shortcuts" aria-label={t('home.dash.quickTitle')}>
              {shortcuts.map(({ to, icon: Icon, label }) => (
                <Link key={to} to={to} className="pf-dash-shortcut">
                  <span className="pf-dash-shortcut-icon" aria-hidden>
                    <Icon size={22} strokeWidth={1.8} />
                  </span>
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <section className="pf-dash-section">
          <div className="pf-dash-section-head">
            <h2>{t('home.dash.featured')}</h2>
            <span className="pf-dash-section-hint">{t('home.dash.featuredHint')}</span>
          </div>
          <div className="pf-dash-featured">
            {IMAGE_STYLE_OPTIONS.map((o) => (
              <button key={o.id} type="button" className="pf-dash-feature" onClick={() => pickStyle(o.id)}>
                <img
                  src={getDramaImageStylePreviewUrl(o.id)}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    const fb = getDramaImageStylePreviewFallbackUrl(o.id)
                    if (!e.currentTarget.src.endsWith(fb)) e.currentTarget.src = fb
                  }}
                />
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        </section>

        {loggedIn ? <HomeRecent /> : null}
      </div>
    </AppShell>
  )
}
