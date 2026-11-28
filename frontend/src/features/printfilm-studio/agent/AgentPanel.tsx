import { tr } from '../../../i18n'
import { DirectorSkillPicker } from './DirectorSkillPicker'
import { ComposerSelect } from '../canvas/ComposerMenu'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp, AtSign, Clapperboard, Minus, Plus, Check, CircleStop, History, MessageSquarePlus, Mic, PanelRight, Pencil, Settings2, Trash2, X, Search } from 'lucide-react'
import { dramaApi } from '../../../api/drama'
import { listAgentSkills, type AgentSkill } from '../../../api/agentSkills'
import { AgentReferences, ReferenceThumbnail } from './AgentReferences'
import { assetReference, nodeReference, type AgentReference } from './references'
import { printfilmStudioApi } from '../api'
import { AgentConversation, type MessageAction } from './AgentConversation'
import { StoryGuide } from './StoryGuide'
import { storyStagePrompt, type StoryStage, type StoryNode } from './storyWorkflow'
import type { AgentEvent } from './conversation'
import { useAgentPanel } from './useAgentPanel'
export type { AgentEvent } from './conversation'
import { useVoiceInput } from './useVoiceInput'
import { proposalStatus, type AgentProposal } from './proposals'
import { emptyStudioSkillSelection, studioSkillOptions, restoreStudioSkillSelection, inferredStudioSkillTask, type StudioSkillSelection, type StudioSkillTask } from './skills'
import type { ProposalControls } from './ProposalCard'
import type { AgentOptions, AgentSession, ProjectAsset } from '../types'

/* 工具名在读取时取当前语言文案（getter），切换语言后自动更新。 */
const toolLabels: Record<string, string> = { get plan_story_assets() { return tr('studioCanvas.agentPanel.toolPlanStoryAssets') }, get plan_story_shots() { return tr('studioCanvas.agentPanel.toolPlanStoryShots') }, get edit_media() { return tr('studioCanvas.agentPanel.toolEditMedia') }, get read_project() { return tr('studioCanvas.agentPanel.toolReadProject') }, get read_episode() { return tr('studioCanvas.agentPanel.toolReadEpisode') }, get read_canvas() { return tr('studioCanvas.agentPanel.toolReadCanvas') }, get add_canvas_node() { return tr('studioCanvas.agentPanel.toolAddCanvasNode') }, get update_canvas_node() { return tr('studioCanvas.agentPanel.toolUpdateCanvasNode') }, get remove_canvas_node() { return tr('studioCanvas.agentPanel.toolRemoveCanvasNode') }, get connect_canvas_nodes() { return tr('studioCanvas.agentPanel.toolConnectCanvasNodes') }, get list_assets() { return tr('studioCanvas.agentPanel.toolListAssets') }, get attach_asset_to_node() { return tr('studioCanvas.agentPanel.toolAttachAssetToNode') }, get create_image_task() { return tr('studioCanvas.agentPanel.toolCreateImageTask') }, get create_video_task() { return tr('studioCanvas.agentPanel.toolCreateVideoTask') }, get create_audio_task() { return tr('studioCanvas.agentPanel.toolCreateAudioTask') }, get get_task_status() { return tr('studioCanvas.agentPanel.toolGetTaskStatus') }, get update_script() { return tr('studioCanvas.agentPanel.toolUpdateScript') }, get update_shot() { return tr('studioCanvas.agentPanel.toolUpdateShot') }, get estimate_generation_price() { return tr('studioCanvas.agentPanel.toolEstimateGenerationPrice') } }

