/**
 * 明暗主题：写 localStorage('pf-theme')，在 <html> 上切换 .dark。
 * 首屏由 index.html 内联脚本先行应用，避免闪白；这里负责运行时切换与订阅。
 */
export type Theme = 'light' | 'dark'

const KEY = 'pf-theme'
const EVENT = 'pf-theme-change'

/** 当前主题：用户偏好优先，否则跟随系统 */
export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* 隐私模式读不到存储时跟随系统 */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 应用并保存主题，通知订阅者 */
export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* 存不下时仅本次生效 */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }))
}

/** 订阅主题变化，返回取消函数 */
export function onThemeChange(fn: (theme: Theme) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<Theme>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
