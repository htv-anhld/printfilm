import { GENERATION_TEXT_VI } from '../i18n/locales/vi/generationText'

const PLACEHOLDER = /\{(#?)(\d+)\}/g

/** 预编译带占位的越南语模板：{n} → 任意文本，{#n} → 数字；长模板优先匹配 */
const VI_TEMPLATES = Object.entries(GENERATION_TEXT_VI)
  .filter(([en]) => /\{#?\d+\}/.test(en))
  .sort(([a], [b]) => b.length - a.length)
  .map(([en, vi]) => {
    const order: number[] = []
    let source = '^'
    let last = 0
    for (const m of en.matchAll(PLACEHOLDER)) {
      source += en.slice(last, m.index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      source += m[1] ? '([\\d.,]+)' : '(.+?)'
      order.push(Number(m[2]))
      last = (m.index ?? 0) + m[0].length
    }
    source += en.slice(last).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'
    return { re: new RegExp(source, 's'), order, vi }
  })

/** 英文文案 → 越南语：先查精确译文，再按模板匹配，查不到回退英文 */
export function generationTextVi(en: string): string {
  const exact = GENERATION_TEXT_VI[en]
  if (exact !== undefined) return exact
  for (const t of VI_TEMPLATES) {
    const m = en.match(t.re)
    if (!m) continue
    const values: Record<number, string> = {}
    t.order.forEach((n, i) => { values[n] = m[i + 1] })
    return t.vi.replace(/\{(\d+)\}/g, (_, n) => values[Number(n)] ?? '')
  }
  return en
}
