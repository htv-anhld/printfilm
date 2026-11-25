import { mediaCandidates } from './mediaHistory'
import { MediaVariants } from './MediaVariants'
import './mediaVariants.css'
import './composition.css'
import { formatStudioText, type TextFormat } from './textFormatting'
import { ADVANCED_NODE_TOOLS } from './nodeScope'
import { memo, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import { Columns2, Crop, FileText, Film, History, Image as ImageIcon, Mic, Pencil, Plus, Scissors, Split, Sparkles, Upload, Wand2 } from 'lucide-react'
import { NodeSkeleton } from './NodeSkeleton'
import { NODE_TYPE_LABEL } from './nodeCatalog'
import { clampMediaIndex, collectMediaUrls } from './imageVariants'
import { nodeMediaKind } from './nodeOperations'
import { MentionMenu, PromptComposer, type ComposerAction } from './PromptComposer'
import { StudioComposerContext, StudioNodeActionsContext, type StudioNodeActions, type StudioComposerState } from './studioNodeContext'
import { MessageContent } from '../agent/MessageContent'
import { InlineVideoPlayer } from './InlineVideoPlayer'
import { InlineAudioPlayer } from './InlineAudioPlayer'
import { studioGenerationError } from './generationError'
import { mediaNodeWidth, showNodePanels } from './nodePresentation'
import { nodeDraft } from './nodeDraft'
import { PromptInput } from './PromptInput'
import { PromptText } from './PromptText'
import { linkedWritingResult, type WritingReference } from './writingContext'
import { mentionQuery, mentionToken, plainPrompt, type PromptReference } from './promptMentions'
import { tr } from '../../../i18n'

type Data = {
  label?: string
  name?: string
  mediaUrl?: string
  url?: string
  cover?: string
  mediaUrls?: string[]
  mediaIndex?: number
  prompt?: string
  text?: string
  hint?: string
  status?: string
  [key: string]: unknown
}

/** 对照 Paba 图片节点：空白可输入、多图切换 / 对比 / 拆开、下槽生成面板。 */
export function StudioNodeCard(props: NodeProps<Node<Data>>) {
  const current = useContext(StudioNodeActionsContext)
  const activeComposer = useContext(StudioComposerContext)
  const latest = useRef(current)
  latest.current = current
  const callbacks = useRef(new Map<string, (...args: unknown[]) => unknown>())
  const submitting = !!current?.submittingNodeIds?.has(props.id)
  const submittingIds = useMemo(()=>new Set(submitting ? [props.id] : []),[submitting,props.id])
  const scoped = current ? Object.fromEntries(Object.entries(current).map(([key,value])=>{
    if(typeof value !== 'function') return [key,value]
    if(!callbacks.current.has(key)) callbacks.current.set(key,(...args: unknown[])=>{
      const handler = latest.current?.[key as keyof StudioNodeActions]
      if(typeof handler === 'function') return (handler as (...args: unknown[])=>unknown)(...args)
    })
    return [key,callbacks.current.get(key)]
  })) as StudioNodeActions : null
  if(scoped) {
    scoped.submittingNodeIds=submittingIds
    scoped.textComposer=current?.textComposer?.nodeId===props.id ? current.textComposer : undefined
    scoped.selectionCount=props.selected ? current?.selectionCount : 0
    scoped.panelsSuppressed=props.selected ? current?.panelsSuppressed : false
  }
  const previous = useRef(scoped)
  if(!previous.current || !scoped || Object.keys(scoped).length!==Object.keys(previous.current).length || Object.entries(scoped).some(([key,value])=>previous.current?.[key as keyof StudioNodeActions]!==value)) previous.current=scoped
  const references = nodeMediaKind(props)==='text' ? current?.writingReferences?.(props.id) || [] : []
  const referenceKey=JSON.stringify(references)
  const referenceCache=useRef({key:referenceKey,value:references})
  if(referenceCache.current.key!==referenceKey) referenceCache.current={key:referenceKey,value:references}
  // Context callbacks always use current state, but unchanged media/editors stay mounted.
  return <StudioNodeView {...props} actions={previous.current} composer={activeComposer?.nodeId===props.id ? activeComposer : null} writingRefs={referenceCache.current.value} compositionState={props.type==='compose'?JSON.stringify(current?.compositionSummary?.(props.id) || {count:0,pending:''}):''}/>
}

const StudioNodeView = memo(function StudioNodeView({ id, data, type, selected, dragging, width, height, actions, composer, writingRefs, compositionState }: NodeProps<Node<Data>> & {actions: StudioNodeActions | null;composer: StudioComposerState | null;writingRefs: WritingReference[];compositionState:string}) {
  const draftRef = useRef<HTMLDivElement | null>(null)
  const [selfWrite, setSelfWrite] = useState(false)
  const [draftMention, setDraftMention] = useState<{ at: number; caret: number; query: string } | null>(null)
  const textInput = useRef<HTMLTextAreaElement>(null)
  const [naturalSize, setNaturalSize] = useState({ url: '', width: 0, height: 0 })
  const variants = collectMediaUrls(data)
  const mediaIndex = clampMediaIndex(data.mediaIndex, variants.length)
  const media = variants[mediaIndex] || data.mediaUrl || data.url || data.cover
  const mediaKind = nodeMediaKind({ type, data })
  const title = String(data.label || data.name || NODE_TYPE_LABEL[type || ''] || tr('studioCanvas.studioNodeCard.node'))
  const caption = nodeDraft({ type, data })
  const submitting = !!actions?.submittingNodeIds?.has(id)
  const busy = submitting || ['queued', 'running', 'awaiting_composite'].includes(String(data.status))
  const ready = !!media && (data.status === 'completed' || data.status === 'succeeded' || data.status === 'ready' || !data.status || data.status === 'DONE')
  const kind = String(type || 'text')
  const isAnalysis = kind === 'frameAnalysis'
  const isText = kind === 'text' || kind === 'script' || kind === 'recipe' || kind === 'director_flow' || kind === 'task_flow' || kind === 'director3d' || kind === 'group'
  const isVideo = kind === 'video' || kind === 'task' || kind === 'videoGeneration' || kind === 'compose' || kind === 'motion' || kind === 'storyboard' || kind === 'shot' || kind === 'interpolate' || kind === 'control_video' || kind === 'fill_frames' || mediaKind === 'video'
  const isAudio = kind === 'audio' || kind === 'audioGeneration' || kind === 'voice' || mediaKind === 'audio'
  const isImage = !isText && !isVideo && !isAudio
  const linkedCaption = writingRefs.length && data.storyKind === 'shot_prompt' ? linkedWritingResult(caption, writingRefs) : caption
  const Icon = kind === 'compose' ? Scissors : isVideo ? Film : isAudio ? Mic : isText ? FileText : ImageIcon
  const panelsVisible = showNodePanels(!!selected, actions?.selectionCount || 0, !!dragging, !!actions?.panelsSuppressed)
  const showComposer = !!(panelsVisible && composer && composer.nodeId === id)
  const draftValue = showComposer ? composer.prompt : caption
  const showTryHints = isImage && !media && !draftValue.trim() && !busy
  const textComposer = actions?.textComposer?.nodeId === id ? actions.textComposer.content : null
  const formatText = (format: TextFormat) => { const input = textInput.current; const value = formatStudioText(caption, input?.selectionStart || 0, input?.selectionEnd || 0, format); actions?.updateText(id, value.text); setSelfWrite(true); window.requestAnimationFrame(() => { textInput.current?.focus(); textInput.current?.setSelectionRange(value.start, value.end) }) }
  const candidates=mediaCandidates(data), candidateIndex=Math.max(0,candidates.findIndex(item=>item.mediaUrl===media))
  const composition=compositionState?JSON.parse(compositionState) as {count:number;pending:string}:{count:0,pending:''}
  const variantBar=(isImage || isVideo)?<MediaVariants items={candidates} index={candidateIndex} video={isVideo} writable={!!actions?.writable} onSelect={index=>actions?.setMediaIndex(id,index)} onCompare={()=>actions?.compareVariants(id)} onSplit={()=>actions?.splitVariants(id)}/>:null

  if (!(kind in NODE_TYPE_LABEL)) return <NodeSkeleton title={title} selected={selected} icon={<FileText size={14} />}><div className="pf-skel-caption">{tr('studioCanvas.studioNodeCard.extension',{kind:String(kind)})}<p>{tr('studioCanvas.studioNodeCard.extensionHint')}</p></div></NodeSkeleton>

  if (kind === 'group') return <div className={`pf-group-frame${selected ? ' is-selected' : ''}${data.autoLayoutGroup ? ' is-organized' : ''}`} onContextMenu={(event) => { event.preventDefault(); actions?.contextMenu(event, id) }}>
    <NodeResizer isVisible={selected && actions?.writable} minWidth={180} minHeight={120} color="#92b2db" onResizeStart={() => actions?.checkpoint()} />
    <header onDoubleClick={(event) => { event.stopPropagation(); actions?.inspect(id) }}>{data.autoLayoutGroup ? <Sparkles size={13} /> : <FileText size={13} />}<b>{title}</b><span>{tr('studioCanvas.studioNodeCard.groupCount',{n:Array.isArray(data.children) ? data.children.length : 0})}</span></header>
  </div>

  const topActions = (() => {
    if (!panelsVisible) return null
    if (busy) return data.canCancel || data.cancelRequested ? <button disabled={!actions?.writable || !!data.cancelRequested} onClick={() => actions?.cancelGeneration(id)}>{data.cancelRequested ? tr('studioCanvas.studioNodeCard.cancelling') : tr('studioCanvas.studioNodeCard.cancelQueue')}</button> : null
    if (kind === 'compose') return <button onClick={()=>actions?.composition?.(id)}><Film size={14}/>{tr('studioCanvas.studioNodeCard.composition')}</button>
    if (isAnalysis) return <><button onClick={() => actions?.upload(id)}><Upload size={14} /> {tr('studioCanvas.studioNodeCard.replaceVideo')}</button><button onClick={() => actions?.analyze(id)}><Film size={14} /> {data.analysisReport ? tr('studioCanvas.studioNodeCard.viewResult') : tr('studioCanvas.studioNodeCard.detectSettings')}</button></>
    if (kind === 'director3d') return <button onClick={() => actions?.director(id)}><Film size={14} /> {tr('studioCanvas.studioNodeCard.openDirector')}</button>
    if (isText) return <>{(['heading1', 'heading', 'heading3', 'paragraph', 'bold', 'italic', 'list', 'ordered', 'divider'] as TextFormat[]).map((format) => <button type="button" key={format} disabled={!actions?.writable} aria-label={tr(`studioCanvas.studioNodeCard.format.${format}`)} onMouseDown={(event) => event.preventDefault()} onClick={() => formatText(format)}>{{ heading1: 'H₁', heading: 'H₂', heading3: 'H₃', paragraph: '¶', bold: 'B', italic: '𝘐', list: '☷', ordered: '1≡', divider: '—', quote: '❞', code: '</>' }[format]}</button>)}<button onClick={() => actions?.duplicate(id)} title={tr('studioCanvas.studioNodeCard.duplicateTitle')}>{tr('studioCanvas.studioNodeCard.duplicate')}</button><button onClick={() => actions?.inspect(id)} title={tr('studioCanvas.studioNodeCard.expandTitle')}>{tr('studioCanvas.studioNodeCard.expand')}</button><button aria-pressed={selfWrite && !textComposer} onClick={() => { actions?.closeTextComposer?.(); setSelfWrite(true) }}>{tr('studioCanvas.studioNodeCard.selfWrite')}</button><button aria-pressed={!!textComposer} onClick={() => { setSelfWrite(false); actions?.generateText(id) }}>{tr('studioCanvas.studioNodeCard.aiWrite')}</button><button onClick={() => actions?.ask(id)}>{tr('studioCanvas.studioNodeCard.direct')}</button></>

    if (isImage) {
      return <>
        <button type="button" onClick={() => actions?.openComposer(id, 'edit')}><Pencil size={14} /> {media ? tr('studioCanvas.studioNodeCard.editImage') : tr('studioCanvas.studioNodeCard.generateImage')}</button>
        <button type="button" disabled={!media} onClick={() => actions?.openComposer(id, 'crop')}><Crop size={14} /> {tr('studioCanvas.studioNodeCard.crop')}</button>
        {ADVANCED_NODE_TOOLS && <button type="button" onClick={() => actions?.imageTools(id, 'mark')}><Pencil size={14} /> {tr('studioCanvas.studioNodeCard.mark')}</button>}
        {ADVANCED_NODE_TOOLS && <button type="button" onClick={() => actions?.imageTools(id, 'lighting')}><Sparkles size={14} /> {tr('studioCanvas.studioNodeCard.lighting')}</button>}
        {ADVANCED_NODE_TOOLS && <button type="button" onClick={() => actions?.imageTools(id, 'angle')}><Columns2 size={14} /> {tr('studioCanvas.studioNodeCard.angle')}</button>}
        {ADVANCED_NODE_TOOLS && <button type="button" onClick={() => actions?.imageTools(id, 'panorama')}><ImageIcon size={14} /> {tr('studioCanvas.studioNodeCard.panorama')}</button>}
        <button type="button" onClick={() => actions?.openComposer(id, 'video')}><Film size={14} /> {tr('studioCanvas.studioNodeCard.i2v')}</button>
        <button type="button" onClick={() => actions?.openComposer(id, 'reference')}><Sparkles size={14} /> {tr('studioCanvas.studioNodeCard.refVideo')}</button>
        {ADVANCED_NODE_TOOLS && <button type="button" onClick={() => actions?.gridSplit(id)}><Split size={14} /> {tr('studioCanvas.studioNodeCard.gridSplit')}</button>}
        <button type="button" onClick={() => actions?.history(id)}><History size={14} /> {tr('studioCanvas.studioNodeCard.history')}</button>
      </>
    }
    if (isVideo) {
      return <>
        <button type="button" onClick={() => actions?.openComposer(id, 'video')}><Film size={14} /> {tr('studioCanvas.studioNodeCard.genVideo')}</button>
        <button type="button" disabled={!media} onClick={() => actions?.mediaEdit(id, 'trim')}><Wand2 size={14} /> {tr('studioCanvas.studioNodeCard.trim')}</button>
        {ADVANCED_NODE_TOOLS && <button type="button" onClick={() => actions?.mediaEdit(id, 'extract_audio')}><Mic size={14} /> {tr('studioCanvas.studioNodeCard.extractAudio')}</button>}
        {ADVANCED_NODE_TOOLS && <button type="button" onClick={() => actions?.mediaEdit(id, 'separate')}><Split size={14} /> {tr('studioCanvas.studioNodeCard.separate')}</button>}
        {ADVANCED_NODE_TOOLS && <button type="button" onClick={() => actions?.mediaEdit(id, 'trim')}><Scissors size={14} /> {tr('studioCanvas.studioNodeCard.clip')}</button>}
        {ADVANCED_NODE_TOOLS && <button type="button" onClick={() => actions?.analyze(id)}><Film size={14} /> {tr('studioCanvas.studioNodeCard.analyze')}</button>}
        <button type="button" onClick={() => actions?.history(id)}><History size={14} /> {tr('studioCanvas.studioNodeCard.history')}</button>
        <button type="button" onClick={() => actions?.upload(id)}><Upload size={14} /> {tr('studioCanvas.studioNodeCard.replaceVideo')}</button>
      </>
    }
    if (isAudio) {
      return <><button type="button" onClick={() => actions?.openComposer(id, 'audio')}><Mic size={14} /> {tr('studioCanvas.studioNodeCard.genAudio')}</button>{ADVANCED_NODE_TOOLS && <><button type="button" onClick={() => actions?.mediaEdit(id, 'trim')}><Scissors size={14} /> {tr('studioCanvas.studioNodeCard.trimAudio')}</button><button type="button" onClick={() => actions?.mediaEdit(id, 'speed')}><Wand2 size={14} /> {tr('studioCanvas.studioNodeCard.speed')}</button></>}<button type="button" onClick={() => actions?.upload(id)}><Upload size={14} /> {tr('studioCanvas.studioNodeCard.replaceAudio')}</button></>
    }
    return null
  })()

  /** 节点内草稿同步到节点数据，并打开/更新生成面板。 */
  const writeDraft = (next: string) => {
    actions?.updateText(id, next)
    if (showComposer) composer?.onPrompt(next)
    else actions?.openComposer(id, 'edit', next)
  }
  const trackDraftMention = (value: string, caret: number) => { const query = mentionQuery(value, caret); setDraftMention(query === null ? null : { at: value.slice(0, caret).lastIndexOf('@'), caret, query }) }

  let body: ReactNode
  if (busy) {
    const stage = isText ? tr('studioCanvas.studioNodeCard.stageWriting') : submitting ? tr('studioCanvas.studioNodeCard.stageSubmitting') : data.generationStage === 'transferring' ? tr('studioCanvas.studioNodeCard.stageTransferring') : data.status === 'queued' ? tr('studioCanvas.studioNodeCard.stageQueued') : data.status === 'awaiting_composite' ? tr('studioCanvas.studioNodeCard.stageCompositing') : tr('studioCanvas.studioNodeCard.stageCloud')
    body = <div className={`pf-node-generating ${data.status === 'queued' ? 'is-queued' : ''}`} role="status" aria-label={tr('studioCanvas.studioNodeCard.stageAria',{title,stage})}><b>{stage}</b><div className="pf-generation-track" role="progressbar" aria-label={stage}><span /></div><small>{data.status === 'queued' ? tr('studioCanvas.studioNodeCard.queuedHint') : tr('studioCanvas.studioNodeCard.runningHint')}</small></div>
  } else if (kind === 'compose') {
    body=<div className="pf-composition-node nodrag nopan"><Scissors size={24}/><div>{tr('studioCanvas.studioNodeCard.clips',{n:composition.count})}{composition.pending&&<small>{composition.pending}</small>}</div></div>
  } else if (isAnalysis) {
    const report = data.analysisReport as { shots?: unknown[]; duration?: number } | undefined
    body = <div className="pf-analysis-node nodrag nopan">{media && <video src={String(media)} controls preload="metadata" />}<button onClick={() => actions?.analyze(id)}><Film size={22} /><b>{report ? tr('studioCanvas.studioNodeCard.shotsResult',{n:report.shots?.length || 0}) : tr('studioCanvas.studioNodeCard.analyze')}</b><span>{tr('studioCanvas.studioNodeCard.analysisFeatures')}</span></button>{!media && <button onClick={() => actions?.upload(id)}>{tr('studioCanvas.studioNodeCard.pickVideo')}</button>}</div>
  } else if (kind === 'director3d') {
    body = <button type="button" className="pf-skel-empty nodrag nopan" onClick={() => actions?.director(id)}><Film size={28} /><b>{tr('studioCanvas.studioNodeCard.open3d')}</b><span>{tr('studioCanvas.studioNodeCard.director3dHint')}</span></button>
  } else if (isText && selfWrite && selected) {
    body = writingRefs.length && (data.storyKind === 'shot_prompt' || caption.includes('@[')) ? <PromptInput className="pf-node-self-writing" label={tr('studioCanvas.studioNodeCard.body')} value={linkedCaption} references={writingRefs} readOnly={!actions?.writable} onChange={value=>actions?.updateText(id,value)} /> : <textarea ref={textInput} className="pf-node-self-writing nodrag nopan nowheel" aria-label={tr('studioCanvas.studioNodeCard.body')} value={caption} readOnly={!actions?.writable} onChange={(event) => actions?.updateText(id, event.target.value)} placeholder={tr('studioCanvas.studioNodeCard.storyPlaceholder')} />
  } else if (isText) {
    body = <div className="pf-skel-text nowheel" onDoubleClick={(event) => { event.stopPropagation(); actions?.inspect(id) }} title={tr('studioCanvas.studioNodeCard.dblEdit')}>{caption ? linkedCaption.includes('@[') ? <PromptText value={linkedCaption} references={writingRefs} /> : <MessageContent text={caption} references={writingRefs} /> : <span className="pf-node-placeholder">{data.writingPrompt ? tr('studioCanvas.studioNodeCard.aiPlaceholder') : tr('studioCanvas.studioNodeCard.textPlaceholder')}</span>}</div>
  } else if (!media && data.promptNodeId && (isImage || isVideo)) {
    body = <div className={`pf-story-result-placeholder ${isVideo ? 'is-video' : 'is-image'}`} role="button" aria-label={tr('studioCanvas.studioNodeCard.pendingAria',{title})} tabIndex={actions?.writable ? 0 : undefined} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && actions?.writable && !showComposer) { event.preventDefault(); event.stopPropagation(); actions.openComposer(id, isVideo ? 'video' : 'edit') } }}>{isVideo ? <Film size={32} strokeWidth={1.6} /> : <ImageIcon size={32} strokeWidth={1.6} />}</div>
  } else if (isVideo && !media && (data.hideTryHints || data.editor === 'reference' || data.editor === 'video' && data.label === '图生视频')) {
    body = <div className="pf-video-result-placeholder" aria-label={tr('studioCanvas.studioNodeCard.videoPlaceholder')} />
  } else if (isVideo && !media && data.editor !== 'compose') {
    body = <div className="pf-video-try nodrag nopan"><span>{tr('studioCanvas.studioNodeCard.try')}</span><button onClick={(event) => { event.stopPropagation(); actions?.videoStart?.(id, 'image_to_video') }}><ImageIcon size={16} />{tr('studioCanvas.studioNodeCard.tryI2v')}</button><button onClick={(event) => { event.stopPropagation(); actions?.videoStart?.(id, 'first_last_frame') }}><Columns2 size={16} />{tr('studioCanvas.studioNodeCard.tryFl')}</button><button onClick={(event) => { event.stopPropagation(); actions?.videoStart?.(id, 'script') }}><FileText size={16} />{tr('studioCanvas.studioNodeCard.tryScript')}</button></div>
  } else if (isVideo && media) {
    body = <div className="pf-media-gallery"><InlineVideoPlayer key={String(media)} url={String(media)} title={title} writable={!!actions?.writable} onSize={(width, height) => setNaturalSize({ url: String(media), width, height })} onCapture={(at) => actions?.mediaEdit(id, 'frame', at)} />{variantBar}</div>
  } else if (isImage && media) {
    body = <div className="pf-image-gallery pf-media-gallery" onDoubleClick={(event) => { if ((event.target as HTMLElement).closest('button')) return; event.preventDefault(); event.stopPropagation(); actions?.openComposer(id, 'edit') }}>
      <div className="pf-skel-media" role="img" aria-label={tr('studioCanvas.studioNodeCard.imageAria',{title})}><img src={String(media)} alt="" draggable={false} onLoad={(event) => { const image = event.currentTarget; setNaturalSize({ url: String(media), width: image.naturalWidth, height: image.naturalHeight }); actions?.imageLoaded?.(id, String(media), image.naturalWidth, image.naturalHeight) }} /></div>
      {variantBar}
    </div>
  } else if (isAudio && media) {
    body = <InlineAudioPlayer key={String(media)} url={String(media)} title={title} projectId={actions?.projectId} assetId={Number(data.assetId) || undefined} />
  } else if (isImage) {
    body = <div
      className="pf-image-draft nodrag nopan"
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); actions?.dropFiles(id, event.dataTransfer.files) }}
    >
      <PromptInput inputRef={draftRef} className="pf-image-draft-input" value={draftValue} label={tr('studioCanvas.studioNodeCard.imageDesc')} references={Array.isArray(data.promptReferences) ? data.promptReferences as PromptReference[] : []} onChange={(value, caret) => { writeDraft(value); trackDraftMention(value, caret) }} onCaret={trackDraftMention} onBlur={() => window.setTimeout(() => setDraftMention(null), 120)} onFocus={() => { if (!showComposer) actions?.openComposer(id, 'edit') }} />
      {draftMention && showComposer && composer && <MentionMenu anchor={draftRef} query={draftMention.query} mentions={composer.mentions} onPick={(item) => { const ref = { ...item, label: composer.refs.find((entry) => entry.id === item.id)?.label || item.label }; writeDraft(`${draftValue.slice(0, draftMention.at)}${mentionToken(ref)} ${draftValue.slice(draftMention.caret)}`); composer.onMention(ref); setDraftMention(null) }} onLibrary={() => { setDraftMention(null); composer.onAddRef() }} />}
      {showTryHints ? <div className="pf-image-try" onMouseDown={(event) => event.stopPropagation()}>
        <span>{tr('studioCanvas.studioNodeCard.try')}</span>
        <button type="button" onClick={() => actions?.upload(id)}><Upload size={13} /> {tr('studioCanvas.studioNodeCard.tryUpload')}</button>
        <button type="button" onClick={() => { actions?.openComposer(id, 'edit'); window.requestAnimationFrame(() => draftRef.current?.focus()) }}><FileText size={13} /> {tr('studioCanvas.studioNodeCard.tryDescribe')}</button>
      </div> : null}
      {busy ? <span className="pf-image-busy">{tr('studioCanvas.studioNodeCard.busy')}</span> : null}
    </div>
  } else {
    body = <button type="button" className="pf-skel-empty nodrag nopan" onClick={(event) => { event.stopPropagation(); actions?.upload(id) }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); actions?.dropFiles(id, event.dataTransfer.files) }}>
      <Plus size={22} strokeWidth={1.75} />
      <b>{busy ? tr('studioCanvas.studioNodeCard.busy') : isVideo ? tr('studioCanvas.studioNodeCard.addVideo') : tr('studioCanvas.studioNodeCard.addAudio')}</b>
    </button>
  }

  return <div onContextMenu={(event) => { event.preventDefault(); actions?.contextMenu(event, id) }} onDragOver={(event) => { if (!isText) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }} onDrop={isText ? undefined : (event) => { event.preventDefault(); event.stopPropagation(); actions?.dropFiles(id, event.dataTransfer.files) }}>
    <NodeSkeleton
      selected={selected}
      busy={busy}
      output={!isAnalysis}
      title={title}
      icon={<Icon size={14} />}
      badge={busy ? undefined : data.status === 'failed' ? tr('studioCanvas.studioNodeCard.badgeFailed') : data.status === 'cancelled' ? tr('studioCanvas.studioNodeCard.badgeCancelled') : ready ? tr('studioCanvas.studioNodeCard.badgeReady') : busy ? tr('studioCanvas.studioNodeCard.badgeBusy') : undefined}
      topVisible={!!selected && !!topActions}
      bottomVisible={kind==='compose'?panelsVisible:textComposer ? panelsVisible : showComposer && !busy}
      keepBottomMounted={!!textComposer}
      topActions={topActions}
      onMenu={(event) => { event.stopPropagation(); setSelfWrite(false); if (actions?.moreMenu) actions.moreMenu(event,id); else if (busy) return; else if (actions?.editGeneration) actions.editGeneration(id); else if (isText) actions?.generateText(id); else actions?.openComposer(id, isVideo ? 'video' : isAudio ? 'audio' : 'edit') }}
      onPreview={media ? () => actions?.preview(id) : undefined}
      onDownload={media || isText ? () => actions?.download(id) : undefined}
      canPreview={!!media}
      canDownload={!!media || isText}
      writable={actions?.writable}
      onRename={(value) => actions?.rename(id, value)}
      onRemove={actions?.writable ? () => actions?.remove(id) : undefined}
      onResize={(nextWidth, nextHeight) => actions?.resize(id, nextWidth, nextHeight)}
      onResizeStart={() => actions?.checkpoint()}
      mediaKind={isText ? 'text' : isVideo ? 'video' : isAudio ? 'audio' : 'image'}
      empty={isImage && !media}
      hasMedia={isImage && !!media}
      hasComposer={showComposer && isImage}
      width={width || mediaNodeWidth(isText ? 'text' : mediaKind, naturalSize.url === media ? naturalSize.width : 0, naturalSize.url === media ? naturalSize.height : 0)}
      height={isImage && !media && !data.userResized ? 280 : isVideo && !media && !data.promptNodeId && data.editor !== 'compose' ? Math.max(height || 0, 240) : isText && (selfWrite || textComposer) ? Math.max(height || 0, 240) : height}
      bottom={kind==='compose'?<div className="pf-composition-node-footer"><button onClick={()=>actions?.composition?.(id)}><Film size={17}/>{tr('studioCanvas.studioNodeCard.composition')}</button></div>:textComposer || (showComposer && composer ? <PromptComposer
        controls={composer.controls}
        videoMode={composer.videoMode}
        onVideoModeChange={composer.onVideoModeChange}
        videoModeOptions={composer.videoModeOptions}
        validationMessage={composer.validationMessage}
        voice={composer.voice}
        onVoiceChange={composer.onVoiceChange}
        action={composer.action}
        prompt={composer.prompt}
        onPrompt={(value) => { composer.onPrompt(value); actions?.updateText(id, value) }}
        chips={composer.chips}
        onRemoveChip={composer.onRemoveChip}
        onAddChip={composer.onAddChip}
        refs={composer.refs}
        onFocusRef={composer.onFocusRef}
        onRemoveRef={composer.onRemoveRef}
        onAddRef={composer.onAddRef}
        mentions={composer.mentions}
        onMention={composer.onMention}
        onPasteText={composer.onPasteText}
        modelId={composer.modelId}
        modelOptions={composer.modelOptions}
        onModelChange={composer.onModelChange}
        ratio={composer.ratio}
        onRatioChange={composer.onRatioChange}
        count={composer.count}
        onCountChange={composer.onCountChange}
        resolution={composer.resolution}
        onResolutionChange={composer.onResolutionChange}
        duration={composer.duration}
        onDurationChange={composer.onDurationChange}
        estimate={composer.estimate}
        isVideo={composer.isVideo}
        onClose={composer.onClose}
        onSubmit={composer.onSubmit}
        canSubmit={composer.canSubmit}
        attached
      /> : null)}
    >
      {body}
      {(data.status === 'failed' || data.status === 'awaiting_composite') && <p role="alert" className="pf-node-error">{studioGenerationError(data.error)}</p>}
      {!busy && !isText && !isImage && caption ? <p className="pf-skel-caption">{plainPrompt(caption)}</p> : null}
    </NodeSkeleton>
  </div>
})

export type { ComposerAction }
