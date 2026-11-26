import type { AdminRoutingChannel } from "@/api/client";

export const TOKENFREE_CHANNEL_ID = "tokenfree";
export const TOKENFREE_BASE_URL = "https://www.tokenfree.com/v1";
export const TOKENFREE_CONSOLE_URL = "https://www.tokenfree.com/channels";

/** 新建空渠道（OpenAI 兼容，排在末尾） */
export function newChannel(existing: AdminRoutingChannel[]): AdminRoutingChannel {
  let n = existing.length + 1;
  while (existing.some((ch) => ch.id === `channel-${n}`)) n += 1;
  return {
    id: `channel-${n}`,
    name: `Channel ${n}`,
    base_url: "",
    api_key: "",
    has_api_key: false,
    api_format: "openai",
    protocol: "auto",
    models: [],
    enabled: true,
    sort_order: existing.length,
  };
}

export const KIE_BASE_URL = "https://api.kie.ai";
export const KIE_CONSOLE_URL = "https://kie.ai/api-key";
/** Kie.ai 已适配的模型（与后端 services/kie_models.py 的 KIE_CATALOG 一致） */
export const KIE_PRESET_MODELS = [
  "bytedance/seedance-2",
  "bytedance/seedance-2-fast",
  "bytedance/seedance-2-mini",
  "seedream/4.5-text-to-image",
  "seedream/5-5-text-to-image",
];

/** 是否 Kie.ai 渠道：协议 kie 或 Base URL 主机为 kie.ai */
export function isKieChannel(ch: Pick<AdminRoutingChannel, "protocol" | "base_url"> | undefined | null): boolean {
  if (!ch) return false;
  if (ch.protocol === "kie") return true;
  try {
    const host = new URL(ch.base_url || "").hostname.toLowerCase();
    return host === "kie.ai" || host.endsWith(".kie.ai");
  } catch {
    return false;
  }
}

/** kie 命名空间模型 id（bytedance/seedance-2-mini 等）不做 TokenFree 别名折叠 */
export function isKieModelId(model: string): boolean {
  const mid = (model || "").trim().toLowerCase();
  return mid.startsWith("bytedance/seedance") || mid.startsWith("seedream/");
}

/** 新建 Kie.ai 渠道：协议 kie、官方 Base URL、预选 Seedance 2.0 三档 + Seedream */
export function newKieChannel(existing: AdminRoutingChannel[]): AdminRoutingChannel {
  let id = "kie";
  let n = 2;
  while (existing.some((ch) => ch.id === id)) id = `kie-${n++}`;
  return {
    id,
    name: "Kie.ai",
    base_url: KIE_BASE_URL,
    api_key: "",
    has_api_key: false,
    api_format: "kie",
    protocol: "kie",
    models: [...KIE_PRESET_MODELS],
    enabled: true,
    sort_order: existing.length,
  };
}
