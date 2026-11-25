import { tr } from '../../../i18n'
import { useState } from 'react'
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Circle, CircleDot, ListChecks } from 'lucide-react'
import { storyGuide, storyImageState, storyNodeLabel, type StoryNode, type StoryStage, type StoryEdge } from './storyWorkflow'

export function StoryGuide({ nodes, edges, preferredIds, writable, onStage, onRepair, onGenerate, running = false, pending = false }: {
  nodes: StoryNode[]; edges: StoryEdge[]; preferredIds: string[]; writable: boolean; running?: boolean; pending?: boolean
  onStage: (stage: StoryStage, script: StoryNode, assets: StoryNode[]) => void
  onRepair: (scriptId: string) => void
  onGenerate: (id: string, kind: 'image' | 'video') => void
}) {
  const [scriptId, setScriptId] = useState(''), [collapsed, setCollapsed] = useState(false)
  const guide = storyGuide(nodes, scriptId ? [scriptId] : preferredIds, edges)
  if (!guide.script) return pending || running ? <section className="pf-story-plan" aria-label={tr('studioCanvas.storyGuide.region')}><div className="pf-story-plan-heading"><ListChecks size={17} /><b>{tr('studioCanvas.storyGuide.introHeading')}</b><span>0 / 3</span></div><ol>{[tr('studioCanvas.storyGuide.stepScript'), tr('studioCanvas.storyGuide.stepAssets'), tr('studioCanvas.storyGuide.stepShots')].map((label, index) => <li key={label}>{index === 0 ? <CircleDot size={17} /> : <Circle size={17} />}<span>{label}</span></li>)}</ol><button className="pf-story-continue" disabled><ArrowRight size={17} />{pending ? tr('studioCanvas.storyGuide.applyScriptFirst') : tr('studioCanvas.storyGuide.planningScript')}</button></section> : null
  const script = guide.script
  const pairedInGroup = (node: StoryNode) => {
    const group = nodes.find((item) => item.id === node.parentId && item.type === 'group' && item.data.sourceScriptId === script.id && item.data.storyKind === `${String(node.data.storyKind)}_group`)
    const writer = nodes.find((item) => item.id === node.data.promptNodeId)
    return !!group && !!writer && writer.data.sourceScriptId === script.id && node.parentId === group.id && writer.parentId === group.id && edges.some((edge) => edge.source === writer.id && edge.target === node.id)
  }
  const assetGroupingMissing = guide.assets.some((node) => !pairedInGroup(node))
  const shotGroupingMissing = guide.shotPlans.some((shot) => shot.video && !pairedInGroup(shot.video))
  const groupingMissing = assetGroupingMissing || shotGroupingMissing
  const graphReady = guide.graphReady && !shotGroupingMissing
  const complete = 1 + Number(guide.assetsReady && !assetGroupingMissing) + Number(graphReady)
  const stage = !guide.assetsReady || assetGroupingMissing ? 'assets' : 'shots'
  const title = stage === 'assets' ? tr('studioCanvas.storyGuide.titleAssets', { name: storyNodeLabel(script) }) : graphReady ? tr('studioCanvas.storyGuide.titleReady') : tr('studioCanvas.storyGuide.titleShots')
  const next = () => {
    if (groupingMissing && guide.assets.length && !guide.missingCharacters.length || guide.needsRepair && !guide.missingCharacters.length) onRepair(script.id)
    else onStage(stage, script, guide.assets)
  }
  const steps = [{ label: tr('studioCanvas.storyGuide.stepScript'), done: true, role: tr('studioCanvas.storyGuide.roleOriginal') }, { label: tr('studioCanvas.storyGuide.stepAssets'), done: guide.assetsReady && !assetGroupingMissing, role: '' }, { label: tr('studioCanvas.storyGuide.stepShots'), done: graphReady, role: tr('studioCanvas.storyGuide.roleDirector') }]
  return <section className="pf-story-plan" aria-label={tr('studioCanvas.storyGuide.region')}>
    <button className="pf-story-plan-heading" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}><ListChecks size={17} /><b title={title}>{title}</b><span>{complete} / 3</span>{collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>
    {!collapsed && <>
      {guide.scripts.length > 1 && <select aria-label={tr('studioCanvas.storyGuide.pickScript')} value={script.id} onChange={(event) => setScriptId(event.target.value)}>{guide.scripts.map((item) => <option key={item.id} value={item.id}>{storyNodeLabel(item)}</option>)}</select>}
      <ol>{steps.map((step, index) => <li key={step.label} className={step.done ? 'is-done' : index === complete ? 'is-current' : ''}>{step.done ? <CheckCircle2 size={17} /> : index === complete ? <CircleDot size={17} /> : <Circle size={17} />}<span>{step.label}</span><small>{step.role}</small></li>)}</ol>
      {!guide.graphReady || groupingMissing ? <button className="pf-story-continue" disabled={!writable || running || pending} onClick={next}><ArrowRight size={17} />{pending ? tr('studioCanvas.storyGuide.handleFirst') : running ? tr('studioCanvas.storyGuide.planning') : tr('studioCanvas.storyGuide.continue', { step: stage === 'assets' ? tr('studioCanvas.storyGuide.stepAssets') : tr('studioCanvas.storyGuide.stepShots') })}</button> : <div className="pf-story-plan-done">{tr('studioCanvas.storyGuide.done')}</div>}
      {!!guide.assets.length && <details className="pf-story-existing"><summary>{tr('studioCanvas.storyGuide.existing', { count: guide.assets.length + guide.shotPlans.length })}</summary><div>{guide.assets.map((node) => <button key={node.id} disabled={!writable || running || storyImageState(node) === 'running'} onClick={() => onGenerate(node.id, 'image')}>{storyNodeLabel(node)} · {storyImageState(node) === 'completed' ? tr('studioCanvas.storyGuide.generated') : tr('studioCanvas.storyGuide.runImage')}</button>)}{guide.shotPlans.map((shot) => <button key={shot.id} disabled={!writable || running || !!shot.missingLinks.length} title={[...shot.missingLinks, ...shot.missingReferences].join(tr('studioCanvas.storyGuide.separator'))} onClick={() => { if (shot.video) onGenerate(shot.video.id, 'video') }}>{shot.label} · {tr('studioCanvas.storyGuide.runVideo')}</button>)}</div></details>}
    </>}
  </section>
}
