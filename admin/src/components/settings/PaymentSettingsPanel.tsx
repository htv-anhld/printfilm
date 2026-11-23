import { useMemo, useState } from "react";
import {
  LabeledControl,
  SettingsLoading,
  SettingsPanel,
  SettingsStatusBar,
  SettingsTabShell,
} from "@/components/settings/SettingsPanel";
import { SecretField } from "@/components/settings/SecretField";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAdminModelSettings } from "@/hooks/useAdminModelSettings";
import { api } from "@/api/client";
import { useI18n } from "@/i18n";

// 易支付与 Token 计费配置
export function PaymentSettingsPanel() {
  const { t } = useI18n();
  const { form, loading, saving, patchField, save } = useAdminModelSettings();
  const [epayKeyInput, setEpayKeyInput] = useState("");
  const [clearEpayKey, setClearEpayKey] = useState(false);
  const [smtpPasswordInput, setSmtpPasswordInput] = useState("");
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false);
  /*
   * tokenfreeBusy 查询 New API 余额中
   * tokenfreeInfo 余额或错误文案
   */
  const [tokenfreeBusy, setTokenfreeBusy] = useState(false);
  const [tokenfreeInfo, setTokenfreeInfo] = useState<string>("");
  const [modelRates, setModelRates] = useState<
    Array<{
      id: string;
      label: string;
      provider: string;
      capability: string;
      basis: string;
      rate_label: string;
      markup: number;
      recommended?: boolean;
      note?: string;
      official_cost_yuan?: number;
      user_charge_yuan?: number;
      verify_url?: string;
    }>
  >([]);
  const [modelRatesBusy, setModelRatesBusy] = useState(false);

  const epayReady = useMemo(() => {
    if (!form) return false;
    const hasKey = (form.has_epay_key && !clearEpayKey) || epayKeyInput.trim().length > 0;
    return Boolean(form.epay_pid && form.epay_api_url && hasKey);
  }, [form, clearEpayKey, epayKeyInput]);

  const tokenfreeReady = Boolean(form?.has_openai_api_key);

  const smtpReady = useMemo(() => {
    if (!form?.smtp_enabled) return false;
    const hasPass = (form.has_smtp_password && !clearSmtpPassword) || smtpPasswordInput.trim().length > 0;
    return Boolean(form.smtp_host && form.smtp_from && hasPass);
  }, [form, clearSmtpPassword, smtpPasswordInput]);

  async function handleSave() {
    if (!form) return;
    await save(
      {
        epay_api_url: form.epay_api_url,
        epay_pid: form.epay_pid,
        epay_key: epayKeyInput.trim() || undefined,
        clear_epay_key: clearEpayKey,
        epay_notify_url: form.epay_notify_url,
        epay_return_url: form.epay_return_url,
        billing_enabled: form.billing_enabled,
        billing_markup: 1.0,
        billing_estimate_buffer: form.billing_estimate_buffer,
        billing_seedance_video0: form.billing_seedance_video0,
        billing_seedance_video1: form.billing_seedance_video1,
        billing_llm_per_m: form.billing_llm_per_m,
        billing_seedream_per_m: form.billing_seedream_per_m,
        billing_tts_per_m: form.billing_tts_per_m,
        billing_kie_fen_per_credit: form.billing_kie_fen_per_credit,
        billing_est_llm_tokens: form.billing_est_llm_tokens,
        billing_est_seedream_tokens: form.billing_est_seedream_tokens,
        billing_est_tts_tokens: form.billing_est_tts_tokens,
        billing_est_seedance_tokens_per_sec: form.billing_est_seedance_tokens_per_sec,
        billing_signup_grant_fen: form.billing_signup_grant_fen,
        billing_user_alert_enabled: form.billing_user_alert_enabled,
        billing_user_alert_interval_fen: form.billing_user_alert_interval_fen,
        billing_admin_cost_alert_enabled: form.billing_admin_cost_alert_enabled,
        billing_admin_cost_alert_threshold_fen: form.billing_admin_cost_alert_threshold_fen,
        billing_admin_cost_alert_emails: form.billing_admin_cost_alert_emails,
        billing_admin_cost_alert_period: form.billing_admin_cost_alert_period,
        smtp_enabled: form.smtp_enabled,
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_user: form.smtp_user,
        smtp_password: smtpPasswordInput.trim() || undefined,
        clear_smtp_password: clearSmtpPassword,
        smtp_from: form.smtp_from,
        smtp_use_tls: form.smtp_use_tls,
      },
      t("settings.payment.saved"),
    );
    setEpayKeyInput("");
    setClearEpayKey(false);
    setSmtpPasswordInput("");
    setClearSmtpPassword(false);
  }

  // 拉取各模型计费口径表
  async function loadModelRates() {
    setModelRatesBusy(true);
    try {
      const res = await api<{ items: typeof modelRates }>("/api/admin/settings/billing/model-rates");
      setModelRates(res.items || []);
    } catch (err) {
      setModelRates([]);
      setTokenfreeInfo(err instanceof Error ? err.message : t("settings.payment.ratesFailed"));
    } finally {
      setModelRatesBusy(false);
    }
  }

  // 查询 TokenFree / New API 剩余额度
  async function queryTokenfreeQuota() {
    setTokenfreeBusy(true);
    setTokenfreeInfo("");
    try {
      const res = await api<{
        quota: number | null;
        used_quota: number | null;
        remain_yuan: number;
        used_yuan: number;
        remain_usd: number | null;
        usd_cny: number;
        console_url: string;
      }>("/api/admin/settings/tokenfree/quota");
      const remainUsd = res.remain_usd != null ? `$${res.remain_usd.toFixed(4)}` : "—";
      setTokenfreeInfo(
        t("settings.payment.quotaInfo", {
          quota: res.quota ?? "—",
          remainYuan: res.remain_yuan,
          remainUsd,
          rate: res.usd_cny,
          used: res.used_quota ?? "—",
          usedYuan: res.used_yuan,
          console: res.console_url,
        }),
      );
    } catch (err) {
      setTokenfreeInfo(err instanceof Error ? err.message : t("settings.payment.quotaFailed"));
    } finally {
      setTokenfreeBusy(false);
    }
  }

  if (loading || !form) {
    return <SettingsLoading />;
  }

  return (
    <SettingsTabShell onSave={() => void handleSave()} saving={saving}>
      <SettingsStatusBar
        title={t("settings.payment.statusTitle")}
        items={[
          {
            id: "epay",
            label: t("settings.payment.epay"),
            ready: epayReady,
            readyText: t("settings.payment.configured"),
            pendingText: t("settings.payment.incomplete"),
          },
          {
            id: "billing",
            label: t("settings.payment.tokenBilling"),
            ready: form.billing_enabled,
            readyText: t("settings.payment.on"),
            pendingText: t("settings.payment.off"),
          },
          {
            id: "tokenfree",
            label: t("settings.payment.upstreamCost"),
            ready: tokenfreeReady,
            readyText: t("settings.payment.keyConfigured"),
            pendingText: t("settings.payment.missingKey"),
          },
          {
            id: "smtp",
            label: "SMTP",
            ready: smtpReady,
            readyText: t("settings.payment.configured"),
            pendingText: form.smtp_enabled ? t("settings.payment.smtpIncomplete") : t("settings.payment.disabled"),
          },
        ]}
      />

      <div className="settings-routing-grid">
        <SettingsPanel
          className="settings-panel--compact"
          title={t("settings.payment.p1Title")}
          description={t("settings.payment.p1Desc")}
        >
          <div className="settings-field-grid">
            <LabeledControl label={t("settings.payment.gateway")}>
              <input
                className="settings-input"
                placeholder="https://pay.gitcc.com"
                value={form.epay_api_url}
                onChange={(e) => patchField("epay_api_url", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.pid")}>
              <input
                className="settings-input"
                value={form.epay_pid}
                onChange={(e) => patchField("epay_pid", e.target.value)}
              />
            </LabeledControl>
            <SecretField
              label={t("settings.payment.merchantKey")}
              value={epayKeyInput}
              configured={form.has_epay_key && !clearEpayKey}
              onChange={setEpayKeyInput}
              onClear={() => {
                setEpayKeyInput("");
                setClearEpayKey(true);
              }}
            />
            <LabeledControl label={t("settings.payment.notifyUrl")} hint={t("settings.payment.notifyHint")} className="settings-field-span-full">
              <input
                className="settings-input"
                value={form.epay_notify_url}
                onChange={(e) => patchField("epay_notify_url", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.returnUrl")} className="settings-field-span-full">
              <input
                className="settings-input"
                value={form.epay_return_url}
                onChange={(e) => patchField("epay_return_url", e.target.value)}
              />
            </LabeledControl>
          </div>
        </SettingsPanel>

        <SettingsPanel
          className="settings-panel--compact"
          title={t("settings.payment.p2Title")}
          description={t("settings.payment.p2Desc")}
        >
          <div className="settings-toggle-row">
            <div>
              <strong>{t("settings.payment.enableBilling")}</strong>
              <span>{t("settings.payment.enableBillingDesc")}</span>
            </div>
            <Switch checked={form.billing_enabled} onCheckedChange={(v) => patchField("billing_enabled", v)} />
          </div>
          <div className="settings-field-grid mt-3">
            <LabeledControl label={t("settings.payment.buffer")}>
              <input
                className="settings-input"
                type="number"
                step="0.1"
                min={1}
                value={form.billing_estimate_buffer}
                onChange={(e) => patchField("billing_estimate_buffer", Number(e.target.value))}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.signupGrant")}>
              <input
                className="settings-input"
                type="number"
                min={0}
                value={form.billing_signup_grant_fen}
                onChange={(e) => patchField("billing_signup_grant_fen", Number(e.target.value))}
              />
            </LabeledControl>
          </div>

          <div className="settings-subsection-title">{t("settings.payment.unitPrice")}</div>
          <div className="settings-field-grid">
            <LabeledControl label="LLM">
              <input
                className="settings-input"
                type="number"
                step="0.1"
                value={form.billing_llm_per_m}
                onChange={(e) => patchField("billing_llm_per_m", Number(e.target.value))}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.seedreamImage")}>
              <input
                className="settings-input"
                type="number"
                step="0.1"
                value={form.billing_seedream_per_m}
                onChange={(e) => patchField("billing_seedream_per_m", Number(e.target.value))}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.ttsVoice")}>
              <input
                className="settings-input"
                type="number"
                step="0.1"
                value={form.billing_tts_per_m}
                onChange={(e) => patchField("billing_tts_per_m", Number(e.target.value))}
              />
            </LabeledControl>
            <LabeledControl label="Seedance video0">
              <input
                className="settings-input"
                type="number"
                step="0.1"
                value={form.billing_seedance_video0}
                onChange={(e) => patchField("billing_seedance_video0", Number(e.target.value))}
              />
            </LabeledControl>
            <LabeledControl label="Seedance video1">
              <input
                className="settings-input"
                type="number"
                step="0.1"
                value={form.billing_seedance_video1}
                onChange={(e) => patchField("billing_seedance_video1", Number(e.target.value))}
              />
            </LabeledControl>
          </div>

          <div className="settings-subsection-title mt-3">{t("settings.payment.ratesTitle")}</div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={tokenfreeBusy}
              onClick={() => void queryTokenfreeQuota()}
            >
              {tokenfreeBusy ? t("settings.payment.querying") : t("settings.payment.queryQuota")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={modelRatesBusy}
              onClick={() => void loadModelRates()}
            >
              {modelRatesBusy ? t("common.loading") : t("settings.payment.viewRates")}
            </Button>
          </div>
          {tokenfreeInfo ? <p className="text-sm text-muted-foreground mt-2">{tokenfreeInfo}</p> : null}
          {modelRates.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-2">{t("settings.payment.colModel")}</th>
                    <th className="p-2">{t("settings.payment.colCapability")}</th>
                    <th className="p-2">{t("settings.payment.colOfficial")}</th>
                    <th className="p-2">{t("settings.payment.colUser")}</th>
                    <th className="p-2">{t("settings.payment.colBasis")}</th>
                  </tr>
                </thead>
                <tbody>
                  {modelRates.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-2">
                        <div className="font-medium">
                          {row.label}
                          {row.recommended ? <span className="ml-1 text-xs text-[#409eff]">{t("settings.payment.recommended")}</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{row.id}</div>
                        {row.note ? <div className="text-xs text-muted-foreground">{row.note}</div> : null}
                      </td>
                      <td className="p-2">{row.capability}</td>
                      <td className="p-2">
                        {row.official_cost_yuan ? `¥${row.official_cost_yuan}` : "—"}
                      </td>
                      <td className="p-2">
                        {row.user_charge_yuan ? `¥${row.user_charge_yuan}` : "—"}
                      </td>
                      <td className="p-2">
                        <div>{row.rate_label}</div>
                        {row.verify_url ? (
                          <a className="text-xs text-[#409eff] hover:underline" href={row.verify_url} target="_blank" rel="noreferrer">
                            {t("settings.payment.verify")}
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="settings-subsection-title">{t("settings.payment.estimateTitle")}</div>
          <div className="settings-field-grid">
            <LabeledControl label={t("settings.payment.llmEstimate")}>
              <input
                className="settings-input"
                type="number"
                value={form.billing_est_llm_tokens}
                onChange={(e) => patchField("billing_est_llm_tokens", Number(e.target.value))}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.seedreamEstimate")}>
              <input
                className="settings-input"
                type="number"
                value={form.billing_est_seedream_tokens}
                onChange={(e) => patchField("billing_est_seedream_tokens", Number(e.target.value))}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.ttsEstimate")}>
              <input
                className="settings-input"
                type="number"
                value={form.billing_est_tts_tokens}
                onChange={(e) => patchField("billing_est_tts_tokens", Number(e.target.value))}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.seedancePerSec")}>
              <input
                className="settings-input"
                type="number"
                value={form.billing_est_seedance_tokens_per_sec}
                onChange={(e) => patchField("billing_est_seedance_tokens_per_sec", Number(e.target.value))}
              />
            </LabeledControl>
          </div>
        </SettingsPanel>
      </div>

      <div className="settings-routing-grid">
        <SettingsPanel
          className="settings-panel--compact"
          title={t("settings.payment.p3Title")}
          description={t("settings.payment.p3Desc")}
        >
          <div className="settings-toggle-row">
            <div>
              <strong>{t("settings.payment.userAlert")}</strong>
              <span>{t("settings.payment.userAlertDesc")}</span>
            </div>
            <Switch
              checked={form.billing_user_alert_enabled}
              onCheckedChange={(v) => patchField("billing_user_alert_enabled", v)}
            />
          </div>
          <div className="settings-field-grid mt-2">
            <LabeledControl label={t("settings.payment.alertInterval")} hint={t("settings.payment.alertIntervalHint")}>
              <input
                className="settings-input"
                type="number"
                min={1}
                value={form.billing_user_alert_interval_fen}
                onChange={(e) => patchField("billing_user_alert_interval_fen", Number(e.target.value))}
              />
            </LabeledControl>
          </div>

          <div className="settings-toggle-row mt-3">
            <div>
              <strong>{t("settings.payment.adminAlert")}</strong>
              <span>{t("settings.payment.adminAlertDesc")}</span>
            </div>
            <Switch
              checked={form.billing_admin_cost_alert_enabled}
              onCheckedChange={(v) => patchField("billing_admin_cost_alert_enabled", v)}
            />
          </div>
          <div className="settings-field-grid mt-2">
            <LabeledControl label={t("settings.payment.threshold")}>
              <input
                className="settings-input"
                type="number"
                min={0}
                value={form.billing_admin_cost_alert_threshold_fen}
                onChange={(e) =>
                  patchField("billing_admin_cost_alert_threshold_fen", Number(e.target.value))
                }
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.period")}>
              <select
                className="settings-select"
                value={form.billing_admin_cost_alert_period}
                onChange={(e) => patchField("billing_admin_cost_alert_period", e.target.value)}
              >
                <option value="daily">{t("settings.payment.daily")}</option>
                <option value="monthly">{t("settings.payment.monthly")}</option>
                <option value="all_time">{t("settings.payment.allTime")}</option>
              </select>
            </LabeledControl>
            <LabeledControl label={t("settings.payment.recipients")} hint={t("settings.payment.commaSep")} className="settings-field-span-full">
              <input
                className="settings-input"
                placeholder="admin@example.com"
                value={form.billing_admin_cost_alert_emails}
                onChange={(e) => patchField("billing_admin_cost_alert_emails", e.target.value)}
              />
            </LabeledControl>
          </div>

          <div className="settings-toggle-row mt-3">
            <div>
              <strong>{t("settings.payment.enableSmtp")}</strong>
              <span>{t("settings.payment.enableSmtpDesc")}</span>
            </div>
            <Switch checked={form.smtp_enabled} onCheckedChange={(v) => patchField("smtp_enabled", v)} />
          </div>
          <div className="settings-field-grid mt-2">
            <LabeledControl label={t("settings.payment.smtpHost")}>
              <input
                className="settings-input"
                placeholder="smtp.example.com"
                value={form.smtp_host}
                onChange={(e) => patchField("smtp_host", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.port")}>
              <input
                className="settings-input"
                type="number"
                min={1}
                value={form.smtp_port}
                onChange={(e) => patchField("smtp_port", Number(e.target.value))}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.sender")}>
              <input
                className="settings-input"
                value={form.smtp_from}
                onChange={(e) => patchField("smtp_from", e.target.value)}
              />
            </LabeledControl>
            <LabeledControl label={t("settings.payment.username")}>
              <input
                className="settings-input"
                value={form.smtp_user}
                onChange={(e) => patchField("smtp_user", e.target.value)}
              />
            </LabeledControl>
            <SecretField
              label={t("settings.payment.smtpPassword")}
              value={smtpPasswordInput}
              configured={form.has_smtp_password && !clearSmtpPassword}
              onChange={setSmtpPasswordInput}
              onClear={() => {
                setSmtpPasswordInput("");
                setClearSmtpPassword(true);
              }}
            />
            <LabeledControl label={t("settings.payment.useTls")}>
              <div className="settings-inline-switch">
                <Switch checked={form.smtp_use_tls} onCheckedChange={(v) => patchField("smtp_use_tls", v)} />
              </div>
            </LabeledControl>
          </div>
        </SettingsPanel>
      </div>
    </SettingsTabShell>
  );
}
