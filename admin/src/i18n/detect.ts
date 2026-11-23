/** 管理后台语言：默认越南语，手动选择写入 localStorage，同步 html lang */

export type Locale = "vi" | "en" | "zh";

export const LOCALES: Locale[] = ["vi", "en", "zh"];

export const DEFAULT_LOCALE: Locale = "vi";

export const LOCALE_STORAGE_KEY = "printfilm.admin.locale";

export const LOCALE_HTML: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en",
  vi: "vi",
};

export const LOCALE_DATE: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en-US",
  vi: "vi-VN",
};

// 当前生效语言（供非 React 工具函数读取）
let activeLocale: Locale = DEFAULT_LOCALE;

export function isLocale(value: unknown): value is Locale {
  return value === "zh" || value === "en" || value === "vi";
}

// 读取手动选择；无记录返回 null
export function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

// 有手动选择用手动，否则默认越南语（不跟随浏览器）
export function detectLocale(): Locale {
  const stored = typeof window === "undefined" ? null : readStoredLocale();
  return stored ?? DEFAULT_LOCALE;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

// 应用语言：写 html lang；persist 时写入 localStorage
export function applyLocale(locale: Locale, persist: boolean): void {
  activeLocale = locale;
  if (persist) {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = LOCALE_HTML[locale];
  }
}

function toDate(value?: string | number | Date | null): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 日期时间按当前语言格式化（空值 —）
export function formatDateTime(value?: string | number | Date | null, locale: Locale = activeLocale): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString(LOCALE_DATE[locale]);
}

// 仅时间
export function formatTime(value?: string | number | Date | null, locale: Locale = activeLocale): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleTimeString(LOCALE_DATE[locale]);
}

// 数字千分位
export function formatNumber(value: number, locale: Locale = activeLocale): string {
  return value.toLocaleString(LOCALE_DATE[locale]);
}
