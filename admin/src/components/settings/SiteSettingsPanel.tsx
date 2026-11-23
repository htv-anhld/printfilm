import {
  LabeledControl,
  SettingsLoading,
  SettingsPanel,
  SettingsStatusBar,
  SettingsTabShell,
} from "@/components/settings/SettingsPanel";
import { useState } from "react";
import { AuthSettingsSection } from "@/components/settings/AuthSettingsSection";
import { useAdminModelSettings } from "@/hooks/useAdminModelSettings";
import { useI18n } from "@/i18n";

/** 站点公网地址与媒体工具路径 */
export function SiteSettingsPanel() {
  const { t } = useI18n();
  const { form, loading, saving, patchField, save } = useAdminModelSettings();
  /* Google client secret 本地编辑态（留空不修改） */
  const [googleSecret, setGoogleSecret] = useState("");
  const [clearGoogleSecret, setClearGoogleSecret] = useState(false);

  async function handleSave() {
    if (!form) return;
    await save(
      {
        public_base_url: form.public_base_url,
        ffmpeg_path: form.ffmpeg_path,
        ffprobe_path: form.ffprobe_path,
        app_public_url: form.app_public_url ?? "",
        email_verification_required: form.email_verification_required ?? true,
        google_client_id: form.google_client_id ?? "",
        google_client_secret: googleSecret.trim() || undefined,
        clear_google_client_secret: clearGoogleSecret,
        google_redirect_uri: form.google_redirect_uri ?? "",
      },
      t("settings.site.saved"),
    );
    setGoogleSecret("");
    setClearGoogleSecret(false);
  }

  if (loading || !form) {
    return <SettingsLoading />;
  }

  const hasPublic = Boolean(form.public_base_url?.trim());
  const hasFfmpeg = Boolean(form.ffmpeg_path?.trim());
  const hasFfprobe = Boolean(form.ffprobe_path?.trim());

  return (
    <SettingsTabShell onSave={() => void handleSave()} saving={saving}>
      <SettingsStatusBar
        title={t("settings.site.statusTitle")}
        items={[
          {
            id: "public",
            label: t("settings.site.publicUrl"),
            ready: hasPublic,
            readyText: t("common.secret.configured"),
            pendingText: t("settings.site.notFilled"),
          },
          {
            id: "ffmpeg",
            label: "ffmpeg",
            ready: hasFfmpeg,
            readyText: form.ffmpeg_path || t("common.secret.configured"),
            pendingText: t("settings.site.defaultPath"),
          },
          {
            id: "ffprobe",
            label: "ffprobe",
            ready: hasFfprobe,
            readyText: form.ffprobe_path || t("common.secret.configured"),
            pendingText: t("settings.site.defaultPath"),
          },
        ]}
      />

      <div className="settings-routing-grid">
        <AuthSettingsSection
          form={form}
          secret={googleSecret}
          clearSecret={clearGoogleSecret}
          onSecret={(v) => {
            setGoogleSecret(v);
            setClearGoogleSecret(false);
          }}
          onClearSecret={() => {
            setGoogleSecret("");
            setClearGoogleSecret(true);
          }}
          patchField={patchField}
        />
        <SettingsPanel
          className="settings-panel--compact"
          title={t("settings.site.panel1Title")}
          description={t("settings.site.panel1Desc")}
        >
          <div className="settings-field-grid">
            <LabeledControl
              label={t("settings.site.baseUrl")}
              hint={t("settings.site.baseUrlHint")}
              className="settings-field-span-full"
            >
              <input
                className="settings-input"
                value={form.public_base_url}
                onChange={(e) => patchField("public_base_url", e.target.value)}
              />
            </LabeledControl>
          </div>
          <p className="settings-panel-footnote">
            {t("settings.site.infraNote")}
          </p>
        </SettingsPanel>

        <SettingsPanel
          className="settings-panel--compact"
          title={t("settings.site.panel2Title")}
          description={t("settings.site.panel2Desc")}
        >
          <div className="settings-field-grid">
            <LabeledControl label={t("settings.site.ffmpegPath")}>
              <input
                className="settings-input"
                placeholder="ffmpeg"
                value={form.ffmpeg_path}
                onChange={(e) => patchField("ffmpeg_path", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.site.ffprobePath")}>
              <input
                className="settings-input"
                placeholder="ffprobe"
                value={form.ffprobe_path}
                onChange={(e) => patchField("ffprobe_path", e.target.value)}
              />
            </LabeledControl>
          </div>
        </SettingsPanel>
      </div>
    </SettingsTabShell>
  );
}
