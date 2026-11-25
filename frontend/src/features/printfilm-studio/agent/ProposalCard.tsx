import { tr } from '../../../i18n'
import { useState } from 'react'
import { CheckSquare, ChevronRight, Group, Link2, LoaderCircle, Pencil, Play, Plus, Undo2 } from 'lucide-react'
import { proposalMedia, proposalStatus, type AgentProposal, type ProposalAction, type ProposalStates } from './proposals'
import { storyImageState, type StoryNode } from './storyWorkflow'

export type ProposalControls = { nodes: StoryNode[]; states: ProposalStates; writable: boolean; busy: boolean; onAction: (proposal: AgentProposal, action: ProposalAction) => Promise<void>; onRun: (ids: string[]) => void }
export function ProposalCard({ proposal, controls }: { proposal: AgentProposal; controls: ProposalControls }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const status = proposalStatus(proposal, controls.states, controls.nodes)
  const applied = status === 'applied'
  const media = proposalMedia(proposal)
  // The planner also records completion manifests on the source script. Those
  // bookkeeping fields are not a rewritten script or another generation task.
  const withoutManifest = (node: NonNullable<AgentProposal['nodes'][number]['after']>) => ({ ...node, data: Object.fromEntries(Object.entries(node.data).filter(([key]) => !['storyAssetsReady', 'storyShotsReady', 'storyCharacterNames', 'storySceneNames'].includes(key))) })
  const visibleChanges = proposal.nodes.filter(({ before, after }) => !before || !after || before.type !== 'script' || JSON.stringify(withoutManifest(before)) !== JSON.stringify(withoutManifest(after)))
  const changed = visibleChanges.flatMap((change) => change.after ? [change.after] : [])
  const groups = changed.filter((node) => node.type === 'group')
  const text = changed.filter((node) => ['text', 'script'].includes(node.type))
  const memberOrder = groups.flatMap((group) => Array.isArray(group.data.children) ? group.data.children.map(String) : [])
  const ordered = [...visibleChanges].sort((a, b) => (memberOrder.indexOf(a.id) < 0 ? 9999 : memberOrder.indexOf(a.id)) - (memberOrder.indexOf(b.id) < 0 ? 9999 : memberOrder.indexOf(b.id)))
  const actual = media.map((node) => controls.nodes.find((item) => item.id === node.id)).filter((node): node is StoryNode => !!node)
  const complete = actual.filter((node) => storyImageState(node) === 'completed').length
  const active = actual.some((node) => storyImageState(node) === 'running')
  const action = async (value: ProposalAction, run = false) => {
    setBusy(true); setError('')
    try { await controls.onAction(proposal, value); if (run) controls.onRun(media.map((node) => node.id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : tr('studioCanvas.proposalCard.actionFailed')) }
    finally { setBusy(false) }
  }
  const label = (id: string) => String(changed.find((node) => node.id === id)?.data.label || controls.nodes.find((node) => node.id === id)?.data.label || tr('studioCanvas.proposalCard.node'))
  return <section className={`pf-agent-proposal is-${status}`} aria-label={tr('studioCanvas.proposalCard.region')}>
    <div className="pf-proposal-changes">{ordered.filter((item) => item.after?.type !== 'group').map((change) => <div key={change.id}>{change.before ? <Pencil size={16} /> : <Plus size={16} />}<span>{tr('studioCanvas.proposalCard.change', { action: !change.after ? tr('studioCanvas.proposalCard.actionDelete') : change.before ? tr('studioCanvas.proposalCard.actionEdit') : tr('studioCanvas.proposalCard.actionCreate'), kind: change.after && ['text', 'script'].includes(change.after.type) ? tr('studioCanvas.proposalCard.kindText') : change.after?.type === 'videoGeneration' ? tr('studioCanvas.proposalCard.kindVideo') : change.after && ['character', 'scene', 'image', 'imageGeneration'].includes(change.after.type) ? tr('studioCanvas.proposalCard.kindImage') : tr('studioCanvas.proposalCard.node'), name: String((change.after || change.before)?.data.label || tr('studioCanvas.proposalCard.untitled')) })}</span></div>)}
      {proposal.edges.map((change) => { const edge = change.after || change.before!; return <div key={change.id}><Link2 size={16} /><span>{change.after ? tr('studioCanvas.proposalCard.connect') : tr('studioCanvas.proposalCard.disconnect')} {label(edge.source)} → {label(edge.target)}</span></div> })}
      {groups.map((group) => <div key={group.id}><Group size={16} /><span>{tr('studioCanvas.proposalCard.group', { count: Array.isArray(group.data.children) ? group.data.children.length : 0, name: String(group.data.label) })}</span></div>)}
    </div>
    {!!text.length && <details className="pf-proposal-prompts"><summary><ChevronRight size={14} />{tr('studioCanvas.proposalCard.prompts', { count: text.length })}</summary>{text.map((node) => <article key={node.id}><b>{String(node.data.label)}</b><p>{String(node.data.writingPrompt || node.data.text || node.data.prompt || '')}</p></article>)}</details>}
    <div className="pf-proposal-summary"><b>{tr('studioCanvas.proposalCard.nodeCount', { count: changed.filter((node) => node.type !== 'group').length })}</b><span>{tr('studioCanvas.proposalCard.breakdown', { text: text.length, image: media.filter((node) => !node.type.includes('video')).length, video: media.filter((node) => node.type.includes('video')).length })}</span><small>{media.length ? tr('studioCanvas.proposalCard.runHint') : tr('studioCanvas.proposalCard.applyHint')}</small></div>
    <div className="pf-proposal-actions">
      {applied ? <><span><CheckSquare size={15} />{tr('studioCanvas.proposalCard.applied')}</span><button disabled={busy || controls.busy || !controls.writable || active} onClick={() => void action('undo')}><Undo2 size={15} />{tr('studioCanvas.proposalCard.undo')}</button>{!!media.length && <button disabled={busy || controls.busy || !controls.writable || active || complete === media.length} onClick={() => controls.onRun(media.map((node) => node.id))}><Play size={15} />{active ? tr('studioCanvas.proposalCard.runningGroup') : complete === media.length ? tr('studioCanvas.proposalCard.done') : tr('studioCanvas.proposalCard.runGroup')}</button>}</> : status === 'ignored' ? <span>{tr('studioCanvas.proposalCard.ignored')}</span> : <>
        {!!media.length && <button className="is-primary" disabled={busy || controls.busy || !controls.writable} onClick={() => void action('apply', true)}><Play size={15} />{tr('studioCanvas.proposalCard.applyRun')}</button>}
        <button disabled={busy || controls.busy || !controls.writable} onClick={() => void action('apply')}><CheckSquare size={15} />{tr('studioCanvas.proposalCard.applyOnly')}</button><button disabled={busy || controls.busy || !controls.writable} onClick={() => void action('ignore')}>{tr('studioCanvas.proposalCard.ignore')}</button>
      </>}
    </div>
    {applied && !!media.length && <div className="pf-proposal-progress"><b>{active && <LoaderCircle size={15} className="pf-agent-progress-spinner" />}{active ? tr('studioCanvas.proposalCard.running') : tr('studioCanvas.proposalCard.progress')} · {tr('studioCanvas.proposalCard.completed', { done: complete, total: media.length })}</b>{actual.map((node) => <div key={node.id}><span>{String(node.data.label)}</span><small>{{ pending: tr('studioCanvas.proposalCard.statePending'), running: tr('studioCanvas.proposalCard.stateRunning'), completed: tr('studioCanvas.proposalCard.done'), failed: tr('studioCanvas.proposalCard.stateFailed') }[storyImageState(node)]}</small></div>)}</div>}
    {error && <p role="alert">{error}</p>}
  </section>
}
