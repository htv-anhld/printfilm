import { tr } from '../../../i18n'
import type { Node } from '@xyflow/react'
import { nodeMediaKind } from '../canvas/nodeOperations'
import { clampMediaIndex, collectMediaUrls } from '../canvas/imageVariants'

export type StoryNode = Node<Record<string, unknown>>
export type StoryKind = 'audio' | 'text' | 'image' | 'video'
export const storyKinds: StoryKind[] = ['audio', 'text', 'image', 'video']
/* 类型名在读取时取当前语言文案（getter）。 */
export const storyLabels: Record<StoryKind, string> = { get audio() { return tr('studioCanvas.storyboardState.audio') }, get text() { return tr('studioCanvas.storyboardState.text') }, get image() { return tr('studioCanvas.storyboardState.image') }, get video() { return tr('studioCanvas.storyboardState.video') } }
export const storyTitle = (node: StoryNode) => String(node.data.label || node.data.name || storyLabels[nodeMediaKind(node)] || tr('studioCanvas.storyboardState.asset'))
export function storyMedia(node: StoryNode) {
  const urls = collectMediaUrls(node.data)
  return urls[clampMediaIndex(node.data.mediaIndex, urls.length)] || ''
}
export function storyStatus(node: StoryNode, submitting = false) {
  if (submitting) return tr('studioCanvas.storyboardState.submitting')
  const status = String(node.data.status || '')
  if (['queued', 'pending'].includes(status)) return tr('studioCanvas.storyboardState.queued')
  if (['running', 'processing', 'awaiting_poll', 'awaiting_composite'].includes(status)) return tr('studioCanvas.storyboardState.generating')
  if (status === 'failed') return tr('studioCanvas.storyboardState.failed')
  if (status === 'cancelled') return tr('studioCanvas.storyboardState.cancelled')
  return storyMedia(node) ? tr('studioCanvas.storyboardState.ready') : nodeMediaKind(node) === 'text' ? tr('studioCanvas.storyboardState.text') : tr('studioCanvas.storyboardState.pending')
}
/** 节点是否排队或生成中（按状态字段判断，不依赖界面文案）。 */
export function storyBusy(node: StoryNode) {
  return ['queued', 'pending', 'running', 'processing', 'awaiting_poll', 'awaiting_composite'].includes(String(node.data.status || ''))
}
export function storySequence(nodes: StoryNode[]) {
  return nodes.filter(node => ['image','video'].includes(nodeMediaKind(node)) && typeof node.data.storyboardOrder === 'number' && node.data.storyboardOrder >= 0)
    .sort((a,b) => Number(a.data.storyboardOrder) - Number(b.data.storyboardOrder))
}
/** Ordering lives on nodes so save, undo, copy and canvas reload share one state. */
export function setStorySequence(nodes: StoryNode[], ids: string[]) {
  const available = new Set(nodes.filter(node => ['image','video'].includes(nodeMediaKind(node))).map(node => node.id))
  const ordered = [...new Set(ids)].filter(id => available.has(id))
  return nodes.map(node => ordered.includes(node.id) || node.data.storyboardOrder != null
    ? { ...node, data: { ...node.data, storyboardOrder: ordered.includes(node.id) ? ordered.indexOf(node.id) : null } } : node)
}
export function storyDuration(node: StoryNode) {
  const seconds = Number(node.data.storyboardDuration || node.data.duration || node.data.mediaDuration || (nodeMediaKind(node) === 'image' ? 3 : 0))
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
}
