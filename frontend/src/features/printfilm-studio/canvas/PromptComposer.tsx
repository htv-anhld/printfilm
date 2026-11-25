import { tr } from '../../../i18n'
import { StudioModelSelect } from '../StudioModelSelect'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, Camera, Eye, FileText, Film, Image as ImageIcon, Mic, Plus, PersonStanding, Sparkles, X } from 'lucide-react'
import { ComposerMenu, ComposerSelect } from './ComposerMenu'
import { PromptInput } from './PromptInput'
import { mentionQuery, mentionToken, promptCaret } from './promptMentions'
import type { StudioVideoMode } from './generationReferences'
import type { ComposerMention } from './studioNodeContext'
import { generationControls, type GenerationControls } from './generationControls'

export type ComposerAction = 'edit' | 'crop' | 'video' | 'reference' | 'audio' | 'inpaint' | 'outpaint' | 'compose'

type Chip = { id: string; label: string }
type ModelOption = { id: string; label: string }

type Props = {
  action: ComposerAction
  prompt: string
  onPrompt: (value: string) => void
  chips: Chip[]
  onRemoveChip: (id: string) => void
  onAddChip: (chip: Chip, append: string) => void
  refs: { id: string; url: string; label: string; mediaKind?: string; status?: string }[]
  onRemoveRef: (id: string) => void
  onFocusRef?: (id: string) => void
  onAddRef: () => void
  mentions: { connected: ComposerMention[]; canvas: ComposerMention[]; assets: ComposerMention[] }
  onMention: (item: ComposerMention) => void
  onPasteText?: (text: string) => string
  modelId: string
  modelOptions: ModelOption[]
  onModelChange: (id: string) => void
  ratio: string
  onRatioChange: (value: string) => void
  count: string
  onCountChange: (value: string) => void
  resolution: string
  onResolutionChange: (value: string) => void
  duration: string
  onDurationChange: (value: string) => void
  estimate: string
  videoMode?: StudioVideoMode
  onVideoModeChange?: (value: StudioVideoMode) => void
  videoModeOptions?: { id: string; label: string; disabled?: boolean; hint?: string }[]
  validationMessage?: string
  generateAudio?: boolean
  onAudioChange?: (value: boolean) => void
  isVideo: boolean
  controls?: GenerationControls
  voice?: string
  onVoiceChange?: (value: string) => void
  onClose: () => void
  onSubmit: () => void
  canSubmit: boolean
  /** 挂在节点下槽时使用节点附样式（对照 Toonflow / Paba promptCard）。 */
  attached?: boolean
}

/** 预设分组（键为内部稳定 id）；label/text 在调用时按当前语言取 tr()。 */
const PRESET_GROUPS = {
  案例: { key: 'case', ids: ['case-q', 'case-cinematic', 'case-product'] },
  姿势: { key: 'pose', ids: ['pose-standing', 'pose-seated', 'pose-walking'] },
  运镜: { key: 'camera', ids: ['camera-push', 'camera-orbit', 'camera-fixed'] },
  特效: { key: 'effect', ids: ['effect-particles', 'effect-rain', 'effect-slow'] },
} as const

/** 取某分组预设（当前语言）。 */
function presetItems(name: keyof typeof PRESET_GROUPS) {
  return PRESET_GROUPS[name].ids.map((id) => { const key = id.replace(/-/g, '_'); return { id, label: tr(`studioCanvas.promptComposer.preset.${key}.label`), text: tr(`studioCanvas.promptComposer.preset.${key}.text`) } })
}
/** 分组显示名。 */
const presetGroupName = (name: keyof typeof PRESET_GROUPS) => tr(`studioCanvas.promptComposer.presetGroup.${PRESET_GROUPS[name].key}`)
const COUNTS = ['1', '2', '4']

function ReferenceThumb({ item }: { item: { url?: string; mediaKind?: string } }) {
  return item.mediaKind === 'text' ? <FileText size={14} /> : item.mediaKind === 'audio' ? <Mic size={14} /> : item.url ? item.mediaKind === 'video' ? <video src={item.url} muted preload="metadata" /> : <img src={item.url} alt="" /> : item.mediaKind==='video' ? <Film size={14}/> : <ImageIcon size={14} />
}

