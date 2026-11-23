import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { api, type MySubscription, type PlanInterval, type SubscriptionPlan } from '../../api'
import { useI18n } from '../../i18n'
import { dialog } from '../../lib/dialog'
import { formatCredits, formatMoney, useBillingConfig } from '../../lib/money'

type Props = {
  loggedIn: boolean
  /** 订阅状态变化（换套餐 / 取消）后通知父组件刷新钱包 */
  onChanged?: () => void
}

/** 月付价 / 年付折月价（美分） */
function monthlyPrice(plan: SubscriptionPlan, interval: PlanInterval): number {
  return interval === 'year' ? Math.round(plan.price_year / 12) : plan.price_month
}

/** 年付相对按月付 12 个月的折扣百分比 */
function yearlySavingPct(plans: SubscriptionPlan[]): number {
  const best = Math.max(0, ...plans.map((p) => 1 - p.price_year / (p.price_month * 12)))
  return Math.round(best * 100)
}

/** 定价页订阅套餐：月 / 年切换，订阅 / 变更 / 管理 */
export default function SubscriptionPlans({ loggedIn, onChanged }: Props) {
  const { t } = useI18n()
  const nav = useNavigate()
  useBillingConfig()
  /* 套餐目录与我的订阅 */
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [enabled, setEnabled] = useState(false)
  const [mine, setMine] = useState<MySubscription | null>(null)
  /* 交互态 */
  const [interval, setPlanInterval] = useState<PlanInterval>('month')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .billingPlans()
      .then((r) => {
        setPlans(r.plans || [])
        setEnabled(Boolean(r.enabled))
      })
      .catch(() => setEnabled(false))
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    api.mySubscription().then(setMine).catch(() => setMine(null))
  }, [loggedIn])

  if (!enabled || plans.length === 0) return null

  const live = mine && mine.status !== 'none'
  const saving = yearlySavingPct(plans)

  // 订阅 / 变更套餐
  async function choose(plan: SubscriptionPlan) {
    if (!loggedIn) {
      nav(`/auth?next=${encodeURIComponent('/pricing#plans')}`)
      return
    }
    setError('')
    setBusy(plan.id)
    try {
      if (!live) {
        const res = await api.subscriptionCheckout(plan.id, interval)
        window.location.assign(res.checkout_url)
        return
      }
      const ok = await dialog.confirm({
        title: t('pricing.plans.changeTitle'),
        message: t('pricing.plans.changeMessage', { plan: plan.name }),
        confirmText: t('pricing.plans.changeConfirm'),
      })
      if (!ok) return
      setMine(await api.subscriptionChange(plan.id, interval))
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pricing.orderFailed'))
    } finally {
      setBusy(null)
    }
  }

  // Creem 客户门户：改卡、发票、期末取消
  async function manage() {
    setError('')
    setBusy('portal')
    try {
      const res = await api.subscriptionPortal()
      window.open(res.url, '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pricing.orderFailed'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="pf-pricing-plans" id="plans" aria-label={t('pricing.plans.title')}>
      <header className="pf-pricing-section-head is-row">
        <div>
          <h2>{t('pricing.plans.title')}</h2>
          <p>{t('pricing.plans.lead')}</p>
        </div>
        <div className="pf-pricing-interval" role="tablist" aria-label={t('pricing.plans.interval')}>
          {(['month', 'year'] as PlanInterval[]).map((iv) => (
            <button
              key={iv}
              type="button"
              role="tab"
              aria-selected={interval === iv}
              className={interval === iv ? 'is-active' : ''}
              onClick={() => setPlanInterval(iv)}
            >
              {t(`pricing.plans.${iv}`)}
              {iv === 'year' && saving > 0 ? <em>{t('pricing.plans.save', { n: saving })}</em> : null}
            </button>
          ))}
        </div>
      </header>

      {live ? (
        <div className="pf-pricing-plan-current">
          <span>
            {t('pricing.plans.current', { plan: mine?.plan_name || mine?.plan_id || '' })}
            {mine?.current_period_end
              ? ` · ${t(mine.cancel_at_period_end ? 'pricing.plans.endsAt' : 'pricing.plans.renewsAt', {
                  date: new Date(mine.current_period_end).toLocaleDateString(),
                })}`
              : ''}
          </span>
          <span>{t('pricing.plans.remaining', { n: formatCredits(mine?.sub_credit_fen) })}</span>
          {mine?.can_manage ? (
            <button type="button" className="pf-pricing-plan-manage" disabled={busy === 'portal'} onClick={() => void manage()}>
              {t('pricing.plans.manage')}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="pf-error pf-pricing-error">{error}</p> : null}

      <div className="pf-pricing-plan-grid">
        {plans.map((plan) => {
          const isCurrent = live && mine?.plan_id === plan.id && mine?.interval === interval
          const purchasable = plan.purchasable?.[interval]
          const perMonth = monthlyPrice(plan, interval)
          const list = interval === 'month' ? plan.list_price_month : undefined
          return (
            <article key={plan.id} className={`pf-pricing-sku-card pf-pricing-plan-card${plan.recommended ? ' is-recommended' : ''}`}>
              {plan.recommended ? <span className="pf-pricing-rec-badge">{t('pricing.recommended')}</span> : null}
              <p className="pf-pricing-sku-tier">{plan.name}</p>
              <div className="pf-pricing-sku-price">
                <strong>{formatMoney(perMonth, { short: true })}</strong>
                <span className="pf-pricing-plan-per">{t('pricing.plans.perMonth')}</span>
              </div>
              <p className="pf-pricing-plan-billed">
                {list ? <s>{formatMoney(list, { short: true })}</s> : null}
                {interval === 'year'
                  ? t('pricing.plans.billedYearly', { amount: formatMoney(plan.price_year, { short: true }) })
                  : t('pricing.plans.billedMonthly')}
              </p>
              <ul className="pf-pricing-plan-features">
                <li>
                  <Check size={14} aria-hidden />
                  {t('pricing.plans.credits', { n: formatCredits(plan.credits_per_month) })}
                </li>
                <li>
                  <Check size={14} aria-hidden />
                  {t('pricing.plans.concurrent', { n: plan.max_concurrent })}
                </li>
                <li>
                  <Check size={14} aria-hidden />
                  {t('pricing.plans.expire')}
                </li>
              </ul>
              <button
                type="button"
                className={`pf-pricing-sku-cta${plan.recommended ? ' is-primary' : ''}`}
                disabled={Boolean(isCurrent) || !purchasable || busy === plan.id}
                onClick={() => void choose(plan)}
              >
                {isCurrent
                  ? t('pricing.plans.currentCta')
                  : !purchasable
                    ? t('common.comingSoon')
                    : live
                      ? t('pricing.plans.switchCta')
                      : t('pricing.plans.subscribeCta')}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
