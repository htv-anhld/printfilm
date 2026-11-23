import type { Locale } from './detect'
import { en } from './locales/en'
import { vi } from './locales/vi'
import { zh } from './locales/zh'

export type Messages = typeof zh

// en / vi 与 zh 结构一致（scripts/check-i18n.mjs 校验 key 对齐）
export const messages: Record<Locale, Messages> = {
  zh,
  en: en as unknown as Messages,
  vi: vi as unknown as Messages,
}
