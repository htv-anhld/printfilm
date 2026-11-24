import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Template } from '../api'
import BillingErrorNotice from '../components/billing/BillingErrorNotice'
import AppShell from '../components/layout/AppShell'
import PillTabs from '../components/ui/PillTabs'
import { CATEGORY_ORDER, HOME_CATEGORY_LABELS } from '../lib/categories'
import { useI18n } from '../i18n'
import { templateCategoryLabel } from './studio/categoryLabel'

export default function TemplatesPage() {
  const nav = useNavigate()
  const { t } = useI18n()
  const [templates, setTemplates] = useState<Template[]>([])
  const [error, setError] = useState('')
  const [category, setCategory] = useState('全部')
  const [q, setQ] = useState('')

  useEffect(() => {
    api
      .templates()
      .then(setTemplates)
      .catch((e) => setError(String(e.message || e)))
  }, [])

  const categoryKeys = useMemo(() => {
    const found = new Set<string>()
    for (const tpl of templates) {
      for (const c of tpl.category || []) {
        if (CATEGORY_ORDER.includes(c)) found.add(c)
      }
    }
    return ['全部', ...CATEGORY_ORDER.filter((c) => found.has(c))]
  }, [templates])

  // 筛选 key 保持中文原值，只翻译展示名
  const labelOf = (k: string) => (k === '全部' ? t('studio.category.all') : HOME_CATEGORY_LABELS[k] || k)
  const categoryLabels = categoryKeys.map(labelOf)
  const labelToKey = new Map<string, string>()
  for (const k of categoryKeys) labelToKey.set(labelOf(k), k)

  const filtered = useMemo(() => {
    let list = templates
    if (category !== '全部') list = list.filter((tpl) => (tpl.category || []).includes(category))
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      list = list.filter(
        (tpl) => tpl.name.toLowerCase().includes(s) || tpl.description.toLowerCase().includes(s),
      )
    }
    return list
  }, [templates, category, q])

  function openTemplate(t: Template) {
    if (!localStorage.getItem('token')) {
      nav('/auth')
      return
    }
    nav(`/studio/new?template=${t.id}`)
  }

  return (
    <AppShell active="templates">
      <div className="pf-section-head">
        <div>
          <h2>{t('studio.templates.title')}</h2>
          <p>{t('studio.templates.subtitle')}</p>
        </div>
      </div>
      <div className="pf-search" style={{ maxWidth: 420, marginBottom: '1rem' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('studio.templates.searchPlaceholder')}
        />
      </div>
      <PillTabs
        items={categoryLabels}
        value={labelOf(category)}
        onChange={(label) => setCategory(labelToKey.get(label) || '全部')}
        ariaLabel={t('studio.templates.categoryAria')}
      />
      {error ? <BillingErrorNotice message={error} /> : null}
      <div className="pf-template-grid" style={{ marginTop: '1rem' }}>
        {filtered.map((tpl) => (
          <button key={tpl.id} type="button" className="pf-template-card" onClick={() => openTemplate(tpl)}>
            <img src={api.assetUrl(tpl.preview_cover)} alt="" />
            <div className="body">
              <h3>{tpl.name}</h3>
              <p>{tpl.description}</p>
              <div className="pf-tags">
                {tpl.category.map((c, i) => (
                  <span key={c}>{templateCategoryLabel(t, tpl, i)}</span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? <p className="pf-muted">{t('studio.templates.empty')}</p> : null}
    </AppShell>
  )
}
