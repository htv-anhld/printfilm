import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminRoutingSettings } from "@/api/client";
import {
  LabeledControl,
  SettingsLoading,
  SettingsPanel,
  SettingsSurface,
  SettingsTabShell,
} from "@/components/settings/SettingsPanel";
import {
  canonicalChannelModelId,
  canonicalizeChannelModels,
  collapseCatalogModels,
  mergeRecommendedSelection,
  pickRecommendedDefaults,
  pickRecommendedModelIds,
  type UpstreamModelOption,
} from "@/lib/tokenfreeRecommendedModels";
import { cn } from "@/lib/utils";
import { tr, useI18n } from "@/i18n";

type Capability = "text" | "image" | "video" | "audio";
type CapabilityFilter = Capability | "all";

const CAPABILITY_ORDER: Capability[] = ["text", "image", "video", "audio"];

const TOKENFREE_CHANNEL_ID = "tokenfree";
const TOKENFREE_BASE_URL = "https://www.tokenfree.com/v1";
const TOKENFREE_CONSOLE_URL = "https://www.tokenfree.com/channels";

// 能力显示名（按当前语言）
function capLabel(cap: Capability): string {
  return tr(`settings.routing.cap.${cap}`);
}

const DEFAULT_KEYS = ["text_model", "image_model", "video_model", "audio_model"] as const;

// 与后端 infer_model_capability 对齐
function inferCapability(model: string): Capability {
  const mid = (model || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!mid) return "text";
  if (mid.includes("tts") || mid.startsWith("zh_") || mid.includes("speaker") || mid.startsWith("s_")) {
    return "audio";
  }
  if (mid.includes("seedance") || mid.includes("veo") || mid.includes("video") || mid.includes("i2v")) {
    return "video";
  }
  if (
    mid.includes("seedream") ||
    mid.includes("nano-banana") ||
    mid.includes("banana") ||
    mid.includes("dream") ||
    mid.includes("image") ||
    mid.includes("imagine-image")
  ) {
    return "image";
  }
  return "text";
}

// 优先用上游声明的能力，否则按模型 id 推断
function modelCapability(model: UpstreamModelOption): Capability {
  const cap = (model.capability || "").trim().toLowerCase();
  if (cap === "text" || cap === "image" || cap === "video" || cap === "audio") {
    return cap;
  }
  return inferCapability(model.id);
}

// 渠道已选模型收到规范 id，避免 Seedance 2.0 三档并存
function canonicalizeRoutingSettings(settings: AdminRoutingSettings): AdminRoutingSettings {
  return {
    ...settings,
    system_channels: settings.system_channels.map((item) =>
      item.id === TOKENFREE_CHANNEL_ID
        ? { ...item, models: canonicalizeChannelModels(item.models || []) }
        : item,
    ),
  };
}

function buildReadiness(data: AdminRoutingSettings | null, hasKey: boolean) {
  const defaults = data?.default_models;
  return [
    { id: "secret", label: "API Key", ready: hasKey },
    { id: "text", label: tr("settings.routing.textModel"), ready: Boolean(defaults?.text_model) },
    { id: "image", label: tr("settings.routing.imageModel"), ready: Boolean(defaults?.image_model) },
    { id: "video", label: tr("settings.routing.videoModel"), ready: Boolean(defaults?.video_model) },
    { id: "audio", label: tr("settings.routing.audioModel"), ready: Boolean(defaults?.audio_model) },
  ] as const;
}

