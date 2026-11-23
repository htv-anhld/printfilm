import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { useI18n } from "@/i18n";

type Kind = "avatar" | "bgm" | "sfx";
type Item = { id: number; kind: Kind; name: string; url: string; tags: string[]; duration_sec?: number | null };

/** 管理端：全站素材库（头像 / 背景音乐 / 音效）；BGM 按情绪标签进入成片合成 */
export function LibraryAdminPage() {
  const { t } = useI18n();
  /* 当前类型、列表与情绪 */
  const [kind, setKind] = useState<Kind>("bgm");
  const [items, setItems] = useState<Item[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  /* 上传表单 */
  const [name, setName] = useState("");
  const [mood, setMood] = useState("default");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: Item[]; moods: string[] }>(`/api/admin/library?kind=${kind}`);
      setItems(res.items);
      setMoods(res.moods);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("name", name || file.name.replace(/\.[^.]+$/, ""));
      form.append("tags", kind === "bgm" ? mood : "");
      form.append("file", file);
      await api("/api/admin/library", { method: "POST", body: form });
      setName("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Item) {
    if (!window.confirm(t("commerce.library.deleteConfirm", { name: item.name }))) return;
    try {
      await api(`/api/admin/library/${item.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="admin-list-page">
      <PageHeader description={t("commerce.library.desc")} />
      <AdminFilterBar>
        <select className="settings-select max-w-[180px]" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {(["bgm", "sfx", "avatar"] as Kind[]).map((k) => (
            <option key={k} value={k}>
              {t(`commerce.library.kinds.${k}`)}
            </option>
          ))}
        </select>
        <input className="settings-input max-w-[220px]" value={name} placeholder={t("commerce.library.name")} onChange={(e) => setName(e.target.value)} />
        {kind === "bgm" ? (
          <select className="settings-select max-w-[160px]" value={mood} onChange={(e) => setMood(e.target.value)}>
            {moods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : null}
        <label className="admin-btn admin-btn-secondary cursor-pointer">
          {busy ? "…" : t("commerce.library.upload")}
          <input
            type="file"
            hidden
            accept={kind === "avatar" ? "image/png,image/jpeg,image/webp" : "audio/*"}
            disabled={busy}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
      </AdminFilterBar>
      {kind === "bgm" ? <p className="text-xs text-[#909399]">{t("commerce.library.bgmHint")}</p> : null}
      {items.length === 0 ? (
        <EmptyState title={t("commerce.library.empty")} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#e4e7ed] bg-white p-3">
              {item.kind === "avatar" ? (
                <img src={item.url} alt={item.name} className="mb-2 aspect-square w-full rounded object-cover" />
              ) : (
                <audio src={item.url} controls preload="none" className="mb-2 w-full" />
              )}
              <div className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-[#909399]">
                    {item.tags.join(", ")}
                    {item.duration_sec ? ` · ${Math.round(item.duration_sec)}s` : ""}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => void remove(item)}>
                  {t("commerce.library.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
