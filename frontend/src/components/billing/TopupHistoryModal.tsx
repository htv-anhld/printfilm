import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import { api, type BillingOrder } from '../../api'
import { formatDateTime, tr, useI18n } from '../../i18n'
import { formatOrderMoney, useBillingConfig } from '../../lib/money'

type Props = {
  open: boolean
  onClose: () => void
}

// 充值档位名（当前语言）；未知档位返回空串
function skuLabel(skuId: string): string {
  const key = `pricing.skus.${skuId}`
  const label = tr(key)
  return label === key ? '' : label
}

// 订单状态文案
function orderStatusLabel(status: string): string {
  const key = `billing.orderStatus.${status}`
  const label = tr(key)
  return label === key ? status : label
}


function formatTime(iso?: string | null) {
  return formatDateTime(iso)
}

/** 充值记录弹窗：列出近期订单与到账状态（过期待支付由后台自动关闭） */
export default function TopupHistoryModal({ open, onClose }: Props) {
  // 计费币种配置到达后重渲染金额
  useBillingConfig()
  const { t } = useI18n()
  /*
   * orders 订单列表
   * loading 加载中
   * error 错误信息
   */
  const [orders, setOrders] = useState<BillingOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .listBillingOrders(50)
      .then((r) => {
        if (!cancelled) setOrders(r.orders || [])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('common.loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title={t('billing.topupHistory.title')} size="lg" className="pf-topup-history-modal">
      {loading ? <p className="pf-muted">{t('common.loading')}</p> : null}
      {error ? <p className="pf-error">{error}</p> : null}
      {!loading && !error && orders.length === 0 ? (
        <p className="pf-muted">{t('billing.topupHistory.empty')}</p>
      ) : null}
      {!loading && orders.length > 0 ? (
        <ul className="pf-topup-list">
          {orders.map((o) => (
            <li key={o.out_trade_no} className="pf-topup-item">
              <div className="pf-topup-main">
                <strong>{skuLabel(o.sku_id) || o.sku_name}</strong>
                <span className="pf-muted">{formatTime(o.paid_at || o.created_at)}</span>
              </div>
              <div className="pf-topup-meta">
                <em>{formatOrderMoney(o.amount_fen, o.currency)}</em>
                <span className="pf-muted">{t('billing.topupHistory.credit', { amount: formatOrderMoney(o.credit_fen, o.currency) })}</span>
                <span className={`pf-topup-status is-${o.status}`}>
                  {orderStatusLabel(o.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  )
}
