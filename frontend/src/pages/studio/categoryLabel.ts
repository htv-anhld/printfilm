import type { TFunction } from '../../i18n'

// 模板原始分类（后端返回的中文值，作筛选 key）→ studio.category.* 文案 key
const CATEGORY_MSG_KEY: Record<string, string> = {
  全部: 'all',
  热门推荐: 'hot',
  开源: 'openSource',
  科普: 'kepu',
  获客: 'leadGen',
  纪录片: 'documentary',
  写实感: 'realistic',
  真人感: 'lifelike',
  电影感: 'cinematic',
  儿童: 'kids',
  动漫: 'anime',
  国风: 'guofeng',
  科幻: 'scifi',
  奇幻: 'fantasy',
  悬疑: 'suspense',
  商业: 'business',
  复古: 'retro',
  图文: 'imageText',
}

/** 模板分类原值的展示名；未知分类原样返回 */
export function categoryLabel(t: TFunction, raw: string): string {
  const key = CATEGORY_MSG_KEY[raw]
  return key ? t(`studio.category.${key}`) : raw
}
