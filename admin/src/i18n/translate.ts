/** 非 React 场景取文案：lib/ 纯函数、常量工厂等直接调用 tr() */

import { getActiveLocale, type Locale } from "./detect";
import { interpolate, lookupMessage, type TVars } from "./lookup";
import { messages, type Messages } from "./messages";

// 缺译回退：当前语言 → 英文 → 中文 → 路径本身
const FALLBACK_CHAIN: Locale[] = ["en", "zh"];

export function translateIn(locale: Locale, path: string, vars?: TVars): string {
  const raw =
    lookupMessage(messages[locale], path) ??
    FALLBACK_CHAIN.map((l) => lookupMessage(messages[l], path)).find((v) => v !== undefined);
  return raw === undefined ? path : interpolate(raw, vars);
}

/** 按当前界面语言取文案（切换语言会重挂整棵树） */
export function tr(path: string, vars?: TVars): string {
  return translateIn(getActiveLocale(), path, vars);
}

/** 当前语言的完整文案对象 */
export function currentMessages(): Messages {
  return messages[getActiveLocale()];
}
