import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type { UsageSummary, Wallet } from '../../api'
import { formatDateTime, useI18n } from '../../i18n'
import { formatMajor, useBillingConfig } from '../../lib/money'

type Props = {
  wallet: Wallet | null
  usage: UsageSummary | null
  loggedIn: boolean
  updatedAt: Date | null
  onHistory: () => void
}

function formatUpdated(d: Date | null) {
  return formatDateTime(d)
}

/** 定价页深色余额卡片：余额、本月消耗、冻结、充值记录 */
export default function PricingWalletCard({ wallet, usage, loggedIn, updatedAt, onHistory }: Props) {
  const { t } = useI18n()
  const [balanceVisible, setBalanceVisible] = useState(true)
  const { symbol } = useBillingConfig()

  const balanceYuan = wallet?.balance_yuan ?? usage?.balance_yuan ?? 0
  const frozenYuan = wallet?.frozen_yuan ?? usage?.frozen_yuan ?? 0
  const monthCharge = usage?.charge_yuan ?? 0

  return (
    <aside className="pf-pricing-wallet-dark">
      <div className="pf-pricing-wallet-dark-head">
        <span className="pf-pricing-wallet-dark-label">{t('pricing.walletBalance')}</span>
        <div className="pf-pricing-wallet-dark-actions">
          <button
            type="button"
            className="pf-pricing-wallet-eye"
            aria-label={balanceVisible ? t('pricing.hideBalance') : t('pricing.showBalance')}
            onClick={() => setBalanceVisible((v) => !v)}
          >
            {balanceVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            type="button"
            className="pf-pricing-wallet-history"
            disabled={!loggedIn}
            title={loggedIn ? t('billing.wallet.viewHistory') : t('pricing.loginFirst')}
            onClick={onHistory}
          >
            {t('pricing.history')}
          </button>
        </div>
      </div>

      <strong className="pf-pricing-wallet-dark-balance">
        {balanceVisible ? formatMajor(balanceYuan) : `${symbol} ****`}
      </strong>

      <dl className="pf-pricing-wallet-dark-meta">
        <div>
          <dt>{t('pricing.monthCharge')}</dt>
          <dd>{loggedIn ? formatMajor(monthCharge) : '—'}</dd>
        </div>
        <div>
          <dt>{t('billing.wallet.frozen')}</dt>
          <dd>{loggedIn ? formatMajor(frozenYuan) : '—'}</dd>
        </div>
      </dl>

      <p className="pf-pricing-wallet-dark-updated">{t('pricing.updatedAt', { time: formatUpdated(updatedAt) })}</p>
    </aside>
  )
}
