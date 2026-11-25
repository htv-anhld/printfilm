import { tr } from '../../../i18n'
import { studioMediaRatio } from '../mediaRatio.ts'
import { writingContext, assertWritingParameters } from '../canvas/writingContext.ts'
import { storyVideoInputs } from '../canvas/storyGenerationInputs.ts'
import { storyImageState, type StoryNode, type StoryEdge } from './storyWorkflow.ts'

export type BatchSettings = { textModel?: string; imageModel: string; videoModel: string; imageResolution: string; videoResolution: string; imageRatio: string; videoRatio: string; duration: string }
export type BatchInput = { id: string; label: string; kind: 'text' | 'image' | 'video'; prompt: string; model: string; resolution: string; ratio: string; duration: string; references: { id: string; url: string }[] }
export type BatchQuote = { runId?: string; settings: BatchSettings; items: { input: BatchInput; yuan: number; priceVersion?: number }[]; total: number; planIds?: string[]; signature?: string; targetIds?: string[] }

export function batchInputs(ids: string[], nodes: StoryNode[], edges: StoryEdge[], settings: BatchSettings): BatchInput[] {
  return [...new Set(ids)].flatMap((id) => {
    const node = nodes.find((item) => item.id === id)
    if (!node) throw new Error(tr('studioCanvas.batchGeneration.changed'))
    if (['running', 'completed'].includes(storyImageState(node))) return []
    const video = ['videoGeneration', 'video'].includes(node.type || '')
    if (!video && !['character', 'scene', 'image', 'imageGeneration'].includes(node.type || '')) return []
    const linked = edges.filter((edge) => edge.target === id).map((edge) => nodes.find((item) => item.id === edge.source)).filter((item): item is StoryNode => !!item)
    const story = video ? storyVideoInputs(node, nodes, edges) : undefined
    const promptNode = node.data.promptNodeId ? linked.find((item) => item.id === node.data.promptNodeId) : undefined
    if (node.data.promptNodeId && !promptNode) throw new Error(tr('studioCanvas.batchGeneration.missingWriter', { name: String(node.data.label) }))
    if (promptNode && (!['text', 'script'].includes(promptNode.type || '') || node.data.sourceScriptId && promptNode.data.sourceScriptId !== node.data.sourceScriptId)) throw new Error(tr('studioCanvas.batchGeneration.sameScript'))
    const prompt = String(story?.prompt ?? (promptNode ? promptNode.data.text || '' : linked.filter((item) => ['text', 'script'].includes(item.type || '')).map((item) => item.data.text || '').join('\n') || node.data.prompt || '')).trim()
    if (!prompt) throw new Error(tr('studioCanvas.batchGeneration.missingPrompt', { name: String(node.data.label) }))
    const references = story ? story.references.map(({ node: ref, url }) => ({ id: ref.id, url })) : linked.filter((item) => !['text', 'script', 'group'].includes(item.type || '')).map((item) => {
      const url = String(item.data.mediaUrl || item.data.url || item.data.cover || '')
      if (!url || storyImageState(item) !== 'completed') throw new Error(tr('studioCanvas.batchGeneration.missingReference', { name: String(item.data.label) }))
      if (item.data.mediaType && item.data.mediaType !== 'image') throw new Error(tr('studioCanvas.batchGeneration.imageOnly'))
      return { id: item.id, url }
    })
    const model = String(node.data.modelId || (video ? settings.videoModel : settings.imageModel))
    if (video && promptNode) { const output = writingContext(promptNode,nodes,edges,settings).outputs.find(item=>item.id===id); if (output) assertWritingParameters(promptNode,output) }
    if (!model) throw new Error(tr('studioCanvas.batchGeneration.noModel'))
    return [{ id, label: String(node.data.label || tr('studioCanvas.batchGeneration.untitled')), kind: video ? 'video' : 'image', prompt, model,
      resolution: String(node.data.resolution || (video ? settings.videoResolution : settings.imageResolution)), ratio: studioMediaRatio(video ? 'video' : 'image', node.data.ratio || (video ? settings.videoRatio : settings.imageRatio)),
      duration: video ? String(node.data.duration || settings.duration) : '', references }]
  })
}
