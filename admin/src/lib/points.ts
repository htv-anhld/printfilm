/** Account quantities only. Payment, costs and creator revenue remain money. */
// 本分支钱包按币种最小单位记账：main.tsx 启动时注入 money()，显示为 $12.34；未注入（单元测试）保持「N 积分」
let pointFormatter: ((value: number) => string) | null = null;

/** 注入金额格式化函数（main.tsx 启动时调用）。 */
export function setPointFormatter(formatter: ((value: number) => string) | null): void {
  pointFormatter = formatter;
}

export function points(value: unknown): string {
  if (pointFormatter && typeof value === 'number' && Number.isSafeInteger(value)) return pointFormatter(value);
  return typeof value === 'number' && Number.isSafeInteger(value) ? `${value.toLocaleString('zh-CN')} 积分` : '—';
}

export function parsePoints(value: string, max = Number.MAX_SAFE_INTEGER): number | null {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  const amount = Number(text);
  return Number.isSafeInteger(amount) && amount <= max ? amount : null;
}
