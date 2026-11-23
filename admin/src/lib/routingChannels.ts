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
