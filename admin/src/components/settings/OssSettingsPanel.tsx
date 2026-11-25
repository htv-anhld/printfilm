import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import {
  LabeledControl,
  SettingsLoading,
  SettingsPanel,
  SettingsStatusBar,
  SettingsTabShell,
} from "@/components/settings/SettingsPanel";
import { SecretField } from "@/components/settings/SecretField";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAdminModelSettings } from "@/hooks/useAdminModelSettings";
import { useI18n } from "@/i18n";

type StorageCheck = { ok: boolean; upload_ok: boolean; public_ok: boolean; url: string; error: string };

// 对象存储配置：阿里云 OSS 或 S3 兼容（Cloudflare R2 / AWS S3 / MinIO）
export function OssSettingsPanel() {
  const { t } = useI18n();
  const { form, loading, saving, patchField, save } = useAdminModelSettings();
  // testing 连接测试中
  const [testing, setTesting] = useState(false);
  const isS3 = (form?.oss_provider || "aliyun") === "s3";
  const [ossKeyIdInput, setOssKeyIdInput] = useState("");
  const [ossKeySecretInput, setOssKeySecretInput] = useState("");
  const [clearOssId, setClearOssId] = useState(false);
  const [clearOssSecret, setClearOssSecret] = useState(false);

  const ossReady = useMemo(() => {
    if (!form?.oss_enabled) return false;
    const hasCreds =
      (form.has_oss_access_key_id && !clearOssId) || ossKeyIdInput.trim().length > 0;
    const hasSecret =
      (form.has_oss_access_key_secret && !clearOssSecret) || ossKeySecretInput.trim().length > 0;
    return Boolean(form.oss_bucket && hasCreds && hasSecret);
  }, [form, clearOssId, clearOssSecret, ossKeyIdInput, ossKeySecretInput]);

  async function handleSave(): Promise<boolean> {
    if (!form) return false;
    const saved = await save(
      {
        oss_enabled: form.oss_enabled,
        oss_provider: form.oss_provider || "aliyun",
        oss_endpoint: form.oss_endpoint.trim(),
        oss_region: form.oss_region.trim(),
        oss_bucket: form.oss_bucket.trim(),
        oss_folder: form.oss_folder.trim(),
        oss_public_base: form.oss_public_base.trim(),
        oss_upload_async: form.oss_upload_async,
        oss_upload_queue: form.oss_upload_queue.trim(),
        oss_access_key_id: clearOssId ? undefined : ossKeyIdInput.trim() || undefined,
        oss_access_key_secret: clearOssSecret ? undefined : ossKeySecretInput.trim() || undefined,
        clear_oss_access_key_id: clearOssId,
        clear_oss_access_key_secret: clearOssSecret,
      },
      t("settings.oss.saved"),
    );
    if (!saved) return false;
    setOssKeyIdInput("");
    setOssKeySecretInput("");
    setClearOssId(false);
    setClearOssSecret(false);
    return true;
  }

  // 先保存再测试：后端用已保存的配置上传小文件并从公网 URL 读回
  async function handleTest() {
    if (!form?.oss_enabled) {
      toast.error(t("settings.oss.testDisabled"));
      return;
    }
    setTesting(true);
    try {
      if (!(await handleSave())) return;
      const res = await api<StorageCheck>("/api/admin/settings/storage/test", { method: "POST" });
      if (res.ok) toast.success(t("settings.oss.testOk"));
      else if (!res.upload_ok) toast.error(t("settings.oss.testUploadFail", { error: res.error || "-" }), { duration: 10000 });
      else toast.error(t("settings.oss.testPublicFail", { error: res.error || "-" }), { duration: 12000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  if (loading || !form) {
    return <SettingsLoading />;
  }

  return (
    <SettingsTabShell onSave={() => void handleSave()} saving={saving}>
      <SettingsStatusBar
        title={t("settings.oss.statusTitle")}
        items={[
          {
            id: "oss",
            label: isS3 ? t("settings.oss.providerS3") : t("settings.oss.aliyunOss"),
            ready: ossReady,
            readyText: t("settings.oss.ready"),
            pendingText: form.oss_enabled ? t("settings.oss.incompleteCreds") : t("settings.oss.disabled"),
          },
          {
            id: "async",
            label: t("settings.oss.asyncUpload"),
            ready: form.oss_upload_async,
            readyText: t("settings.oss.on"),
            pendingText: t("settings.oss.off"),
          },
        ]}
        extra={
          <span className="settings-status-extra">
            {t("settings.source", { source: form.source === "db" ? t("settings.sourceDb") : t("settings.sourceEnv") })}
          </span>
        }
      />

      <div className="settings-routing-grid">
        <SettingsPanel
          className="settings-panel--compact"
          title={t("settings.oss.panelTitle")}
          description={t("settings.oss.panelDesc")}
        >
          <div className="settings-toggle-row">
            <div>
              <strong>{t("settings.oss.enable")}</strong>
              <span>{t("settings.oss.enableDesc")}</span>
            </div>
            <Switch checked={form.oss_enabled} onCheckedChange={(v) => patchField("oss_enabled", v)} />
          </div>
          <div className="settings-toggle-row mt-3">
            <div>
              <strong>{t("settings.oss.provider")}</strong>
              <span>{isS3 ? t("settings.oss.providerS3Desc") : t("settings.oss.panelDesc")}</span>
            </div>
            <div className="settings-segmented" role="radiogroup" aria-label={t("settings.oss.provider")}>
              {(["aliyun", "s3"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={(form.oss_provider || "aliyun") === p}
                  className={`settings-segmented-btn${(form.oss_provider || "aliyun") === p ? " is-active" : ""}`}
                  onClick={() => patchField("oss_provider", p)}
                >
                  {p === "s3" ? t("settings.oss.providerS3") : t("settings.oss.providerAliyun")}
                </button>
              ))}
            </div>
          </div>
          {isS3 ? <p className="settings-hint-box mt-3">{t("settings.oss.r2Guide")}</p> : null}
          <p className="settings-hint-box mt-3">{t("settings.oss.marketplaceNote")}</p>
          <div className="settings-field-grid mt-3">
            <LabeledControl label="Endpoint">
              <input
                className="settings-input"
                placeholder={isS3 ? "https://<account_id>.r2.cloudflarestorage.com" : "oss-cn-beijing.aliyuncs.com"}
                value={form.oss_endpoint}
                onChange={(e) => patchField("oss_endpoint", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl label="Region">
              <input
                className="settings-input"
                placeholder={isS3 ? "auto" : "cn-hangzhou"}
                value={form.oss_region}
                onChange={(e) => patchField("oss_region", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl label="Bucket">
              <input
                className="settings-input"
                value={form.oss_bucket}
                onChange={(e) => patchField("oss_bucket", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.oss.folder")}>
              <input
                className="settings-input"
                placeholder="kepu"
                value={form.oss_folder}
                onChange={(e) => patchField("oss_folder", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl
              label={t("settings.oss.publicBase")}
              hint={isS3 ? t("settings.oss.publicBaseHintS3") : t("settings.oss.publicBaseHint")}
              className="settings-field-span-full"
            >
              <input
                className="settings-input"
                placeholder={isS3 ? "https://pub-xxxxxxxx.r2.dev" : "https://cdn.example.com"}
                value={form.oss_public_base}
                onChange={(e) => patchField("oss_public_base", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.oss.queue")}>
              <input
                className="settings-input"
                value={form.oss_upload_queue}
                onChange={(e) => patchField("oss_upload_queue", e.target.value)}
              />
            </LabeledControl>
            <SecretField
              label="AccessKey ID"
              value={ossKeyIdInput}
              configured={form.has_oss_access_key_id}
              clearPending={clearOssId}
              onUndoClear={() => setClearOssId(false)}
              onChange={(value) => {
                setOssKeyIdInput(value);
                setClearOssId(false);
              }}
              onClear={() => {
                setOssKeyIdInput("");
                setClearOssId(true);
              }}
            />
            <SecretField
              label="AccessKey Secret"
              value={ossKeySecretInput}
              configured={form.has_oss_access_key_secret}
              clearPending={clearOssSecret}
              onUndoClear={() => setClearOssSecret(false)}
              onChange={(value) => {
                setOssKeySecretInput(value);
                setClearOssSecret(false);
              }}
              onClear={() => {
                setOssKeySecretInput("");
                setClearOssSecret(true);
              }}
            />
          </div>
          <div className="settings-toggle-row mt-3">
            <div>
              <strong>{t("settings.oss.asyncUpload")}</strong>
              <span>{t("settings.oss.asyncUploadDesc")}</span>
            </div>
            <Switch checked={form.oss_upload_async} onCheckedChange={(v) => patchField("oss_upload_async", v)} />
          </div>
          <div className="mt-3">
            <Button type="button" variant="outline" disabled={testing || saving} onClick={() => void handleTest()}>
              {testing ? t("settings.oss.testing") : t("settings.oss.test")}
            </Button>
          </div>
        </SettingsPanel>
      </div>
    </SettingsTabShell>
  );
}
