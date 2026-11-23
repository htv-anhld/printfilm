/** 漫剧「内容语言」选择：决定 AI 生成大纲/剧本/分镜/台词所用语言（与界面语言独立） */
import { Languages } from 'lucide-react'
import { isLocale, useI18n } from '../../i18n'
import { DRAMA_CONTENT_LOCALES, type DramaContentLocale } from './dramaContentLocale'

type Props = {
  value: DramaContentLocale
  onChange: (next: DramaContentLocale) => void
  disabled?: boolean
  className?: string
}

/** 紧凑下拉（新建项目面板选项条内使用） */
export function DramaContentLocaleSelect({ value, onChange, disabled = false, className = '' }: Props) {
  const { t } = useI18n()
  return (
    <label
      className={`drama-agent-opt-trigger drama-content-locale-select${className ? ` ${className}` : ''}`}
      title={t('drama.contentLocale.hint')}
    >
      <Languages size={13} strokeWidth={2} aria-hidden />
      <span className="sr-only">{t('drama.contentLocale.label')}</span>
      <select
        value={value}
        disabled={disabled}
        aria-label={t('drama.contentLocale.label')}
        onChange={(e) => {
          if (isLocale(e.target.value)) onChange(e.target.value)
        }}
        style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
      >
        {DRAMA_CONTENT_LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(`drama.contentLocale.names.${l}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
