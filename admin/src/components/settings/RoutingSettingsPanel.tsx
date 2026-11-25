import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminRoutingChannel, type AdminRoutingSettings } from "@/api/client";
import { RoutingChannelFields, RoutingChannelTabs } from "@/components/settings/RoutingChannelList";
import { TOKENFREE_BASE_URL, TOKENFREE_CHANNEL_ID } from "@/lib/routingChannels";
import {
  LabeledControl,
  SettingsLoading,
  SettingsPanel,
  SettingsSurface,
  SettingsTabShell,
} from "@/components/settings/SettingsPanel";
import { cn } from "@/lib/utils";
import { tr, useI18n } from "@/i18n";

type Capability = "text" | "image" | "video" | "audio";
type CapabilityFilter = Capability | "all";

const CAPABILITY_ORDER: Capability[] = ["text", "image", "video", "audio"];
const DEFAULT_KEYS = ["text_model", "image_model", "video_model", "audio_model"] as const;
const MEDIA_FIELDS = ["images", "videos", "audios"] as const;
type MediaField = (typeof MEDIA_FIELDS)[number];

/*
 * Channel model catalog helpers (multi-channel routing). Upstream replaced
 * lib/tokenfreeRecommendedModels with a locked preset list, so the fork keeps
 * its catalog normalisation here.
 */
type UpstreamModelOption = { id: string; label: string; capability: string };

/** 勾选推荐时补上的 TokenFree id；视频含 2.5 / 2.0 / Mini */
const RECOMMENDED_MODEL_IDS: Record<Capability, string[]> = {
  text: ["kimi-k2.6"],
  image: ["gpt-image-2-5"],
  video: ["seedance-2-5", "seedance-2-0", "seedance-2-0-mini"],
  audio: [
    "qwen-tts-2025-05-22",
    "qwen3-tts-flash",
    "gemini-3.1-flash-tts",
    "gemini-2.5-pro-preview-tts",
    "elevenlabs-tts",
    "elevenlabs/text-to-speech-multilingual-v2",
  ],
};

// 把 Seedance 接入点/短名收到 TokenFree 目录 id
function canonicalChannelModelId(model: string): string {
  const mid = (model || "").trim();
  if (!mid) return "";
  const low = mid.toLowerCase();
  if (!low.includes("seedance")) return mid;
  if (low.includes("mini")) return "seedance-2-0-mini";
  if (/(?:2-5|2\.5|260628)/.test(low)) return "seedance-2-5";
  if (/(?:2-0|2\.0|260128)/.test(low)) return "seedance-2-0";
  const compact = low.replace(/_/g, "-");
  if (compact === "seedance-2" || compact === "seedance2" || compact.endsWith("seedance-2")) {
    return "seedance-2-0";
  }
  return mid;
}

