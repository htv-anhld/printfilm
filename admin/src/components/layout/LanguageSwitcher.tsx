import { LOCALES, useI18n, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";

const SHORT: Record<Locale, string> = { vi: "VI", en: "EN", zh: "中" };
const FULL: Record<Locale, string> = { vi: "Tiếng Việt", en: "English", zh: "中文" };

type LanguageSwitcherProps = {
  className?: string;
};

// 界面语言切换（VI / EN / 中），选择写入 localStorage
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      role="radiogroup"
      aria-label={t("layout.language")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[9px] border border-[var(--admin-border,#e2e8f0)] bg-white/70 p-0.5",
        className,
      )}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={locale === l}
          title={FULL[l]}
          onClick={() => locale !== l && setLocale(l)}
          className={cn(
            "h-7 min-w-[2.25rem] cursor-pointer rounded-[7px] px-2 text-xs font-semibold transition-colors",
            locale === l
              ? "bg-[var(--admin-forest,#1f5c48)] text-white"
              : "text-[var(--admin-muted,#64748b)] hover:bg-[rgba(61,154,114,0.12)] hover:text-[var(--admin-forest,#1f5c48)]",
          )}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
