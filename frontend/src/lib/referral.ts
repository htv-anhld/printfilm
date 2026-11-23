/**
 * 合作伙伴推广码：落地时从 ?ref= 读取并保存 60 天，注册（邮箱 / Google）时带给后端归因。
 */

const KEY = 'pf.ref'
const TTL_MS = 60 * 24 * 3600 * 1000

/** 启动时调用：URL 带 ref 就记下（后到的覆盖先到的） */
export function captureReferral() {
  try {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code && /^[A-Za-z0-9]{4,24}$/.test(code)) {
      localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }))
    }
  } catch {
    /* 隐私模式等：忽略 */
  }
}

/** 读取未过期的推广码 */
export function referralCode(): string | undefined {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return undefined
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number }
    if (!code || !at || Date.now() - at > TTL_MS) {
      localStorage.removeItem(KEY)
      return undefined
    }
    return code
  } catch {
    return undefined
  }
}
