import { tr } from '../../../i18n'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useReactFlow } from '@xyflow/react'
import { Hand, MousePointer2, Plus, Search } from 'lucide-react'
import { STUDIO_ADDABLE_TYPES, STUDIO_NODE_LABELS, type StudioAddableType } from './flowAdapter'

type StudioChromeProps = {
  title: string
  statusText: string
  lockError: string
  writable: boolean
  loading: boolean
  tool: 'move' | 'hand'
  agentOpen: boolean
  onTool: (tool: 'move' | 'hand') => void
  onAdd: (type: StudioAddableType) => void
  onRetryLock: () => void
  onTakeOver: () => void
  onToggleAgent: () => void
}

/** 画布上的浮层：返回、状态、添加工具、缩放，配色沿用现有浅色体系。 */
export function StudioChrome({ title, statusText, lockError, writable, loading, tool, agentOpen, onTool, onAdd, onRetryLock, onTakeOver, onToggleAgent }: StudioChromeProps) {
  /*
   * addOpen 添加节点菜单
   * searchOpen 节点搜索
   * query 搜索关键字
   * searchError 未找到节点
   */
  const [addOpen, setAddOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchError, setSearchError] = useState('')
  const { setCenter, getNodes, getViewport } = useReactFlow()

  /** 按标题或正文定位节点。 */
  function searchNodes(event: FormEvent) {
    event.preventDefault()
    const keyword = query.trim()
    if (!keyword) return
    const hit = getNodes().find((node) => {
      const data = node.data as { label?: string; text?: string }
      return node.id.includes(keyword) || String(data.label || '').includes(keyword) || String(data.text || '').includes(keyword)
    })
    if (!hit) {
      setSearchError(tr('studioCanvas.studioChrome.noMatch'))
      return
    }
    setSearchError('')
    void setCenter(hit.position.x + 120, hit.position.y + 80, { zoom: Math.max(getViewport().zoom, 1), duration: 200 })
    setSearchOpen(false)
  }

  return (
    <>
      <div className="pf-studio-menu">
        <Link to="/canvas" aria-label={tr('studioCanvas.studioChrome.backList')}>{tr('studioCanvas.studioChrome.back')}</Link>
        <div>
          <strong>{title || 'Prismreel Studio'}</strong>
          <span>{statusText}</span>
        </div>
      </div>
      <div className="pf-studio-switch" role="tablist" aria-label={tr('studioCanvas.studioChrome.workspace')}>
        <button type="button" aria-pressed="true">{tr('studioCanvas.studioChrome.canvas')}</button>
        <button type="button" disabled title={tr('studioCanvas.studioChrome.docsSoon')}>{tr('studioCanvas.studioChrome.docs')}</button>
      </div>
      {lockError ? (
        <p className="pf-studio-lock" role="alert">
          {lockError}
          <button type="button" onClick={onRetryLock}>{tr('studioCanvas.studioChrome.retry')}</button>
          <button type="button" onClick={onTakeOver}>{tr('studioCanvas.studioChrome.takeOver')}</button>
        </p>
      ) : null}
      <div className="pf-studio-tools" role="toolbar" aria-label={tr('studioCanvas.studioChrome.tools')}>
        <div className="pf-studio-add">
          <button type="button" className="is-plus" aria-label={tr('studioCanvas.studioChrome.addNode')} aria-expanded={addOpen} disabled={!writable || loading} onClick={() => setAddOpen((open) => !open)}>
            <Plus size={16} />
          </button>
          {addOpen ? (
            <div className="pf-studio-add-menu" role="menu">
              {STUDIO_ADDABLE_TYPES.map((type) => (
                <button key={type} type="button" role="menuitem" onClick={() => { onAdd(type); setAddOpen(false) }}>{STUDIO_NODE_LABELS[type]}</button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" aria-pressed={tool === 'move'} aria-label={tr('studioCanvas.studioChrome.move')} onClick={() => onTool('move')}><MousePointer2 size={16} /></button>
        <button type="button" aria-pressed={tool === 'hand'} aria-label={tr('studioCanvas.studioChrome.hand')} onClick={() => onTool('hand')}><Hand size={16} /></button>
        <button type="button" aria-pressed={searchOpen} aria-label={tr('studioCanvas.studioChrome.search')} disabled={loading} onClick={() => setSearchOpen((open) => !open)}><Search size={16} /></button>
        {!agentOpen ? <button type="button" className="pf-studio-agent-launcher" aria-label={tr('studioCanvas.studioChrome.openAgent')} onClick={onToggleAgent} /> : null}
      </div>
      {searchOpen ? (
        <form className="pf-studio-search" onSubmit={searchNodes}>
          <input value={query} placeholder={tr('studioCanvas.studioChrome.searchPlaceholder')} onChange={(event) => setQuery(event.target.value)} />
          {searchError ? <span>{searchError}</span> : null}
        </form>
      ) : null}
    </>
  )
}
