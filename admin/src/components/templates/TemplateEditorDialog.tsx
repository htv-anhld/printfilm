import { ImageOff, Loader2, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { AdminTemplate } from "@/api/client";
import { AdminField } from "@/components/admin/AdminField";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { tr, useI18n } from "@/i18n";

export type TemplateFormState = {
  id: string;
  name: string;
  description: string;
  category: string;
  preview_cover: string;
  style_prefix: string;
  character_prompt: string;
  extra_prompt: string;
  negative_prompt: string;
  default_ratio: string;
  shot_duration_min: number;
  shot_duration_max: number;
  llm_system_addon: string;
  sort_order: number;
  is_active: boolean;
  is_premium: boolean;
};

type TemplateEditorDialogProps = {
  open: boolean;
  saving: boolean;
  editing: AdminTemplate | null;
  form: TemplateFormState;
  categorySuggestions?: string[];
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<TemplateFormState>) => void;
  onSave: () => void;
};

type EditorTab = "basic" | "prompts" | "publish";

const TAB_IDS: EditorTab[] = ["basic", "prompts", "publish"];

function ratioOptions() {
  return [
    { value: "16:9", label: tr("templates.editor.ratio169") },
    { value: "9:16", label: tr("templates.editor.ratio916") },
    { value: "1:1", label: tr("templates.editor.ratio11") },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
  ];
}

