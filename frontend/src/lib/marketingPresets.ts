/** 营销视频预设 id（与后端 /api/marketing/presets 一致）；标题 / 说明 / 脚本走 i18n marketing.presets.<id> */
export const MARKETING_PRESET_IDS = [
  'product_hero',
  'ugc_testimonial',
  'unboxing',
  'flash_sale',
  'before_after',
  'how_to',
  'brand_story',
  'app_demo',
] as const

export type MarketingPresetId = (typeof MARKETING_PRESET_IDS)[number]

/** 是否为已知预设 */
export function isMarketingPreset(id: string | null | undefined): id is MarketingPresetId {
  return Boolean(id) && (MARKETING_PRESET_IDS as readonly string[]).includes(id as string)
}
