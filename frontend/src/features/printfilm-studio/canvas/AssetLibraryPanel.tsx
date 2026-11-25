import { tr } from '../../../i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, ImagePlus, Search, Star, Upload, X, Film, Mic } from 'lucide-react'
import { dramaApi } from '../../../api/drama'
import type { ProjectAsset } from '../types'

export const ASSET_DRAG_TYPE = 'application/x-printfilm-asset'
export function assetMediaKind(asset: ProjectAsset): 'image' | 'video' | 'audio' {
  const kind = String(asset.asset_type || asset.type || '').toLowerCase()
  return kind === 'video' ? 'video' : kind === 'audio' || kind === 'voice' ? 'audio' : 'image'
}

function assetTags(asset: ProjectAsset): string[] {
  const tags = asset.params?.tags
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : []
}

type Props = { projectId: number; assets: ProjectAsset[]; writable: boolean; acceptKinds?: readonly string[]; onClose: () => void; onUpload: () => void; onGenerate: () => void; onPick: (asset: ProjectAsset) => Promise<void> }

export function AssetLibraryPanel({ projectId, assets, writable, acceptKinds, onClose, onUpload, onGenerate, onPick }: Props) {
  const [source, setSource] = useState<'project' | 'library'>('project')
  const [library, setLibrary] = useState<ProjectAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [tag, setTag] = useState('')
  const [page, setPage] = useState(1)
  const grid = useRef<HTMLDivElement>(null)
  const favoriteKey = `printfilm-studio:${projectId}:favorite-assets`
  const [favorites, setFavorites] = useState<number[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(favoriteKey) || '[]'); return Array.isArray(saved) ? saved.filter((id) => typeof id === 'number') : [] } catch { return [] }
  })
  useEffect(() => {
    if (source !== 'library') return
    let active = true
    setLoading(true); setError('')
    void dramaApi.listAssets().then((items) => { if (active) setLibrary(items) }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : tr('studioCanvas.assetLibraryPanel.loadFailed')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [source])
  const items = source === 'project' ? assets : library
  const tags = useMemo(() => [...new Set(items.flatMap(assetTags))].sort(), [items])
  const visible = useMemo(() => items.filter((asset) => {
    if (acceptKinds && !acceptKinds.includes(assetMediaKind(asset))) return false
    if (query.trim() && !`${asset.name || ''} ${assetTags(asset).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())) return false
    if (tag && !assetTags(asset).includes(tag)) return false
    if (filter === 'favorite') return favorites.includes(asset.id)
    if (['image', 'video', 'audio'].includes(filter)) return assetMediaKind(asset) === filter
    if (filter !== 'all') return asset.type === filter
    return true
  }), [items, query, tag, filter, favorites, acceptKinds])
  const pages = Math.max(1, Math.ceil(visible.length / 24))
  const currentPage = Math.min(page, pages)
  const pageItems = visible.slice((currentPage - 1) * 24, currentPage * 24)
  useEffect(() => { setPage(1) }, [source, query, tag, filter])
  useEffect(() => { if (grid.current) grid.current.scrollTop = 0 }, [currentPage, source, query, tag, filter])
  const toggleFavorite = (id: number) => {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id]
    setFavorites(next)
    try { localStorage.setItem(favoriteKey, JSON.stringify(next)) } catch { setError(tr('studioCanvas.assetLibraryPanel.favFailed')) }
  }
  const pick = async (asset: ProjectAsset) => {
    if (!writable || pending !== null) return
    setPending(asset.id); setError('')
    try { await onPick(asset) } catch (reason) { setError(reason instanceof Error ? reason.message : tr('studioCanvas.assetLibraryPanel.importFailed')) } finally { setPending(null) }
  }
  return <aside className="pf-library" aria-label={tr('studioCanvas.assetLibraryPanel.title')}>
    <header><FolderOpen size={20} /><b>{tr('studioCanvas.assetLibraryPanel.title')}</b><span>{items.length}</span><button type="button" aria-label={tr('studioCanvas.assetLibraryPanel.close')} onClick={onClose}><X size={20} /></button></header>
    <div className="pf-library-actions"><button type="button" className={source === 'project' ? 'is-active' : ''} onClick={() => setSource('project')}>{tr('studioCanvas.assetLibraryPanel.project')}</button><button type="button" disabled={!writable} onClick={onUpload}><Upload size={16} />{tr('studioCanvas.assetLibraryPanel.import')}</button><button type="button" disabled={!writable} onClick={onGenerate}><ImagePlus size={16} />{tr('studioCanvas.assetLibraryPanel.genImage')}</button></div>
    <label className="pf-library-search"><Search size={17} /><input aria-label={tr('studioCanvas.assetLibraryPanel.search')} placeholder={tr('studioCanvas.assetLibraryPanel.search')} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="pf-library-filters">{[['all', tr('studioCanvas.assetLibraryPanel.f.all')], ['favorite', tr('studioCanvas.assetLibraryPanel.f.favorite')], ['image', tr('studioCanvas.assetLibraryPanel.f.image')], ['video', tr('studioCanvas.assetLibraryPanel.f.video')], ['audio', tr('studioCanvas.assetLibraryPanel.f.audio')], ['character', tr('studioCanvas.assetLibraryPanel.f.character')], ['scene', tr('studioCanvas.assetLibraryPanel.f.scene')], ['prop', tr('studioCanvas.assetLibraryPanel.f.prop')], ['voice', tr('studioCanvas.assetLibraryPanel.f.voice')], ['material', tr('studioCanvas.assetLibraryPanel.f.material')]].map(([id, label]) => <button type="button" key={id} className={filter === id ? 'is-active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
    <label className="pf-library-tags">{tr('studioCanvas.assetLibraryPanel.tag')}<select aria-label={tr('studioCanvas.assetLibraryPanel.tagLabel')} value={tag} onChange={(event) => setTag(event.target.value)}><option value="">{tr('studioCanvas.assetLibraryPanel.allTags')}</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label>
    <button type="button" className="pf-library-source" onClick={() => setSource((current) => current === 'project' ? 'library' : 'project')}><FolderOpen size={17} />{source === 'project' ? tr('studioCanvas.assetLibraryPanel.fromMine') : tr('studioCanvas.assetLibraryPanel.backProject')}</button>
    <p className="pf-library-hint">{writable ? acceptKinds ? tr('studioCanvas.assetLibraryPanel.hintRefs') : tr('studioCanvas.assetLibraryPanel.hintPlace') : tr('studioCanvas.assetLibraryPanel.hintReadonly')}</p>
    {error && <p className="pf-library-error" role="alert">{error}</p>}
    <div ref={grid} className="pf-library-grid" aria-busy={loading}>
      {loading ? <p className="pf-library-empty">{tr('studioCanvas.assetLibraryPanel.loading')}</p> : pageItems.map((asset) => {
        const kind = assetMediaKind(asset)
        const poster = asset.cover || (kind === 'image' ? asset.url : undefined)
        return <article key={asset.id} className="pf-library-card" draggable={writable} onDragStart={(event) => { event.dataTransfer.setData(ASSET_DRAG_TYPE, String(asset.id)); event.dataTransfer.effectAllowed = 'copy' }}>
          <button type="button" className="pf-library-pick" disabled={!writable || pending !== null} onClick={() => void pick(asset)} aria-label={tr('studioCanvas.assetLibraryPanel.addItem', { name: asset.name || asset.id })}>
            {poster ? <img src={poster} alt="" draggable={false} loading="lazy" /> : kind === 'video' ? <Film size={32} /> : kind === 'audio' ? <Mic size={32} /> : <ImagePlus size={32} />}
            <span>{pending === asset.id ? tr('studioCanvas.assetLibraryPanel.adding') : asset.name || tr('studioCanvas.assetLibraryPanel.itemN', { id: asset.id })}</span>
          </button>
          <button type="button" className={`pf-library-star${favorites.includes(asset.id) ? ' is-active' : ''}`} onClick={() => toggleFavorite(asset.id)} aria-label={`${favorites.includes(asset.id) ? tr('studioCanvas.assetLibraryPanel.unfavorite') : tr('studioCanvas.assetLibraryPanel.favorite')} ${asset.name || asset.id}`} aria-pressed={favorites.includes(asset.id)}><Star size={15} /></button>
        </article>
      })}
      {!loading && visible.length === 0 && <p className="pf-library-empty">{items.length ? tr('studioCanvas.assetLibraryPanel.noMatch') : tr('studioCanvas.assetLibraryPanel.empty')}</p>}
    </div>
    <nav className="pf-library-pagination" aria-label={tr('studioCanvas.assetLibraryPanel.pagination')}><button disabled={loading || currentPage === 1} onClick={() => setPage(currentPage - 1)}>{tr('studioCanvas.assetLibraryPanel.prev')}</button><span aria-live="polite">{tr('studioCanvas.assetLibraryPanel.pageInfo', { page: currentPage, pages, count: visible.length })}</span><button disabled={loading || currentPage === pages} onClick={() => setPage(currentPage + 1)}>{tr('studioCanvas.assetLibraryPanel.next')}</button></nav>
  </aside>
}