/** Paba 图片节点生成面板：参考图 / 案例 + 提示词 + 模型 / 比例 / 张数。 */
/** 从光标前取出尚未结束的 @ 查询。 */
/** @ 引用菜单：已接入、画布上、素材库。 */
export function MentionMenu({ query, mentions, onPick, onLibrary, anchor, fromButton = false }: {
  query: string
  mentions: { connected: ComposerMention[]; canvas: ComposerMention[]; assets: ComposerMention[] }
  onPick: (item: ComposerMention) => void
  anchor: RefObject<HTMLElement | null>
  fromButton?: boolean
  onLibrary?: () => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const popup = menu.current, editor = anchor.current
    if (!popup || !editor) return
    let frame = 0
    const place = () => {
      let rect = editor.getBoundingClientRect()
      const selection = window.getSelection()
      if (!fromButton && selection?.rangeCount && editor.contains(selection.focusNode)) {
        const range = selection.getRangeAt(0).cloneRange()
        range.collapse(false)
        // Measure the @ glyph itself; a collapsed range may have no box at a line break.
        if (range.startContainer.nodeType === 3) {
          const prefix = (range.startContainer.textContent || '').slice(0, range.startOffset)
          const at = Math.max(prefix.lastIndexOf('@'), prefix.lastIndexOf('＠'))
          if (at >= 0) {
            range.setEnd(range.startContainer, at + 1)
            range.setStart(range.startContainer, at)
          }
        }
        const glyph = range.getBoundingClientRect?.()
        if (glyph?.height) rect = glyph
      }
      const width = Math.min(300, window.innerWidth - 16)
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
      const below = window.innerHeight - rect.bottom - 12
      const above = below < 120 && rect.top > below
      Object.assign(popup.style, { left: left + 'px', width: width + 'px',
        top: above ? 'auto' : rect.bottom + 4 + 'px',
        bottom: above ? window.innerHeight - rect.top + 4 + 'px' : 'auto',
        maxHeight: Math.max(0, Math.min(280, above ? rect.top - 12 : below)) + 'px' })
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; place() }) }
    place()
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    document.addEventListener('selectionchange', schedule)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      document.removeEventListener('selectionchange', schedule)
    }
  }, [anchor, query, fromButton])
  const match = (item: ComposerMention) => !query || `${item.label} ${item.hint || ''}`.toLowerCase().includes(query.toLowerCase())
  const groups = [
    { key: 'connected', title: tr('studioCanvas.promptComposer.mention.connected'), items: mentions.connected.filter(match) },
    { key: 'canvas', title: tr('studioCanvas.promptComposer.mention.canvas'), items: mentions.canvas.filter(match) },
    { key: 'assets', title: tr('studioCanvas.promptComposer.mention.assets'), items: mentions.assets.filter(match) },
  ].filter((group) => group.items.length)
  return createPortal(<div ref={menu} className="pf-mention nodrag nopan nowheel" role="listbox" style={{ position: 'fixed', right: 'auto', zIndex: 10000, boxSizing: 'border-box' }} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    {!groups.length && <p>{tr('studioCanvas.promptComposer.mention.empty')}</p>}
    {groups.map((group) => <section key={group.key}>
      <h4>{group.title}</h4>
      {group.items.map((item) => <button type="button" key={`${item.source}-${item.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => onPick(item)}>
        <span className="pf-mention-thumb"><ReferenceThumb item={item} /></span>
        <b>{item.label}</b>
        <small>{item.hint || (item.source === 'asset' ? tr('studioCanvas.promptComposer.mention.asset') : tr('studioCanvas.promptComposer.mention.image'))}</small>
      </button>)}
    </section>)}
    {onLibrary && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onLibrary}>{tr('studioCanvas.promptComposer.mention.fromLibrary')}</button>}
  </div>, document.body)
}

export function PromptComposer({
  action, prompt, onPrompt, chips, onRemoveChip, onAddChip, refs, onFocusRef, onRemoveRef, onAddRef, mentions, onMention, onPasteText,
  modelId, modelOptions, onModelChange, ratio, onRatioChange, count, onCountChange,
  resolution, onResolutionChange, duration, onDurationChange, estimate, isVideo, onClose, onSubmit, canSubmit, attached, controls, voice, onVoiceChange, videoMode, onVideoModeChange, videoModeOptions, validationMessage, generateAudio, onAudioChange,
}: Props) {
  const choices = controls || generationControls(undefined, isVideo)
  const fixedRatio = isVideo && (videoMode === 'first_last_frame' || videoMode === 'image_to_video')
  const [presetMenu, setPresetMenu] = useState<keyof typeof PRESET_GROUPS | null>(null)
  const imageMode = !isVideo && action !== 'audio' && action !== 'crop'
  const placeholder = action === 'audio' ? tr('studioCanvas.promptComposer.placeholder.audio') : imageMode
    ? tr('studioCanvas.promptComposer.placeholder.image')
    : tr('studioCanvas.promptComposer.placeholder.video')
  const inputRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [fromButton, setFromButton] = useState(false)
  const [mentionAt, setMentionAt] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelBlur = () => { if (blurTimer.current !== null) { clearTimeout(blurTimer.current); blurTimer.current = null } }
  useEffect(() => () => cancelBlur(), [])
  const syncMention = (value: string, caret: number) => {
    setFromButton(false)
    const next = mentionQuery(value, caret)
    setQuery(next || '')
    setMentionAt(next === null || next.startsWith('[') ? null : value.slice(0, caret).lastIndexOf('@'))
  }
  const pickMention = (item: ComposerMention) => {
    const caret = inputRef.current ? promptCaret(inputRef.current) : prompt.length
    const at = mentionAt ?? prompt.lastIndexOf('@')
    const chosen = { ...item, label: refs.find((ref) => ref.id === item.id)?.label || item.label }
    const token = mentionToken(chosen)
    const next = at >= 0 ? `${prompt.slice(0, at)}${token} ${prompt.slice(Math.max(caret, at))}` : `${prompt}${token} `
    onPrompt(next)
    onMention(chosen)
    setMentionAt(null)
  }

  return <div className={`pf-composer-card${attached ? ' is-attached' : ''}${imageMode ? ' is-image' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
    <div className="pf-composer-tags nowheel">
      {chips.map((chip) => <span className="pf-chip" key={chip.id}>{chip.label}<button type="button" aria-label={tr('studioCanvas.promptComposer.removeChip')} onClick={() => onRemoveChip(chip.id)}><X size={12} /></button></span>)}
      {refs.map((item) => <span className={`pf-chip is-ref${item.status?' is-pending':''}`} key={item.id} title={`${item.label}${item.status?' · '+item.status:''}`}><button type="button" className="pf-ref-jump" aria-label={tr('studioCanvas.promptComposer.focusRef', { label: item.label })} onClick={()=>onFocusRef?.(item.id)}><ReferenceThumb item={item} /><span className="pf-ref-label">{item.label}</span></button><button type="button" aria-label={tr('studioCanvas.promptComposer.removeRef')} onClick={() => onRemoveRef(item.id)}><X size={12} /></button></span>)}
      {action !== 'audio' && <button ref={triggerRef} type="button" className="pf-chip-btn" onMouseDown={(event) => event.preventDefault()} onClick={() => {
        if (isVideo && videoMode === 'first_last_frame') { onAddRef(); return }
        cancelBlur(); setFromButton(true); setMentionAt(prompt.length); setQuery(''); inputRef.current?.focus()
      }}><Plus size={13} /> {isVideo && videoMode === 'first_last_frame' ? tr('studioCanvas.promptComposer.setFrames') : isVideo ? tr('studioCanvas.promptComposer.reference') : tr('studioCanvas.promptComposer.referenceImage')}</button>}
      {(imageMode || isVideo) && (isVideo ? (['特效', '运镜', '姿势', '案例'] as const) : (['姿势', '案例'] as const)).map((name) => <button type="button" key={name} className="pf-chip-btn" aria-expanded={presetMenu === name} onClick={() => setPresetMenu(presetMenu === name ? null : name)}>{name === '运镜' ? <Camera size={16} /> : name === '姿势' ? <PersonStanding size={16} /> : name === '特效' ? <Sparkles size={16} /> : <ImageIcon size={16} />}{presetGroupName(name)}</button>)}
      {!attached && <button type="button" className="pf-composer-close" aria-label={tr('studioCanvas.promptComposer.close')} onClick={onClose}><X size={16} /></button>}
    </div>
    {presetMenu && <div className="pf-prompt-presets nowheel">{presetItems(presetMenu).map((preset) => <button type="button" key={preset.id} onClick={() => { onAddChip(preset, preset.text); setPresetMenu(null) }}><b>{PRESET_GROUPS[presetMenu].key === 'case' ? preset.label.replace(/^[^·]*·/, '') : preset.label}</b><span>{preset.text}</span></button>)}</div>}
    <div className="pf-composer-input nowheel">
      <PromptInput inputRef={inputRef} value={prompt} label={tr('studioCanvas.promptComposer.inputLabel')} placeholder={placeholder} references={[...mentions.connected, ...mentions.canvas, ...mentions.assets]} onPasteText={onPasteText} onChange={(value, caret) => { onPrompt(value); syncMention(value, caret) }} onCaret={syncMention} onFocus={cancelBlur} onBlur={() => { cancelBlur(); blurTimer.current = setTimeout(() => setMentionAt(null), 120) }} />
      {mentionAt !== null ? <MentionMenu anchor={fromButton ? triggerRef : inputRef} fromButton={fromButton} query={query} mentions={mentions} onPick={pickMention} onLibrary={() => { setMentionAt(null); onAddRef() }} /> : null}
    </div>
    {action === 'crop' && <div className="pf-crop-row"><button type="button" onClick={onSubmit}>{tr('studioCanvas.promptComposer.cropByRatio')}</button></div>}
    <footer>
      <div className="pf-composer-controls">
      {action !== 'crop' && action !== 'compose' && <StudioModelSelect label={tr('studioCanvas.promptComposer.model')} value={modelId} options={modelOptions.length ? modelOptions : [{ id: '', label: tr('studioCanvas.promptComposer.defaultModel') }]} onChange={onModelChange} />}
      {action === 'compose' ? <span>{tr('studioCanvas.promptComposer.composeHint')}</span> : action === 'audio' ? <ComposerSelect label={tr('studioCanvas.promptComposer.voice')} value={voice || 'narrator_calm'} options={[{ id: 'narrator_calm', label: tr('studioCanvas.promptComposer.voiceCalm') }, { id: 'warm_storyteller', label: tr('studioCanvas.promptComposer.voiceWarm') }, { id: 'teacher_clear', label: tr('studioCanvas.promptComposer.voiceTeacher') }]} onChange={(value) => onVoiceChange?.(value)} /> : isVideo ? <>
        <ComposerSelect label={tr('studioCanvas.promptComposer.videoMode')} value={videoMode || 'text_to_video'} options={videoModeOptions || []} onChange={(value) => onVideoModeChange?.(value as StudioVideoMode)} />
        <ComposerMenu label={tr('studioCanvas.promptComposer.videoParams')} value={`${fixedRatio ? tr('studioCanvas.promptComposer.followFirstFrame') : ratio} · ${resolution} · ${tr('studioCanvas.promptComposer.seconds', { n: duration })}`} wide>{() => <>
          <h3>{tr('studioCanvas.promptComposer.videoParams')}</h3>
          {onAudioChange && <label className="pf-composer-audio"><input type="checkbox" checked={generateAudio !== false} onChange={event => onAudioChange(event.target.checked)} />{tr('studioCanvas.promptComposer.genAudio')}</label>}
          {([{ id: 'ratio', name: tr('studioCanvas.promptComposer.ratio'), value: ratio, values: choices.ratios, change: onRatioChange }, { id: 'resolution', name: tr('studioCanvas.promptComposer.resolution'), value: resolution, values: choices.resolutions, change: onResolutionChange }, { id: 'duration', name: tr('studioCanvas.promptComposer.duration'), value: duration, values: choices.durations, change: onDurationChange }]).filter(field => !fixedRatio || field.id !== 'ratio').map((field) => <fieldset key={field.id}><legend>{field.name}</legend><div className="pf-composer-option-grid">{field.values.map((value) => <button type="button" role="radio" aria-checked={value === field.value} key={value} onClick={() => field.change(value)}>{field.id === 'ratio' && <i className="pf-ratio-preview" style={{ aspectRatio: value.replace(':', '/') }} />}{field.id === 'duration' ? tr('studioCanvas.promptComposer.seconds', { n: value }) : value}</button>)}</div></fieldset>)}
        </>}</ComposerMenu>
      </> : <>
        <ComposerSelect label={tr('studioCanvas.promptComposer.ratio')} value={ratio} options={choices.ratios.map((id) => ({ id, label: ({auto:tr('studioCanvas.promptComposer.ratioAuto'),'1:1':tr('studioCanvas.promptComposer.ratioSquare'),'3:2':tr('studioCanvas.promptComposer.ratioLandscape'),'2:3':tr('studioCanvas.promptComposer.ratioPortrait')} as Record<string,string>)[id] || id }))} onChange={onRatioChange} />
        {action !== 'crop' && <><ComposerSelect label={tr('studioCanvas.promptComposer.resolution')} value={resolution} options={choices.resolutions.map((id) => ({ id, label: id }))} onChange={onResolutionChange} /><ComposerSelect label={tr('studioCanvas.promptComposer.count')} value={count} options={(action === 'inpaint' ? ['1'] : COUNTS).map((id) => ({ id, label: tr('studioCanvas.promptComposer.countN', { n: id }) }))} onChange={onCountChange} /></>}
      </>}
      <span className="pf-composer-spacer" />
      {!validationMessage && <span className="pf-composer-quote" title={estimate}><Eye size={15} /><em className="pf-composer-cost">{estimate}</em></span>}
      </div>
      <button type="button" className="pf-composer-go" disabled={!canSubmit} onClick={onSubmit} aria-label={action === 'compose' ? tr('studioCanvas.promptComposer.composeVideo') : tr('studioCanvas.promptComposer.generate')}><ArrowUp size={18} /></button>
    </footer>
    {validationMessage && <p className="pf-composer-validation" role="status">{validationMessage}</p>}
  </div>
}
