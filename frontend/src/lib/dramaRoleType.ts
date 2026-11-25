/**
 * 漫剧角色定位（roleType）的界面显示翻译。
 * AI / 后端存的是中文码（主角、重要配角、主角（重要配角）…），存储保持中文；
 * 这里只在显示时把已知词换成当前界面语言，未知词原样保留。
 * 词表与后端 content_locale._ROLE_TYPE_TOKENS 一致。
 */

import { getActiveLocale, translateIn, type Locale } from '../i18n'

/** 中文角色码 → i18n key（按长度降序，避免「主角」先吃掉「女主角」） */
const ROLE_TYPE_KEYS: Array<[string, string]> = [
  ['重要配角', 'keySupporting'],
  ['女主角', 'femaleLead'],
  ['男主角', 'maleLead'],
  ['主角', 'lead'],
  ['配角', 'supporting'],
  ['反派', 'villain'],
  ['群众', 'extras'],
  ['客串', 'cameo'],
  ['旁白', 'narrator'],
]

const ROLE_TYPE_RE = new RegExp(ROLE_TYPE_KEYS.map(([zh]) => zh).join('|'), 'g')

/**
 * 把 roleType 翻成界面语言显示。
 * @param raw 后端 / AI 返回的角色定位（可能是组合，如「主角（重要配角）」）
 * @param locale 目标语言，缺省取当前界面语言
 * @returns 显示文案；zh 或空值原样返回
 */
export function formatDramaRoleType(raw: unknown, locale?: Locale): string {
  const text = String(raw ?? '').trim()
  const loc = locale || getActiveLocale()
  if (!text || loc === 'zh') return text
  const map = new Map(ROLE_TYPE_KEYS)
  return text
    .replace(ROLE_TYPE_RE, (zh) => translateIn(loc, `lib.roleType.${map.get(zh)}`))
    .replace(/（/g, ' (')
    .replace(/）/g, ')')
    .replace(/[、，]/g, ', ')
    .trim()
}
