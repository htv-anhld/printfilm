import { useState } from 'react'
import { FileText, Search, X } from 'lucide-react'
import { tr } from '../../../i18n'

export function CanvasSearch({ nodes, onSelect, onClose }: { nodes: { id: string; data: Record<string, unknown> }[]; onSelect: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const matches = nodes.filter((node) => `${node.data.label || ''} ${node.data.name || ''} ${node.data.text || ''} ${node.data.prompt || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <section className="pf-canvas-search" role="dialog" aria-label={tr('studioCanvas.canvasSearch.dialog')} onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}><header><Search size={16} /><input autoFocus placeholder={tr('studioCanvas.canvasSearch.placeholder')} aria-label={tr('studioCanvas.canvasSearch.input')} value={query} onChange={(event) => setQuery(event.target.value)} /><button aria-label={tr('studioCanvas.canvasSearch.close')} onClick={onClose}><X size={16} /></button></header><div>{matches.map((node) => <button key={node.id} onClick={() => { onSelect(node.id); onClose() }}><FileText size={15} /><span>{String(node.data.label || node.data.name || tr('studioCanvas.canvasSearch.untitled'))}<small>{String(node.data.text || node.data.prompt || '').slice(0, 65)}</small></span></button>)}{matches.length === 0 && <p>{tr('studioCanvas.canvasSearch.empty')}</p>}</div></section>
}
