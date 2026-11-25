import { tr } from '../../../i18n'
import { X } from 'lucide-react'
import { mediaHistory, type MediaSnapshot } from './mediaHistory'

export function NodeMediaHistory({ data, writable, onRestore, onClose }: { data: Record<string, unknown>; writable: boolean; onRestore: (item: MediaSnapshot) => void; onClose: () => void }) {
  const items = [...mediaHistory(data)].reverse()
  return <div className="pf-edit-overlay"><section className="pf-media-editor" role="dialog" aria-label={tr('studioCanvas.nodeMediaHistory.dialog')}><header><b>{tr('studioCanvas.nodeMediaHistory.title')}</b><button onClick={onClose} aria-label={tr('studioCanvas.nodeMediaHistory.close')}><X size={18} /></button></header><p>{tr('studioCanvas.nodeMediaHistory.hint')}</p>{!items.length && <p>{tr('studioCanvas.nodeMediaHistory.empty')}</p>}<div className="pf-node-history">{items.map((item, index) => <article key={`${item.savedAt}-${index}`}>{item.mediaType === 'video' ? <video src={item.mediaUrl} controls preload="metadata" /> : item.mediaType === 'audio' ? <audio src={item.mediaUrl} controls /> : <img src={item.mediaUrl} alt={item.label || tr('studioCanvas.nodeMediaHistory.image')} />}<div><b>{item.label || tr('studioCanvas.nodeMediaHistory.media')}</b><small>{new Date(item.savedAt).toLocaleString()}</small><button disabled={!writable} onClick={() => onRestore(item)}>{tr('studioCanvas.nodeMediaHistory.restore')}</button></div></article>)}</div></section></div>
}
