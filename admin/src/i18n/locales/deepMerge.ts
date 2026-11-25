// 深合并：把 extra 中新增的文案并入基础语言包（不覆盖已有字符串）
export function deepMergeMessages<T>(base: T, extra: Record<string, unknown>): T {
  const out = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k]
    out[k] = v && typeof v === 'object' && cur && typeof cur === 'object'
      ? deepMergeMessages(cur, v as Record<string, unknown>)
      : cur === undefined ? v : cur
  }
  return out as T
}
