import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { projectSharingApi } from './projectSharing'
import { tr } from '../../i18n'

export default function SharedProjects() {
  const [items, setItems] = useState<{ id: number; title: string }[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void projectSharingApi.shared().then(result => { if (active) setItems(result.items) }).catch(cause => { if (active) setError(cause.message) })
    return () => { active = false }
  }, [])
  if (!items.length && !error) return null
  return <section className="pf-project-list-panel" aria-label={tr('studioCanvas.sharedProjects.title')}><div className="pf-project-list-heading"><div><h2>{tr('studioCanvas.sharedProjects.title')} <span>{items.length}</span></h2><p>{tr('studioCanvas.sharedProjects.hint')}</p></div></div><div className="pf-shared-project-grid">{items.map(item => <Link key={item.id} to={`/drama/projects/${item.id}/canvas`}><strong>{item.title}</strong><span>{tr('studioCanvas.sharedProjects.open')}</span></Link>)}</div>{error && <p role="alert">{error}</p>}</section>
}
