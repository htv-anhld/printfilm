import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, ArrowUpRight } from 'lucide-react'
import { dramaApi, type DramaProjectListItem } from '../../api/drama'
import Pagination from '../../components/ui/Pagination'
import { tr, useI18n } from '../../i18n'
import { SharePanel } from './ProjectSharePanel'
import './projectTeams.css'

/** A team is the membership of one canvas project, with no organization wallet. */
export default function CanvasProjectTeams() {
  const { t } = useI18n()
  const [items, setItems] = useState<DramaProjectListItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [relation, setRelation] = useState<'all' | 'owned' | 'joined'>('all')
  const [selected, setSelected] = useState<number>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    void dramaApi.listProjects({ workflow: 'canvas', relation, page, page_size: 8 }).then(result => {
      if (!active) return
      setItems(result.items); setTotal(result.meta.total); setPage(result.meta.page)
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : tr('canvasTeams.loadFailed')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, relation, retry])
  return <section className="pf-project-teams">
    <header><div><h2>{t('canvasTeams.title')}</h2><p>{t('canvasTeams.intro')}</p></div><Link className="pf-btn" to="/canvas">{t('canvasTeams.myProjects')} <ArrowUpRight size={16} /></Link></header>
    <nav aria-label={t('canvasTeams.filterAria')}>{(['all', 'owned', 'joined'] as const).map(value => <button key={value} aria-pressed={value === relation} onClick={() => { setRelation(value); setPage(1) }}>{({ all: t('canvasTeams.all'), owned: t('canvasTeams.owned'), joined: t('canvasTeams.joined') })[value]}</button>)}</nav>
    <p className="pf-muted">{t('canvasTeams.note')}</p>
    {loading ? <p role="status">{t('canvasTeams.loading')}</p> : error ? <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>{t('canvasTeams.retry')}</button></p> : <>
      <div className="pf-project-teams-grid">{items.map(item => <article key={item.id}>
        <Users size={22} /><span>{item.is_owner ? t('canvasTeams.owned') : t('canvasTeams.joined')}</span><h3>{item.title}</h3>
        <footer><Link to={`/drama/projects/${item.id}/canvas`}>{t('canvasTeams.openCanvas')}</Link><button onClick={() => setSelected(item.id)}>{item.is_owner ? t('canvasTeams.manage') : t('canvasTeams.viewMembers')}</button></footer>
      </article>)}</div>
      {!items.length && <p>{t('canvasTeams.empty')}</p>}
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / 8))} total={total} pageSize={8} onChange={setPage} />
    </>}
    {selected !== undefined && <SharePanel projectId={selected} onClose={() => setSelected(undefined)} />}
  </section>
}
