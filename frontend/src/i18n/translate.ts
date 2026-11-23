/** 非 React 场景取文案：lib/ 纯函数、常量工厂、错误映射等直接调用 tr() */

import { getActiveLocale, type Locale } from './detect'
import { interpolate, lookupMessage, type TVars } from './lookup'
import { messages, type Messages } from './messages'

// 缺译时的回退顺序：当前语言 → 英文 → 中文 → 原路径
const FALLBACK_CHAIN: Locale[] = ['en', 'zh']

/** 按指定语言取文案并插值；找不到时按回退链取，最后返回 path 本身 */
export function translateIn(locale: Locale, path: string, vars?: TVars): string {
  const raw =
    lookupMessage(messages[locale], path) ??
    FALLBACK_CHAIN.map((l) => lookupMessage(messages[l], path)).find((v) => v !== undefined)
  return raw === undefined ? path : interpolate(raw, vars)
}

/** 按当前界面语言取文案（切换语言时 I18nProvider 会重挂整棵树，调用处无需订阅） */
export function tr(path: string, vars?: TVars): string {
  return translateIn(getActiveLocale(), path, vars)
}

/** 当前语言的完整文案对象（取数组/嵌套结构时用，如 currentMessages().help.faq） */
export function currentMessages(): Messages {
  return messages[getActiveLocale()]
}
