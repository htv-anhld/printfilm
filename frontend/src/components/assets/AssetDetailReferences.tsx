import { useEffect, useRef, useState } from 'react'
import { AudioLines, ImageIcon, Play, Video } from 'lucide-react'
import { resolveDramaMediaUrl } from '../../api/drama'
import { splitAssetDetailPrompt, type AssetDetailReference } from '../../lib/assetDetails'
import Modal from '../ui/Modal'
import { tr } from '../../i18n'

type ReferencePreview = { reference: AssetDetailReference; label: string }
/** 参考素材类型的展示名（图片/视频/音频），按界面语言取 assetLib.types.* */
const kindLabel = (kind: 'image' | 'video' | 'audio') => tr(`assetLib.types.${kind}`)

function numberedReferences(references: AssetDetailReference[]) {
  const counts = { image: 0, video: 0, audio: 0 }
  return references.map(reference => ({ reference, label: tr('assetLib.refs.numbered', { kind: kindLabel(reference.kind), n: ++counts[reference.kind] }) }))
}

/** A thumbnail always uses the media captured by this generation, including old versions. */
function ReferenceThumbnail({ reference }: { reference: AssetDetailReference }) {
  const [failed, setFailed] = useState(false)
  const image = reference.kind === 'image' ? reference.url : reference.cover
  const Icon = reference.kind === 'image' ? ImageIcon : reference.kind === 'video' ? Video : AudioLines
  return <span className="pf-detail-reference-thumb">
    {!failed && image ? <img src={resolveDramaMediaUrl(image)} alt="" loading="lazy" onError={() => setFailed(true)} />
      : !failed && reference.kind === 'video' ? <video src={resolveDramaMediaUrl(reference.url)} muted playsInline preload="metadata" tabIndex={-1} aria-hidden onError={() => setFailed(true)} />
        : <Icon size={22} aria-hidden />}
    {reference.kind === 'video' && <span className="pf-detail-reference-play"><Play size={14} fill="currentColor" aria-hidden /></span>}
  </span>
}

export function readableDetailPrompt(text: string, references: AssetDetailReference[]) {
  const numbered = numberedReferences(references)
  return splitAssetDetailPrompt(text, references).map(part => {
    if (part.kind === 'text') return part.text
    const label = numbered.filter(item => part.references.includes(item.reference)).map(item => item.label).join(tr('assetLib.refs.listSep'))
    const name = part.references.find(reference => reference.name)?.name
    return name ? tr('assetLib.refs.nameWithLabel', { name, label }) : label
  }).join('')
}

export function DetailPrompt({ text, references, onPreview }: {
  text: string
  references: AssetDetailReference[]
  onPreview: (preview: ReferencePreview) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const contentRef = useRef<HTMLParagraphElement>(null)
  const numbered = numberedReferences(references)
  const referenceKey = references.map(item => `${item.kind}:${item.url}:${item.asset_id}:${item.name}`).join('|')
  const long = text.length > 160 || text.split('\n').length > 5 || overflows
  useEffect(() => {
    if (expanded || !contentRef.current) return
    const element = contentRef.current
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [expanded, text, referenceKey])
  return <div className="pf-asset-detail-text">
    <p ref={contentRef} className={expanded ? 'is-expanded' : 'is-collapsed'}>{splitAssetDetailPrompt(text, references).map((part, index) => {
      if (part.kind === 'text') return part.text
      const reference = part.references.find(item => item.kind === 'image') || part.references[0]
      const preview = numbered.find(item => item.reference === reference)!
      const name = part.references.find(item => item.name)?.name || preview.label
      const labels = numbered.filter(item => part.references.includes(item.reference)).map(item => item.label).join(tr('assetLib.refs.listSep'))
      return <button key={index} type="button" className="pf-detail-prompt-mention" onClick={() => onPreview(preview)} title={`${name} · ${labels}`} aria-label={tr('assetLib.refs.previewMention', { name, labels })}>
        <ReferenceThumbnail key={reference.url} reference={reference} /><span>{name}</span><small>{labels}</small>
      </button>
    })}</p>
    {long && <button type="button" className="pf-detail-text-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? tr('assetLib.refs.collapse') : tr('assetLib.refs.expand')}</button>}
  </div>
}

export function DetailReferences({ references, onPreview }: {
  references: AssetDetailReference[]
  onPreview: (preview: ReferencePreview) => void
}) {
  const numbered = numberedReferences(references)
  if (!numbered.length) return null
  return <section className="pf-detail-references" aria-label={tr('assetLib.refs.sectionAria')}>
    <h3>{tr('assetLib.refs.title')} <span>{numbered.length}</span></h3>
    {(['image', 'video', 'audio'] as const).map(kind => {
      const items = numbered.filter(item => item.reference.kind === kind)
      if (!items.length) return null
      return <div className={`pf-detail-reference-group is-${kind}`} key={kind}>
        <h4>{tr('assetLib.refs.kindTitle', { kind: kindLabel(kind) })}</h4>
        <div className="pf-detail-reference-grid">{items.map((item, index) => <div className="pf-detail-reference" key={`${item.reference.url}:${index}`}>
          <button type="button" className="pf-detail-reference-open" onClick={() => onPreview(item)} aria-label={item.reference.name ? tr('assetLib.refs.previewNamed', { label: item.label, name: item.reference.name }) : tr('assetLib.refs.preview', { label: item.label })}>
            <ReferenceThumbnail key={item.reference.url} reference={item.reference} />
            <span className="pf-detail-reference-label">{item.label}</span>
          </button>
          <span className="pf-detail-reference-name" title={item.reference.name || item.label}>{kind === 'audio' && item.reference.name ? `${item.label} · ${item.reference.name}` : item.reference.name || item.label}</span>
          {item.reference.role === 'first_frame' && <small>{tr('assetLib.refs.firstFrame')}</small>}
          {item.reference.role === 'last_frame' && <small>{tr('assetLib.refs.lastFrame')}</small>}
          {kind === 'audio' && <audio src={resolveDramaMediaUrl(item.reference.url)} controls preload="none" aria-label={tr('assetLib.refs.audioAria', { label: item.label, name: item.reference.name || tr('assetLib.refs.audioFallback') })} />}
        </div>)}</div>
      </div>
    })}
  </section>
}

export function DetailReferencePreview({ preview, onClose }: { preview: ReferencePreview | null; onClose: () => void }) {
  const [failed, setFailed] = useState(false)
  if (!preview) return null
  const { reference, label } = preview
  const url = resolveDramaMediaUrl(reference.url)
  return <Modal open onClose={onClose} title={`${label}${reference.name ? ` · ${reference.name}` : ''}`} size="lg" className="pf-detail-reference-preview">
    <div className={`pf-detail-reference-player is-${reference.kind}`}>
      {failed ? <p role="status">{tr('assetLib.refs.loadFailed')}</p>
        : reference.kind === 'image' ? <img src={url} alt={reference.name || label} onError={() => setFailed(true)} />
          : reference.kind === 'video' ? <video src={url} poster={resolveDramaMediaUrl(reference.cover)} controls playsInline preload="metadata" onError={() => setFailed(true)} />
            : <><AudioLines size={52} aria-hidden /><audio src={url} controls preload="metadata" aria-label={reference.name || label} onError={() => setFailed(true)} /></>}
    </div>
  </Modal>
}

export type { ReferencePreview }
