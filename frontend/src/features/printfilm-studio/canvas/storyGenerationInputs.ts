import { splitPrompt } from './promptMentions.ts'
import { tr } from '../../../i18n'

type StoryGenerationNode = { id: string; type?: string; data: Record<string, unknown> }
type StoryGenerationEdge = { source: string; target: string }

export function isCanvasCharacter(node?: StoryGenerationNode) {
  return node?.data.storyKind === 'character' || node?.type === 'character'
}

export function characterVoiceReferences(nodes: StoryGenerationNode[]) {
  const references = new Map<number, string[]>()
  for (const node of nodes) {
    if (!isCanvasCharacter(node)) continue
    const id = node.data.voiceReferenceAssetId
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) continue
    const label = String(node.data.label || '角色')
    const labels = references.get(id) ?? []
    if (!labels.includes(label)) labels.push(label)
    references.set(id, labels)
  }
  return [...references].map(([assetId, labels]) => ({ assetId, labels }))
}

export function characterVoicePrompt(labels: string[], audioNumber: number) {
  return `@音频${audioNumber}：仅用于${labels.join('、')}的对白音色，台词以本镜指定文本为准。`
}

export function storyAssetPrompt(source: StoryGenerationNode | undefined, nodes: StoryGenerationNode[], edges: StoryGenerationEdge[]) {
  if (!source || !['character', 'scene'].includes(String(source.data.storyKind)) || !source.data.promptNodeId) return undefined
  const writer = nodes.find((node) => node.id === source.data.promptNodeId)
  if (!writer || !['text', 'script'].includes(writer.type || '') || !edges.some((edge) => edge.source === writer.id && edge.target === source.id)) throw new Error(tr('studioCanvas.storyGenerationInputs.assetWriter'))
  if (writer.data.sourceScriptId !== source.data.sourceScriptId) throw new Error(tr('studioCanvas.storyGenerationInputs.assetScript'))
  const prompt = String(writer.data.text || '').trim()
  if (!prompt) throw new Error(tr('studioCanvas.storyGenerationInputs.assetEmpty'))
  return prompt
}

/** Resolve the live graph at submit time; cached video prompts are not authoritative. */
export function storyVideoInputs(source: StoryGenerationNode | undefined, nodes: StoryGenerationNode[], edges: StoryGenerationEdge[]) {
  if (source?.data.storyKind !== 'shot_video') return undefined
  const incoming = new Set(edges.filter((edge) => edge.target === source.id).map((edge) => edge.source))
  const promptId = String(source.data.promptNodeId || '')
  const promptNode = nodes.find((node) => node.id === promptId)
  if (!promptNode || !incoming.has(promptId) || !['text', 'script'].includes(promptNode.type || '')) throw new Error(tr('studioCanvas.storyGenerationInputs.shotWriter'))
  const scriptId = String(source.data.sourceScriptId || '')
  if (!scriptId || promptNode.data.sourceScriptId !== scriptId) throw new Error(tr('studioCanvas.storyGenerationInputs.shotScript'))
  const prompt = String(promptNode.data.text || '').trim()
  if (!prompt) throw new Error(tr('studioCanvas.storyGenerationInputs.shotEmpty'))
  const ids = Array.isArray(source.data.referenceNodeIds) ? [...new Set(source.data.referenceNodeIds.map(String))] : []
  if (!ids.length) throw new Error(tr('studioCanvas.storyGenerationInputs.shotRefs'))
  const references = ids.map((id) => {
    const node = nodes.find((item) => item.id === id)
    if (!node || !incoming.has(id)) throw new Error(tr('studioCanvas.storyGenerationInputs.shotRefLinks'))
    if (node.data.sourceScriptId !== scriptId || !['character', 'scene'].includes(String(node.data.storyKind || ''))) throw new Error(tr('studioCanvas.storyGenerationInputs.shotRefSource'))
    const label = String(node.data.label || tr('studioCanvas.storyGenerationInputs.refDefault'))
    if (node.data.mediaType && node.data.mediaType !== 'image') throw new Error(tr('studioCanvas.storyGenerationInputs.notImage',{label}))
    if (['queued', 'running', 'awaiting_composite', 'failed', 'error', 'cancelled'].includes(String(node.data.status || ''))) throw new Error(tr('studioCanvas.storyGenerationInputs.refPending',{label}))
    const urls = Array.isArray(node.data.mediaUrls) ? node.data.mediaUrls.filter((url): url is string => typeof url === 'string' && !!url.trim()) : []
    const value = Number(node.data.mediaIndex || 0)
    const index = Number.isFinite(value) ? Math.max(0, Math.min(Math.floor(value), urls.length - 1)) : 0
    const url = urls[index] || String(node.data.mediaUrl || node.data.url || node.data.cover || '')
    if (!url) throw new Error(tr('studioCanvas.storyGenerationInputs.refMissing',{label}))
    return { node, url }
  })
  if (!references.some((reference) => reference.node.data.storyKind === 'scene')) throw new Error(tr('studioCanvas.storyGenerationInputs.shotNoScene'))
  const providerPrompt = splitPrompt(prompt).map(part => {
    if ('text' in part) return part.text
    const index = references.findIndex(ref=>part.reference.source === 'node' && ref.node.id === part.reference.id)
    return index >= 0 ? `@图片${index+1}` : part.reference.label
  }).join('') + '\n参考素材对应（按实际上传顺序）：\n' + references.map((ref,index)=>
    `@图片${index+1}：${ref.node.data.label || '参考图'}，${ref.node.data.storyKind === 'scene' ? '用于场景空间与光线' : '仅用于人物身份和造型，不照搬背景或姿势'}。`).join('\n')
  return { prompt, providerPrompt, promptNode, references, mode: 'omni_reference' as const }
}
