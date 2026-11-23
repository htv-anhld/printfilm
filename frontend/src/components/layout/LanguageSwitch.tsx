import { LOCALES, type Locale } from '../../i18n/detect'
import { useI18n } from '../../i18n'

/** 顶栏语言切换（越/英/中）：点击后写入偏好 */
const LABEL_KEY: Record<Locale, string> = { vi: 'nav.langVi', en: 'nav.langEn', zh: 'nav.langZh' }

export default function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="pf-nav-lang" role="group" aria-label={t('nav.language')}>
      {LOCALES.map((code: Locale) => (
        <button
          key={code}
          type="button"
          className={locale === code ? 'is-active' : undefined}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {t(LABEL_KEY[code])}
        </button>
      ))}
    </div>
  )
}
