import { API_BASE } from '../api'

/**
 * 前端错误上报（POST /api/error-reports）：window.onerror + 未处理的 Promise 拒绝。
 * 每次页面加载最多报 20 条，同一条只报一次；上报失败静默，绝不再抛错。
 */

const MAX_PER_PAGE = 20
const seen = new Set<string>()
let sent = 0

/** 发送一条错误（keepalive，页面卸载时也尽量送达） */
export function reportError(error: unknown, source = 'manual') {
  try {
    const err = error instanceof Error ? error : new Error(String(error ?? 'unknown'))
    const message = `${err.name}: ${err.message}`.slice(0, 1000)
    const key = `${message}|${(err.stack || '').split('\n')[1] || ''}`
    if (seen.has(key) || sent >= MAX_PER_PAGE) return
    seen.add(key)
    sent += 1
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = localStorage.getItem('token')
    if (token) headers.Authorization = `Bearer ${token}`
    void fetch(`${API_BASE}/api/error-reports`, {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({
        message,
        stack: (err.stack || '').slice(0, 8000),
        url: location.pathname + location.search,
        source,
        release: import.meta.env.VITE_RELEASE || import.meta.env.MODE,
      }),
    }).catch(() => undefined)
  } catch {
    /* 上报本身不能制造新错误 */
  }
}

/** 挂全局监听（main.tsx 启动时调用一次；开发环境不上报） */
export function installErrorReporter() {
  if (import.meta.env.DEV) return
  window.addEventListener('error', (e) => {
    // 资源加载失败（img/script）没有 error 对象，忽略
    if (e.error) reportError(e.error, 'window')
  })
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'))
}
