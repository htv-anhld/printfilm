import type { AdminModelSettings } from "@/api/client";
import { SecretField } from "@/components/settings/SecretField";
import { LabeledControl, SettingsPanel } from "@/components/settings/SettingsPanel";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";

/** 登录方式：邮箱验证开关与 Google OAuth 客户端 */
export function AuthSettingsSection({
  form,
  secret,
  clearSecret,
  onSecret,
  onClearSecret,
  patchField,
}: {
  form: AdminModelSettings;
  secret: string;
  clearSecret: boolean;
  onSecret: (value: string) => void;
  onClearSecret: () => void;
  patchField: <K extends keyof AdminModelSettings>(key: K, value: AdminModelSettings[K]) => void;
}) {
  const { t } = useI18n();
  const appUrl = (form.app_public_url || "").replace(/\/$/, "");
  const callback = (form.google_redirect_uri || "").trim() || `${appUrl || "https://app.example.com"}/auth/google/callback`;
  return (
    <SettingsPanel
      className="settings-panel--compact"
      title={t("settings.site.auth.title")}
      description={t("settings.site.auth.desc")}
    >
      <div className="settings-field-grid">
        <LabeledControl
          label={t("settings.site.auth.verify")}
          hint={t("settings.site.auth.verifyHint")}
          className="settings-field-span-full"
        >
          <Switch
            checked={form.email_verification_required ?? true}
            onCheckedChange={(v) => patchField("email_verification_required", v)}
          />
        </LabeledControl>
        <LabeledControl label={t("settings.site.auth.appUrl")} className="settings-field-span-full">
          <input
            className="settings-input"
            placeholder="https://app.example.com"
            value={form.app_public_url ?? ""}
            onChange={(e) => patchField("app_public_url", e.target.value)}
          />
        </LabeledControl>
        <LabeledControl label="Google Client ID" className="settings-field-span-full">
          <input
            className="settings-input font-mono"
            placeholder="…apps.googleusercontent.com"
            value={form.google_client_id ?? ""}
            onChange={(e) => patchField("google_client_id", e.target.value)}
          />
        </LabeledControl>
        <SecretField
          label="Google Client Secret"
          value={secret}
          configured={Boolean(form.has_google_client_secret) && !clearSecret}
          onChange={onSecret}
          onClear={onClearSecret}
        />
        <LabeledControl
          label={t("settings.site.auth.redirect")}
          hint={t("settings.site.auth.redirectHint", { url: callback })}
          className="settings-field-span-full"
        >
          <input
            className="settings-input font-mono"
            placeholder={callback}
            value={form.google_redirect_uri ?? ""}
            onChange={(e) => patchField("google_redirect_uri", e.target.value)}
          />
        </LabeledControl>
      </div>
    </SettingsPanel>
  );
}
