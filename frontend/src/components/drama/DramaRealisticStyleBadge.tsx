/** 写实风格提醒：Seedance 可能把写实角色图判为真人（PrivacyInformation）而拒绝生成视频 */
import { TriangleAlert } from 'lucide-react'
import { useI18n } from '../../i18n'
import './DramaRealisticStyleBadge.css'

type BadgeProps = {
  /** card：风格卡片角标；inline：触发器里的小图标 */
  variant?: 'card' | 'inline'
}

// 渲染「写实」角标，悬停显示完整提醒
export function DramaRealisticStyleBadge({ variant = 'card' }: BadgeProps) {
  const { t } = useI18n()
  const tip = t('lib.imageStyleRealism.seedanceWarning')
  return (
    <em
      className={`drama-realistic-badge drama-realistic-badge--${variant}`}
      title={tip}
      aria-label={tip}
      role="img"
    >
      <TriangleAlert size={variant === 'card' ? 11 : 13} strokeWidth={2.2} aria-hidden />
      {variant === 'card' ? <b>{t('lib.imageStyleRealism.badge')}</b> : null}
    </em>
  )
}

// 渲染选中写实风格时的说明条
export function DramaRealisticStyleNotice() {
  const { t } = useI18n()
  return (
    <p className="drama-realistic-notice" role="note">
      <TriangleAlert size={14} strokeWidth={2} aria-hidden />
      <span>{t('lib.imageStyleRealism.seedanceWarning')}</span>
    </p>
  )
}