// 解析封面预览地址
function coverPreviewSrc(url: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

// 模板新建/编辑弹窗（分 Tab + 封面预览）
export function TemplateEditorDialog({
  open,
  saving,
  editing,
  form,
  categorySuggestions = [],
  onOpenChange,
  onChange,
  onSave,
}: TemplateEditorDialogProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<EditorTab>("basic");
  const previewSrc = useMemo(() => coverPreviewSrc(form.preview_cover), [form.preview_cover]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setTab("basic");
    onOpenChange(next);
  };

  return (
    <AdminModal
      open={open}
      onOpenChange={handleOpenChange}
      size="full"
      className="template-editor-dialog max-h-[92vh] overflow-hidden"
      bodyClassName="p-0 overflow-hidden"
      title={editing ? t("templates.editor.editTitle", { name: editing.name }) : t("templates.create")}
      subtitle={editing ? editing.id : t("templates.editor.subtitle")}
      footer={
        <>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? t("common.saving") : t("templates.editor.save")}
          </Button>
        </>
      }
    >
      <div className="template-editor-layout">
        <aside className="template-editor-preview">
          <div className="template-editor-preview-frame">
            {previewSrc ? (
              <img src={previewSrc} alt={t("templates.editor.coverPreview")} className="template-editor-preview-img" />
            ) : (
              <div className="template-editor-preview-empty">
                <ImageOff className="h-10 w-10 text-[#c0c4cc]" />
                <span>{t("templates.editor.coverPreview")}</span>
              </div>
            )}
          </div>
          <AdminField label={t("templates.editor.coverUrl")} hint={t("templates.editor.coverUrlHint")}>
            <Input
              className="admin-input h-9"
              placeholder="/static/templates/covers/xxx.png"
              value={form.preview_cover}
              onChange={(e) => onChange({ preview_cover: e.target.value })}
            />
          </AdminField>
        </aside>

        <div className="template-editor-main">
          <div className="template-editor-tabs" role="tablist">
            {TAB_IDS.map((id) => ({ id, label: t(`templates.editor.tabs.${id}`) })).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={cn("template-editor-tab", tab === item.id && "is-active")}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="template-editor-panel">
            {tab === "basic" ? (
              <div className="template-editor-grid">
                {!editing ? (
                  <AdminField label={t("templates.editor.id")} className="template-editor-field--full">
                    <Input
                      className="admin-input h-9"
                      placeholder={t("templates.editor.idPlaceholder")}
                      value={form.id}
                      onChange={(e) => onChange({ id: e.target.value })}
                    />
                  </AdminField>
                ) : null}
                <AdminField label={t("templates.editor.name")} className="template-editor-field--full">
                  <Input
                    className="admin-input h-9"
                    value={form.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                  />
                </AdminField>
                <AdminField label={t("templates.editor.desc")} className="template-editor-field--full">
                  <Textarea
                    value={form.description}
                    onChange={(e) => onChange({ description: e.target.value })}
                    className="min-h-[88px]"
                  />
                </AdminField>
                <AdminField
                  label={t("templates.editor.categories")}
                  hint={
                    categorySuggestions.length
                      ? t("templates.editor.commonCategories", { list: categorySuggestions.slice(0, 8).join(t("templates.editor.listSep")) + (categorySuggestions.length > 8 ? "…" : "") })
                      : undefined
                  }
                >
                  <Input
                    className="admin-input h-9"
                    placeholder={t("templates.editor.categoriesPlaceholder")}
                    value={form.category}
                    onChange={(e) => onChange({ category: e.target.value })}
                  />
                </AdminField>
                <AdminSelect
                  label={t("templates.editor.defaultRatio")}
                  value={form.default_ratio}
                  options={ratioOptions()}
                  onChange={(v) => onChange({ default_ratio: v })}
                />
                <AdminField label={t("templates.editor.sort")}>
                  <Input
                    className="admin-input h-9"
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => onChange({ sort_order: Number(e.target.value) })}
                  />
                </AdminField>
                <AdminField label={t("templates.editor.shotMin")}>
                  <Input
                    className="admin-input h-9"
                    type="number"
                    value={form.shot_duration_min}
                    onChange={(e) => onChange({ shot_duration_min: Number(e.target.value) })}
                  />
                </AdminField>
                <AdminField label={t("templates.editor.shotMax")}>
                  <Input
                    className="admin-input h-9"
                    type="number"
                    value={form.shot_duration_max}
                    onChange={(e) => onChange({ shot_duration_max: Number(e.target.value) })}
                  />
                </AdminField>
              </div>
            ) : null}

            {tab === "prompts" ? (
              <div className="template-editor-grid template-editor-grid--prompts">
                <AdminField label={t("templates.editor.stylePrompt")} className="template-editor-field--full">
                  <Textarea
                    value={form.style_prefix}
                    onChange={(e) => onChange({ style_prefix: e.target.value })}
                    className="min-h-[100px] font-mono text-[13px]"
                  />
                </AdminField>
                <AdminField label={t("templates.editor.characterPrompt")} className="template-editor-field--full">
                  <Textarea
                    value={form.character_prompt}
                    onChange={(e) => onChange({ character_prompt: e.target.value })}
                    className="min-h-[88px] font-mono text-[13px]"
                  />
                </AdminField>
                <AdminField label={t("templates.editor.extraPrompt")} className="template-editor-field--full">
                  <Textarea
                    value={form.extra_prompt}
                    onChange={(e) => onChange({ extra_prompt: e.target.value })}
                    className="min-h-[88px] font-mono text-[13px]"
                  />
                </AdminField>
                <AdminField label={t("templates.editor.llmSystem")} className="template-editor-field--full">
                  <Textarea
                    value={form.llm_system_addon}
                    onChange={(e) => onChange({ llm_system_addon: e.target.value })}
                    className="min-h-[88px] font-mono text-[13px]"
                  />
                </AdminField>
                <AdminField label={t("templates.editor.negativePrompt")} className="template-editor-field--full">
                  <Textarea
                    value={form.negative_prompt}
                    onChange={(e) => onChange({ negative_prompt: e.target.value })}
                    className="min-h-[88px] font-mono text-[13px]"
                  />
                </AdminField>
              </div>
            ) : null}

            {tab === "publish" ? (
              <div className="template-editor-publish">
                <div className="template-editor-publish-row">
                  <div>
                    <strong>{t("templates.editor.activeTitle")}</strong>
                    <p>{t("templates.editor.activeDesc")}</p>
                  </div>
                  <Switch checked={form.is_active} onCheckedChange={(v) => onChange({ is_active: v })} />
                </div>
                <div className="template-editor-publish-row">
                  <div>
                    <strong>{t("templates.editor.premiumTitle")}</strong>
                    <p>{t("templates.editor.premiumDesc")}</p>
                  </div>
                  <Switch checked={form.is_premium} onCheckedChange={(v) => onChange({ is_premium: v })} />
                </div>
                {editing ? (
                  <details className="mt-4 rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">{t("templates.editor.advanced")}</summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="mb-1 text-xs text-[var(--admin-muted)]">seedance_config</div>
                        <pre className="admin-json-readonly">
                          {JSON.stringify(editing.seedance_config ?? {}, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-[var(--admin-muted)]">audio_config</div>
                        <pre className="admin-json-readonly">
                          {JSON.stringify(editing.audio_config ?? {}, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-[var(--admin-muted)]">subtitle_config</div>
                        <pre className="admin-json-readonly">
                          {JSON.stringify(editing.subtitle_config ?? {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AdminModal>
  );
}
