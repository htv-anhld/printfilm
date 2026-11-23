/** 给所有发往后端 /api、/epay 的请求带上 X-Locale，后端据此返回对应语言的报错与内容 */

import { getActiveLocale } from './detect'

let installed = false

// 判断是否为后端接口请求（同源相对路径或 :8000 绝对路径都带 /api/）
function isBackendUrl(url: string): boolean {
  return /\/api\/|\/epay\//.test(url)
}

/** 包装 window.fetch：只对后端请求追加 X-Locale（调用方已显式设置时不覆盖） */
export function installLocaleHeader(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return
  installed = true
  const nativeFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!isBackendUrl(url)) return nativeFetch(input, init)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (!headers.has('X-Locale')) headers.set('X-Locale', getActiveLocale())
    return nativeFetch(input, { ...init, headers })
  }
}
