/**
 * 管理端金额展示：数据库 *_fen 列是「计费币种最小单位」（USD 美分 / CNY 分）。
 * 启动时读一次 /api/billing/config 得到币种符号；读不到按商业版默认 USD。
 */

let symbol = "$";
let currency: "USD" | "CNY" = "USD";

/** 启动时拉取计费币种（失败保持默认） */
export async function loadBillingCurrency(): Promise<void> {
  try {
    const res = await fetch("/api/billing/config");
    if (!res.ok) return;
    const data = (await res.json()) as { currency?: string; symbol?: string };
    if (data.currency === "CNY" || data.currency === "USD") currency = data.currency;
    if (data.symbol) symbol = data.symbol;
  } catch {
    /* 网络失败用默认 */
  }
}

/** 当前计费币种代码 */
export function billingCurrency(): "USD" | "CNY" {
  return currency;
}

/** 最小单位 → 带符号金额：$1,234.56 */
export function money(minor: number | null | undefined): string {
  return majorMoney((Number(minor) || 0) / 100);
}

/** 主单位 → 带符号金额（后端 *_yuan 字段） */
export function majorMoney(major: number | string | null | undefined): string {
  const v = Number(major) || 0;
  const body = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return `${v < 0 ? "-" : ""}${symbol}${body}`;
}

/** 订单金额按下单币种展示（存量易支付订单是人民币） */
export function orderMoney(minor: number | null | undefined, orderCurrency?: string | null): string {
  const code = (orderCurrency || currency).toUpperCase();
  const sym = code === "CNY" ? "¥" : "$";
  const v = (Number(minor) || 0) / 100;
  return `${sym}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
