import { tr } from '../../../i18n'
import { decodeCanvasDocument, type CanvasDocument, type CanvasNode, type CanvasEdge } from '../canvas/canvasCodec.ts'
import { normalizeImageDraft } from '../canvas/nodeDraft.ts'

export type Change<T> = { id: string; before: T | null; after: T | null }
export type AgentProposal = { id: string; nodes: Change<CanvasNode>[]; edges: Change<CanvasEdge>[] }
export type ProposalAction = 'apply' | 'undo' | 'ignore'
export type ProposalStatus = 'pending' | 'applied' | 'ignored' | 'undone'
export type ProposalStates = Record<string, ProposalStatus>

const transient = new Set(['selected', 'measured', 'dragging', 'resizing'])
function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key, item]) => !transient.has(key) && !('position' in value && ['width', 'height'].includes(key)) && item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalized(item)]))
  return value
}
const canonical = (value: unknown) => value && typeof value === 'object' && 'position' in value && 'data' in value ? normalizeImageDraft(value as CanvasNode) : value
const equal = (a: unknown, b: unknown) => JSON.stringify(normalized(canonical(a))) === JSON.stringify(normalized(canonical(b)))
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

// Only change fields reviewed by the user; reject conflicts instead of overwriting later work.
function merge(current: unknown, before: unknown, after: unknown): unknown {
  if (equal(before, after)) return current
  if (object(before) && object(after) && object(current)) {
    const result = { ...current }
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (transient.has(key) || equal(before[key], after[key])) continue
      const next = merge(current[key], before[key], after[key])
      if (next === undefined) delete result[key]; else result[key] = next
    }
    return result
  }
  if (!equal(current, before)) throw new Error(tr('studioCanvas.proposals.modified'))
  return after
}

export function applyProposal(document: CanvasDocument, proposal: AgentProposal, action: ProposalAction): CanvasDocument {
  const states = (document.agentProposalStates || {}) as ProposalStates
  const state = proposalStatus(proposal, states, document.nodes)
  if (action === 'apply' && state === 'applied' || action === 'ignore' && state === 'ignored') return document
  if (action === 'undo' && state !== 'applied') throw new Error(tr('studioCanvas.proposals.notApplied'))
  if (action === 'ignore' && state === 'applied') throw new Error(tr('studioCanvas.proposals.undoFirst'))
  const result = structuredClone(document)
  if (action !== 'ignore') for (const kind of ['nodes', 'edges'] as const) {
    const items = new Map<string, CanvasNode | CanvasEdge>(result[kind].map((item) => [item.id, item]))
    for (const change of proposal[kind]) {
      const before = action === 'undo' ? change.after : change.before
      const after = action === 'undo' ? change.before : change.after
      const current = items.get(change.id)
      if (!before) {
        if (current) throw new Error(tr('studioCanvas.proposals.exists'))
        if (after) items.set(change.id, structuredClone(after))
      } else if (!after) {
        if (!equal(current, before)) throw new Error(tr('studioCanvas.proposals.cannotUndo'))
        items.delete(change.id)
      } else items.set(change.id, merge(current, before, after) as CanvasNode | CanvasEdge)
    }
    if (kind === 'nodes') result.nodes = [...items.values()] as CanvasNode[]
    else result.edges = [...items.values()] as CanvasEdge[]
  }
  // Parents before children, without changing relative positions or unrelated nodes.
  result.nodes.sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId))
  const ids = new Set(result.nodes.map((node) => node.id))
  if (result.nodes.some((node) => node.parentId && !ids.has(String(node.parentId)))) throw new Error(tr('studioCanvas.proposals.groupNotEmpty'))
  result.agentProposalStates = { ...states, [proposal.id]: action === 'apply' ? 'applied' : action === 'undo' ? 'undone' : 'ignored' }
  return decodeCanvasDocument(result)
}

export function proposalStatus(proposal: AgentProposal, states: ProposalStates, nodes: { id: string }[]): ProposalStatus {
  const state = states[proposal.id] || 'pending'
  const added = proposal.nodes.filter((change) => !change.before && change.after)
  if (state === 'applied' && added.length && added.every((change) => !nodes.some((node) => node.id === change.id))) return 'undone'
  return state
}

export function proposalMedia(proposal: AgentProposal) {
  return proposal.nodes.flatMap(({ after }) => after && ['character', 'scene', 'image', 'imageGeneration', 'videoGeneration', 'video'].includes(after.type) ? [after] : [])
}
