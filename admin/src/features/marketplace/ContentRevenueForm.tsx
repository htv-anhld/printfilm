import { tz } from '@/i18n/zhText'
import { useState, type FormEvent } from 'react'
import { request, type Item } from './api'

export default function ContentRevenueForm({ item, kind }: { item: Item; kind: 'work' | 'series' | 'series_episode' }) {
  const [saved, setSaved] = useState<number | null>(typeof item.share_bps === 'number' ? item.share_bps : null)
  const [value, setValue] = useState(saved === null ? '' : String(saved))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    if (value !== '' && (!/^\d+$/.test(value) || Number(value) > 10000)) { setMessage(tz("请输入 0～10000 的整数，或留空恢复继承比例。")); return }
    if (!reason.trim()) { setMessage(tz("请填写修改原因。")); return }
    setBusy(true); setMessage('')
    try {
      const result = await request<{ share_bps: number | null }>(`/api/admin/marketplace/content-revenue/${kind}/${item.id}`, 'PATCH', {
        version: item.version, previous_share_bps: saved, share_bps: value === '' ? null : Number(value), reason: reason.trim(),
      })
      setSaved(result.share_bps); setReason(''); setMessage(tz("已保存，仅在后续提交发布时采用；现有发布版本及历史收益保持不变。"))
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  return <form className="market-ops-inline-form" onSubmit={save}>
    <h3>{kind === 'series_episode' ? tz("当前分集分成") : kind === 'series' ? tz("系列默认分成") : tz("作品分成")}{tz("（仅后台运营可修改）")}</h3>
    <p>{tz("留空继承")}{kind === 'series_episode' ? tz("系列及平台") : tz("平台")}{tz("比例。仅用于后续提交的发布版本，不追溯已发布版本及历史订单。")}</p>
    <label>{tz("平台抽成（万分比）")}<input type="text" inputMode="numeric" value={value} onChange={event => setValue(event.target.value)} placeholder={tz("留空继承")} /></label>
    {value !== '' && /^\d+$/.test(value) && Number(value) <= 10000 && <p>{tz("平台")} {Number(value) / 100}{tz("% / 创作者")} {(10000 - Number(value)) / 100}%</p>}
    <label>{tz("修改原因")}<input value={reason} onChange={event => setReason(event.target.value)} required maxLength={2000} /></label>
    <button type="submit" disabled={busy}>{busy ? tz("保存中…") : tz("保存分成")}</button>
    {message && <p role="status">{message}</p>}
  </form>
}
