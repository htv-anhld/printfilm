import { tr } from '../i18n'

/** 模板分类值（与模板数据中的中文分类一致，勿翻译） */
export const CATEGORY_ORDER = [
  '开源',
  '科普',
  '获客',
  '纪录片',
  '写实感',
  '真人感',
  '电影感',
  '儿童',
  '动漫',
  '国风',
  '科幻',
  '奇幻',
  '悬疑',
  '商业',
  '复古',
  '图文',
]

// 分类值 → 文案 key
const CATEGORY_KEYS: Record<string, string> = {
  全部: 'all',
  开源: 'opensource',
  科普: 'kepu',
  获客: 'leadgen',
  纪录片: 'documentary',
  写实感: 'realistic',
  真人感: 'people',
  电影感: 'cinematic',
  儿童: 'healing',
  动漫: 'anime',
  国风: 'guofeng',
  科幻: 'scifi',
  奇幻: 'fantasy',
  悬疑: 'mystery',
  商业: 'business',
  复古: 'retro',
  图文: 'imageText',
}

/** 分类展示名（按当前界面语言）；未知分类原样返回 */
export function categoryLabel(value: string): string {
  const key = CATEGORY_KEYS[value]
  return key ? tr(`categories.${key}`) : value
}

/** 兼容旧写法 HOME_CATEGORY_LABELS[value]：读取时按当前语言翻译 */
export const HOME_CATEGORY_LABELS: Record<string, string> = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined
      return CATEGORY_KEYS[prop] ? categoryLabel(prop) : undefined
    },
  },
)
