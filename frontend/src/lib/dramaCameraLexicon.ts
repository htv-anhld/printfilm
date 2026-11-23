/**
 * 漫剧运镜 / 景别词库（对齐 docs/EPISODE_RULES.md §5）
 * 供分集编辑 @ 菜单插入画面行前缀或运镜短语
 */

import { translateIn, tr, type Locale } from '../i18n'

export type DramaCameraLexiconGroup = 'shot' | 'move'

export type DramaCameraLexiconItem = {
  id: string
  group: DramaCameraLexiconGroup
  /** 列表展示名 */
  label: string
  /** 插入到脚本的文本（用户可继续补描写） */
  insert: string
  /** 一行说明 */
  hint: string
}

const SHOT_IDS = ['empty', 'wide', 'full', 'medium', 'close', 'closeup', 'ecu', 'establish', 'atmosphere']
const MOVE_IDS = ['push', 'pull', 'pan', 'truck', 'follow', 'high', 'low', 'aerial']

// 词条文案取 lib.camera.items.<id>.*（getter，随当前语言；insert 写入脚本，按界面语言）
function lexItem(id: string, group: DramaCameraLexiconGroup): DramaCameraLexiconItem {
  return {
    id,
    group,
    get label() {
      return tr(`lib.camera.items.${id}.label`)
    },
    get insert() {
      return tr(`lib.camera.items.${id}.insert`)
    },
    get hint() {
      return tr(`lib.camera.items.${id}.hint`)
    },
  }
}

// 按 key 生成字符串数组，每个下标是 getter（map / 下标读取都拿当前语言）
function localizedList(keys: string[]): readonly string[] {
  const list: string[] = []
  keys.forEach((key, index) => {
    Object.defineProperty(list, index, { get: () => tr(key), enumerable: true })
  })
  return list
}

/** 景别标签：写入画面行，勿标成对白 */
export const DRAMA_SHOT_SIZE_LEXICON: DramaCameraLexiconItem[] = [
  lexItem('empty', 'shot'),
  lexItem('wide', 'shot'),
  lexItem('full', 'shot'),
  lexItem('medium', 'shot'),
  lexItem('close', 'shot'),
  lexItem('closeup', 'shot'),
  lexItem('ecu', 'shot'),
  lexItem('establish', 'shot'),
  lexItem('atmosphere', 'shot'),
]

/** 运镜短语：单段运动轴建议 ≤ 2 */
export const DRAMA_CAMERA_MOVE_LEXICON: DramaCameraLexiconItem[] = [
  lexItem('push', 'move'),
  lexItem('pull', 'move'),
  lexItem('pan', 'move'),
  lexItem('truck', 'move'),
  lexItem('follow', 'move'),
  lexItem('high', 'move'),
  lexItem('low', 'move'),
  lexItem('aerial', 'move'),
]

/** 合并词库（插入列表用） */
export const DRAMA_CAMERA_LEXICON: DramaCameraLexiconItem[] = [
  ...DRAMA_SHOT_SIZE_LEXICON,
  ...DRAMA_CAMERA_MOVE_LEXICON,
]

/** 运镜使用提示（只展示，不插入）；下标取值为 getter，随当前语言 */
export const DRAMA_CAMERA_USAGE_TIPS: readonly string[] = localizedList([
  'lib.camera.tips.formula',
  'lib.camera.tips.axes',
  'lib.camera.tips.rotation',
  'lib.camera.tips.visualOnly',
])

/**
 * 英文 / 越南语的景别与画面标签（小写，含词库 insert 去冒号后的各语言写法）。
 * 供脚本校验与字幕提取识别「Wide shot: …」「Cận cảnh: …」等纯画面行。
 */
export const DRAMA_VISUAL_LABEL_ALIASES: readonly string[] = [
  ...new Set(
    [
      ...['en', 'vi'].flatMap((l) =>
        [...SHOT_IDS, ...MOVE_IDS].map((id) =>
          translateIn(l as Locale, `lib.camera.items.${id}.insert`).replace(/[：:]\s*$/, ''),
        ),
      ),
      'visual',
      'environment',
      'shot',
      'action',
      'transition',
      'flashback',
      'establishing',
      'close up',
      'closeup',
      'hình ảnh',
      'môi trường',
      'cảnh quay',
      'hành động',
      'chuyển cảnh',
      'hồi tưởng',
    ].map((v) => v.trim().toLowerCase()),
  ),
]

// 是否为英文/越南语画面标签（不区分大小写）
export function isVisualLabelAlias(label: string): boolean {
  return DRAMA_VISUAL_LABEL_ALIASES.includes((label || '').trim().toLowerCase())
}

// 按关键字过滤词库（匹配 label / insert / hint）
export function filterDramaCameraLexicon(
  items: DramaCameraLexiconItem[],
  query: string,
): DramaCameraLexiconItem[] {
  const q = (query || '').trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.insert.toLowerCase().includes(q) ||
      item.hint.toLowerCase().includes(q),
  )
}
