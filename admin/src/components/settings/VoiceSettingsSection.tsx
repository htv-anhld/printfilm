import type { AdminModelSettings } from "@/api/client";
import { SecretField } from "@/components/settings/SecretField";
import { LabeledControl, SettingsPanel } from "@/components/settings/SettingsPanel";
import { useI18n } from "@/i18n";

/** ElevenLabs 配音：Key、模型、edge 音色升级映射、成本单价 */
export function VoiceSettingsSection({
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
  return (
    <SettingsPanel className="settings-panel--compact" title={t("settings.site.voice.title")} description={t("settings.site.voice.desc")}>
      <div className="settings-field-grid">
        <SecretField
          label="ElevenLabs API Key"
          value={secret}
          configured={Boolean(form.has_elevenlabs_api_key) && !clearSecret}
          onChange={onSecret}
          onClear={onClearSecret}
        />
        <LabeledControl label={t("settings.site.voice.model")} hint={t("settings.site.voice.modelHint")}>
          <input
            className="settings-input font-mono"
            value={form.elevenlabs_model ?? "eleven_flash_v2_5"}
            onChange={(e) => patchField("elevenlabs_model", e.target.value)}
          />
        </LabeledControl>
        <LabeledControl label={t("settings.site.voice.price")} hint={t("settings.site.voice.priceHint")}>
          <input
            className="settings-input"
            type="number"
            step="0.01"
            min={0}
            value={form.elevenlabs_usd_per_1k_chars ?? 0.1}
            onChange={(e) => patchField("elevenlabs_usd_per_1k_chars", Number(e.target.value))}
          />
        </LabeledControl>
        <LabeledControl
          label={t("settings.site.voice.map")}
          hint={t("settings.site.voice.mapHint")}
          className="settings-field-span-full"
        >
          <input
            className="settings-input font-mono"
            placeholder="vi-VN-HoaiMyNeural:voice_id,vi-VN-NamMinhNeural:voice_id"
            value={form.elevenlabs_voice_map ?? ""}
            onChange={(e) => patchField("elevenlabs_voice_map", e.target.value)}
          />
        </LabeledControl>
      </div>
    </SettingsPanel>
  );
}
