import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { AdminField } from "./AdminField";
import { AdminModal } from "./AdminModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";

/** 修改自己的登录密码；传 resetUserId 时改为管理员重置该普通用户的密码（无需当前密码） */
export function ChangePasswordDialog({ email, resetUserId, onClose }: { email?: string; resetUserId?: number; onClose: () => void }) {
  const { t } = useI18n();
  const resetting = resetUserId !== undefined;
  const formId = useId();
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = new FormData(event.currentTarget);
    const current = form.get("current");
    const password = String(form.get("password"));
    if (password !== form.get("confirm")) return setError(t("layout.password.mismatch"));
    if (!resetting && current === password) return setError(t("layout.password.sameAsCurrent"));
    if (new TextEncoder().encode(password).length > 72) return setError(t("layout.password.tooLong"));
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      await api(resetting ? `/api/admin/users/${resetUserId}/reset-password` : "/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(resetting ? { new_password: password } : { current_password: current, new_password: password }),
      });
      toast.success(resetting ? t("layout.password.resetSuccess", { email: email ?? "" }) : t("layout.password.success"));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("layout.password.failed"));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <AdminModal open onOpenChange={open => { if (!open && !pending.current) onClose(); }}
      title={resetting ? t("layout.password.resetTitle") : t("layout.password.title")} subtitle={email} size="md"
      footer={<>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{t("layout.password.cancel")}</Button>
        <Button type="submit" form={formId} disabled={saving}>{saving ? t("layout.password.saving") : resetting ? t("layout.password.resetConfirm") : t("layout.password.save")}</Button>
      </>}>
      <form id={formId} className="space-y-4" onSubmit={submit} onChange={() => setError("")}>
        <input type="hidden" name="username" autoComplete="username" value={email ?? ""} />
        {!resetting && <AdminField label={t("layout.password.current")} required>
          <Input type="password" name="current" autoComplete="current-password" maxLength={64} disabled={saving} />
        </AdminField>}
        <AdminField label={t("layout.password.new")} required hint={t("layout.password.hint")}>
          <Input type="password" name="password" autoComplete="new-password" minLength={6} maxLength={64} disabled={saving} />
        </AdminField>
        <AdminField label={t("layout.password.confirm")} required>
          <Input type="password" name="confirm" autoComplete="new-password" maxLength={64} disabled={saving} />
        </AdminField>
        {error && <p role="alert" className="admin-field-error">{error}</p>}
      </form>
    </AdminModal>
  );
}
