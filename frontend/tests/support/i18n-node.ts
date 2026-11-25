// 测试用 i18n 入口：与 src/i18n/index.ts 相同但不含 React context（.tsx 无法被 node 直接加载）
export {
  applyLocale,
  DEFAULT_LOCALE,
  LOCALES,
  detectLocale,
  formatDateTime,
  getActiveLocale,
  isLocale,
  localeFromBrowser,
  type Locale,
} from '../../src/i18n/detect.ts'
export { messages, type Messages } from '../../src/i18n/messages.ts'
export { currentMessages, tr, translateIn } from '../../src/i18n/translate.ts'
export { installLocaleHeader } from '../../src/i18n/localeHeader.ts'
export type TFunction = (path: string, vars?: Record<string, string | number>) => string
