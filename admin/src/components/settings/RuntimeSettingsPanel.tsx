import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminModelSettings } from "@/api/client";
import {
  LabeledControl,
  SettingsLoading,
  SettingsPanel,
  SettingsStatusBar,
  SettingsTabShell,
} from "@/components/settings/SettingsPanel";
import { Switch } from "@/components/ui/switch";
import { tr, useI18n } from "@/i18n";

const NUMBER_FIELDS = [
  "seedance_duration_min", "seedance_duration_max", "ark_video_poll_interval", "ark_video_poll_timeout",
  "pipeline_image_concurrency", "pipeline_video_concurrency", "pipeline_audio_concurrency",
  "task_runtime_max_concurrency", "task_user_max_concurrency", "task_poll_max_concurrency",
  "drama_user_video_job_limit", "drama_fragment_max_attempts",
] as const;
type NumberField = (typeof NUMBER_FIELDS)[number];

// 运行参数配置（并发、质量、Mock 等 flat 字段）
export function RuntimeSettingsPanel() {
  const { t } = useI18n();
  const [form, setForm] = useState<AdminModelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numberDrafts, setNumberDrafts] = useState<Partial<Record<NumberField, string>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<AdminModelSettings>("/api/admin/settings/models");
      setForm(data);
      setNumberDrafts({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusItems = useMemo(
    () =>
      (form?.readiness ?? []).map((item) => ({
        id: item.capability,
        label: item.label,
        ready: item.ready,
        readyText: item.model || t("settings.ready"),
        pendingText: t("settings.notReady"),
      })),
    [form?.readiness, t],
  );

  function patchField<K extends keyof AdminModelSettings>(key: K, value: AdminModelSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const errors: Partial<Record<NumberField | "ark_image_size" | "ark_video_resolution" | "ark_video_ratio", string>> = {};
  if (form) {
    NUMBER_FIELDS.forEach((key) => {
      const raw = numberDrafts[key] ?? String(form[key]);
      const value = Number(raw);
      const seconds = key === "ark_video_poll_interval" || key === "ark_video_poll_timeout";
      if (!raw.trim() || !Number.isFinite(value) || value <= 0) errors[key] = seconds ? tr("settings.runtime.form.errSeconds") : tr("settings.runtime.form.errMinOne");
      else if (!seconds && !Number.isInteger(value)) errors[key] = tr("settings.runtime.form.errInteger");
    });
    if (!errors.seedance_duration_min && !errors.seedance_duration_max && form.seedance_duration_min > form.seedance_duration_max) {
      errors.seedance_duration_max = tr("settings.runtime.form.errMaxLtMin");
    }
    if (!errors.ark_video_poll_interval && !errors.ark_video_poll_timeout && form.ark_video_poll_timeout <= form.ark_video_poll_interval) {
      errors.ark_video_poll_timeout = tr("settings.runtime.form.errTimeout");
    }
    (["ark_image_size", "ark_video_resolution", "ark_video_ratio"] as const).forEach((key) => {
      if (!form[key].trim()) errors[key] = tr("settings.runtime.form.errRequired");
    });
  }
  const hasErrors = Object.keys(errors).length > 0;

  function numberField(key: NumberField, label: string, hint: string, unit: string) {
    if (!form) return null;
    const seconds = key === "ark_video_poll_interval" || key === "ark_video_poll_timeout";
    return (
      <LabeledControl label={label} hint={hint} error={errors[key]} required>
        <div className="relative">
          <input
            className="settings-input !pr-12"
            type="number" required min={seconds ? 0 : 1} step={seconds ? "any" : 1}
            aria-invalid={Boolean(errors[key])}
            value={numberDrafts[key] ?? form[key]}
            onChange={(event) => {
              const raw = event.target.value;
              setNumberDrafts((prev) => ({ ...prev, [key]: raw }));
              if (raw.trim() && Number.isFinite(Number(raw))) patchField(key, Number(raw));
            }}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--admin-muted)]">{unit}</span>
        </div>
      </LabeledControl>
    );
  }

  async function handleSave() {
    if (!form || saving || hasErrors) return;
    setSaving(true);
    try {
      const body = {
        ark_image_size: form.ark_image_size,
        ark_video_resolution: form.ark_video_resolution,
        ark_video_ratio: form.ark_video_ratio,
        seedance_duration_min: form.seedance_duration_min,
        seedance_duration_max: form.seedance_duration_max,
        ark_video_poll_interval: form.ark_video_poll_interval,
        ark_video_poll_timeout: form.ark_video_poll_timeout,
        pipeline_image_concurrency: form.pipeline_image_concurrency,
        pipeline_video_concurrency: form.pipeline_video_concurrency,
        pipeline_audio_concurrency: form.pipeline_audio_concurrency,
        task_runtime_max_concurrency: form.task_runtime_max_concurrency,
        task_user_max_concurrency: form.task_user_max_concurrency,
        task_poll_max_concurrency: form.task_poll_max_concurrency,
        drama_user_video_job_limit: form.drama_user_video_job_limit,
        drama_fragment_max_attempts: form.drama_fragment_max_attempts,
        ark_mock: form.ark_mock,
      };
      await api("/api/admin/settings/models", { method: "PATCH", body: JSON.stringify(body) });
      await load();
      toast.success(t("settings.runtime.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return <SettingsLoading />;
  }

  return (
    <SettingsTabShell onSave={handleSave} saving={saving} disabled={hasErrors} saveLabel={t("settings.runtime.form.saveLabel")}>
      <SettingsStatusBar
        title={t("settings.runtime.statusTitle")}
        items={
          statusItems.length > 0
            ? statusItems
            : [{ id: "empty", label: t("settings.runtime.capRouting"), ready: false, pendingText: t("settings.runtime.fillKeyFirst") }]
        }
        extra={
          <span className="settings-status-extra">
            {form.readiness?.length && form.readiness.every((item) => item.ready) ? t("settings.runtime.allReady") : t("settings.runtime.fillKey")}
          </span>
        }
      />

      <SettingsPanel title={t("settings.runtime.form.defaultsTitle")} description={t("settings.runtime.form.defaultsDesc")}>
        <div className="settings-field-grid settings-field-grid--3">
          <LabeledControl label={t("settings.runtime.imageSize")} hint={t("settings.runtime.form.imageSizeHint")} error={errors.ark_image_size} required>
            <input className="settings-input" required placeholder={t("settings.runtime.form.egValue", { v: "2K" })} aria-invalid={Boolean(errors.ark_image_size)} value={form.ark_image_size} onChange={(e) => patchField("ark_image_size", e.target.value)} />
          </LabeledControl>
          <LabeledControl label={t("settings.runtime.videoQuality")} hint={t("settings.runtime.form.videoQualityHint")} error={errors.ark_video_resolution} required>
            <input className="settings-input" required placeholder={t("settings.runtime.form.egValue", { v: "720p" })} aria-invalid={Boolean(errors.ark_video_resolution)} value={form.ark_video_resolution} onChange={(e) => patchField("ark_video_resolution", e.target.value)} />
          </LabeledControl>
          <LabeledControl label={t("settings.runtime.videoRatio")} hint={t("settings.runtime.form.videoRatioHint")} error={errors.ark_video_ratio} required>
            <input className="settings-input" required placeholder={t("settings.runtime.form.egValue", { v: "16:9" })} aria-invalid={Boolean(errors.ark_video_ratio)} value={form.ark_video_ratio} onChange={(e) => patchField("ark_video_ratio", e.target.value)} />
          </LabeledControl>
        </div>
        <div className="settings-field-grid settings-field-grid--2 mt-5">
          {numberField("seedance_duration_min", t("settings.runtime.seedanceMin"), t("settings.runtime.form.seedanceMinHint"), t("settings.runtime.form.unitSec"))}
          {numberField("seedance_duration_max", t("settings.runtime.seedanceMax"), t("settings.runtime.form.seedanceMaxHint"), t("settings.runtime.form.unitSec"))}
        </div>
      </SettingsPanel>

      <SettingsPanel title={t("settings.runtime.form.concTitle")} description={t("settings.runtime.form.concDesc")}>
        <div className="settings-field-grid settings-field-grid--3">
          {numberField("task_runtime_max_concurrency", t("settings.runtime.globalSlots"), t("settings.runtime.form.globalSlotsHint"), t("settings.runtime.form.unitItem"))}
          {numberField("task_user_max_concurrency", t("settings.runtime.userSlots"), t("settings.runtime.form.userSlotsHint"), t("settings.runtime.form.unitItem"))}
          {numberField("drama_user_video_job_limit", t("settings.runtime.dramaVideoLimit"), t("settings.runtime.form.dramaVideoLimitHint"), t("settings.runtime.form.unitItem"))}
        </div>
        <div className="settings-runtime-note mt-5">
          <Activity className="h-4 w-4 shrink-0 text-[var(--admin-forest)]" />
          <span>{t("settings.runtime.form.draftPrefix")} <strong>{form.task_runtime_max_concurrency}</strong> {t("settings.runtime.form.draftMid")} <strong>{form.task_user_max_concurrency}</strong>{t("settings.runtime.form.draftSuffix")}</span>
        </div>
      </SettingsPanel>

      <details className="settings-advanced">
        <summary><span>{t("settings.runtime.form.advTitle")}</span><span>{t("settings.runtime.form.advDesc")}</span></summary>
        <SettingsPanel title={t("settings.runtime.form.pipelineTitle")} description={t("settings.runtime.form.pipelineDesc")}>
          <div className="settings-field-grid settings-field-grid--3">
            {numberField("pipeline_image_concurrency", t("settings.runtime.imageConc"), t("settings.runtime.form.imageConcHint"), t("settings.runtime.form.unitLane"))}
            {numberField("pipeline_video_concurrency", t("settings.runtime.videoConc"), t("settings.runtime.form.videoConcHint"), t("settings.runtime.form.unitLane"))}
            {numberField("pipeline_audio_concurrency", t("settings.runtime.ttsConc"), t("settings.runtime.form.ttsConcHint"), t("settings.runtime.form.unitLane"))}
          </div>
        </SettingsPanel>
        <SettingsPanel title={t("settings.runtime.form.pollTitle")} description={t("settings.runtime.form.pollDesc")}>
          <div className="settings-field-grid settings-field-grid--2">
            {numberField("ark_video_poll_interval", t("settings.runtime.pollInterval"), t("settings.runtime.form.pollIntervalHint"), t("settings.runtime.form.unitSec"))}
            {numberField("ark_video_poll_timeout", t("settings.runtime.pollTimeout"), t("settings.runtime.form.pollTimeoutHint"), t("settings.runtime.form.unitSec"))}
            {numberField("task_poll_max_concurrency", t("settings.runtime.selectorConc"), t("settings.runtime.form.selectorConcHint"), t("settings.runtime.form.unitLane"))}
            {numberField("drama_fragment_max_attempts", t("settings.runtime.fragmentAttempts"), t("settings.runtime.form.fragmentAttemptsHint"), t("settings.runtime.form.unitTimes"))}
          </div>
        </SettingsPanel>
        <SettingsPanel title={t("settings.runtime.form.devTitle")} description={t("settings.runtime.form.devDesc")}>
          <div className="settings-toggle-row">
            <div><strong>{t("settings.runtime.mockTitle")}</strong><span>{t("settings.runtime.mockDesc")}</span></div>
            <Switch aria-label={t("settings.runtime.mockTitle")} checked={form.ark_mock} onCheckedChange={(v) => patchField("ark_mock", v)} />
          </div>
        </SettingsPanel>
      </details>
    </SettingsTabShell>
  );
}
