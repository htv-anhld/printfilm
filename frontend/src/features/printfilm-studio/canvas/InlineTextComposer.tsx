import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowUp, LoaderCircle, Plus, Square, X } from 'lucide-react'
import { ComposerMenu, ComposerSelect } from './ComposerMenu'
import { WRITING_SKILLS, WRITING_TYPES, textWritingPrompt, writingTypeLabel } from './textWriting'
import { PromptInput, restorePromptCaret } from './PromptInput'
import { MentionMenu } from './PromptComposer'
import { mentionQuery, mentionToken } from './promptMentions'
import type { ComposerMention } from './studioNodeContext'
import { StudioModelSelect } from '../StudioModelSelect'
import { editableWritingRequirements, imageWritingRequirements } from './textWriting'
import { linkedWritingPrompt, linkedWritingResult, writingRequest, writingOutputSignature, writingParametersChanged, type WritingOutput, type WritingReference } from './writingContext'
import { listAgentSkills, type AgentSkill } from '../../../api/agentSkills'
import { defaultStudioSkillSelection, studioSkillsForTask, studioSkillName } from '../agent/skills'
import { printfilmStudioApi } from '../api'
import { WritingRunStore } from './WritingRunStore'
import { points } from '../../../lib/points'
import { tr } from '../../../i18n'

