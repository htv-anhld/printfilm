import { tr } from '../../../i18n'
import { useState } from 'react'
import { ImagePlus, Plus, X } from 'lucide-react'

export function VideoNodeSetup({ mode, items, initialIds, onApply, onCreate, onLibrary, onClose }: {
  mode: 'image_to_video' | 'first_last_frame'; items: { id: string; label: string; url: string }[]; initialIds: string[]
  onApply: (ids: string[]) => void; onCreate: () => void; onLibrary: () => void; onClose: () => void
}) {
  const limit = mode === 'first_last_frame' ? 2 : 1
  const [ids, setIds] = useState(() => Array.from({ length: limit }, (_, index) =>
    items.some((item) => item.id === initialIds[index]) ? initialIds[index] : '',
  ))
  const [slot, setSlot] = useState(ids[0] && limit === 2 ? 1 : 0)
  const choose = (id: string) => {
    const next = ids.map((current, index) => index === slot ? id : current === id ? '' : current)
    setIds(next)
    const empty = next.indexOf('')
    if (empty >= 0) setSlot(empty)
  }
  return <div className="pf-edit-overlay"><section className="pf-video-setup" role="dialog" aria-label={tr('studioCanvas.videoNodeSetup.dialog')} aria-modal="true">
    <header><div><b>{limit === 2 ? tr('studioCanvas.videoNodeSetup.titleFrames') : tr('studioCanvas.videoNodeSetup.titleRefs')}</b><p>{limit === 2 ? tr('studioCanvas.videoNodeSetup.hintFrames') : tr('studioCanvas.videoNodeSetup.hintRefs')}</p></div><button aria-label={tr('studioCanvas.videoNodeSetup.close')} onClick={onClose}><X size={18} /></button></header>
    {limit === 2 && <div className="pf-video-frame-slots">{[tr('studioCanvas.videoNodeSetup.first'), tr('studioCanvas.videoNodeSetup.last')].map((label, index) => <button type="button" key={index} aria-pressed={slot === index} onClick={() => setSlot(index)}>{label} · {items.find(item => item.id === ids[index])?.label || tr('studioCanvas.videoNodeSetup.pending')}</button>)}</div>}
    <div className="pf-video-setup-grid">{items.map((item) => <button key={item.id} aria-pressed={ids.includes(item.id)} onClick={() => choose(item.id)}><img src={item.url} alt="" loading="lazy" /><span>{item.label}</span>{ids.includes(item.id) && <b>{limit === 1 ? tr('studioCanvas.videoNodeSetup.ref') : ids.indexOf(item.id) === 0 ? tr('studioCanvas.videoNodeSetup.first') : tr('studioCanvas.videoNodeSetup.last')}</b>}</button>)}</div>
    {!items.length && <p>{tr('studioCanvas.videoNodeSetup.empty')}</p>}
    <footer><button onClick={onCreate}><Plus size={16} />{tr('studioCanvas.videoNodeSetup.create')}</button><button onClick={onLibrary}><ImagePlus size={16} />{tr('studioCanvas.videoNodeSetup.library')}</button><button className="is-primary" disabled={ids.some(id => !id) || new Set(ids).size !== limit} onClick={() => onApply(ids)}>{tr('studioCanvas.videoNodeSetup.done')}</button></footer>
  </section></div>
}
