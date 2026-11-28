import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { api, type AdminRoutingChannel } from "@/api/client";
import { LabeledControl } from "@/components/settings/SettingsPanel";
import { useI18n } from "@/i18n";
import {
  isKieChannel,
  KIE_BASE_URL,
  KIE_CONSOLE_URL,
  newChannel,
  newKieChannel,
  TOKENFREE_BASE_URL,
  TOKENFREE_CHANNEL_ID,
  TOKENFREE_CONSOLE_URL,
} from "@/lib/routingChannels";
import { cn } from "@/lib/utils";

/** 渠道列表：选中、启停、上下移动（顺序 = failover 顺序）、增删 */
export function RoutingChannelTabs({
  channels,
  activeId,
  locked,
  onSelect,
  onChange,
}: {
  channels: AdminRoutingChannel[];
  activeId: string;
  locked: boolean;
  onSelect: (id: string) => void;
  onChange: (next: AdminRoutingChannel[]) => void;
}) {
  const { t } = useI18n();

  // 交换相邻渠道并重排 sort_order
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= channels.length) return;
    const next = [...channels];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((ch, i) => ({ ...ch, sort_order: i })));
  }

  // 删除前确认：删掉的渠道会连同其模型绑定一起移除
  function remove(id: string) {
    if (!window.confirm(t("settings.routing.channel.removeConfirm"))) return;
    const next = channels.filter((ch) => ch.id !== id).map((ch, i) => ({ ...ch, sort_order: i }));
    onChange(next);
    if (activeId === id && next[0]) onSelect(next[0].id);
  }

  function add(kind: "openai" | "kie" = "openai") {
    const ch = kind === "kie" ? newKieChannel(channels) : newChannel(channels);
    onChange([...channels, ch]);
    onSelect(ch.id);
  }

  // Kie.ai 不是 OpenAI 兼容网关，后端不会把它当主渠道
  const primaryId = channels.find((ch) => ch.enabled && (ch.has_api_key || ch.api_key) && !isKieChannel(ch))?.id;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {channels.map((ch, index) => (
          <li
            key={ch.id}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
              ch.id === activeId ? "border-[#409eff] bg-[#ecf5ff]" : "border-[#e4e7ed] bg-white",
              !ch.enabled && "opacity-60",
            )}
          >
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(ch.id)}>
              <span className="w-5 shrink-0 text-xs text-[#6f687a]">#{index + 1}</span>
              <span className="truncate font-medium">{ch.name || ch.id}</span>
              <span className="truncate font-mono text-xs text-[#6f687a]">{ch.id}</span>
              {ch.id === primaryId ? (
                <em className="rounded bg-[#f0f9eb] px-1.5 text-xs not-italic text-[#407723]">
                  {t("settings.routing.channel.primary")}
                </em>
              ) : null}
              {!ch.enabled ? (
                <em className="rounded bg-[#f4f4f5] px-1.5 text-xs not-italic text-[#6f687a]">
                  {t("settings.routing.channel.disabled")}
                </em>
              ) : null}
              <span className="ml-auto shrink-0 text-xs text-[#6f687a]">
                {t("settings.routing.channel.modelCount", { n: ch.models.length })}
              </span>
            </button>
            {!locked ? (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary settings-mini-btn"
                  aria-label={t("settings.routing.channel.moveUp")}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary settings-mini-btn"
                  aria-label={t("settings.routing.channel.moveDown")}
                  disabled={index === channels.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary settings-mini-btn"
                  aria-label={t("settings.routing.channel.remove")}
                  disabled={channels.length <= 1}
                  onClick={() => remove(ch.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {!locked ? (
        <div className="flex items-center gap-3">
          <button type="button" className="admin-btn admin-btn-secondary settings-mini-btn" onClick={() => add()}>
            <Plus className="h-3.5 w-3.5" />
            {t("settings.routing.channel.add")}
          </button>
          <button type="button" className="admin-btn admin-btn-secondary settings-mini-btn" onClick={() => add("kie")}>
            <Plus className="h-3.5 w-3.5" />
            {t("settings.routing.kie.add")}
          </button>
          <span className="text-xs text-[#6f687a]">{t("settings.routing.channel.failoverHint")}</span>
        </div>
      ) : null}
    </div>
  );
}

/** 单渠道连接字段：ID / 名称 / Base URL / 协议 / 启用 / Key */
export function RoutingChannelFields({
  channel,
  isNew,
  locked,
  keyInput,
  onKeyInput,
  onChange,
}: {
  channel: AdminRoutingChannel;
  isNew: boolean;
  locked: boolean;
  keyInput: string;
  onKeyInput: (value: string) => void;
  onChange: (patch: Partial<AdminRoutingChannel>) => void;
}) {
  const { t } = useI18n();
  const isTokenfree = channel.id === TOKENFREE_CHANNEL_ID;
  const isKie = isKieChannel(channel);
  const hasSavedKey = Boolean(channel.has_api_key);

  // 切到 kie 协议时补默认 Base URL / 调用格式
  function changeProtocol(protocol: AdminRoutingChannel["protocol"]) {
    if (protocol === "kie") {
      onChange({ protocol, api_format: "kie", base_url: channel.base_url || KIE_BASE_URL });
      return;
    }
    onChange({ protocol, api_format: channel.api_format === "kie" ? "openai" : channel.api_format });
  }

  return (
    <>
      {!locked ? (
        <>
          <LabeledControl label={t("settings.routing.channel.id")} hint={isNew ? t("settings.routing.channel.idHint") : undefined}>
            <input
              className="settings-input font-mono"
              value={channel.id}
              readOnly={!isNew}
              onChange={(e) => onChange({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
            />
          </LabeledControl>
          <LabeledControl label={t("settings.routing.channel.name")}>
            <input className="settings-input" value={channel.name} onChange={(e) => onChange({ name: e.target.value })} />
          </LabeledControl>
          <LabeledControl label={t("settings.routing.channel.protocol")} hint={t("settings.routing.channel.protocolHint")}>
            <select
              className="settings-select"
              value={channel.protocol}
              disabled={isTokenfree}
              onChange={(e) => changeProtocol(e.target.value as AdminRoutingChannel["protocol"])}
            >
              <option value="auto">auto</option>
              <option value="openai">OpenAI</option>
              <option value="ark">Volcengine Ark</option>
              <option value="kie">Kie</option>
              <option value="volc_tts">Doubao TTS</option>
            </select>
          </LabeledControl>
          <LabeledControl label={t("settings.routing.channel.enabled")}>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={channel.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
              {channel.enabled ? t("settings.routing.channel.on") : t("settings.routing.channel.off")}
            </label>
          </LabeledControl>
        </>
      ) : null}
      <LabeledControl label={t("settings.routing.endpoint")} className="settings-field-span-full">
        <input
          className="settings-input"
          value={isTokenfree ? TOKENFREE_BASE_URL : channel.base_url}
          readOnly={isTokenfree || locked}
          placeholder={isKie ? KIE_BASE_URL : "https://api.example.com/v1"}
          onChange={(e) => onChange({ base_url: e.target.value })}
        />
        {isKie ? (
          <p className="mt-1 text-xs text-[#6f687a]">
            {t("settings.routing.kie.hint")}
            <a className="ml-1 text-[#0068d4] hover:underline" href={KIE_CONSOLE_URL} target="_blank" rel="noreferrer">
              {KIE_CONSOLE_URL}
            </a>
          </p>
        ) : null}
        {isTokenfree ? (
          <p className="mt-1 text-xs text-[#6f687a]">
            {t("settings.routing.console")}
            <a className="ml-1 text-[#0068d4] hover:underline" href={TOKENFREE_CONSOLE_URL} target="_blank" rel="noreferrer">
              {TOKENFREE_CONSOLE_URL}
            </a>
          </p>
        ) : null}
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
            value={keyInput}
            onChange={(e) => onKeyInput(e.target.value)}
          />
          {keyInput ? (
            <button type="button" className="admin-btn admin-btn-secondary settings-mini-btn" onClick={() => onKeyInput("")}>
              {t("common.clear")}
            </button>
          ) : null}
        </div>
      </LabeledControl>
      {isKie ? <KieCreditBox channel={channel} isNew={isNew} keyInput={keyInput} /> : null}
    </>
  );
}

/** Kie.ai credit 余额查询（类似 TokenFree 额度面板）；新建未保存的渠道用表单里的 Key 查 */
function KieCreditBox({ channel, isNew, keyInput }: { channel: AdminRoutingChannel; isNew: boolean; keyInput: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const canQuery = Boolean(keyInput.trim()) || (!isNew && channel.has_api_key);

  async function query() {
    setBusy(true);
    setInfo("");
    try {
      const res = await api<{ credits: number; usd_estimate: number }>("/api/admin/settings/kie/credit", {
        method: "POST",
        body: JSON.stringify({
          channel_id: isNew ? undefined : channel.id,
          api_key: keyInput.trim() || undefined,
          base_url: channel.base_url || undefined,
        }),
      });
      setInfo(t("settings.routing.kie.creditInfo", { credits: res.credits, usd: res.usd_estimate.toFixed(2) }));
    } catch (err) {
      setInfo(err instanceof Error ? err.message : t("settings.routing.kie.creditFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LabeledControl label={t("settings.routing.kie.credit")} className="settings-field-span-full">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="admin-btn admin-btn-secondary settings-mini-btn"
          disabled={busy || !canQuery}
          onClick={() => void query()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
          {t("settings.routing.kie.queryCredit")}
        </button>
        {info ? <span className="text-xs text-[#606266]">{info}</span> : null}
      </div>
    </LabeledControl>
  );
}
