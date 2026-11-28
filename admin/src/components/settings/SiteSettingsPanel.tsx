import {
  LabeledControl,
  SettingsLoading,
  SettingsPanel,
  SettingsStatusBar,
  SettingsTabShell,
} from "@/components/settings/SettingsPanel";
import { useState } from "react";
import { AuthSettingsSection } from "@/components/settings/AuthSettingsSection";
import { VoiceSettingsSection } from "@/components/settings/VoiceSettingsSection";
import { Switch } from "@/components/ui/switch";
import { useAdminModelSettings } from "@/hooks/useAdminModelSettings";
import { useI18n } from "@/i18n";

/** 站点公网地址与媒体工具路径 */
export function SiteSettingsPanel() {
  const { t } = useI18n();
  const { form, loading, saving, patchField, save } = useAdminModelSettings();
  /* Google client secret 本地编辑态（留空不修改） */
  const [googleSecret, setGoogleSecret] = useState("");
  const [clearGoogleSecret, setClearGoogleSecret] = useState(false);
  /* ElevenLabs Key 本地编辑态 */
  const [elevenKey, setElevenKey] = useState("");
  const [clearElevenKey, setClearElevenKey] = useState(false);

  async function handleSave() {
    if (!form) return;
    const saved = await save(
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
        elevenlabs_api_key: elevenKey.trim() || undefined,
        clear_elevenlabs_api_key: clearElevenKey,
        elevenlabs_model: form.elevenlabs_model ?? "eleven_flash_v2_5",
        elevenlabs_voice_map: form.elevenlabs_voice_map ?? "",
        elevenlabs_usd_per_1k_chars: form.elevenlabs_usd_per_1k_chars ?? 0.1,
        marketplace_enabled: form.marketplace_enabled,
        marketplace_app_enabled: form.marketplace_app_enabled,
        marketplace_social_initialization_enabled: form.marketplace_social_initialization_enabled,
        marketplace_sharing_enabled: form.marketplace_sharing_enabled,
        marketplace_share_base_url: (form.marketplace_share_base_url || '').trim(),
        marketplace_share_apple_team_id: (form.marketplace_share_apple_team_id || '').trim(),
        marketplace_share_android_package_name: (form.marketplace_share_android_package_name || '').trim(),
        marketplace_share_android_sha256_fingerprints: (form.marketplace_share_android_sha256_fingerprints || '').trim(),
        marketplace_max_duration_seconds: form.marketplace_max_duration_seconds,
      },
      t("settings.site.saved"),
    );
    if (!saved) return;
    setGoogleSecret("");
    setClearGoogleSecret(false);
    setElevenKey("");
    setClearElevenKey(false);
  }

  if (loading || !form) {
    return <SettingsLoading />;
  }

  const hasPublic = Boolean(form.public_base_url?.trim());
  const hasFfmpeg = Boolean(form.ffmpeg_path?.trim());
  const hasFfprobe = Boolean(form.ffprobe_path?.trim());

  return (
    <SettingsTabShell onSave={handleSave} saving={saving} saveLabel={t("settings.site.saveLabel")}>
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
          {
            id: "marketplace",
            label: t("settings.site.mp.marketplace"),
            ready: form.marketplace_enabled,
            readyText: t("settings.oss.on"),
            pendingText: t("settings.oss.disabled"),
          },
          {
            id: "marketplace-app",
            label: t("settings.site.mp.appVideo"),
            ready: form.marketplace_app_enabled,
            readyText: t("settings.oss.on"),
            pendingText: t("settings.oss.disabled"),
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
        <VoiceSettingsSection
          form={form}
          secret={elevenKey}
          clearSecret={clearElevenKey}
          onSecret={(v) => {
            setElevenKey(v);
            setClearElevenKey(false);
          }}
          onClearSecret={() => {
            setElevenKey("");
            setClearElevenKey(true);
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
              optional
              className="settings-field-span-full"
            >
              <input
                className="settings-input"
                type="url"
                placeholder="https://www.prismreel.com"
                autoComplete="url"
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
            <LabeledControl label={t("settings.site.ffmpegPath")} optional>
              <input
                className="settings-input"
                placeholder="ffmpeg"
                value={form.ffmpeg_path}
                onChange={(e) => patchField("ffmpeg_path", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.site.ffprobePath")} optional>
              <input
                className="settings-input"
                placeholder="ffprobe"
                value={form.ffprobe_path}
                onChange={(e) => patchField("ffprobe_path", e.target.value)}
              />
            </LabeledControl>
          </div>
        </SettingsPanel>

        <SettingsPanel
          className="settings-panel--compact"
          title={t("settings.site.mp.panelTitle")}
          description={t("settings.site.mp.panelDesc")}
        >
          <div className="settings-toggle-row">
            <div>
              <strong>{t("settings.site.mp.enable")}</strong>
              <span>{t("settings.site.mp.enableDesc")}</span>
            </div>
            <Switch
              checked={form.marketplace_enabled}
              onCheckedChange={(value) => patchField("marketplace_enabled", value)}
            />
          </div>
          <div className="settings-toggle-row">
            <div>
              <strong>{t("settings.site.mp.appEnable")}</strong>
              <span>{t("settings.site.mp.appEnableDesc")}</span>
            </div>
            <Switch
              checked={form.marketplace_app_enabled}
              onCheckedChange={(value) => patchField("marketplace_app_enabled", value)}
            />
          </div>
          <LabeledControl
            label={t("settings.site.mp.maxDuration")}
            hint={t("settings.site.mp.maxDurationHint")}
          >
            <input
              className="settings-input"
              type="number"
              min={1}
              max={86400}
              step={1}
              value={form.marketplace_max_duration_seconds}
              onChange={(e) => patchField("marketplace_max_duration_seconds", Number(e.target.value))}
            />
          </LabeledControl>
        </SettingsPanel>
        <SettingsPanel className="settings-panel--compact" title={t("settings.site.mp.shareTitle")} description={t("settings.site.mp.shareDesc")}>
          <div className="settings-toggle-row"><div><strong>{t("settings.site.mp.socialInit")}</strong><span>{t("settings.site.mp.socialInitDesc")}</span></div><Switch checked={form.marketplace_social_initialization_enabled ?? false} onCheckedChange={value => patchField("marketplace_social_initialization_enabled", value)} /></div>
          <div className="settings-toggle-row"><div><strong>{t("settings.site.mp.sharing")}</strong><span>{t("settings.site.mp.sharingDesc")}</span></div><Switch checked={form.marketplace_sharing_enabled ?? false} onCheckedChange={value => patchField("marketplace_sharing_enabled", value)} /></div>
          <div className="settings-field-grid">
            <LabeledControl label={t("settings.site.mp.shareBase")} hint={t("settings.site.mp.shareBaseHint")} className="settings-field-span-full"><input className="settings-input" type="url" value={form.marketplace_share_base_url ?? ''} onChange={event => patchField("marketplace_share_base_url", event.target.value)} placeholder="https://www.prismreel.com" /></LabeledControl>
            <LabeledControl label="Apple Team ID" hint={t("settings.site.mp.teamIdHint")}><input className="settings-input" value={form.marketplace_share_apple_team_id ?? ''} maxLength={10} onChange={event => patchField("marketplace_share_apple_team_id", event.target.value)} placeholder="ABCDEFGHIJ" /></LabeledControl>
            <LabeledControl label={t("settings.site.mp.androidPkg")} hint={t("settings.site.mp.androidPkgHint")}><input className="settings-input" value={form.marketplace_share_android_package_name ?? ''} maxLength={255} onChange={event => patchField("marketplace_share_android_package_name", event.target.value)} placeholder="com.example.app" /></LabeledControl>
            <LabeledControl label={t("settings.site.mp.androidSha")} hint={t("settings.site.mp.androidShaHint")} className="settings-field-span-full"><textarea className="settings-input" rows={4} maxLength={10000} value={form.marketplace_share_android_sha256_fingerprints ?? ''} onChange={event => patchField("marketplace_share_android_sha256_fingerprints", event.target.value)} placeholder={t("settings.site.mp.androidShaPlaceholder")} /></LabeledControl>
            <LabeledControl label="iOS Bundle ID" hint={t("settings.site.mp.bundleHint")}><input className="settings-input" readOnly value={form.apple_bundle_id || t("settings.site.mp.iosNotConfigured")} /></LabeledControl>
          </div>
          <p className="settings-panel-footnote">{t("settings.site.mp.footnote")}</p>
        </SettingsPanel>
      </div>
    </SettingsTabShell>
  );
}