type TextReference = { id: string; label: string; text: string; url?: string; mediaKind?: string }
export function InlineTextComposer({ projectId, nodeId, title, text, settings, references, candidates, headers, writable, onSetting, onReference, onPasteText, onFocusReference, onBusy, onApply, onValidate, runStore: providedRunStore, outputs = [] }: {
  projectId: number; nodeId: string; title: string; text: string; settings: Record<string, unknown>; references: TextReference[]; candidates: TextReference[]; headers: HeadersInit; writable: boolean
  onSetting: (key: string, value: string | number[]) => void; onReference: (id: string) => void; onBusy: (busy: boolean) => void; onApply: (text: string, expected: string, outputs?: WritingOutput[]) => void
  onFocusReference?: (id:string)=>void; onRunDependencies?: () => void; outputs?: WritingOutput[]
  onPasteText?: (value: string) => string
  runStore?: WritingRunStore; onValidate?: () => void
}) {
  const [directorReady,setDirectorReady] = useState(false)
  const [directorSkills,setDirectorSkills] = useState<AgentSkill[]>([])
  const writingTask = outputs.some(output=>output.kind==='video') ? 'video_prompt' : outputs.length ? 'asset_plan' : 'script_write'
  const configuredIds = Array.isArray(settings.writingDirectorSkillIds) ? settings.writingDirectorSkillIds.map(Number) : undefined
  const directorId = configuredIds ? configuredIds[0] : defaultStudioSkillSelection(directorSkills)[writingTask]
  const [models, setModels] = useState<{ id: string; label: string }[]>([])
  const [defaultModel, setDefaultModel] = useState('')
  const [elapsed,setElapsed] = useState(0)
  const [localRunStore] = useState(() => new WritingRunStore(id => printfilmStudioApi.stopSession(id)))
  const runStore = providedRunStore || localRunStore, runKey = `${projectId}:${nodeId}`
  const { busy, error, result, startedAt } = useSyncExternalStore(
    useCallback(listener => runStore.subscribe(runKey, listener), [runStore, runKey]),
    useCallback(() => runStore.snapshot(runKey), [runStore, runKey]),
  )
  const setError = (error: string) => runStore.update(runKey, { error })
  const setResult = (result: string) => runStore.update(runKey, { result })
  const [manage, setManage] = useState(false)
  const alive = useRef(true)
  const imageOutput = outputs.length > 0 && outputs.every(output=>output.kind==='image')
  const prompt = (imageOutput ? imageWritingRequirements : editableWritingRequirements)(String(settings.writingPrompt || '')), type = imageOutput && (!settings.writingType || settings.writingType==='镜头提示词') ? '图片提示词' : String(settings.writingType || (outputs.some(output=>output.kind==='video') ? '镜头提示词' : '故事脚本')), skill = String(settings.writingSkill || 'none')
  const boundReferences: WritingReference[] = references.map(item => ({...item,source:'node',mediaKind:item.mediaKind || (item.url ? 'image' : 'text')}))
  const linkedPrompt = linkedWritingPrompt(prompt,boundReferences,[])
  const promptInput = useRef<HTMLDivElement | null>(null)
  const [mention, setMention] = useState<{ value: string; start: number; end: number; query: string } | null>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelBlur = () => { if (blurTimer.current !== null) { clearTimeout(blurTimer.current); blurTimer.current = null } }
  useEffect(() => () => cancelBlur(), [])
  const syncMention = (value: string, caret: number) => {
    const query = mentionQuery(value, caret)
    setMention(query === null || query.startsWith('[') ? null : { value, start: value.slice(0, caret).lastIndexOf('@'), end: caret, query })
  }
  const asMention = (item: TextReference): ComposerMention => ({ ...item, source: 'node', mediaKind: item.mediaKind || (item.url ? 'image' : 'text') })
  const pickMention = (item: ComposerMention) => {
    if (!mention || busy || !writable) return
    cancelBlur()
    const token = mentionToken(item)
    const next = `${mention.value.slice(0, mention.start)}${token} ${mention.value.slice(mention.end)}`
    if (!references.some(ref => ref.id === item.id)) onReference(item.id)
    onSetting('writingPrompt', next)
    const caret = mention.start + token.length + 1
    setMention(null)
    window.requestAnimationFrame(() => { if (promptInput.current) { promptInput.current.focus(); restorePromptCaret(promptInput.current, caret) } })
  }
  const latestOutputs = useRef(outputs); latestOutputs.current = outputs
  const model = models.find(item=>item.id===settings.writingModel)?.id || models.find(item=>item.id===defaultModel)?.id || models[0]?.id || ''
  const requestVersion = useRef('')
  requestVersion.current = JSON.stringify({prompt,type,skill,model,directorId,custom:settings.customWritingSkill,references})
  useEffect(() => { alive.current = true; void printfilmStudioApi.agentConfig().then((value) => { if (alive.current) { setModels(value.models); setDefaultModel(value.default_model || '') } }).catch(() => { if (alive.current) setError(tr('studioCanvas.inlineTextComposer.modelsFailed')) }); return () => { alive.current = false } }, [])
  useEffect(()=>{ let active=true; void listAgentSkills().then(result=>{if(active)setDirectorSkills(result.items || [])}).catch(()=>undefined).finally(()=>{if(active)setDirectorReady(true)}); return()=>{active=false} },[])
  useEffect(()=>{ if(!busy) return; const tick=()=>setElapsed(Math.floor((Date.now()-startedAt)/1000)); tick(); const timer=window.setInterval(tick,1000); return()=>window.clearInterval(timer) },[busy,startedAt])
  const stop = () => runStore.stop(runKey)
  const generate = async () => {
    if (!writable || !directorReady || !prompt.trim() || !model) return
    const run = runStore.begin(runKey)
    if (!run) return
    const expected = text, acceptedOutputs = outputs, binding = writingOutputSignature(outputs), version = requestVersion.current
    onBusy(true)
    let output = ''
    try {
      const session = await printfilmStudioApi.createSession(projectId); run.sessionId = session.id
      if (run.controller.signal.aborted) { await printfilmStudioApi.stopSession(session.id); return }
      await printfilmStudioApi.updateSession(session.id, { title: tr('studioCanvas.inlineTextComposer.sessionTitle',{title}).slice(0, 200), model_id: model })
      let failure = ''
      await printfilmStudioApi.stream(session.id, textWritingPrompt(type, skill === 'custom' ? String(settings.customWritingSkill || '') : WRITING_SKILLS.find((item) => item.id === skill)?.text || '', writingRequest(prompt,boundReferences,acceptedOutputs), text, references), (event) => {
        if (event.type === 'message_delta') output += String(event.content || '')
        if (event.type === 'error') failure = String(event.message || tr('studioCanvas.inlineTextComposer.failed'))
      }, run.controller.signal, headers, { enabled_tools: [], node_ids: [nodeId, ...references.map((item) => item.id)], agent_mode:'director',skill_task:writingTask,skill_ids:directorId ? [directorId] : [] })
      if (run.controller.signal.aborted) return
      if (failure) throw new Error(failure)
      if (!output.trim()) throw new Error(tr('studioCanvas.inlineTextComposer.empty'))
      if (version !== requestVersion.current) throw new Error(tr('studioCanvas.inlineTextComposer.requestChanged'))
      if (binding !== writingOutputSignature(latestOutputs.current)) throw new Error(tr('studioCanvas.inlineTextComposer.outputsChanged'))
      onValidate?.()
      const linked = acceptedOutputs.length ? linkedWritingResult(output, boundReferences) : output
      setResult(linked)
      if (acceptedOutputs.length) onApply(linked, expected, acceptedOutputs); else onApply(linked, expected)
    } catch (reason) { if (!run.controller.signal.aborted) { setResult(output); setError(reason instanceof Error ? reason.message : tr('studioCanvas.inlineTextComposer.failed')) } }
    finally { if (runStore.finish(runKey, run)) onBusy(false) }
  }
  return <div className="pf-composer-card is-attached pf-inline-writing" onMouseDown={(event) => event.stopPropagation()}>
    <div className="pf-composer-tags"><ComposerMenu label={tr('studioCanvas.inlineTextComposer.refMenu')} value={<><Plus size={16} />{tr('studioCanvas.inlineTextComposer.refs')}</>}>{(close) => <>{candidates.length ? candidates.map((item) => <button key={item.id} disabled={busy || !writable} onClick={() => { onReference(item.id); close() }}>{item.url && <img className="pf-writing-reference-thumb" src={item.url} alt=""/>}{item.label}</button>) : <p>{tr('studioCanvas.inlineTextComposer.noCandidates')}</p>}</>}</ComposerMenu>{references.map((item) => <span className="pf-chip is-ref" key={item.id}><button type="button" className="pf-ref-jump" aria-label={tr('studioCanvas.inlineTextComposer.locateRef',{label:item.label})} onClick={()=>onFocusReference?.(item.id)}>{item.url && <img className="pf-writing-reference-thumb" src={item.url} alt=""/>}{item.label}</button><button aria-label={tr('studioCanvas.inlineTextComposer.removeRef',{label:item.label})} disabled={busy || !writable} onClick={() => onReference(item.id)}><X size={12}/></button></span>)}</div>
    <div className="pf-writing-prompt" onKeyDown={event => { if (event.key === 'Escape') { setMention(null); event.stopPropagation() } }}>
      <PromptInput inputRef={promptInput} label={tr('studioCanvas.inlineTextComposer.promptLabel')} value={linkedPrompt} references={boundReferences} readOnly={busy || !writable} onPasteText={onPasteText} onChange={(value, caret) => { onSetting('writingPrompt', value); syncMention(value, caret) }} onCaret={syncMention} onFocus={cancelBlur} onBlur={() => { cancelBlur(); blurTimer.current = setTimeout(() => setMention(null), 120) }} placeholder={tr('studioCanvas.inlineTextComposer.promptPlaceholder')} />
      {mention && writable && !busy && <MentionMenu anchor={promptInput} query={mention.query} mentions={{ connected: references.map(asMention), canvas: candidates.filter(item => !references.some(ref => ref.id === item.id)).map(asMention), assets: [] }} onPick={pickMention} />}
    </div>
    {!!outputs.length && <div className="pf-writing-outputs" aria-label={tr('studioCanvas.inlineTextComposer.outputs')}>{outputs.map(output => <span key={output.id}><b>{output.label}</b> · {output.model || tr('studioCanvas.inlineTextComposer.defaultModel')} · {output.ratio || tr('studioCanvas.inlineTextComposer.noRatio')}{output.kind === 'video' ? ` · ${output.duration ? tr('studioCanvas.inlineTextComposer.seconds',{n:output.duration}) : tr('studioCanvas.inlineTextComposer.noDuration')}` : ''}</span>)}<small>{imageOutput ? tr('studioCanvas.inlineTextComposer.imageHint') : tr('studioCanvas.inlineTextComposer.videoHint')}</small></div>}
    {text.trim() && writingParametersChanged({id:nodeId,data:settings},outputs) && <p className="pf-composer-validation">{tr('studioCanvas.inlineTextComposer.stale')}</p>}
    <fieldset disabled={busy || !writable} className="pf-writing-director"><ComposerSelect label={tr('studioCanvas.inlineTextComposer.director')} value={directorId ? String(directorId) : ''} options={[{id:'',label:tr('studioCanvas.inlineTextComposer.noDirector')},...studioSkillsForTask(directorSkills,writingTask).map(skill=>({id:String(skill.id),label:imageOutput && skill.is_builtin && skill.slug==='short-drama-assets' ? tr('studioCanvas.inlineTextComposer.imageDirector') : studioSkillName(skill)}))]} onChange={value=>onSetting('writingDirectorSkillIds',value ? [Number(value)] : [])}/></fieldset>
    <footer><fieldset disabled={busy || !writable} className="pf-writing-parameters"><ComposerSelect label={tr('studioCanvas.inlineTextComposer.type')} value={type} options={WRITING_TYPES.map((id) => ({ id, label: writingTypeLabel(id) }))} onChange={(value) => onSetting('writingType', value)} /><StudioModelSelect label={tr('studioCanvas.inlineTextComposer.model')} value={model} options={models} onChange={(value) => onSetting('writingModel', value)} /><ComposerSelect label={tr('studioCanvas.inlineTextComposer.skill')} value={skill} options={[...WRITING_SKILLS, { id: 'custom', label: tr('studioCanvas.inlineTextComposer.customSkill') }, { id: 'manage', label: tr('studioCanvas.inlineTextComposer.manageSkills') }]} onChange={(value) => value === 'manage' ? setManage(!manage) : onSetting('writingSkill', value)} /></fieldset><span className="pf-composer-spacer" /><em className="pf-composer-cost">{tr('studioCanvas.inlineTextComposer.perRun',{points:points(5)})}</em>{busy ? <button className="pf-composer-go" aria-label={tr('studioCanvas.inlineTextComposer.stop')} onClick={stop}><Square size={17} /></button> : <button className="pf-composer-go" aria-label={tr('studioCanvas.inlineTextComposer.start')} disabled={!writable || !directorReady || !prompt.trim() || !model} onClick={() => void generate()}><ArrowUp size={18} /></button>}</footer>
    {manage && <div className="pf-writing-skill-editor"><b>{tr('studioCanvas.inlineTextComposer.customTitle')}</b><textarea aria-label={tr('studioCanvas.inlineTextComposer.customAria')} maxLength={3000} value={String(settings.customWritingSkill || '')} onChange={(event) => onSetting('customWritingSkill', event.target.value)} placeholder={tr('studioCanvas.inlineTextComposer.customPlaceholder')} /><button onClick={() => { onSetting('writingSkill', 'custom'); setManage(false) }}>{tr('studioCanvas.inlineTextComposer.useSkill')}</button></div>}
    {busy && <div className="pf-writing-progress" role="status"><LoaderCircle size={15}/><span>{tr('studioCanvas.inlineTextComposer.progress')}</span><small>{tr('studioCanvas.inlineTextComposer.elapsed',{n:elapsed})}</small></div>}
    {error && <div role="alert" className="pf-composer-validation">{error}{result && <details><summary>{tr('studioCanvas.inlineTextComposer.kept')}</summary><textarea readOnly value={result} aria-label={tr('studioCanvas.inlineTextComposer.kept')} /></details>}</div>}
  </div>
}
