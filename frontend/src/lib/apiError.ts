import { notifyBillingErrorIfNeeded } from './billingError'
import { apiErrorMessage } from '../api/http'
import { workspaceScope } from '../features/teams/workspaceScope'
import { tr } from '../i18n'

export type ApiError = Error & { status?: number; code?: string }

// detail 为 { message, code } 时取出语言无关的错误码
function detailCode(detail: unknown): string | undefined {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return undefined
  const code = (detail as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

/** 解析 FastAPI detail 并抛出；402 / 余额不足时弹出充值引导（团队空间不弹个人充值） */
export function throwApiError(status: number, detail: unknown, fallback = tr('common.requestFailed')): never {
  const finalMessage = apiErrorMessage(detail, fallback) || fallback
  if (workspaceScope.teamId === null) notifyBillingErrorIfNeeded(status, finalMessage)
  const err = new Error(finalMessage) as ApiError
  err.status = status
  err.code = detailCode(detail)
  throw err
}

/** 是否为「素材已齐，应直接合成成片」的 409（按错误码判断，不依赖文案语言） */
export function isAssetsReadyComposeError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as ApiError).code === 'assets_ready_compose'
}