// 合并 Seedance 2.0 三档别名，保持原顺序
function canonicalizeChannelModels(models: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of models) {
    const id = canonicalChannelModelId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

// 目录里同款 Seedance 只留一条，优先展示规范 id
function collapseCatalogModels(models: UpstreamModelOption[]): UpstreamModelOption[] {
  const map = new Map<string, UpstreamModelOption>();
  for (const model of models) {
    const id = canonicalChannelModelId(model.id);
    if (!id) continue;
    const prev = map.get(id);
    if (!prev || model.id === id) {
      map.set(id, {
        ...model,
        id,
        label: model.id === id ? model.label || id : id,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

// 上游目录里实际存在的推荐 id
function pickRecommendedModelIds(models: UpstreamModelOption[]): string[] {
  const ids = new Set(models.map((item) => canonicalChannelModelId(item.id)));
  const out: string[] = [];
  for (const cap of CAPABILITY_ORDER) {
    for (const want of RECOMMENDED_MODEL_IDS[cap]) {
      if (ids.has(want) && !out.includes(want)) out.push(want);
    }
  }
  return out;
}

// 各能力默认项；视频写逻辑 id seedance-2.5，与下拉选项对齐
function pickRecommendedDefaults(models: UpstreamModelOption[]): Record<Capability, string> {
  const ids = new Set(models.map((item) => canonicalChannelModelId(item.id)));
  const out: Record<Capability, string> = { text: "", image: "", video: "", audio: "" };
  for (const cap of CAPABILITY_ORDER) {
    if (cap === "video" && (ids.has("seedance-2-5") || ids.has("seedance-2.5"))) {
      out.video = "seedance-2.5";
      continue;
    }
    out[cap] = RECOMMENDED_MODEL_IDS[cap].find((id) => ids.has(id)) || "";
  }
  return out;
}

// 勾选推荐：canonicalize 后补上短名单，不删已选的 Seedance 2.0
function mergeRecommendedSelection(selected: string[], catalog: UpstreamModelOption[]): string[] {
  const recommended = pickRecommendedModelIds(catalog);
  return canonicalizeChannelModels([...selected, ...recommended]);
}

// 能力显示名（按当前语言）
function capLabel(cap: Capability): string {
  return tr(`settings.routing.cap.${cap}`);
}

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

// 渠道已选模型收成规范 id，并按 sort_order（= failover 顺序）排好
function normalizeSettings(settings: AdminRoutingSettings): AdminRoutingSettings {
  return {
    ...settings,
    system_channels: [...settings.system_channels]
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
      .map((item) =>
        item.id === TOKENFREE_CHANNEL_ID ? { ...item, models: canonicalizeChannelModels(item.models || []) } : item,
      ),
  };
}

// 就绪条：至少一个可用渠道 + 四种能力都有默认模型
function buildReadiness(data: AdminRoutingSettings | null, keyInputs: Record<string, string>) {
  const defaults = data?.default_models;
  const hasKey = (data?.system_channels ?? []).some(
    (ch) => ch.enabled && (ch.has_api_key || Boolean((keyInputs[ch.id] || "").trim())),
  );
  return [
    { id: "secret", label: "API Key", ready: hasKey },
    { id: "text", label: tr("settings.routing.textModel"), ready: Boolean(defaults?.text_model) },
    { id: "image", label: tr("settings.routing.imageModel"), ready: Boolean(defaults?.image_model) },
    { id: "video", label: tr("settings.routing.videoModel"), ready: Boolean(defaults?.video_model) },
    { id: "audio", label: tr("settings.routing.audioModel"), ready: Boolean(defaults?.audio_model) },
  ] as const;
}

// 模型路由配置：多个上游渠道（顺序 = failover 顺序），每个渠道填 Key、拉取并勾选模型
export function RoutingSettingsPanel() {
  const { t } = useI18n();
  /* 服务端配置 + 本地未保存的编辑 */
  const [data, setData] = useState<AdminRoutingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /* 按渠道 ID 存的临时状态：新 Key、上游目录、本次新建（ID 可改） */
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [catalogs, setCatalogs] = useState<Record<string, UpstreamModelOption[]>>({});
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState("");
  /* 模型目录的筛选输入 */
  const [fetchingModels, setFetchingModels] = useState(false);
  const [manualModel, setManualModel] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [modelCapFilter, setModelCapFilter] = useState<CapabilityFilter>("all");
  /* 参考素材上限的输入草稿（未通过校验前不写回 data） */
  const [referenceDrafts, setReferenceDrafts] = useState<Record<string, Partial<Record<MediaField, string>>>>({});

  const locked = Boolean(data?.upstream_locked);
  const channels = data?.system_channels ?? [];
  const channel = channels.find((item) => item.id === activeId) ?? channels[0];
  const keyInput = channel ? keyInputs[channel.id] || "" : "";
  const hasKey = Boolean(channel?.has_api_key) || Boolean(keyInput.trim());
  const upstreamModels = useMemo(() => (channel ? catalogs[channel.id] || [] : []), [catalogs, channel]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = normalizeSettings(await api<AdminRoutingSettings>("/api/admin/settings/routing"));
      setData(res);
      setKeyInputs({});
      setCatalogs({});
      setNewIds(new Set());
      setReferenceDrafts({});
      setActiveId((prev) => (res.system_channels.some((ch) => ch.id === prev) ? prev : res.system_channels[0]?.id || ""));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("settings.routing.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedModels = useMemo(() => channel?.models ?? [], [channel]);
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
    const counts: Record<CapabilityFilter, number> = { all: catalogModels.length, text: 0, image: 0, video: 0, audio: 0 };
    for (const model of catalogModels) counts[modelCapability(model)] += 1;
    return counts;
  }, [catalogModels]);

  const filteredCatalogModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    return catalogModels.filter((model) => {
      if (modelCapFilter !== "all" && modelCapability(model) !== modelCapFilter) return false;
      if (!q) return true;
      return `${model.id} ${model.label || ""}`.toLowerCase().includes(q);
    });
  }, [catalogModels, modelCapFilter, modelSearch]);

  const readiness = buildReadiness(data, keyInputs);

  // 参考素材上限：每项 0–100 的整数；生图模型只接受图片参考
  const referenceLimits = data?.media_reference_limits ?? {};
  const isImageOnlyModel = (id: string) =>
    (data?.logical_models ?? []).some((model) => model.id === id && model.capability === "image");
  const referenceErrors: Record<string, Partial<Record<MediaField, string>>> = {};
  Object.entries(referenceLimits).forEach(([id, limits]) => {
    MEDIA_FIELDS.forEach((field) => {
      if (isImageOnlyModel(id) && field !== "images") return;
      const raw = referenceDrafts[id]?.[field] ?? String(limits[field]);
      const value = Number(raw);
      if (!raw.trim() || !Number.isInteger(value) || value < 0 || value > 100) {
        referenceErrors[id] = { ...referenceErrors[id], [field]: t("settings.routing.refLimits.error") };
      }
    });
  });
  const referenceErrorCount = Object.values(referenceErrors).reduce((total, fields) => total + Object.keys(fields).length, 0);

  // 改某个渠道；新建渠道改 ID 时同步迁移按 ID 存的临时状态
  function patchChannel(id: string, patch: Partial<AdminRoutingChannel>) {
    const nextId = patch.id;
    setData((prev) =>
      prev
        ? { ...prev, system_channels: prev.system_channels.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)) }
        : prev,
    );
    if (nextId !== undefined && nextId !== id) {
      const rename = <T,>(map: Record<string, T>) => {
        const { [id]: value, ...rest } = map;
        return value === undefined ? rest : { ...rest, [nextId]: value };
      };
      setKeyInputs(rename);
      setCatalogs(rename);
      setNewIds((prev) => new Set([...[...prev].filter((x) => x !== id), nextId]));
      setActiveId(nextId);
    }
  }

  // 列表增删 / 排序
  function replaceChannels(next: AdminRoutingChannel[]) {
    const prevIds = new Set(channels.map((ch) => ch.id));
    const added = next.filter((ch) => !prevIds.has(ch.id)).map((ch) => ch.id);
    if (added.length) setNewIds((prev) => new Set([...prev, ...added]));
    setData((prev) => (prev ? { ...prev, system_channels: next } : prev));
  }

  function setSelectedModels(models: string[]) {
    if (!channel) return;
    patchChannel(channel.id, { models: canonicalizeChannelModels(models) });
  }

  // 勾选短名单，并把未设置的能力默认模型补上推荐值
  function applyRecommendedSelection(models: UpstreamModelOption[]) {
    const picks = pickRecommendedDefaults(models);
    setSelectedModels(mergeRecommendedSelection(selectedModels, models));
    setData((prev) => {
      if (!prev) return prev;
      const nextDefaults = { ...prev.default_models };
      for (const key of DEFAULT_KEYS) {
        const cap = key.replace("_model", "") as Capability;
        if ((nextDefaults[key] || "").trim()) continue;
        if (picks[cap]) nextDefaults[key] = picks[cap];
      }
      return { ...prev, default_models: nextDefaults };
    });
  }

  async function fetchUpstreamModels() {
    if (!channel) return;
    if (!hasKey) {
      toast.error(t("settings.routing.keyRequired"));
      return;
    }
    setFetchingModels(true);
    try {
      const res = await api<{ models: UpstreamModelOption[] }>("/api/admin/settings/upstream/models", {
        method: "POST",
        body: JSON.stringify({
          // 新建未保存的渠道后端查不到，只按表单里的 Base URL + Key 拉
          channel_id: newIds.has(channel.id) ? undefined : channel.id,
          protocol: channel.protocol || "auto",
          base_url: channel.id === TOKENFREE_CHANNEL_ID ? TOKENFREE_BASE_URL : channel.base_url,
          api_key: keyInput.trim() || undefined,
          capability: "all",
        }),
      });
      const catalog = collapseCatalogModels(res.models);
      setCatalogs((prev) => ({ ...prev, [channel.id]: catalog }));
      const shouldAutoPick = selectedModels.length === 0;
      if (shouldAutoPick) applyRecommendedSelection(catalog);
      else setSelectedModels([...selectedModels, ...pickRecommendedModelIds(catalog)]);
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
    setSelectedModels(
      checked ? [...new Set([...selectedModels, modelId])] : selectedModels.filter((id) => id !== modelId),
    );
  }

  function addManualModel() {
    const id = canonicalChannelModelId(manualModel.trim());
    if (!id) return;
    if (!selectedModels.includes(id)) setSelectedModels([...selectedModels, id]);
    setManualModel("");
  }

  async function handleSave() {
    if (!data || saving || referenceErrorCount > 0) return;
    setSaving(true);
    try {
      const res = await api<{ settings: AdminRoutingSettings }>("/api/admin/settings/routing", {
        method: "PATCH",
        body: JSON.stringify({
          system_channels: data.system_channels.map((ch, index) => ({
            id: ch.id,
            name: ch.name,
            base_url: ch.id === TOKENFREE_CHANNEL_ID ? TOKENFREE_BASE_URL : ch.base_url,
            api_key: (keyInputs[ch.id] || "").trim() || undefined,
            api_format: ch.api_format,
            protocol: ch.protocol,
            models: ch.models,
            enabled: ch.enabled,
            sort_order: index,
          })),
          default_models: data.default_models,
          ...(data.media_reference_limits ? { media_reference_limits: data.media_reference_limits } : {}),
        }),
      });
      const next = normalizeSettings(res.settings);
      setData(next);
      setKeyInputs({});
      setNewIds(new Set());
      setReferenceDrafts({});
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
    <SettingsTabShell onSave={() => void handleSave()} saving={saving} disabled={referenceErrorCount > 0}>
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
        title={t("settings.routing.channel.title")}
        description={locked ? t("settings.routing.descLocked") : t("settings.routing.desc")}
      >
        <RoutingChannelTabs
          channels={channels}
          activeId={channel?.id || ""}
          locked={locked}
          onSelect={setActiveId}
          onChange={replaceChannels}
        />
      </SettingsPanel>

      {channel ? (
        <SettingsPanel title={channel.name || channel.id} description={t("settings.routing.channel.editDesc")}>
          <div className="settings-field-grid">
            <RoutingChannelFields
              channel={channel}
              isNew={newIds.has(channel.id)}
              locked={locked}
              keyInput={keyInput}
              onKeyInput={(value) => setKeyInputs((prev) => ({ ...prev, [channel.id]: value }))}
              onChange={(patch) => patchChannel(channel.id, patch)}
            />

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
                        className={cn("settings-model-cap-chip", modelCapFilter === cap && "is-active", cap !== "all" && `is-${cap}`)}
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
                      <button type="button" className="admin-btn admin-btn-secondary settings-mini-btn" onClick={() => setModelSearch("")}>
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
                        <input type="checkbox" checked={checked} onChange={(e) => toggleModel(model.id, e.target.checked)} />
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
      ) : null}

      <SettingsPanel title={t("settings.routing.useModels")} description={t("settings.routing.useModelsDesc")}>
        <div className="settings-field-grid settings-field-grid--2">
          {DEFAULT_KEYS.map((key) => {
            const cap = key.replace("_model", "") as Capability;
            const options = (data?.logical_models ?? []).filter((model) => model.capability === cap);
            const allSelected = channels.flatMap((ch) => (ch.enabled ? ch.models : []));
            const fallback = [...new Set(allSelected.filter((id) => inferCapability(id) === cap))];
            const ids = options.length > 0 ? options.map((m) => m.id) : fallback;
            return (
              <LabeledControl key={key} label={t("settings.routing.capDefault", { cap: capLabel(cap) })}>
                <select
                  className="settings-select"
                  value={data?.default_models[key] ?? ""}
                  onChange={(e) =>
                    setData((prev) =>
                      prev ? { ...prev, default_models: { ...prev.default_models, [key]: e.target.value } } : prev,
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

      {Object.keys(referenceLimits).length > 0 ? (
        <details className="settings-advanced">
          <summary>
            <span>{t("settings.routing.refLimits.advanced")}</span>
            <span>
              {referenceErrorCount > 0
                ? t("settings.routing.refLimits.pending", { n: referenceErrorCount })
                : t("settings.routing.refLimits.summary")}
            </span>
          </summary>
          <SettingsPanel title={t("settings.routing.refLimits.title")} description={t("settings.routing.refLimits.desc")}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-[var(--admin-muted)]">
                    <th scope="col" className="px-2 py-3 font-medium">{t("settings.routing.refLimits.model")}</th>
                    <th scope="col" className="px-2 py-3 font-medium">{t("settings.routing.refLimits.images")}</th>
                    <th scope="col" className="px-2 py-3 font-medium">{t("settings.routing.refLimits.videos")}</th>
                    <th scope="col" className="px-2 py-3 font-medium">{t("settings.routing.refLimits.audios")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(referenceLimits).map(([id, limits]) => (
                    <tr key={id} className="border-b last:border-0">
                      <th scope="row" className="px-2 py-3 font-medium">
                        {(data?.logical_models ?? []).find((model) => model.id === id)?.name || id}
                        <code className="mt-1 block text-[10px] font-normal text-[var(--admin-muted)]">{id}</code>
                      </th>
                      {MEDIA_FIELDS.map((field) => {
                        const unsupported = isImageOnlyModel(id) && field !== "images";
                        const error = referenceErrors[id]?.[field];
                        return (
                          <td key={field} className="px-2 py-3 align-top">
                            {unsupported ? (
                              <span className="inline-flex h-10 items-center text-xs text-[var(--admin-muted)]">
                                {t("settings.routing.refLimits.unsupported")}
                              </span>
                            ) : (
                              <>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  required
                                  aria-label={`${id} ${t(`settings.routing.refLimits.${field}`)}`}
                                  aria-invalid={Boolean(error)}
                                  className="settings-input !w-24"
                                  value={referenceDrafts[id]?.[field] ?? limits[field]}
                                  disabled={saving}
                                  onChange={(event) => {
                                    const raw = event.target.value;
                                    setReferenceDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: raw } }));
                                    const value = Number(raw);
                                    if (!raw.trim() || !Number.isInteger(value) || value < 0 || value > 100) return;
                                    setData((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            media_reference_limits: {
                                              ...prev.media_reference_limits,
                                              [id]: { ...prev.media_reference_limits[id], [field]: value },
                                            },
                                          }
                                        : prev,
                                    );
                                  }}
                                />
                                {error ? <p className="mt-1 text-[11px] text-[#b64d43]" role="alert">{error}</p> : null}
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-6 text-[var(--admin-muted)]">{t("settings.routing.refLimits.footnote")}</p>
          </SettingsPanel>
        </details>
      ) : null}
    </SettingsTabShell>
  );
}
