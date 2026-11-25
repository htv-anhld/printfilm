/** 首页「最近作品」：最近漫剧 + 最近短视频（各取 6 条，加载/空/错误三态） */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clapperboard, Film } from 'lucide-react'
import { api } from '../../api'
import { dramaApi, resolveDramaMediaUrl, type DramaProjectListItem } from '../../api/drama'
import { useI18n } from '../../i18n'
import { dramaProjectEntryPath, formatDramaCardMeta } from '../../lib/dramaWorkflow'
import { STATUS_CN } from '../../lib/status'

const RECENT_LIMIT = 6

type KepuItem = {
  id: number
  title: string
  status: string
  cover_url: string | null
  created_at: string
  updated_at?: string
}

type Card = {
  key: string
  to: string
  title: string
  meta: string
  cover: string
}

// 把时间戳格式化为当前语言的短日期
function shortDate(raw: string | undefined, locale: string): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// 漫剧按更新时间倒序取前 N 条
function latestDramas(rows: DramaProjectListItem[]): DramaProjectListItem[] {
  const ts = (r: DramaProjectListItem) => new Date(r.updated_at || r.created_at || 0).getTime()
  return [...rows].sort((a, b) => ts(b) - ts(a)).slice(0, RECENT_LIMIT)
}

/** 最近作品两栏区块 */
export default function HomeRecent() {
  const { t, locale } = useI18n()
  /*
   * dramas / kepus 卡片数据（null = 加载中）
   * dramaErr / kepuErr 各自的错误文案
   */
  const [dramas, setDramas] = useState<Card[] | null>(null)
  const [kepus, setKepus] = useState<Card[] | null>(null)
  const [dramaErr, setDramaErr] = useState('')
  const [kepuErr, setKepuErr] = useState('')

  useEffect(() => {
    let alive = true
    dramaApi
      .listProjects({ page: 1, page_size: 50 })
      .then((res) => {
        if (!alive) return
        setDramas(
          latestDramas(res.items).map((r) => ({
            key: `d${r.id}`,
            to: dramaProjectEntryPath(r),
            title: r.title || t('home.dash.untitled'),
            meta: [formatDramaCardMeta(r), shortDate(r.updated_at || r.created_at, locale)]
              .filter(Boolean)
              .join(' · '),
            cover: r.cover_url ? resolveDramaMediaUrl(r.cover_url) : '',
          })),
        )
      })
      .catch(() => {
        if (!alive) return
        setDramas([])
        setDramaErr(t('home.dash.loadFailed'))
      })
    api
      .listProjects({ page: 1, page_size: RECENT_LIMIT })
      .then((res) => {
        if (!alive) return
        const rows = res.items as KepuItem[]
        setKepus(
          rows.map((p) => ({
            key: `k${p.id}`,
            to: p.status === 'DRAFT' ? `/studio/${p.id}/style` : `/studio/${p.id}`,
            title: p.title || t('home.dash.untitled'),
            meta: [STATUS_CN[p.status] || p.status, shortDate(p.updated_at || p.created_at, locale)]
              .filter(Boolean)
              .join(' · '),
            cover: p.cover_url ? api.assetUrl(p.cover_url, p.updated_at) : '',
          })),
        )
      })
      .catch(() => {
        if (!alive) return
        setKepus([])
        setKepuErr(t('home.dash.loadFailed'))
      })
    return () => {
      alive = false
    }
  }, [t, locale])

  return (
    <>
      <RecentSection
        title={t('home.dash.recentDrama')}
        viewAllTo="/drama"
        items={dramas}
        error={dramaErr}
        empty={t('home.dash.emptyDrama')}
        kind="drama"
      />
      <RecentSection
        title={t('home.dash.recentKepu')}
        viewAllTo="/history"
        items={kepus}
        error={kepuErr}
        empty={t('home.dash.emptyKepu')}
        kind="kepu"
      />
    </>
  )
}

type SectionProps = {
  title: string
  viewAllTo: string
  items: Card[] | null
  error: string
  empty: string
  kind: 'drama' | 'kepu'
}

/** 单个最近作品区块：标题行 + 卡片网格 */
function RecentSection({ title, viewAllTo, items, error, empty, kind }: SectionProps) {
  const { t } = useI18n()
  const Icon = kind === 'drama' ? Clapperboard : Film
  return (
    <section className="pf-dash-section">
      <div className="pf-dash-section-head">
        <h2>{title}</h2>
        <Link to={viewAllTo}>
          {t('home.dash.viewAll')}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      {items === null ? (
        <div className="pf-dash-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="pf-dash-card is-skeleton" aria-hidden />
          ))}
        </div>
      ) : error ? (
        <p className="pf-dash-empty is-error">{error}</p>
      ) : items.length === 0 ? (
        <p className="pf-dash-empty">{empty}</p>
      ) : (
        <div className="pf-dash-grid">
          {items.map((c) => (
            <Link key={c.key} to={c.to} className="pf-dash-card">
              <span className="pf-dash-card-cover">
                {c.cover ? (
                  <img
                    src={c.cover}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.removeAttribute('hidden')
                    }}
                  />
                ) : null}
                {c.cover ? (
                  <span className="pf-dash-card-initial" aria-hidden hidden>
                    <Icon size={22} strokeWidth={1.6} />
                  </span>
                ) : (
                  <span className="pf-dash-card-initial" aria-hidden>
                    <Icon size={22} strokeWidth={1.6} />
                  </span>
                )}
              </span>
              <span className="pf-dash-card-body">
                <strong>{c.title}</strong>
                <small>{c.meta}</small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
