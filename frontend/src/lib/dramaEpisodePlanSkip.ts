/** 分集自动分镜跳过记录（后端写在 script.params.episode_plan_skips，见 backend services/drama/episode_plan_skip.py）。 */

export type EpisodePlanSkip = {
  /** skipped：正文过短；failed：其它原因建分集失败 */
  status: 'skipped' | 'failed'
  /** 后端原始原因（已按界面语言翻译） */
  reason: string
  /** 正文篇幅（汉字当量；vi/en 为词数 × 1.6） */
  units: number
  /** 自动分镜所需最小篇幅（同上单位） */
  minUnits: number
}

/**
 * 读取某集仍然有效的自动分镜跳过记录。
 * 记录时的分集内容版本与当前版本不一致（正文已再保存）时视为过期，返回 null。
 * @param script 剧本（只读 params）
 * @param number 集号
 */
export function readEpisodePlanSkip(
  script: { params?: Record<string, unknown> | null } | null | undefined,
  number: number | undefined,
): EpisodePlanSkip | null {
  if (!number) return null
  const params = script?.params || {}
  const skips = params.episode_plan_skips
  if (!skips || typeof skips !== 'object') return null
  const raw = (skips as Record<string, Record<string, unknown> | undefined>)[String(number)]
  if (!raw || typeof raw !== 'object') return null
  const versions = (params.episode_versions || {}) as Record<string, unknown>
  const current = Number(versions[String(number)] ?? 0) || 0
  const recorded = Number(raw.version ?? 0) || 0
  if (recorded !== current) return null
  return {
    status: raw.status === 'failed' ? 'failed' : 'skipped',
    reason: String(raw.reason || ''),
    units: Number(raw.units || 0) || 0,
    minUnits: Number(raw.min_units || 0) || 0,
  }
}
