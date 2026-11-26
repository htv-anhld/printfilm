import operations from './locale-operations.ts'
import { getActiveLocale, type Locale } from '../../i18n/detect.ts'
import a from './locale-text-0.ts'
import b from './locale-text-1.ts'
import c from './locale-text-2.ts'
import d from './locale-text-3.ts'
import e from './locale-text-4.ts'
import server from './locale-server.json' with { type: 'json' }
import vietnamese from './locale-vi.json' with { type: 'json' }

export const marketplaceEnglish: Record<string, string> = { ...operations, "观众解锁价（积分）": "Unlock price (Points)", "本集观众解锁价（积分）": "Episode unlock price (Points)", "请输入有效的整数积分": "Enter a valid whole number of Points", ...server, ...a, ...b, ...c, ...d, ...e }
/** 越南语对照（以中文原文为键）；缺译时回退英文。 */
export const marketplaceVietnamese: Record<string, string> = vietnamese
const reverse = new Map([...Object.entries(marketplaceEnglish), ...Object.entries(marketplaceVietnamese)].map(([zh, text]) => [text, zh]))

/** 按语言取模板：zh 原文；vi 优先越南语再回退英文；其余语言用英文。 */
function templateFor(key: string, source: string, locale: Locale): string {
  if (locale === 'zh') return key
  if (locale === 'vi') return marketplaceVietnamese[key] || marketplaceEnglish[key] || source
  return marketplaceEnglish[key] || source
}

/** 仅翻译系统词典中的文字；不用于标题、简介、昵称和人工审核理由。 */
export function marketText(source: string, values: unknown[] = [], locale: Locale = getActiveLocale()): string {
  const key = marketplaceEnglish[source] || marketplaceVietnamese[source] ? source : reverse.get(source) || source
  const template = templateFor(key, source, locale)
  return template.replace(/\{(\d+)\}/g, (match, index: string) => Number(index) < values.length ? String(values[Number(index)] ?? '') : match)
}

/** 仅把已有模板生成的系统反馈重新显示为当前语言，保留动态参数原文。 */
export function marketFeedback(value: string): string {
  if (marketplaceEnglish[value] || marketplaceVietnamese[value] || reverse.has(value)) return marketText(value)
  for (const [zh, en] of Object.entries(marketplaceEnglish)) {
    if (!zh.includes('{0}')) continue
    for (const pattern of [zh, en, marketplaceVietnamese[zh]].filter(Boolean)) {
      const indexes: number[] = []
      const regex = pattern.split(/(\{\d+\})/g).map(part => {
        if (/^\{\d+\}$/.test(part)) { indexes.push(Number(part.slice(1, -1))); return '([\\s\\S]*?)' }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      }).join('')
      const match = value.match(new RegExp('^' + regex + '$'))
      if (match) { const values: string[] = []; indexes.forEach((index, i) => { values[index] = match[i + 1] }); return marketText(zh, values) }
    }
  }
  return value
}
