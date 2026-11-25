/** Wallet quantities already use integer hundredths of CNY: 1 stored unit = 1 point. */
export function pointLocale(): 'zh' | 'en' {
  // 仅中文界面显示「积分」，越南语 / 英语等其他语言统一用英文
  if (typeof document === 'undefined') return 'zh'
  return document.documentElement.lang.startsWith('zh') ? 'zh' : 'en'
}

export function pointText(zh: string, en: string): string {
  return pointLocale() === 'en' ? en : zh
}

// 本分支钱包按币种最小单位（USD 美分 / CNY 分）记账：应用启动时注入金额格式化，余额与报价显示为 $12.34；
// 未注入（单元测试）时保持上游的「N 积分 / Points」显示
let pointFormatter: ((value: number) => string) | null = null

/** 注入金额格式化函数（main.tsx 启动时调用）。 */
export function setPointFormatter(formatter: ((value: number) => string) | null): void {
  pointFormatter = formatter
}

export function points(value: unknown, locale: 'zh' | 'en' = pointLocale()): string {
  if (pointFormatter && typeof value === 'number' && Number.isSafeInteger(value)) return pointFormatter(value)
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? `${value.toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN')} ${locale === 'en' ? 'Points' : '积分'}` : '—'
}

/** No rounding, exponent notation, fractions or yuan conversion for account inputs. */
export function parsePoints(value: string, max = Number.MAX_SAFE_INTEGER): number | null {
  const text = value.trim()
  if (!/^\d+$/.test(text)) return null
  const amount = Number(text)
  return Number.isSafeInteger(amount) && amount <= max ? amount : null
}

/** Display sub-point unit rates exactly; final quotes retain the existing rounding. */
export function pointUnitRate(yuan: string): string {
  if (!/^\d+(\.\d{1,4})?$/.test(yuan)) return '—'
  const [whole, fraction = ''] = yuan.split('.')
  const units = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'))
  const decimals = (units % 100n).toString().padStart(2, '0').replace(/0+$/, '')
  return `${units / 100n}${decimals ? '.' + decimals : ''}`
}
