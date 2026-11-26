import { useEffect, useMemo, useState } from 'react'
import { request } from './api'
import { marketText as mt, marketplaceVietnamese } from './translate'
import { useMarketplaceLocale } from './useMarketplaceLocale'
export type Category = { code: string; name_zh: string; name_en: string; label: string; enabled: boolean }
export function useCategories() {
  const locale = useMarketplaceLocale()
  const [items, setItems] = useState<Category[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    request<{ items: Category[] }>('/categories').then(value => { if (active) { setItems(value.items); setError('') } })
      .catch(e => { if (active) setError(mt('分类加载失败：{0}，请刷新重试。', [e.message])) })
    return () => { active = false }
  }, [locale])
  const names = useMemo(() => items.map(item => item.code), [items])
  const label = (code: string, original?: { category?: string; category_labels?: { zh: string; en: string } } | null) => {
    const item = items.find(item => item.code === code)
    // 后台分类只维护中英文；越南语优先用内置分类的系统译文，没有再用英文名
    const vi = (zh?: string) => locale === 'vi' && zh ? marketplaceVietnamese[zh] : undefined
    return item ? (vi(item.name_zh) || (locale !== 'zh' ? item.name_en || item.name_zh : item.name_zh))
      : vi(original?.category_labels?.zh) || original?.category_labels?.[locale === 'zh' ? 'zh' : 'en'] || original?.category || code
  }
  return { items, names, label, error }
}
