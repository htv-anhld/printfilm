import type { AdminModelSettings } from "@/api/client";
import { SecretField } from "@/components/settings/SecretField";
import { LabeledControl, SettingsPanel } from "@/components/settings/SettingsPanel";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import type { CreemSecretsDraft } from "@/lib/creemSettings";

/** 管理端 Creem 配置块：密钥、测试模式、产品映射、回调地址提示 */
export function CreemSettingsSection({
  form,
  draft,
  onDraft,
  patchField,
}: {
  form: AdminModelSettings;
  draft: CreemSecretsDraft;
  onDraft: (next: CreemSecretsDraft) => void;
  patchField: <K extends keyof AdminModelSettings>(key: K, value: AdminModelSettings[K]) => void;
}) {
  const { t } = useI18n();
  const webhookUrl = `${window.location.origin.replace(/:\d+$/, "")}/api/billing/creem/webhook`;
  return (
    <SettingsPanel
      className="settings-panel--compact"
      title={t("settings.payment.creem.title")}
      description={t("settings.payment.creem.desc")}
    >
      <div className="settings-field-grid">
        <LabeledControl label={t("settings.payment.creem.testMode")} hint={t("settings.payment.creem.testModeHint")}>
          <Switch checked={form.creem_test_mode ?? true} onCheckedChange={(v) => patchField("creem_test_mode", v)} />
        </LabeledControl>
        <SecretField
          label="API Key"
          value={draft.apiKey}
          configured={Boolean(form.has_creem_api_key) && !draft.clearApiKey}
          onChange={(v) => onDraft({ ...draft, apiKey: v, clearApiKey: false })}
          onClear={() => onDraft({ ...draft, apiKey: "", clearApiKey: true })}
        />
        <SecretField
          label={t("settings.payment.creem.webhookSecret")}
          value={draft.webhookSecret}
          configured={Boolean(form.has_creem_webhook_secret) && !draft.clearWebhookSecret}
          onChange={(v) => onDraft({ ...draft, webhookSecret: v, clearWebhookSecret: false })}
          onClear={() => onDraft({ ...draft, webhookSecret: "", clearWebhookSecret: true })}
        />
        <LabeledControl label={t("settings.payment.creem.creditProduct")} hint={t("settings.payment.creem.creditProductHint")}>
          <input
            className="settings-input font-mono"
            placeholder="prod_…"
            value={form.creem_credit_product_id ?? ""}
            onChange={(e) => patchField("creem_credit_product_id", e.target.value)}
          />
        </LabeledControl>
        <LabeledControl
          label={t("settings.payment.creem.skuProducts")}
          hint={t("settings.payment.creem.skuProductsHint")}
          className="settings-field-span-full"
        >
          <input
            className="settings-input font-mono"
            placeholder="credits_900:prod_a,credits_3900:prod_b"
            value={form.creem_sku_products ?? ""}
            onChange={(e) => patchField("creem_sku_products", e.target.value)}
          />
        </LabeledControl>
        <LabeledControl
          label={t("settings.payment.creem.planProducts")}
          hint={t("settings.payment.creem.planProductsHint")}
          className="settings-field-span-full"
        >
          <input
            className="settings-input font-mono"
            placeholder="starter_month:prod_a,starter_year:prod_b,pro_month:prod_c"
            value={form.creem_plan_products ?? ""}
            onChange={(e) => patchField("creem_plan_products", e.target.value)}
          />
        </LabeledControl>
        <LabeledControl
          label={t("settings.payment.creem.appUrl")}
          hint={t("settings.payment.creem.appUrlHint")}
          className="settings-field-span-full"
        >
          <input
            className="settings-input"
            placeholder="https://app.example.com"
            value={form.app_public_url ?? ""}
            onChange={(e) => patchField("app_public_url", e.target.value)}
          />
        </LabeledControl>
        <LabeledControl label={t("settings.payment.creem.webhookUrl")} className="settings-field-span-full">
          <input className="settings-input font-mono" readOnly value={webhookUrl} />
          <p className="mt-1 text-xs text-[#909399]">{t("settings.payment.creem.webhookUrlHint")}</p>
        </LabeledControl>
      </div>
    </SettingsPanel>
  );
}
