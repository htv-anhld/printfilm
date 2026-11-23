/** 给发往后端 /api/ 的请求带上 X-Locale */

import { getActiveLocale } from "./detect";

let installed = false;

function isBackendUrl(url: string): boolean {
  return /\/api\//.test(url);
}

/** 包装 window.fetch：只对后端请求追加 X-Locale（调用方显式设置时不覆盖） */
export function installLocaleHeader(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isBackendUrl(url)) return nativeFetch(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("X-Locale")) headers.set("X-Locale", getActiveLocale());
    return nativeFetch(input, { ...init, headers });
  };
}
