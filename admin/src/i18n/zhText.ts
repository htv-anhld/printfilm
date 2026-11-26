/**
 * 以中文原文为键的运行时翻译（用于上游只写了中文的市场 / App 支付等模块）。
 * - zh 直接返回原文（上游单测按中文比对）
 * - vi / en 查 zhText/{vi,en}.json，缺译依次回退英文 → 中文
 * - 每次调用时读取当前语言，切换语言后重挂即生效；模块顶层常量表请用 zhLazy() 包裹
 */
import { getActiveLocale } from "./detect.ts";
import en from "./zhText/en.json" with { type: "json" };
import vi from "./zhText/vi.json" with { type: "json" };

export const zhTextCatalogs: Record<"en" | "vi", Record<string, string>> = { en, vi };

type Vars = Record<string, unknown> | unknown[];

/** 按当前语言翻译中文原文，并以 {0} / {name} 插值（插值内容不翻译）。 */
export function tz(source: string, vars?: Vars): string {
  const locale = getActiveLocale();
  const template = locale === "zh" ? source : zhTextCatalogs[locale][source] ?? zhTextCatalogs.en[source] ?? source;
  if (!vars) return template;
  const table = vars as Record<string, unknown>;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(table, key) ? String(table[key] ?? "") : match,
  );
}

/** 对已知的服务端/历史中文提示做翻译；不在词典中的原样返回（用户内容不翻译）。 */
export function tzKnown(value: string): string {
  return typeof value === "string" && value ? tz(value) : value;
}

/** 把模块顶层的「代码 → 中文」常量表包装成按读取时语言翻译的只读视图（可嵌套）。 */
export function zhLazy<T extends object>(table: T): T {
  return new Proxy(table, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value === "string") return tz(value);
      if (value && typeof value === "object") return zhLazy(value as object);
      return value;
    },
  }) as T;
}
