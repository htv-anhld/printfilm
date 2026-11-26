/** Drama image style options (aligned with manju imageStyles). */

import { tr } from '../i18n'

export const IMAGE_STYLE_IDS = [
  'retro-sci-fi-atompunk',
  'palace-intrigue-cold',
  'domestic-suspense-cold',
  'ancient-romance-soft',
  'ancient-chinese-mythology',
  'japanese-youth-film',
  'japanese-daily-natural',
  'korean-urban-soft',
  'chinese-urban-realistic',
  'wuxia-realistic-photo',
  '90s-realistic-film',
  'retro-narrative-film',
  'american-retro-hollywood',
  'neon-cyberpunk-film',
  '90s-rural-china-film',
  'cgi-3d-animation',
  'ghibli-handdrawn-anime',
  'tezuka-era-cartoon',
  'shanghai-animation',
  'pixel-art',
  'shadow-puppet-illustration',
] as const

export type ImageStyleId = (typeof IMAGE_STYLE_IDS)[number]

/**
 * 风格是否为真人写实（影视/摄影质感）；false 为插画/动画类。
 * 与后端 services/drama/image_styles.py 的 IMAGE_STYLE_REALISTIC 对齐（后端测试会比对本表）。
 * Seedance 会以 PrivacyInformation 拒收像真人的角色参考图，写实风格选中时需要提醒用户。
 */
export const IMAGE_STYLE_REALISTIC: Record<ImageStyleId, boolean> = {
  'retro-sci-fi-atompunk': true,
  'palace-intrigue-cold': true,
  'domestic-suspense-cold': true,
  'ancient-romance-soft': true,
  'ancient-chinese-mythology': true,
  'japanese-youth-film': true,
  'japanese-daily-natural': true,
  'korean-urban-soft': true,
  'chinese-urban-realistic': true,
  'wuxia-realistic-photo': true,
  '90s-realistic-film': true,
  'retro-narrative-film': true,
  'american-retro-hollywood': true,
  'neon-cyberpunk-film': true,
  '90s-rural-china-film': true,
  'cgi-3d-animation': false,
  'ghibli-handdrawn-anime': false,
  'tezuka-era-cartoon': false,
  'shanghai-animation': false,
  'pixel-art': false,
  'shadow-puppet-illustration': false,
}

/** 风格是否为真人写实（未知 / 空风格返回 false） */
export function isRealisticImageStyle(styleId: string | undefined | null): boolean {
  if (!styleId) return false
  return IMAGE_STYLE_REALISTIC[styleId as ImageStyleId] === true
}

/** 视频模型是否为 Seedance 系列（会做参考图真人审核） */
export function isSeedanceVideoModel(modelId: string | undefined | null): boolean {
  return /seedance/i.test(modelId || '')
}

/** 写实风格 + Seedance 视频模型时需要提示「角色图可能被判为真人」 */
export function shouldWarnRealisticStyle(
  styleId: string | undefined | null,
  videoModelId: string | undefined | null,
): boolean {
  return isRealisticImageStyle(styleId) && isSeedanceVideoModel(videoModelId)
}

// 展示名随当前语言（getter），保持 { id, label } 结构不变
export const IMAGE_STYLE_OPTIONS: Array<{ id: ImageStyleId; label: string }> = IMAGE_STYLE_IDS.map(
  (id) => ({
    id,
    get label() {
      return tr(`lib.imageStyles.${id}`)
    },
  }),
)

export const EPISODE_COUNT_PRESETS = [1, 12, 24, 36, 48] as const

export function getImageStyleLabel(styleId: string | undefined | null): string | null {
  if (!styleId) return null
  return IMAGE_STYLE_OPTIONS.find((o) => o.id === styleId)?.label ?? null
}
