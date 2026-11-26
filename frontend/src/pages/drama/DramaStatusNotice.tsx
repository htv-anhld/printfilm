import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert, WifiOff, X } from 'lucide-react'
import BillingErrorNotice from '../../components/billing/BillingErrorNotice'
import { useI18n } from '../../i18n'
import './dramaStatusNotice.css'

type Props = {
  tone?: 'info' | 'success' | 'warning' | 'error' | 'busy'
  title: string
  children?: ReactNode
  icon?: ReactNode
  className?: string
  onDismiss?: () => void
}

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
  busy: LoaderCircle,
}

/** 漫剧共用状态条：按 tone 着色（深浅色均适配），生成中的状态使用轻量动效。 */
export default function DramaStatusNotice({ tone = 'info', title, children, icon, className = '', onDismiss }: Props) {
  const { t } = useI18n()
  const Icon = icons[tone]
  return (
    <div className={`drama-status-notice is-${tone} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="drama-status-notice-icon" aria-hidden="true">
        {icon || <Icon size={17} strokeWidth={1.8} className={tone === 'busy' ? 'drama-status-notice-spinner' : undefined} />}
      </span>
      <div className="drama-status-notice-content">
        <strong className="drama-status-notice-title">{title}</strong>
        {children ? <div className="drama-status-notice-description">{children}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="drama-status-notice-close" onClick={onDismiss} aria-label={t('drama.statusNotice.close')}>
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

/** 网络异常给出本地化说明，业务错误继续保留余额不足等操作入口。 */
export function DramaErrorNotice({ message, className, onDismiss }: { message: string; className?: string; onDismiss?: () => void }) {
  const { t } = useI18n()
  const networkError = /failed to fetch|networkerror|network request failed|load failed|connection reset|连接被重置/i.test(message)
  return (
    <DramaStatusNotice
      tone={networkError ? 'warning' : 'error'}
      title={networkError ? t('drama.statusNotice.networkTitle') : t('drama.statusNotice.failedTitle')}
      icon={networkError ? <WifiOff size={17} strokeWidth={1.8} /> : undefined}
      className={className}
      onDismiss={onDismiss}
    >
      {networkError ? (
        <>
          <p>{t('drama.statusNotice.networkHint')}</p>
          <details className="drama-status-notice-details">
            <summary>{t('drama.statusNotice.details')}</summary>
            <p>{message}</p>
          </details>
        </>
      ) : <BillingErrorNotice message={message} className="drama-status-notice-message" inline />}
    </DramaStatusNotice>
  )
}
