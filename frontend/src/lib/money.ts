import { useSyncExternalStore } from 'react'
import { api, type BillingConfig } from '../api'

/**
 * 计费币种展示：钱包整数单位 = 计费币种最小单位（USD 美分 = credit / CNY 分）。
 * 配置从 /api/billing/config 拉一次并缓存；拉到前按商业版默认 USD 展示。
 */

const FALLBACK: BillingConfig = {
  billing_enabled: false,
  currency: 'USD',
  symbol: '$',
  unit: 'credit',
  units_per_major: 100,
  signup_grant_fen: 0,
  first_topup_bonus_fen: 0,
  pay_types: [],
}

/* 模块级缓存 + 订阅者（useSyncExternalStore） */
let current: BillingConfig = FALLBACK
let loading: Promise<BillingConfig> | null = null
const listeners = new Set<() => void>()

/** 拉取计费配置（并发只请求一次；失败保持回退值，下次调用重试） */
export function loadBillingConfig(): Promise<BillingConfig> {
  if (!loading) {
    loading = api
      .billingConfig()
      .then((cfg) => {
        current = { ...FALLBACK, ...cfg }
        listeners.forEach((fn) => fn())
        return current
      })
      .catch(() => {
        loading = null
        return current
      })
  }
  return loading
}

/** 当前配置（同步读，可能是回退值） */
export function billingConfig(): BillingConfig {
  return current
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  void loadBillingConfig()
  return () => listeners.delete(fn)
}

/** 组件里读计费配置；配置到达后自动重渲染 */
export function useBillingConfig(): BillingConfig {
  return useSyncExternalStore(subscribe, billingConfig, billingConfig)
}

/** 最小单位 → 主单位数字 */
export function toMajor(minor: number | null | undefined): number {
  return (Number(minor) || 0) / (current.units_per_major || 100)
}

/** 金额文案：$12.34 / ¥12.34（参数为最小单位） */
export function formatMoney(minor: number | null | undefined, opts: { short?: boolean } = {}): string {
  return formatMajor(toMajor(minor), opts)
}

/** 金额文案（参数为主单位，如后端 *_yuan 字段） */
export function formatMajor(major: number | null | undefined, opts: { short?: boolean } = {}): string {
  const v = Number(major) || 0
  const body = opts.short && Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${v < 0 ? '-' : ''}${current.symbol}${body.replace(/^-/, '')}`
}

/** credit 数（USD 下钱包整数即 credit；CNY 下不显示 credit） */
export function formatCredits(minor: number | null | undefined): string {
  return Math.round(Number(minor) || 0).toLocaleString('en-US')
}

/** 当前是否 credit 计费（USD） */
export function usesCredits(): boolean {
  return current.unit === 'credit'
}

/** 订单金额：按下单时的币种展示（存量易支付订单是人民币） */
export function formatOrderMoney(minor: number | null | undefined, currency?: string | null): string {
  const code = (currency || current.currency || 'USD').toUpperCase()
  const symbol = code === 'CNY' ? '¥' : '$'
  const v = (Number(minor) || 0) / 100
  return `${symbol}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
