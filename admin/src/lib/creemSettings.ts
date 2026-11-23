import type { AdminModelSettings } from "@/api/client";

/** Creem 两个密钥的本地编辑态（留空 = 不修改） */
export type CreemSecretsDraft = {
  apiKey: string;
  clearApiKey: boolean;
  webhookSecret: string;
  clearWebhookSecret: boolean;
};

export const EMPTY_CREEM_SECRETS: CreemSecretsDraft = {
  apiKey: "",
  clearApiKey: false,
  webhookSecret: "",
  clearWebhookSecret: false,
};

/** Creem 是否可收款：有 API Key + webhook secret + 至少一个 credit 产品 */
export function creemReady(form: AdminModelSettings, draft: CreemSecretsDraft): boolean {
  const hasKey = (form.has_creem_api_key && !draft.clearApiKey) || draft.apiKey.trim().length > 0;
  const hasSecret = (form.has_creem_webhook_secret && !draft.clearWebhookSecret) || draft.webhookSecret.trim().length > 0;
  const hasProduct = Boolean((form.creem_credit_product_id || "").trim() || (form.creem_sku_products || "").trim());
  return hasKey && hasSecret && hasProduct;
}

/** 保存时要提交的 Creem 字段 */
export function creemPatch(form: AdminModelSettings, draft: CreemSecretsDraft) {
  return {
    creem_api_key: draft.apiKey.trim() || undefined,
    clear_creem_api_key: draft.clearApiKey,
    creem_webhook_secret: draft.webhookSecret.trim() || undefined,
    clear_creem_webhook_secret: draft.clearWebhookSecret,
    creem_test_mode: form.creem_test_mode ?? true,
    creem_credit_product_id: form.creem_credit_product_id ?? "",
    creem_sku_products: form.creem_sku_products ?? "",
    app_public_url: form.app_public_url ?? "",
  };
}
