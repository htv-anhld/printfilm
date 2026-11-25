import { tr } from '../i18n'
import type { DramaProjectUsageStats } from '../api/drama'
import { formatMajor } from './money'

/** 空用量占位，避免列表未返回 usage 时崩溃 */
export const EMPTY_DRAMA_USAGE: DramaProjectUsageStats = {
  charge_fen: 0,
  charge_yuan: 0,
  tokens: 0,
  calls: 0,
  image_gens: 0,
  video_gens: 0,
}

/** 格式化漫剧费用展示 */
export function formatDramaChargeYuan(yuan: number | undefined | null): string {
  const n = Number(yuan) || 0
  return formatMajor(n)
}

/** 列表/工作台短文案：费用 · 生图 · 生视频 · 调用 */
export function formatDramaUsageBrief(usage?: DramaProjectUsageStats | null): string {
  const u = usage || EMPTY_DRAMA_USAGE
  const calls = u.calls > 0 ? ` · ${tr('lib.usage.calls', { n: u.calls })}` : ''
  return `${formatDramaChargeYuan(u.charge_yuan)} · ${tr('lib.usage.images', { n: u.image_gens })} · ${tr('lib.usage.videos', { n: u.video_gens })}${calls}`
}
