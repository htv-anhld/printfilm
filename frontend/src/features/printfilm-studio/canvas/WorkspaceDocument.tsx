import { useState } from 'react'
import { FileText, Image, Film, Mic, Pencil, Scan, Check } from 'lucide-react'
import { MessageContent } from '../agent/MessageContent'
import { nodeMediaKind, type StudioNodeRecord } from './nodeOperations'
import { writingContext } from './writingContext'
import { InlineVideoPlayer } from './InlineVideoPlayer'
import { tr } from '../../../i18n'

export function WorkspaceDocument({ nodes, writable, onText, onLocate }: { nodes: StudioNodeRecord[]; writable: boolean; onText: (id: string, text: string) => void; onLocate: (id: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const visible = nodes.filter((node) => node.type !== 'group')
  return <section className="pf-workspace-document" aria-label={tr('studioCanvas.workspaceDocument.title')}><div className="pf-document-content"><header><FileText size={24} /><div><h1>{tr('studioCanvas.workspaceDocument.title')}</h1><p>{tr('studioCanvas.workspaceDocument.subtitle',{n:visible.length})}</p></div></header>
    {visible.length === 0 && <p className="pf-document-empty">{tr('studioCanvas.workspaceDocument.empty')}</p>}
    {visible.map((node) => { const kind = nodeMediaKind(node), media = String(node.data.mediaUrl || node.data.url || node.data.cover || ''), text = String(node.data.text || node.data.prompt || ''), Icon = kind === 'image' ? Image : kind === 'video' ? Film : kind === 'audio' ? Mic : FileText; return <article key={node.id} className={`pf-document-node is-${kind}`}><header><Icon size={16} /><b>{String(node.data.label || node.data.name || tr('studioCanvas.workspaceDocument.node'))}</b>{kind === 'text' && writable && <button aria-label={editing === node.id ? tr('studioCanvas.workspaceDocument.doneEdit') : tr('studioCanvas.workspaceDocument.edit')} onClick={() => setEditing(editing === node.id ? null : node.id)}>{editing === node.id ? <Check size={15} /> : <Pencil size={15} />}</button>}<button aria-label={tr('studioCanvas.workspaceDocument.locate')} title={tr('studioCanvas.workspaceDocument.locate')} onClick={() => onLocate(node.id)}><Scan size={15} /></button></header>
      {kind === 'text' ? editing === node.id ? <textarea autoFocus aria-label={tr('studioCanvas.workspaceDocument.body')} value={text} onChange={(event) => onText(node.id, event.target.value)} /> : <MessageContent references={writingContext(node,nodes,[]).references} text={text || tr('studioCanvas.workspaceDocument.noText')} /> : media ? kind === 'video' ? <InlineVideoPlayer key={media} url={media} title={String(node.data.label || tr('studioCanvas.workspaceDocument.video'))} writable={false} onSize={() => undefined} onCapture={() => undefined} /> : kind === 'audio' ? <audio src={media} controls /> : <img src={media} alt={String(node.data.label || tr('studioCanvas.workspaceDocument.image'))} loading="lazy" /> : <div className="pf-document-pending"><Icon size={28} />{node.data.status === 'running' || node.data.status === 'queued' ? tr('studioCanvas.workspaceDocument.generating') : tr('studioCanvas.workspaceDocument.noMedia')}</div>}
      {kind !== 'text' && text && <p>{text}</p>}
    </article>})}
  </div></section>
}
