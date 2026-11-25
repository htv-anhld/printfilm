import { tr } from '../../../i18n'
import { useEffect, useRef, useState } from 'react'
import { X, Scissors, Volume2, Film, Image, Gauge } from 'lucide-react'
import { printfilmStudioApi } from '../api'
import type { MediaOperation, ProjectAsset } from '../types'
import { readProjectMedia } from './projectMedia'

/** 操作名在读取时按当前语言取文案（getter）。 */
const MEDIA_ACTIONS: Record<MediaOperation, string> = { get trim() { return tr('studioCanvas.mediaEditor.action.trim') }, get extract_audio() { return tr('studioCanvas.mediaEditor.action.extract_audio') }, get separate() { return tr('studioCanvas.mediaEditor.action.separate') }, get mute() { return tr('studioCanvas.mediaEditor.action.mute') }, get speed() { return tr('studioCanvas.mediaEditor.action.speed') }, get frame() { return tr('studioCanvas.mediaEditor.action.frame') }, get frames() { return tr('studioCanvas.mediaEditor.action.frames') } }

export function MediaEditor({ projectId, assetId, url, kind, initial, initialStart = 0, headers, onClose, onComplete }: { projectId: number; assetId?: number; url: string; kind: 'audio' | 'video'; initial: MediaOperation; initialStart?: number; headers: HeadersInit; onClose: () => void; onComplete: (assets: ProjectAsset[]) => void }) {
  const [operation, setOperation] = useState(initial)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const media = useRef<HTMLMediaElement | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => { if (media.current) media.current.playbackRate = speed }, [speed])
  const loaded = () => { const value = media.current?.duration || 0; if (Number.isFinite(value)) { setDuration(value); setEnd(value); if (media.current && initialStart > 0) media.current.currentTime = Math.min(initialStart, value) } }
  const seek = (value: number) => { setStart(value); if (media.current) media.current.currentTime = value }
  const execute = async () => {
    if (controller.current) return
    const abort = new AbortController(); controller.current = abort; setBusy(true); setError('')
    try {
      const blob = await readProjectMedia(url, projectId, assetId, abort.signal)
      if (blob.size > 100 * 1024 * 1024) throw new Error(tr('studioCanvas.mediaEditor.tooLarge'))
      const result = await printfilmStudioApi.editMedia(projectId, new File([blob], 'source.media', { type: blob.type }), { operation, start: operation === 'trim' || operation === 'frame' ? start : 0, end: operation === 'trim' ? end : undefined, speed: operation === 'speed' ? speed : 1 }, headers, abort.signal)
      if (!abort.signal.aborted) { onComplete(result.assets); onClose() }
    } catch (reason) { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : tr('studioCanvas.mediaEditor.failed')) }
    finally { if (controller.current === abort) { controller.current = null; setBusy(false) } }
  }
  const choices: MediaOperation[] = kind === 'audio' ? ['trim', 'speed'] : ['trim', 'extract_audio', 'separate', 'mute', 'speed', 'frame', 'frames']
  return <div className="pf-edit-overlay"><section className="pf-media-editor" role="dialog" aria-modal="true" aria-label={tr('studioCanvas.mediaEditor.dialog')}>
    <header><b>{MEDIA_ACTIONS[operation]}</b><button onClick={() => { controller.current?.abort(); onClose() }} aria-label={tr('studioCanvas.mediaEditor.close')}><X size={18} /></button></header>
    <nav>{choices.map((item) => <button disabled={busy} className={operation === item ? 'is-active' : ''} key={item} onClick={() => { setOperation(item); setError('') }}>{item === 'trim' ? <Scissors size={14} /> : item === 'speed' ? <Gauge size={14} /> : item.includes('frame') ? <Image size={14} /> : item === 'extract_audio' ? <Volume2 size={14} /> : <Film size={14} />}{MEDIA_ACTIONS[item]}</button>)}</nav>
    {kind === 'video' ? <video ref={(element) => { media.current = element }} src={url} controls onLoadedMetadata={loaded} onTimeUpdate={() => { if (operation === 'trim' && media.current && media.current.currentTime >= end && !media.current.paused) { media.current.pause(); media.current.currentTime = start } }} onPlay={() => { if (operation === 'trim' && media.current && (media.current.currentTime < start || media.current.currentTime >= end)) media.current.currentTime = start }} onError={() => setError(tr('studioCanvas.mediaEditor.cantPlay'))} /> : <audio ref={(element) => { media.current = element }} src={url} controls onLoadedMetadata={loaded} />}
    {(operation === 'trim' || operation === 'frame') && <div className="pf-media-range"><label>{tr('studioCanvas.mediaEditor.startAt', { s: start.toFixed(2) })}<input disabled={busy} type="range" min="0" max={Math.max(0, duration - .05)} step="0.01" value={start} onChange={(event) => seek(Number(event.target.value))} /><input aria-label={tr('studioCanvas.mediaEditor.start')} disabled={busy} type="number" min="0" max={duration} step="0.01" value={start} onChange={(event) => seek(Number(event.target.value))} /></label>{operation === 'trim' && <label>{tr('studioCanvas.mediaEditor.end')}<input type="range" min={Math.min(duration, start + .01)} max={duration} step="0.01" value={end} disabled={busy} onChange={(event) => setEnd(Number(event.target.value))} /><input aria-label={tr('studioCanvas.mediaEditor.end')} disabled={busy} type="number" min={start} max={duration} step="0.01" value={end} onChange={(event) => setEnd(Number(event.target.value))} /></label>}</div>}
    {operation === 'speed' && <label>{tr('studioCanvas.mediaEditor.speedAt', { x: speed.toFixed(1) })}<input disabled={busy} type="range" min="0.1" max="4" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></label>}
    <p>{operation === 'frames' ? tr('studioCanvas.mediaEditor.framesHint') : tr('studioCanvas.mediaEditor.resultHint')}</p>
    {error && <p role="alert" className="pf-editor-error">{error}</p>}
    <footer><span>{tr('studioCanvas.mediaEditor.limits')}</span>{busy ? <button onClick={() => controller.current?.abort()}>{tr('studioCanvas.mediaEditor.cancel')}</button> : <button className="is-primary" disabled={operation === 'trim' && (!duration || !(end > start) || end > duration)} onClick={() => void execute()}>{tr('studioCanvas.mediaEditor.apply')}</button>}</footer>
  </section></div>
}
