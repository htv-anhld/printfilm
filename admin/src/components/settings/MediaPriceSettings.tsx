import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { AdminField } from "@/components/admin/AdminField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsPanel } from "./SettingsPanel";
import { tr } from "@/i18n";

type PriceData = {
  active_version: number | null; enabled: boolean; prices: Record<string, Record<string, string>>;
  strategies: Array<{ id: string; capability: string; allowed_resolutions: string[]; duration_min?: number; duration_max?: number }>;
};
function priceError(value: string) {
  if (!value.trim()) return "";
  if (!/^\d+(?:\.\d{1,4})?$/.test(value.trim())) return tr("ui.mediaPrice.errFormat");
  return Number(value) < 0.0001 || Number(value) > 10000 ? tr("ui.mediaPrice.errRange") : "";
}

/** Price publishing is independent from the surrounding payment settings save. */
export function MediaPriceSettings() {
  const [data, setData] = useState<PriceData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [operation, setOperation] = useState<"" | "load" | "publish" | "toggle">("");
  const baseline = useRef("");
  const busy = Boolean(operation);
  const dirty = Boolean(data && baseline.current !== JSON.stringify(data.prices));
  const invalidPrices = data ? Object.values(data.prices).some(rows => Object.values(rows).some(price => priceError(price))) : false;
  async function load() {
    try {
      const loaded = await api<PriceData>("/api/admin/settings/billing/media-prices");
      baseline.current = JSON.stringify(loaded.prices); setData(loaded); setError(""); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("ui.mediaPrice.loadFailed")); return false; }
  }
  useEffect(() => { void load(); }, []);
  async function reload() {
    if (busy) return;
    setOperation("load"); setNotice("");
    try { await load(); } finally { setOperation(""); }
  }
  async function toggle() {
    if (!data?.active_version || busy) return;
    setOperation("toggle"); setNotice(""); setError("");
    try {
      await api("/api/admin/settings/billing/media-prices/activation", { method: "PATCH", body: JSON.stringify({ enabled: !data.enabled, expected_version: data.active_version }) });
      setData(current => current ? { ...current, enabled: !data.enabled } : current);
      setNotice(tr("ui.mediaPrice.toggled"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("ui.mediaPrice.toggleFailed")); }
    finally { setOperation(""); }
  }
  async function publish() {
    if (!data || busy || invalidPrices) return;
    setOperation("publish"); setError(""); setNotice("");
    try {
      const prices = Object.fromEntries(Object.entries(data.prices).map(([model, rows]) => [model,
        Object.fromEntries(Object.entries(rows).filter(([, value]) => value.trim() !== "").map(([resolution, value]) => [resolution, value.trim()])),
      ]));
      await api("/api/admin/settings/billing/media-prices", { method: "POST", body: JSON.stringify({ prices, expected_version: data.active_version }) });
      const refreshed = await load();
      setNotice(refreshed ? tr("ui.mediaPrice.published") : tr("ui.mediaPrice.publishedReloadFailed"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("ui.mediaPrice.publishFailed")); }
    finally { setOperation(""); }
  }
  return <SettingsPanel title={tr("ui.mediaPrice.title")} description={tr("ui.mediaPrice.desc")}>
    <div className="admin-form-notice">{data?.active_version ? `${tr("ui.mediaPrice.version", { version: data.active_version })} · ${data.enabled ? tr("ui.mediaPrice.fixedOn") : tr("ui.mediaPrice.fixedOff")}` : tr("ui.mediaPrice.noVersion")}{dirty ? tr("ui.mediaPrice.dirty") : ""}</div>
    <p className="settings-price-note">{tr("ui.mediaPrice.note")}</p>
    {error ? <p role="alert" className="admin-field-error">{error}</p> : null}
    {notice ? <p role="status" className="settings-price-note">{notice}</p> : null}
    {!data && !error ? <p className="settings-price-note" role="status">{tr("ui.mediaPrice.loading")}</p> : null}
    {data && ["image", "video"].map(kind => <details key={kind} className="settings-advanced mt-4" open={kind === "image" ? true : undefined}>
      <summary>{kind === "image" ? tr("ui.mediaPrice.imageSummary") : tr("ui.mediaPrice.videoSummary")}</summary>
      <div className="settings-price-table admin-table-wrap"><table><thead><tr><th>{tr("ui.mediaPrice.colModel")}</th><th>{tr("ui.mediaPrice.colPrices")}</th></tr></thead><tbody>
        {data.strategies.filter(strategy => strategy.capability === kind).map(strategy => <tr key={strategy.id}>
          <td><strong className="text-xs">{strategy.id}</strong><p className="settings-price-note">{strategy.duration_max ? tr("ui.mediaPrice.secondsRange", { min: strategy.duration_min ?? 0, max: strategy.duration_max }) : tr("ui.mediaPrice.perImageBilling")}</p></td>
          <td><div className="settings-price-cell">{strategy.allowed_resolutions.map(resolution => {
            const value = data.prices[strategy.id]?.[resolution] ?? "";
            return <AdminField key={resolution} label={resolution} error={priceError(value)} hint={value ? (kind === "image" ? tr("ui.mediaPrice.unitImage") : tr("ui.mediaPrice.unitSecond")) : tr("ui.mediaPrice.notConfigured")}>
              <Input type="text" inputMode="decimal" disabled={busy} aria-label={tr("ui.mediaPrice.priceAria", { model: strategy.id, resolution })} placeholder={tr("ui.mediaPrice.placeholder")} value={value}
                onChange={event => { setNotice(""); setData({ ...data, prices: { ...data.prices, [strategy.id]: { ...data.prices[strategy.id], [resolution]: event.target.value } } }); }} />
            </AdminField>;
          })}</div></td>
        </tr>)}
      </tbody></table></div>
    </details>)}
    <div className="settings-price-actions">
      <Button disabled={!data || busy || invalidPrices} onClick={() => void publish()}>{operation === "publish" ? tr("ui.mediaPrice.publishing") : tr("ui.mediaPrice.publish")}</Button>
      <Button variant="outline" disabled={busy} onClick={() => void reload()}>{operation === "load" ? tr("ui.mediaPrice.reloading") : dirty ? tr("ui.mediaPrice.discardReload") : tr("ui.mediaPrice.reload")}</Button>
      {data?.active_version ? <Button variant="outline" disabled={busy} onClick={() => void toggle()}>{operation === "toggle" ? tr("ui.mediaPrice.toggling") : data.enabled ? tr("ui.mediaPrice.disable") : tr("ui.mediaPrice.enable")}</Button> : null}
    </div>
  </SettingsPanel>;
}
