import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyLocale, detectLocale, type Locale } from './detect'
import type { TVars } from './lookup'
import { messages, type Messages } from './messages'
import { translateIn } from './translate'

export type TFunction = (path: string, vars?: TVars) => string

type I18nValue = {
  locale: Locale
  setLocale: (next: Locale) => void
  t: TFunction
  m: Messages
}

const I18nContext = createContext<I18nValue | null>(null)

// 同步 document title / description
function syncDocumentMeta(m: Messages) {
  if (typeof document === 'undefined') return
  document.title = m.meta.title
  const desc = document.querySelector('meta[name="description"]')
  if (desc) desc.setAttribute('content', m.meta.description)
}

/** 全站语言：浏览器自动识别，手动选择后写入 localStorage */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const next = detectLocale()
    applyLocale(next, false)
    return next
  })

  const m = messages[locale]

  useEffect(() => {
    applyLocale(locale, false)
    syncDocumentMeta(m)
  }, [locale, m])

  const setLocale = useCallback((next: Locale) => {
    applyLocale(next, true)
    setLocaleState(next)
  }, [])

  const t = useCallback<TFunction>((path, vars) => translateIn(locale, path, vars), [locale])

  const value = useMemo(() => ({ locale, setLocale, t, m }), [locale, setLocale, t, m])

  // key=locale：切换语言时重挂子树，让 lib/ 里 tr() 算出的文案与模块外缓存一起刷新
  return (
    <I18nContext.Provider value={value}>
      <Fragment key={locale}>{children}</Fragment>
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
