import { dialog } from './dialog'
import { tr } from '../i18n'
import { workspaceScope } from '../features/teams/workspaceScope'

export const PRICING_PATH = '/pricing'

/** 是否为余额不足 / 计费拦截类错误 */
export function isBillingError(message: string) {
  return /余额不足|积分不足|insufficient points|请先充值|402|insufficient_balance|insufficient balance|số dư không đủ|vui lòng nạp tiền|please top up/i.test(message)
}

/** 跳转定价页充值；团队空间跳到团队钱包 */
export function goToTopup() {
  if (typeof window !== 'undefined') {
    window.location.assign(workspaceScope.teamId === null ? PRICING_PATH : `/teams/${workspaceScope.teamId}?tab=billing`)
  }
}

/**
 * 弹出余额不足提示；若用户选择去充值则跳转定价页。
 * 团队空间内只提示额度受限（团队余额由所有者管理）。
 * @returns 是否已按计费错误处理
 */
export async function handleBillingError(
  err: unknown,
  navigate?: (path: string) => void,
): Promise<boolean> {
  const message = err instanceof Error ? err.message : String(err || '')
  if (!isBillingError(message)) return false
  if (workspaceScope.teamId !== null) {
    await dialog.alert({
      title: tr('billing.insufficient.teamTitle'),
      message: `${billingPointsMessage(message)}${tr('billing.insufficient.teamHint')}`,
      confirmText: tr('billing.insufficient.cancel'),
    })
    return true
  }
  const go = await dialog.confirm({
    title: tr('billing.insufficient.title'),
    message: message || tr('billing.insufficient.message'),
    confirmText: tr('billing.insufficient.confirm'),
    cancelText: tr('billing.insufficient.cancel'),
    tone: 'danger',
  })
  if (go) {
    if (navigate) navigate(PRICING_PATH)
    else goToTopup()
  }
  return true
}

/**
 * API 层全局拦截：402 / 余额不足时弹出充值引导（不吞掉原错误）。
 */
export function notifyBillingErrorIfNeeded(status: number, message: string) {
  if (status === 402 || isBillingError(message)) {
    void handleBillingError(new Error(message))
  }
}

/**
 * 计费错误文案展示。本分支钱包按金额（USD 分）展示，后端已按语言返回报错，
 * 因此不做上游的「积分」换算，原样返回。
 */
export function billingPointsMessage(message: string): string {
  return message
}
