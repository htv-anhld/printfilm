import { notifyBillingErrorIfNeeded } from './billingError'
import { tr } from '../i18n'

export type ApiError = Error & { status?: number; code?: string }

// detail 为 { message, code } 时取出语言无关的错误码
function detailCode(detail: unknown): string | undefined {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return undefined
  const code = (detail as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

/** 解析 FastAPI detail 并抛出；402 / 余额不足时弹出充值引导 */
export function throwApiError(status: number, detail: unknown, fallback = tr('common.requestFailed')): never {
  const message =
    typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ')
        : detail && typeof detail === 'object' && typeof (detail as { message?: unknown }).message === 'string'
          ? (detail as { message: string }).message
          : fallback
  const finalMessage = message || fallback
  notifyBillingErrorIfNeeded(status, finalMessage)
  const err = new Error(finalMessage) as ApiError
  err.status = status
  err.code = detailCode(detail)
  throw err
}

/** 是否为「素材已齐，应直接合成成片」的 409（按错误码判断，不依赖文案语言） */
export function isAssetsReadyComposeError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as ApiError).code === 'assets_ready_compose'
}