// 开源版模型配置：固定 TokenFree，只填 Key、拉取并选择模型
export function RoutingSettingsPanel() {
  const { t } = useI18n();
  const [data, setData] = useState<AdminRoutingSettings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upstreamModels, setUpstreamModels] = useState<UpstreamModelOption[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [manualModel, setManualModel] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [modelCapFilter, setModelCapFilter] = useState<CapabilityFilter>("all");

  const channel = data?.system_channels.find((item) => item.id === TOKENFREE_CHANNEL_ID) ?? data?.system_channels[0];
  const hasSavedKey = Boolean(channel?.has_api_key);
  const hasKey = hasSavedKey || Boolean(apiKeyInput.trim());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<AdminRoutingSettings>("/api/admin/settings/routing");
      setData(canonicalizeRoutingSettings(res));
      setApiKeyInput("");
      setUpstreamModels([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("settings.routing.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedModels = channel?.models ?? [];
  const catalogModels = useMemo(() => {
    const raw: UpstreamModelOption[] = [];
    const seen = new Set<string>();
    for (const model of upstreamModels) {
      raw.push(model);
      seen.add(canonicalChannelModelId(model.id));
    }
    for (const id of selectedModels) {
      const cid = canonicalChannelModelId(id);
      if (!cid || seen.has(cid)) continue;
      raw.push({ id: cid, label: cid, capability: inferCapability(cid) });
      seen.add(cid);
    }
    return collapseCatalogModels(raw);
  }, [selectedModels, upstreamModels]);

  const capCounts = useMemo(() => {
    const counts: Record<CapabilityFilter, number> = {
      all: catalogModels.length,
      text: 0,
      image: 0,
      video: 0,
      audio: 0,
    };
    for (const model of catalogModels) {
      counts[modelCapability(model)] += 1;
    }
    return counts;
  }, [catalogModels]);

  const filteredCatalogModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    return catalogModels.filter((model) => {
      const cap = modelCapability(model);
      if (modelCapFilter !== "all" && cap !== modelCapFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${model.id} ${model.label || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [catalogModels, modelCapFilter, modelSearch]);

  const readiness = buildReadiness(data, hasKey);

  // 勾选短名单，并把 Seedance 2.0 三档别名收成 2.5 / 2.0 Mini
  function applyRecommendedSelection(models: UpstreamModelOption[]) {
    const picks = pickRecommendedDefaults(models);
    setSelectedModels(mergeRecommendedSelection(selectedModels, models));
    setData((prev) => {
      if (!prev) return prev;
      const nextDefaults = { ...prev.default_models };
      for (const key of DEFAULT_KEYS) {
        const cap = key.replace("_model", "") as Capability;
        if ((nextDefaults[key] || "").trim()) continue;
        const upstream = picks[cap];
        if (!upstream) continue;
        nextDefaults[key] = upstream;
      }
      return { ...prev, default_models: nextDefaults };
    });
  }

  function setSelectedModels(models: string[]) {
    const nextModels = canonicalizeChannelModels(models);
    setData((prev) => {
      if (!prev) return prev;
      const channels = prev.system_channels.length
        ? prev.system_channels.map((item) =>
            item.id === (channel?.id || TOKENFREE_CHANNEL_ID) ? { ...item, models: nextModels } : item,
          )
        : [
            {
              id: TOKENFREE_CHANNEL_ID,
              name: "TokenFree New API",
              base_url: TOKENFREE_BASE_URL,
              api_key: "",
              has_api_key: hasSavedKey,
              api_format: "openai" as const,
              protocol: "auto" as const,
              models: nextModels,
              enabled: true,
              sort_order: 0,
            },
          ];
      return { ...prev, system_channels: channels };
    });
  }

  async function fetchUpstreamModels() {
    if (!hasKey) {
      toast.error(t("settings.routing.keyRequired"));
      return;
    }
    setFetchingModels(true);
    try {
      const res = await api<{ models: UpstreamModelOption[] }>("/api/admin/settings/upstream/models", {
        method: "POST",
        body: JSON.stringify({
          channel_id: TOKENFREE_CHANNEL_ID,
          protocol: "auto",
          base_url: TOKENFREE_BASE_URL,
          api_key: apiKeyInput.trim() || undefined,
          capability: "all",
        }),
      });
      const catalog = collapseCatalogModels(res.models);
      setUpstreamModels(catalog);
      const shouldAutoPick = selectedModels.length === 0;
      if (shouldAutoPick) {
        applyRecommendedSelection(catalog);
      } else {
        setSelectedModels([...selectedModels, ...pickRecommendedModelIds(catalog)]);
      }
      toast.success(
        shouldAutoPick
          ? t("settings.routing.fetchedPicked", { n: res.models.length })
          : t("settings.routing.fetchedMerged", { n: res.models.length }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.routing.fetchFailed"));
    } finally {
      setFetchingModels(false);
    }
  }

  function toggleModel(modelId: string, checked: boolean) {
    const next = checked
      ? [...new Set([...selectedModels, modelId])]
      : selectedModels.filter((id) => id !== modelId);
    setSelectedModels(next);
  }

  function addManualModel() {
    const id = canonicalChannelModelId(manualModel.trim());
    if (!id) return;
    if (!selectedModels.includes(id)) setSelectedModels([...selectedModels, id]);
    setManualModel("");
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    try {
      const res = await api<{ settings: AdminRoutingSettings }>("/api/admin/settings/routing", {
        method: "PATCH",
        body: JSON.stringify({
          system_channels: [
            {
              id: TOKENFREE_CHANNEL_ID,
              name: "TokenFree New API",
              base_url: TOKENFREE_BASE_URL,
              api_key: apiKeyInput.trim() || undefined,
              api_format: "openai",
              protocol: "auto",
              models: selectedModels,
              enabled: true,
              sort_order: 0,
            },
          ],
          default_models: data.default_models,
        }),
      });
      setData(canonicalizeRoutingSettings(res.settings));
      setApiKeyInput("");
      toast.success(t("settings.routing.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return <SettingsLoading label={t("settings.routing.loading")} />;
  }

  return (
    <SettingsTabShell onSave={() => void handleSave()} saving={saving}>
      <SettingsSurface className="settings-readiness-bar">
        <div className="settings-readiness-title">{t("settings.routing.readiness")}</div>
        <div className="settings-readiness-row">
          {readiness.map((item) => (
            <div key={item.id} className={cn("settings-readiness-item", item.ready && "is-ready")}>
              <span className={cn("settings-readiness-dot", item.ready ? "is-on" : "is-off")} />
              <span>{item.label}</span>
              <em>{item.ready ? t("common.secret.configured") : t("settings.notReady")}</em>
            </div>
          ))}
        </div>
      </SettingsSurface>

      {(data?.validation_errors.length ?? 0) > 0 ? (
        <SettingsSurface className="border-[#fde2e2] bg-[#fef0f0]">
          <div className="text-xs font-medium text-[#f56c6c]">{t("settings.routing.validation")}</div>
          <ul className="mt-1 space-y-0.5 text-xs text-[#f56c6c]">
            {data?.validation_errors.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </SettingsSurface>
      ) : null}

      <SettingsPanel
        title="TokenFree New API"
        description={t("settings.routing.desc")}
      >
        <div className="settings-field-grid">
          <LabeledControl label={t("settings.routing.endpoint")} className="settings-field-span-full">
            <input className="settings-input" value={TOKENFREE_BASE_URL} readOnly />
            <p className="mt-1 text-xs text-[#909399]">
              {t("settings.routing.console")}
              <a className="ml-1 text-[#409eff] hover:underline" href={TOKENFREE_CONSOLE_URL} target="_blank" rel="noreferrer">
                {TOKENFREE_CONSOLE_URL}
              </a>
            </p>
          </LabeledControl>
          <LabeledControl
            label="API Key"
            hint={hasSavedKey ? t("settings.routing.savedKeyHint") : t("settings.routing.notConfigured")}
            className="settings-field-span-full"
          >
            <div className="settings-secret-row">
              <input
                className="settings-input is-secret"
                type="password"
                placeholder={hasSavedKey ? t("settings.routing.savedKeyPlaceholder") : t("settings.routing.pasteKey")}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              {apiKeyInput ? (
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary settings-mini-btn"
                  onClick={() => setApiKeyInput("")}
                >
                  {t("common.clear")}
                </button>
              ) : null}
            </div>
          </LabeledControl>

          <LabeledControl
            className="settings-field-span-full"
            label={t("settings.routing.models")}
            hint={t("settings.routing.modelsHint")}
          >
            <div className="settings-model-toolbar">
              <button
                type="button"
                className="admin-btn admin-btn-secondary settings-mini-btn"
                disabled={fetchingModels || !hasKey}
                onClick={() => void fetchUpstreamModels()}
              >
                {fetchingModels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {t("settings.routing.fetchModels")}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary settings-mini-btn"
                disabled={upstreamModels.length === 0}
                onClick={() => applyRecommendedSelection(upstreamModels)}
              >
                {t("settings.routing.pickRecommended")}
              </button>
              <span className="settings-model-count">
                {t("settings.routing.selected", { n: selectedModels.length })}
                {upstreamModels.length > 0 ? t("settings.routing.upstreamCount", { n: upstreamModels.length }) : ""}
                {filteredCatalogModels.length !== catalogModels.length
                  ? t("settings.routing.currentList", { n: filteredCatalogModels.length })
                  : ""}
              </span>
            </div>
            {catalogModels.length > 0 ? (
              <>
                <div className="settings-model-cap-row">
                  {(["all", ...CAPABILITY_ORDER] as CapabilityFilter[]).map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      className={cn(
                        "settings-model-cap-chip",
                        modelCapFilter === cap && "is-active",
                        cap !== "all" && `is-${cap}`,
                      )}
                      onClick={() => setModelCapFilter(cap)}
                    >
                      {cap === "all" ? t("common.all") : capLabel(cap)}
                      <span>{capCounts[cap]}</span>
                    </button>
                  ))}
                </div>
                <div className="settings-model-search">
                  <Search className="h-3.5 w-3.5 shrink-0 text-[#909399]" aria-hidden />
                  <input
                    className="settings-input"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder={t("settings.routing.searchPlaceholder")}
                  />
                  {modelSearch ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary settings-mini-btn"
                      onClick={() => setModelSearch("")}
                    >
                      {t("common.clear")}
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
            <div className="settings-model-catalog">
              {catalogModels.length === 0 ? (
                <div className="settings-empty-hint">{t("settings.routing.emptyFetch")}</div>
              ) : filteredCatalogModels.length === 0 ? (
                <div className="settings-empty-hint">{t("settings.routing.noMatch")}</div>
              ) : (
                filteredCatalogModels.map((model) => {
                  const checked = selectedModels.includes(model.id);
                  const cap = modelCapability(model);
                  return (
                    <label key={model.id} className={cn("settings-model-option", checked && "is-checked")}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleModel(model.id, e.target.checked)}
                      />
                      <span className="font-mono text-xs">{model.label || model.id}</span>
                      <em className={cn("settings-cap-tag", `is-${cap}`)}>{capLabel(cap) || cap}</em>
                    </label>
                  );
                })
              )}
            </div>
            <div className="settings-model-manual">
              <input
                className="settings-input"
                value={manualModel}
                onChange={(e) => setManualModel(e.target.value)}
                placeholder={t("settings.routing.manualPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addManualModel();
                  }
                }}
              />
              <button type="button" className="admin-btn admin-btn-secondary settings-mini-btn" onClick={addManualModel}>
                {t("settings.routing.add")}
              </button>
            </div>
          </LabeledControl>
        </div>
      </SettingsPanel>

      <SettingsPanel title={t("settings.routing.useModels")} description={t("settings.routing.useModelsDesc")}>
        <div className="settings-field-grid settings-field-grid--2">
          {DEFAULT_KEYS.map((key) => {
            const cap = key.replace("_model", "") as Capability;
            const options = (data?.logical_models ?? []).filter((model) => model.capability === cap);
            const fallback = selectedModels.filter((id) => inferCapability(id) === cap);
            const ids = options.length > 0 ? options.map((m) => m.id) : fallback;
            return (
              <LabeledControl key={key} label={t("settings.routing.capDefault", { cap: capLabel(cap) })}>
                <select
                  className="settings-select"
                  value={data?.default_models[key] ?? ""}
                  onChange={(e) =>
                    setData((prev) =>
                      prev
                        ? { ...prev, default_models: { ...prev.default_models, [key]: e.target.value } }
                        : prev,
                    )
                  }
                >
                  <option value="">{t("settings.routing.unset")}</option>
                  {ids.map((id) => (
                    <option key={id} value={id}>
                      {options.find((m) => m.id === id)?.name || id}
                    </option>
                  ))}
                </select>
              </LabeledControl>
            );
          })}
        </div>
      </SettingsPanel>
    </SettingsTabShell>
  );
}
