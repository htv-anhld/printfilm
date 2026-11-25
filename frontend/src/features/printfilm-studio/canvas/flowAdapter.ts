import { decodeCanvasDocument, encodeCanvasDocument, type CanvasDocument } from './canvasCodec.ts'
import { tr } from '../../../i18n'

export const STUDIO_ADDABLE_TYPES = ['text', 'image', 'video', 'audio', 'script'] as const
export type StudioAddableType = (typeof STUDIO_ADDABLE_TYPES)[number]

const STUDIO_NODE_LABEL_TYPES = ['text', 'image', 'video', 'audio', 'script', 'asset', 'task', 'group'] as const

/** 节点类型显示名：按访问时的界面语言取文案（getter，避免导入时冻结语言） */
export const STUDIO_NODE_LABELS: Record<string, string> = Object.defineProperties(
  {} as Record<string, string>,
  Object.fromEntries(STUDIO_NODE_LABEL_TYPES.map((type) => [type, { enumerable: true, get: () => tr(`studioCanvas.flowAdapter.node.${type}`) }])),
)

type FlowNode = { id: string; type?: string | null; position: { x: number; y: number }; data?: Record<string, unknown> }
type FlowEdge = { id: string; source: string; target: string }

/** 把持久化画布转成 React Flow 可渲染的节点、连线和视口。 */
export function flowFromDocument(raw: unknown): { nodes: FlowNode[]; edges: FlowEdge[]; viewport: CanvasDocument['viewport'] } {
  const document = decodeCanvasDocument(raw)
  return {
    nodes: document.nodes.map((node) => ({ ...node })),
    edges: document.edges.map((edge) => ({ ...edge })),
    viewport: document.viewport,
  }
}

/** 只保留可持久化字段，避免把选中态和测量结果写回服务端。 */
export function documentFromFlow(nodes: FlowNode[], edges: FlowEdge[], viewport: CanvasDocument['viewport']): CanvasDocument {
  return encodeCanvasDocument({
    toonflowCanvas: true,
    version: 1,
    nodes: nodes.map((node) => ({
      ...Object.fromEntries(Object.entries(node).filter(([key]) => !['selected', 'measured', 'dragging', 'resizing'].includes(key))),
      id: node.id,
      type: node.type || 'text',
      position: node.position,
      data: node.data && typeof node.data === 'object' ? node.data : {},
    })),
    edges: edges.map((edge) => ({ ...Object.fromEntries(Object.entries(edge).filter(([key]) => key !== 'selected')), id: edge.id, source: edge.source, target: edge.target })),
    viewport,
  })
}