export function AgentPanel({ projectId, sessionId, events, answer, running, prompt, nodes, edges, assets, headers, writable, onDockWidth, onHistoryChange, onPrompt, onSend, onGenerateMedia, onRepairStory, onStop, onSelectSession, onClose, selectedNodeIds = [], proposals }: {
  proposals?: ProposalControls
  selectedNodeIds?: string[]
  projectId: number; sessionId: string | null; events: AgentEvent[]; answer: string; running: boolean; prompt: string; nodes: { id: string; type?: string; data: Record<string, unknown> }[]; edges: { source: string; target: string }[]; assets: ProjectAsset[]; headers: HeadersInit; writable: boolean
  onDockWidth: (width: number) => void; onHistoryChange: (session: AgentSession) => void
  onPrompt: (value: string) => void; onSend: (options: AgentOptions, model: string, references: AgentReference[], message?: string) => Promise<void>; onGenerateMedia: (id: string, kind: 'image' | 'video') => void; onRepairStory: (scriptId: string) => Promise<void>; onStop: () => void; onSelectSession: (id: string | null) => void; onClose: () => void
}) {
  const [tab, setTab] = useState<'chat' | 'history' | 'settings' | 'mentions'>('chat')
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [models, setModels] = useState<{ id: string; label: string }[]>([])
  const [tools, setTools] = useState<string[]>([])
  const [enabled, setEnabled] = useState<string[] | undefined>()
  const [role, setRole] = useState<'director' | 'assistant'>('director')
  /* 导演 Skill 按阶段单选；列表就绪前阻止导演发送，避免默认规则尚未加载。 */
  const [skillTask, setSkillTask] = useState<StudioSkillTask>('script_write')
  const [skillSelection, setSkillSelection] = useState<StudioSkillSelection>(emptyStudioSkillSelection)
  const [agentSkills, setAgentSkills] = useState<AgentSkill[]>([])
  const [skillsReady, setSkillsReady] = useState(false)
  const skillsProject = useRef<number | null>(null)
  const selectionKey = selectedNodeIds.join(',')
  useEffect(() => { setNodeIds(selectionKey ? selectionKey.split(',').slice(0, 20) : []) }, [selectionKey])
  const [model, setModel] = useState('')
  const modelSession = useRef<string | null | undefined>(undefined)
  const [nodeIds, setNodeIds] = useState<string[]>([])
  const [assetRefs, setAssetRefs] = useState<ProjectAsset[]>([])
  const [error, setError] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionScope, setMentionScope] = useState('canvas')
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionPage, setMentionPage] = useState(1)
  const [libraryAssets, setLibraryAssets] = useState<ProjectAsset[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  useEffect(() => {
    if (tab !== 'mentions' || mentionScope !== 'library') return
    let active = true
    setLibraryLoading(true)
    void dramaApi.listAssets().then((items) => { if (active) setLibraryAssets(items) }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : tr('studioCanvas.agentPanel.loadAssetsFailed')) }).finally(() => { if (active) setLibraryLoading(false) })
    return () => { active = false }
  }, [tab, mentionScope])
  const settingsId = useId()
  const settingsPanel = useRef<HTMLDivElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (tab !== 'settings') return
    const dismiss = (event: PointerEvent) => {
      if (!settingsPanel.current?.contains(event.target as Node) && !settingsButton.current?.contains(event.target as Node)) setTab('chat')
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setTab('chat'); settingsButton.current?.focus() }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [tab])
  const mentionListId = useId()
  const input = useRef<HTMLTextAreaElement>(null)
  const mentionList = useRef<HTMLDivElement>(null)
  const voice = useVoiceInput((text) => onPrompt(prompt + text), setError)
  const [uploading, setUploading] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const layout = useAgentPanel(onDockWidth)
  const upload = useRef<HTMLInputElement | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    let active = true
    void printfilmStudioApi.agentConfig().then((config) => { if (active) { setModels(config.models); setTools(config.tools) } }).catch((reason) => { if (active) setError(String(reason.message)) })
    return () => { active = false }
  }, [projectId])
  useEffect(() => {
    let active = true
    setSkillsReady(false)
    void listAgentSkills().then((result) => {
      if (!active) return
      const items = result.items || []
      setAgentSkills(items)
      let stored: unknown
      try { stored = JSON.parse(localStorage.getItem(`pf-director-skills:${projectId}`) || 'null') } catch { stored = null }
      skillsProject.current = projectId
      setSkillSelection(restoreStudioSkillSelection(items,stored))
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : tr('studioCanvas.agentPanel.loadSkillsFailed')) }).finally(() => { if (active) setSkillsReady(true) })
    return () => { active = false }
  }, [projectId])
  useEffect(() => {
    if (!skillsReady || skillsProject.current !== projectId) return
    try { localStorage.setItem(`pf-director-skills:${projectId}`, JSON.stringify(skillSelection)) } catch { /* Private browser storage can be unavailable. */ }
  }, [skillSelection,skillsReady,projectId])
  useEffect(() => {
    let active = true
    void printfilmStudioApi.listSessions(projectId).then((result) => { if (active) { setSessions(result.sessions); if (modelSession.current !== sessionId) { modelSession.current = sessionId; setModel(result.sessions.find((item) => item.id === sessionId)?.model_id || '') } } }).catch((reason) => { if (active) setError(String(reason.message)) })
    return () => { active = false }
  }, [projectId, sessionId, tab, running])
  const attempt = async (action: () => Promise<void>) => { setError(''); try { await action() } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : tr('studioCanvas.agentPanel.actionFailed')) } }
  const select = (id: string | null) => { onSelectSession(id); setTab('chat'); setNodeIds([]); setAssetRefs([]) }
  const toggleNode = (id: string) => setNodeIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : ids.length < 20 ? [...ids, id] : ids)
  const toggleAsset = (asset: ProjectAsset) => setAssetRefs((items) => items.some((item) => item.id === asset.id) ? items.filter((item) => item.id !== asset.id) : items.length < 20 ? [...items, asset] : items)
  const references = [
    ...nodeIds.flatMap((id) => { const node = nodes.find((item) => item.id === id); return node ? [nodeReference(node, assets)] : [] }),
    ...assetRefs.map(assetReference),
  ]
  const send = () => {
    if (running || uploading || !prompt.trim() || role === 'director' && !skillsReady) return
    const task = inferredStudioSkillTask(prompt,skillTask)
    setSkillTask(task)
    void onSend({
      director_skill_selection: role === 'director' ? skillSelection : undefined,
      enabled_tools: enabled || (role === 'director' ? tools.filter((tool) => !['create_image_task', 'create_video_task', 'create_audio_task'].includes(tool)) : undefined),
      node_ids: references.flatMap((item) => item.nodeId ? [item.nodeId] : []),
      asset_ids: assetRefs.map((item) => item.id),
      ...studioSkillOptions(skillSelection, task, role),
    }, model, references)
  }
  const startStoryStage = (stage: StoryStage, script: StoryNode) => {
    if (running || uploading || !writable || !skillsReady) return
    const required = stage === 'assets' ? 'plan_story_assets' : 'plan_story_shots'
    if (!tools.includes(required)) { setError(tr('studioCanvas.agentPanel.guideToolsMissing')); return }
    if (enabled && (!enabled.includes(required) || !enabled.includes('read_canvas'))) { setError(tr('studioCanvas.agentPanel.guideToolsDisabled')); return }
    setTab('chat')
    setNodeIds([script.id])
    setSkillTask(stage==='assets' ? 'asset_plan' : 'shot_plan')
    void onSend({
      director_skill_selection: skillSelection,
      enabled_tools: ['read_canvas', required],
      node_ids: [script.id],
      story_step: stage,
      ...studioSkillOptions(skillSelection, stage === 'assets' ? 'asset_plan' : 'shot_plan', 'director'),
    }, model, [nodeReference(script, assets)], storyStagePrompt(stage, script))
  }
  const mentionQuery = (mentionSearch || /@([^\s@]*)$/.exec(prompt)?.[1] || '').toLowerCase()
  const matches = tab !== 'mentions' ? [] : (mentionScope === 'canvas'
    ? nodes.filter((node) => node.type !== 'group').map((node) => ({ ...nodeReference(node, assets), selected: nodeIds.includes(node.id), pick: () => toggleNode(node.id) }))
    : (mentionScope === 'library' ? libraryAssets : assets).map((asset) => ({ ...assetReference(asset), selected: assetRefs.some((item) => item.id === asset.id), pick: () => toggleAsset(asset) }))
  ).filter((item) => `${item.label} ${item.key}`.toLowerCase().includes(mentionQuery))
  const mentionPages = Math.max(1, Math.ceil(matches.length / 24))
  const currentMentionPage = Math.min(mentionPage, mentionPages)
  const mentionItems = matches.slice((currentMentionPage - 1) * 24, currentMentionPage * 24)
  const activeMention = Math.min(mentionIndex, Math.max(0, mentionItems.length - 1))
  useEffect(() => { setMentionIndex(0); setMentionPage(1) }, [mentionQuery, tab, mentionScope])
  useEffect(() => {
    const list = mentionList.current
    const item = list?.querySelector<HTMLElement>('[data-active="true"]')
    if (!list || !item) return
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
  }, [activeMention, tab])
  const pickMention = (item: typeof mentionItems[number]) => {
    if (!item.selected) {
      if (item.key.startsWith('node-') ? nodeIds.length >= 20 : assetRefs.length >= 20) { setError(tr('studioCanvas.agentPanel.referenceLimit')); return }
      item.pick()
    }
    onPrompt(`${prompt.replace(/@[^\s@]*$/, '')}@${item.label} `)
    setTab('chat'); input.current?.focus()
  }
  const mentionKey = (event: KeyboardEvent<HTMLElement>) => {
    if (tab !== 'mentions' || event.nativeEvent.isComposing) return false
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Tab', 'Escape'].includes(event.key)) return false
    event.preventDefault(); event.stopPropagation()
    if (event.key === 'Escape') { setTab('chat'); input.current?.focus(); return true }
    if (event.key === 'Enter' || event.key === 'Tab') { if (mentionItems[activeMention] && !event.repeat) pickMention(mentionItems[activeMention]); return true }
    const length = mentionItems.length
    if (length) setMentionIndex(event.key === 'Home' ? 0 : event.key === 'End' ? length - 1 : (activeMention + (event.key === 'ArrowDown' ? 1 : -1) + length) % length)
    return true
  }
  const uploadFiles = (files: FileList | null) => {
    if (!files?.length || !writable || uploading || running) return
    void attempt(async () => {
      setUploading(true)
      try {
        for (const file of Array.from(files).slice(0, Math.max(0, 20 - assetRefs.length))) {
          if (!/^(image|video|audio)\//.test(file.type)) throw new Error(tr('studioCanvas.agentPanel.uploadTypeUnsupported'))
          const asset = await printfilmStudioApi.uploadAsset(projectId, file, headers)
          if (!alive.current) return
          toggleAsset(asset)
        }
      } finally { if (alive.current) setUploading(false) }
    })
  }
  const historyAction = async (event: AgentEvent, action: MessageAction) => {
    if (!sessionId || !event.id || running) return
    const sequence = Math.max(...events.map((item) => item.sequence || 0))
    const lastId = events.find((item) => item.sequence === sequence)?.id
    if (!lastId) throw new Error(tr('studioCanvas.agentPanel.messageNotSynced'))
    const changed = await printfilmStudioApi.messageAction(sessionId, event.id, action, sequence, lastId)
    if (!alive.current) return
    onHistoryChange(changed)
    if (action === 'edit_branch') onPrompt(event.text)
  }
  return <aside className={`pf-agent-panel ${layout.docked ? 'is-docked' : 'is-floating'}`} style={layout.rect} aria-label="Prismreel Agent" onDragOver={(event) => { if (writable && event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }} onDrop={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); uploadFiles(event.dataTransfer.files) } }} {...layout.handlers}>
    {(['left', ...(layout.docked ? [] : ['right', 'bottom'])] as ('left' | 'right' | 'bottom')[]).map((edge) => <div key={edge} className={`pf-agent-resize is-${edge}`} role="separator" aria-label={edge === 'bottom' ? tr('studioCanvas.agentPanel.resizeHeight') : tr('studioCanvas.agentPanel.resizeWidth')} aria-orientation={edge === 'bottom' ? 'horizontal' : 'vertical'} aria-valuenow={edge === 'bottom' ? layout.rect.height : layout.rect.width} tabIndex={0} onPointerDown={(event) => layout.start(event, edge)} onKeyDown={(event) => layout.keyboard(event, edge)} />)}
    <header className="pf-agent-panel-header" onPointerDown={(event) => layout.start(event, 'move')}>
      <span className="pf-agent-brand" aria-hidden="true">P<span /></span>
      <b title={sessions.find((item) => item.id === sessionId)?.title}>{sessions.find((item) => item.id === sessionId)?.title || tr('studioCanvas.agentPanel.defaultTitle')}</b>
      <button title={tr('studioCanvas.agentPanel.newSession')} aria-label={tr('studioCanvas.agentPanel.newSession')} disabled={running} onClick={() => select(null)}><MessageSquarePlus size={18} /></button>
      <button title={tr('studioCanvas.agentPanel.history')} aria-label={tr('studioCanvas.agentPanel.history')} aria-expanded={tab === 'history'} onClick={() => setTab(tab === 'history' ? 'chat' : 'history')}><History size={18} /></button>
      <button ref={settingsButton} title={tr('studioCanvas.agentPanel.toolSettings')} aria-label={tr('studioCanvas.agentPanel.toolSettings')} aria-expanded={tab === 'settings'} aria-controls={settingsId} onClick={() => setTab(tab === 'settings' ? 'chat' : 'settings')}><Settings2 size={18} /></button>
      <button title={layout.docked ? tr('studioCanvas.agentPanel.undockTitle') : tr('studioCanvas.agentPanel.dockRight')} aria-label={layout.docked ? tr('studioCanvas.agentPanel.undock') : tr('studioCanvas.agentPanel.dockRight')} onClick={layout.toggleDock}><PanelRight size={18} /></button>
      <button title={tr('studioCanvas.agentPanel.collapse')} aria-label={tr('studioCanvas.agentPanel.collapse')} onClick={onClose}><Minus size={18} /></button>
    </header>
    {tab === 'settings' && <div ref={settingsPanel} id={settingsId} className="pf-agent-settings" role="region" aria-label={tr('studioCanvas.agentPanel.toolSettingsRegion')}>
      <div className="pf-agent-settings-heading"><span>{tr('studioCanvas.agentPanel.settingsHeading')}</span><button aria-label={tr('studioCanvas.agentPanel.closeSettings')} onClick={() => { setTab('chat'); settingsButton.current?.focus() }}><X size={16} /></button></div>
      <p>{tr('studioCanvas.agentPanel.settingsHint')}</p>
      <div className="pf-agent-settings-tools">{tools.map((tool) => {
        const checked = enabled ? enabled.includes(tool) : role !== 'director' || !['create_image_task', 'create_video_task', 'create_audio_task'].includes(tool)
        return <label className="pf-tool-toggle" key={tool}><span>{toolLabels[tool] || tool}</span><input type="checkbox" role="switch" disabled={running} checked={checked} onChange={(event) => setEnabled((current) => {
          const active = current || (role === 'director' ? tools.filter((item) => !['create_image_task', 'create_video_task', 'create_audio_task'].includes(item)) : tools)
          return event.target.checked ? [...new Set([...active, tool])] : active.filter((item) => item !== tool)
        })} /></label>
      })}{!tools.length && <p>{tr('studioCanvas.agentPanel.noTools')}</p>}</div>
      <p className="pf-agent-settings-note">{role === 'director' && !enabled ? tr('studioCanvas.agentPanel.directorNote') : tr('studioCanvas.agentPanel.billingNote')}</p>
    </div>}
    {tab === 'history' ? <div className="pf-agent-scroll"><h3>{tr('studioCanvas.agentPanel.history')}</h3>{sessions.length === 0 && <p>{tr('studioCanvas.agentPanel.noSessions')}</p>}{sessions.map((session) => <div className="pf-agent-session" key={session.id}>{renaming === session.id ? <><input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /><button title={tr('studioCanvas.agentPanel.saveName')} onClick={() => void attempt(async () => { const changed = await printfilmStudioApi.updateSession(session.id, { title }); setSessions((items) => items.map((item) => item.id === changed.id ? changed : item)); setRenaming(null) })}><Check size={16} /></button></> : <><button className="pf-session-name" disabled={running} onClick={() => select(session.id)}>{session.title}<small>{session.status === 'running' ? tr('studioCanvas.agentPanel.running') : session.id === sessionId ? tr('studioCanvas.agentPanel.currentSession') : tr('studioCanvas.agentPanel.openHistory')}</small></button><button title={tr('studioCanvas.agentPanel.rename')} disabled={session.status === 'running'} onClick={() => { setRenaming(session.id); setTitle(session.title) }}><Pencil size={15} /></button><button title={tr('studioCanvas.agentPanel.deleteSession')} disabled={session.status === 'running'} onClick={() => { if (window.confirm(tr('studioCanvas.agentPanel.confirmDelete', { title: session.title }))) void attempt(async () => { await printfilmStudioApi.deleteSession(session.id); setSessions((items) => items.filter((item) => item.id !== session.id)); if (session.id === sessionId) select(null) }) }}><Trash2 size={15} /></button></>}</div>)}</div>
      : <AgentConversation proposals={proposals} sessionId={sessionId} events={events} answer={answer} running={running} labels={toolLabels} onPrompt={onPrompt} onAction={historyAction} guide={<StoryGuide running={running} pending={!!proposals && events.some((event) => event.type === 'proposal' && ['pending', 'undone'].includes(proposalStatus(event.data as AgentProposal, proposals.states, nodes)))} nodes={nodes} edges={edges} preferredIds={nodeIds.length ? nodeIds : events.findLast((event) => event.type === 'user')?.references?.flatMap((reference) => reference.nodeId ? [reference.nodeId] : []) || []} writable={writable && !uploading} onStage={startStoryStage} onGenerate={onGenerateMedia} onRepair={(scriptId) => { void attempt(() => onRepairStory(scriptId)) }} />} />}

    {error && <div role="alert" className="pf-agent-error">{error}<button aria-label={tr('studioCanvas.agentPanel.dismissError')} onClick={() => setError('')}><X size={12} /></button></div>}
    <nav className="pf-agent-shortcuts" aria-label={tr('studioCanvas.agentPanel.shortcuts')}>
      <button onClick={() => { setTab('mentions'); input.current?.focus() }}>{tr('studioCanvas.agentPanel.references')}</button>
      <button disabled={!writable || uploading || running} onClick={() => upload.current?.click()}>{tr('studioCanvas.agentPanel.upload')}</button>
      <button onClick={() => { onPrompt(tr('studioCanvas.agentPanel.outlinePrompt')); setTab('chat'); input.current?.focus() }}>{tr('studioCanvas.agentPanel.outline')}</button>
    </nav>
    {role === 'director' && <DirectorSkillPicker skills={agentSkills} selection={skillSelection} task={skillTask} disabled={running || !skillsReady} onTask={setSkillTask} onSelect={(phase,id)=>setSkillSelection(current=>({...current,[phase]:id}))}/>}
    <div className="pf-agent-compose">
      {tab === 'mentions' && <div className="pf-agent-mention-menu" onKeyDown={mentionKey}>
        <header><b>{tr('studioCanvas.agentPanel.mention')}</b><button aria-label={tr('studioCanvas.agentPanel.closeMention')} onClick={() => { setTab('chat'); input.current?.focus() }}><X size={14} /></button></header>
        <div className="pf-mention-tabs" role="tablist" aria-label={tr('studioCanvas.agentPanel.mentionSource')}>{[['canvas', tr('studioCanvas.agentPanel.scopeCanvas')], ['project', tr('studioCanvas.agentPanel.scopeProject')], ['library', tr('studioCanvas.agentPanel.scopeLibrary')]].map(([key, label]) => <button key={key} role="tab" aria-selected={mentionScope === key} onClick={() => setMentionScope(key)}>{label}</button>)}</div>
        <label className="pf-mention-search"><Search size={14} /><input aria-label={tr('studioCanvas.agentPanel.searchLabel')} placeholder={tr('studioCanvas.agentPanel.searchPlaceholder')} value={mentionSearch} onChange={(event) => setMentionSearch(event.target.value)} /></label>
        <div ref={mentionList} id={mentionListId} role="listbox" aria-label={tr('studioCanvas.agentPanel.mention')} aria-multiselectable="true" className="pf-agent-mention-options">
          {mentionItems.map((item, index) => <button key={item.key} id={`${mentionListId}-${index}`} role="option" aria-selected={item.selected} data-active={index === activeMention} onMouseEnter={() => setMentionIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => pickMention(item)}><span className="pf-mention-thumb"><ReferenceThumbnail reference={item} /></span><span className="pf-mention-copy"><b>{item.label}</b><small>{{ image: tr('studioCanvas.agentPanel.kindImage'), video: tr('studioCanvas.agentPanel.kindVideo'), audio: tr('studioCanvas.agentPanel.kindAudio'), text: tr('studioCanvas.agentPanel.kindText') }[item.kind]}</small></span>{item.selected && <Check size={14} />}</button>)}
          {libraryLoading && mentionScope === 'library' && <p>{tr('studioCanvas.agentPanel.loadingAssets')}</p>}
          {mentionItems.length === 0 && <p>{tr('studioCanvas.agentPanel.noMatches')}</p>}
        </div>
        {mentionPages > 1 && <nav className="pf-library-pagination" aria-label={tr('studioCanvas.agentPanel.pagination')}><button disabled={currentMentionPage === 1} onClick={() => { setMentionPage(currentMentionPage - 1); setMentionIndex(0) }}>{tr('studioCanvas.agentPanel.prevPage')}</button><span>{tr('studioCanvas.agentPanel.pageOf', { page: currentMentionPage, total: mentionPages })}</span><button disabled={currentMentionPage === mentionPages} onClick={() => { setMentionPage(currentMentionPage + 1); setMentionIndex(0) }}>{tr('studioCanvas.agentPanel.nextPage')}</button></nav>}
        <small className="pf-agent-mention-help">{tr('studioCanvas.agentPanel.mentionHelp')}</small>
      </div>}
      <AgentReferences references={references} onRemove={(reference) => {
        if (reference.nodeId) toggleNode(reference.nodeId)
        else setAssetRefs((items) => items.filter((item) => item.id !== reference.assetId))
      }} />
      <textarea ref={input} aria-label={tr('studioCanvas.agentPanel.messageLabel')} aria-controls={tab === 'mentions' ? mentionListId : undefined} aria-activedescendant={tab === 'mentions' && mentionItems.length ? `${mentionListId}-${activeMention}` : undefined} aria-autocomplete="list" value={prompt} onChange={(event) => { onPrompt(event.target.value); if (/@[^\s@]*$/.test(event.target.value)) setTab('mentions'); else if (tab === 'mentions') setTab('chat') }} onKeyDown={(event) => { if (mentionKey(event)) return; if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() } }} placeholder={tr('studioCanvas.agentPanel.placeholder')} />
      <footer>
        <div className="pf-agent-compose-tools">
          <button title={writable ? tr('studioCanvas.agentPanel.uploadTitle') : tr('studioCanvas.agentPanel.uploadNeedsEdit')} aria-label={tr('studioCanvas.agentPanel.upload')} disabled={!writable || uploading || running} onClick={() => upload.current?.click()}><Plus size={20} /></button>
          <Clapperboard className="pf-agent-role-icon" size={17} />
          <ComposerSelect label={tr('studioCanvas.agentPanel.modeLabel')} value={role} options={[{ id: 'director', label: tr('studioCanvas.agentPanel.modeDirector') }, { id: 'assistant', label: tr('studioCanvas.agentPanel.modeAssistant') }]} onChange={(value) => setRole(value === 'assistant' ? 'assistant' : 'director')} />
        </div>
        <div className="pf-agent-compose-actions">
          <select aria-label={tr('studioCanvas.agentPanel.modelLabel')} title={models.find((item) => item.id === model)?.label || tr('studioCanvas.agentPanel.defaultModel')} value={model} disabled={running} onChange={(event) => setModel(event.target.value)}><option value="">{tr('studioCanvas.agentPanel.defaultModel')}</option>{models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <button title={tr('studioCanvas.agentPanel.mention')} aria-label={tr('studioCanvas.agentPanel.mention')} aria-expanded={tab === 'mentions'} aria-controls={mentionListId} onClick={() => { setTab(tab === 'mentions' ? 'chat' : 'mentions'); input.current?.focus() }}><AtSign size={17} /></button>
          <button title={voice.supported ? voice.recording ? tr('studioCanvas.agentPanel.stopVoice') : tr('studioCanvas.agentPanel.voiceTitle') : tr('studioCanvas.agentPanel.voiceUnsupported')} aria-label={tr('studioCanvas.agentPanel.voice')} disabled={!voice.supported || running} aria-pressed={voice.recording} onClick={voice.toggle}><Mic size={17} /></button>
          {running ? <button className="pf-agent-send" title={tr('studioCanvas.agentPanel.stop')} aria-label={tr('studioCanvas.agentPanel.stop')} onClick={onStop}><CircleStop size={21} /></button> : <button className="pf-agent-send" title={tr('studioCanvas.agentPanel.send')} aria-label={tr('studioCanvas.agentPanel.send')} disabled={!prompt.trim() || uploading || role === 'director' && !skillsReady} onClick={() => { setTab('chat'); send() }}><ArrowUp size={21} /></button>}
        </div>
      </footer></div>
    <input hidden type="file" multiple accept="image/*,video/*,audio/*" ref={upload} onChange={(event) => { uploadFiles(event.target.files); event.target.value = '' }} />
  </aside>
}


