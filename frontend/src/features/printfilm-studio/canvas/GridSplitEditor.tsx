import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { printfilmStudioApi } from '../api'
import type { ProjectAsset } from '../types'
import { gridTiles } from './gridSplit'
import { readProjectMedia } from './projectMedia'
import { tr } from '../../../i18n'

export function GridSplitEditor({ projectId, assetId, url, title, headers, onClose, onComplete }: {
  projectId: number; assetId?: number; url: string; title: string; headers: HeadersInit; onClose: () => void; onComplete: (assets: ProjectAsset[], columns: number) => void
}) {
  const [rows, setRows] = useState(3), [columns, setColumns] = useState(3)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [busy, setBusy] = useState(false), [completed, setCompleted] = useState(0), [error, setError] = useState('')
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [url])
  let valid = false
  try { gridTiles(size.width, size.height, rows, columns); valid = true } catch { /* preview awaits metadata */ }
  const split = async () => {
    if (busy || !valid) return
    const controller = new AbortController(); abort.current = controller
    setBusy(true); setError(''); setCompleted(0)
    let bitmap: ImageBitmap | undefined
    const outputs: ProjectAsset[] = []
    try {
      bitmap = await createImageBitmap(await readProjectMedia(url, projectId, assetId, controller.signal))
      const tiles = gridTiles(bitmap.width, bitmap.height, rows, columns)
      const canvas = window.document.createElement('canvas'), context = canvas.getContext('2d')
      if (!context) throw new Error(tr('studioCanvas.gridSplitEditor.browser'))
      for (const tile of tiles) {
        controller.signal.throwIfAborted()
        canvas.width = tile.width; canvas.height = tile.height
        context.drawImage(bitmap, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height)
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(tr('studioCanvas.gridSplitEditor.encode'))), 'image/png'))
        outputs.push(await printfilmStudioApi.uploadAsset(projectId, new File([blob], `${title}-${tile.row + 1}-${tile.column + 1}.png`, { type: 'image/png' }), headers, controller.signal))
        controller.signal.throwIfAborted(); setCompleted(outputs.length)
      }
      onComplete(outputs, columns); onClose()
    } catch (reason) { if (!controller.signal.aborted) setError(`${reason instanceof Error ? reason.message : tr('studioCanvas.gridSplitEditor.failed')}${outputs.length ? tr('studioCanvas.gridSplitEditor.partialKept',{n:outputs.length}) : ''}`) }
    finally { bitmap?.close(); if (!controller.signal.aborted) setBusy(false) }
  }
  return <div className="pf-edit-overlay"><section className="pf-grid-split" role="dialog" aria-modal="true" aria-label={tr('studioCanvas.gridSplitEditor.title')}><header><b>{tr('studioCanvas.gridSplitEditor.title')}</b><span>{tr('studioCanvas.gridSplitEditor.keepOriginal')}</span><button aria-label={tr('studioCanvas.gridSplitEditor.close')} onClick={onClose}><X size={18} /></button></header>
    <div className="pf-grid-presets">{[2, 3, 4, 5].map((count) => <button disabled={busy} key={count} aria-pressed={rows === count && columns === count} onClick={() => { setRows(count); setColumns(count) }}><span style={{ display: 'grid', gridTemplateColumns: `repeat(${count},1fr)` }}>{Array.from({ length: count * count }, (_, i) => <i key={i} />)}</span>{tr('studioCanvas.gridSplitEditor.preset',{n:count * count})}<small>{count} × {count}</small></button>)}</div>
    <div className="pf-grid-dimensions"><label>{tr('studioCanvas.gridSplitEditor.rows')}<input aria-label={tr('studioCanvas.gridSplitEditor.rowsAria')} disabled={busy} type="number" min="1" max="10" value={rows} onChange={(event) => setRows(Number(event.target.value))} /></label><span>×</span><label>{tr('studioCanvas.gridSplitEditor.cols')}<input aria-label={tr('studioCanvas.gridSplitEditor.colsAria')} disabled={busy} type="number" min="1" max="10" value={columns} onChange={(event) => setColumns(Number(event.target.value))} /></label></div>
    <div className="pf-grid-preview"><img src={url} alt={tr('studioCanvas.gridSplitEditor.preview')} onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setError(tr('studioCanvas.gridSplitEditor.loadFailed'))} />{valid && <div style={{ gridTemplateColumns: `repeat(${columns},1fr)`, gridTemplateRows: `repeat(${rows},1fr)` }}>{Array.from({ length: rows * columns }, (_, i) => <span key={i}>{i + 1}</span>)}</div>}</div>
    <p>{tr('studioCanvas.gridSplitEditor.hint',{n:valid ? rows * columns : '—'})}</p>{error && <p role="alert">{error}</p>}
    <button className="pf-grid-submit" disabled={busy || !valid} onClick={() => void split()}>{busy ? tr('studioCanvas.gridSplitEditor.splitting',{done:completed,total:rows * columns}) : tr('studioCanvas.gridSplitEditor.submit')}</button>
  </section></div>
}
