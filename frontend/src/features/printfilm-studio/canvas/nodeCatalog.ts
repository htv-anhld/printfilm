import { tr } from '../../../i18n'

/** 对照 Toonflow-app 节点菜单与 packages/nodes 类型。 */
export type NodeCatalogItem = {
  id: string
  label: string
  type?: string
  action?: 'upload' | 'assets' | 'history'
  children?: NodeCatalogItem[]
  hint?: string
  editor?: 'edit' | 'crop' | 'video' | 'reference' | 'audio' | 'inpaint' | 'outpaint' | 'compose'
}

/** 带动态文案的目录项：label/hint 用 getter 在读取时按当前语言取 tr()，避免模块加载时冻结语言。 */
function item(key: string, rest: Omit<NodeCatalogItem, 'label' | 'hint'>, withHint = false): NodeCatalogItem {
  const base = { ...rest } as NodeCatalogItem
  Object.defineProperty(base, 'label', { get: () => tr(`studioCanvas.nodeCatalog.item.${key}.label`), enumerable: true, configurable: true })
  if (withHint) Object.defineProperty(base, 'hint', { get: () => tr(`studioCanvas.nodeCatalog.item.${key}.hint`), enumerable: true, configurable: true })
  return base
}

/** 与 Toonflow anonymousData / resolveNodeMenu 默认顺序一致。 */
export const FULL_NODE_CATALOG: NodeCatalogItem[] = [
  item('text', { id: 'text', type: 'text' }),
  item('image', { id: 'image', type: 'image', editor: 'edit' }),
  item('video', { id: 'video', type: 'video', editor: 'video' }),
  item('audio', { id: 'audio', type: 'audio', editor: 'audio' }),
  item('compose', { id: 'compose', type: 'compose' }, true),
  item('imageGeneration', { id: 'imageGeneration', type: 'imageGeneration', editor: 'edit' }, true),
  item('videoGeneration', { id: 'videoGeneration', type: 'videoGeneration', editor: 'video' }, true),
  item('audioGeneration', { id: 'audioGeneration', type: 'audioGeneration', editor: 'audio' }, true),
  item('frameAnalysis', { id: 'frameAnalysis', type: 'frameAnalysis' }, true),
  item('director3d', { id: 'director3d', type: 'director3d' }, true),
  item('group', { id: 'group', type: 'group' }, true),
  item('library', {
    id: 'group:library',
    children: [
      item('library_assets', { id: 'library_assets', action: 'assets' }),
      item('library_history', { id: 'library_history', action: 'history' }),
      item('library_upload', { id: 'library_upload', action: 'upload' }),
    ],
  }),
]

// Keep legacy renderers/data intact; expose one entry per everyday content type.
export const NODE_CATALOG = FULL_NODE_CATALOG.filter((item) => ['text', 'image', 'video', 'audio', 'compose', 'group', 'group:library'].includes(item.id))

// 漫剧 / 资产库常见类型（旧画布可能已落库）及旧画布扩展类型也在其中
const NODE_TYPES = ['text', 'image', 'video', 'audio', 'imageGeneration', 'videoGeneration', 'audioGeneration', 'frameAnalysis', 'director3d', 'script', 'asset', 'task', 'group', 'scene', 'character', 'prop', 'shot', 'voice', 'material', 'compose', 'motion', 'inpaint', 'outpaint', 'storyboard', 'director_flow', 'task_flow', 'recipe', 'interpolate', 'control_video', 'upscale', 'fill_frames']

/** 节点类型 → 显示名；每个属性是 getter，读取时按当前语言取文案（键集合保持静态，供注册 nodeTypes 用）。 */
export const NODE_TYPE_LABEL: Record<string, string> = Object.defineProperties({} as Record<string, string>,
  Object.fromEntries(NODE_TYPES.map((type) => [type, { get: () => tr(`studioCanvas.nodeCatalog.type.${type}`), enumerable: true }])))


