import { useState } from "react";
import { Check, Eye, EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { LabeledControl } from "@/components/settings/SettingsPanel";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";

type SecretFieldProps = {
  label: string;
  hint?: string;
  value: string;
  configured: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  clearPending?: boolean;
  onUndoClear?: () => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
};

// Only the new draft can be revealed; existing secrets are never loaded into this field.
export function SecretField({
  label,
  hint,
  value,
  configured,
  placeholder,
  onChange,
  onClear,
  clearPending = false,
  onUndoClear,
  disabled = false,
  required = false,
  error,
}: SecretFieldProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const hasDraft = value.trim().length > 0;
  const status = clearPending
    ? t("common.secret.statusClearPending")
    : hasDraft
      ? t("common.secret.statusDraft")
      : configured
        ? t("common.secret.configured")
        : t("common.secret.statusNotConfigured");
  const inputRequired = required && !configured && !clearPending;
  const fieldError = error ?? (value.length > 0 && !hasDraft && !clearPending ? t("common.secret.onlySpaces") : undefined);
  const guidance = clearPending
    ? t("common.secret.guideClearPending")
    : configured
      ? t("common.secret.configuredHint")
      : t("common.secret.guideNew");
  return (
    <LabeledControl
      label={label}
      hint={[hint, guidance].filter(Boolean).join(" ")}
      required={inputRequired}
      error={fieldError}
    >
      <div className="admin-secret-field">
        <div className="admin-secret-field-row settings-secret-row">
          <input
            type={visible && !clearPending ? "text" : "password"}
            className="settings-input is-secret"
            placeholder={clearPending ? t("common.secret.markedClear") : placeholder ?? (configured ? t("common.secret.keepEmpty") : t("common.secret.enter"))}
            value={clearPending ? "" : value}
            disabled={disabled || clearPending}
            required={inputRequired}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
          />
          <Button type="button" variant="outline" size="icon" disabled={disabled || clearPending || !hasDraft}
            aria-label={visible ? t("common.secret.hideLabel", { label }) : t("common.secret.showLabel", { label })} aria-pressed={visible}
            title={visible ? t("common.secret.hideInput") : t("common.secret.showInput")} onClick={() => setVisible((current) => !current)}>
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </Button>
          {clearPending && onUndoClear ? <Button type="button" variant="outline" disabled={disabled} onClick={onUndoClear}>
            <RotateCcw size={14} />{t("common.secret.undo")}
          </Button> : (configured || hasDraft) && onClear ? <Button type="button" variant="outline" disabled={disabled} onClick={() => { setVisible(false); onClear(); }}>
            <Trash2 size={14} />{t("common.clear")}
          </Button> : null}
        </div>
        <span className="admin-secret-status inline-flex items-center gap-1" role="status">
          {configured && !clearPending && !hasDraft ? <Check size={12} /> : null}{status}
        </span>
      </div>
    </LabeledControl>
  );
}
