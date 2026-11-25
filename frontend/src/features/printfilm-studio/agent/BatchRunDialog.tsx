import { tr } from '../../../i18n'
import { useEffect, useRef, useState } from 'react'
import { Play, X } from 'lucide-react'
import type { MediaModelOption } from '../../../api'
import { points } from '../../../lib/points'
import type { BatchQuote, BatchSettings } from './batchGeneration'
import type { StoryNode } from './storyWorkflow'
import { printfilmStudioApi } from '../api'
import { readNodeDefaults } from '../workspacePreferences'

function modelOptions(model: MediaModelOption | undefined, kind: 'image' | 'video') {
  const resolutions = model?.available_resolutions?.length ? model.available_resolutions : model?.allowed_resolutions?.length ? model.allowed_resolutions : kind === 'image' ? ['1K', '2K'] : ['720p', '1080p']
  const ratios = model?.allowed_aspect_ratios?.length ? model.allowed_aspect_ratios : ['16:9', '9:16', '1:1', '3:2', '2:3']
  return { resolutions, ratios }
}
function modelDefaults(model: MediaModelOption | undefined, kind: 'image' | 'video'): Partial<BatchSettings> {
  const { resolutions, ratios } = modelOptions(model, kind)
  return { [`${kind}Model`]: model?.id || '', [`${kind}Resolution`]: resolutions.includes(model?.defaults?.resolution || '') ? model!.defaults!.resolution : resolutions[0], [`${kind}Ratio`]: ratios.includes(kind==='image' ? '2:3' : '16:9') ? (kind==='image' ? '2:3' : '16:9') : ratios.includes(model?.defaults?.aspect_ratio || '') ? model!.defaults!.aspect_ratio : ratios[0], ...(kind === 'video' ? { duration: String(Math.min(model?.duration_max || 15, Math.max(model?.duration_min || 2, model?.defaults?.duration || 5))) } : {}) }
}

export async function batchDefaults(imageModels: MediaModelOption[], videoModels: MediaModelOption[]): Promise<BatchSettings> {
  const saved = readNodeDefaults(), config = await printfilmStudioApi.agentConfig()
  return { ...modelDefaults(imageModels.find(model => model.id === saved.image) || imageModels[0], 'image'), ...modelDefaults(videoModels.find(model => model.id === saved.video) || videoModels[0], 'video'), textModel: saved.text || config.models[0]?.id } as BatchSettings
}

export function BatchRunDialog({ nodes, imageModels, videoModels, balance, onQuote, onRun, onClose }: {
  nodes: StoryNode[]; imageModels: MediaModelOption[]; videoModels: MediaModelOption[]; balance?: number
  onQuote: (settings: BatchSettings) => Promise<BatchQuote>; onRun: (quote: BatchQuote) => Promise<void>; onClose: () => void
}) {
  const [quote, setQuote] = useState<BatchQuote | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const quoteRef = useRef(onQuote); quoteRef.current = onQuote
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setQuote(null); setError('')
    void batchDefaults(imageModels, videoModels).then(settings => quoteRef.current(settings)).then(value => { if (active) setQuote(value) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : tr('studioCanvas.batchRunDialog.quoteFailed')) })
    return () => { active = false }
  }, [retry])
  const run = async () => {
    if (!quote || busy) return
    setBusy(true); setError('')
    try { await onRun(quote); onClose() }
    catch (reason) { setError(reason instanceof Error ? reason.message : tr('studioCanvas.batchRunDialog.submitFailed')) }
    finally { setBusy(false) }
  }
  return <div className="pf-batch-overlay"><section className="pf-batch-dialog" role="dialog" aria-modal="true" aria-label={tr('studioCanvas.batchRunDialog.dialog')} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && !busy) onClose() }}>
    <header><b>{tr('studioCanvas.batchRunDialog.title', { count: nodes.length })}</b><button disabled={busy} aria-label={tr('studioCanvas.batchRunDialog.close')} onClick={onClose}><X size={19} /></button></header>
    <p>{tr('studioCanvas.batchRunDialog.description')}</p>
    {quote ? <div className="pf-batch-quote">{(['text', 'image', 'video'] as const).map(kind => { const items = quote.items.filter(item => item.input.kind === kind); return items.length ? <div key={kind}><span>{tr('studioCanvas.batchRunDialog.kindCount', { kind: {text:tr('studioCanvas.batchRunDialog.text'),image:tr('studioCanvas.batchRunDialog.image'),video:tr('studioCanvas.batchRunDialog.video')}[kind], count: items.length })}</span><b>{points(Math.round(items.reduce((sum, item) => sum + item.yuan, 0) * 100))}</b></div> : null })}<ol>{quote.items.map(item => <li key={item.input.id}>{item.input.label}</li>)}</ol><strong>{tr('studioCanvas.batchRunDialog.estimate', { amount: points(Math.round(quote.total * 100)) })}</strong><small>{tr('studioCanvas.batchRunDialog.balance', { balance: points(balance === undefined ? undefined : Math.round(balance * 100)), text: points(5) })}</small></div> : !error && <p role="status">{tr('studioCanvas.batchRunDialog.quoting')}</p>}
    {error && <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>{tr('studioCanvas.batchRunDialog.requote')}</button></p>}
    <footer><button disabled={busy} onClick={onClose}>{tr('studioCanvas.batchRunDialog.cancel')}</button><button className="is-primary" disabled={busy || !quote || balance !== undefined && quote.total > balance} onClick={() => void run()}><Play size={15} />{busy ? tr('studioCanvas.batchRunDialog.submitting') : tr('studioCanvas.batchRunDialog.run')}</button></footer>
  </section></div>
}
