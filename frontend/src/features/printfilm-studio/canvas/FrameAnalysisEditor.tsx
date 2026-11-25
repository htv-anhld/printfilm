import { useEffect, useRef, useState } from 'react'
import { Download, Film, X } from 'lucide-react'
import { printfilmStudioApi } from '../api'
import type { FrameAnalysisReport, ProjectAsset } from '../types'
import './frameAnalysis.css'
import { readProjectMedia } from './projectMedia'
import { tr } from '../../../i18n'

export function FrameAnalysisEditor({ projectId, assetId, url, report, headers, writable, onClose, onComplete }: { projectId: number; assetId?: number; url: string; report?: FrameAnalysisReport; headers: HeadersInit; writable: boolean; onClose: () => void; onComplete: (report: FrameAnalysisReport, assets: ProjectAsset[]) => void }) {
  const [result, setResult] = useState(report)
  const [detector, setDetector] = useState<'adaptive' | 'content'>(report?.detector || 'adaptive')
  const [threshold, setThreshold] = useState(report?.threshold || 3)
  const [minimum, setMinimum] = useState(report?.minimum || .6)
  const [frames, setFrames] = useState(true), [clips, setClips] = useState(true), [audio, setAudio] = useState(true)
  const [selected, setSelected] = useState(0), [mode, setMode] = useState<'frame' | 'clip'>('frame')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const analyze = async () => {
    if (controller.current || !writable) return
    const abort = new AbortController(); controller.current = abort; setBusy(true); setError('')
    try {
      const blob = await readProjectMedia(url, projectId, assetId, abort.signal)
      if (blob.size > 100 * 1024 * 1024) throw new Error(tr('studioCanvas.frameAnalysisEditor.tooLarge'))
      const output = await printfilmStudioApi.analyzeMedia(projectId, new File([blob], 'source.media', { type: blob.type }), { detector, threshold, minimum, frames, clips, audio }, headers, abort.signal)
      if (!abort.signal.aborted) { setResult(output.report); setSelected(0); setMode(frames ? 'frame' : 'clip'); onComplete(output.report, output.assets) }
    } catch (reason) { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : tr('studioCanvas.frameAnalysisEditor.failed')) }
    finally { if (controller.current === abort) { controller.current = null; setBusy(false) } }
  }
  const download = () => {
    const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = objectUrl; link.download = tr('studioCanvas.frameAnalysisEditor.fileName'); link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
  const shot = result?.shots[selected], preview = mode === 'clip' ? shot?.clip : shot?.frame
  return <div className="pf-edit-overlay"><section className="pf-frame-analysis" role="dialog" aria-modal="true" aria-label={tr('studioCanvas.frameAnalysisEditor.title')}>
    <header><b><Film size={18} /> {tr('studioCanvas.frameAnalysisEditor.title')}</b><button aria-label={tr('studioCanvas.frameAnalysisEditor.close')} onClick={() => { controller.current?.abort(); onClose() }}><X size={18} /></button></header>
    <fieldset disabled={busy || !writable} className="pf-analysis-settings">
      <label>{tr('studioCanvas.frameAnalysisEditor.detector')}<select aria-label={tr('studioCanvas.frameAnalysisEditor.detector')} value={detector} onChange={(event) => { const value = event.target.value as 'adaptive' | 'content'; setDetector(value); setThreshold(value === 'adaptive' ? 3 : .28) }}><option value="adaptive">{tr('studioCanvas.frameAnalysisEditor.adaptive')}</option><option value="content">{tr('studioCanvas.frameAnalysisEditor.content')}</option></select></label>
      <label>{tr('studioCanvas.frameAnalysisEditor.threshold')}<input aria-label={tr('studioCanvas.frameAnalysisEditor.threshold')} type="number" min={.01} max={detector === 'adaptive' ? 10 : 1} step={detector === 'adaptive' ? .1 : .01} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>
      <label>{tr('studioCanvas.frameAnalysisEditor.minShot')}<input aria-label={tr('studioCanvas.frameAnalysisEditor.minShotAria')} type="number" min={.1} max={60} step={.1} value={minimum} onChange={(event) => setMinimum(Number(event.target.value))} /></label>
      <label><input type="checkbox" checked={frames} onChange={(event) => setFrames(event.target.checked)} />{tr('studioCanvas.frameAnalysisEditor.frames')}</label><label><input type="checkbox" checked={clips} onChange={(event) => setClips(event.target.checked)} />{tr('studioCanvas.frameAnalysisEditor.clips')}</label><label><input type="checkbox" checked={audio} onChange={(event) => setAudio(event.target.checked)} />{tr('studioCanvas.frameAnalysisEditor.audio')}</label>
    </fieldset>
    <div className="pf-analysis-content">
      {result ? <><nav aria-label={tr('studioCanvas.frameAnalysisEditor.shots')}>{result.shots.map((item, index) => <button key={item.index} className={selected === index ? 'is-active' : ''} onClick={() => setSelected(index)}>{item.frame?.url && <img src={item.frame.url} alt="" />}<span><b>{tr('studioCanvas.frameAnalysisEditor.shot',{n:item.index})}</b><small>{tr('studioCanvas.frameAnalysisEditor.range',{start:item.start.toFixed(2),end:item.end.toFixed(2),dur:item.duration.toFixed(2)})}</small></span></button>)}</nav><main><div className="pf-analysis-tabs"><button className={mode === 'frame' ? 'is-active' : ''} disabled={!shot?.frame} onClick={() => setMode('frame')}>{tr('studioCanvas.frameAnalysisEditor.frames')}</button><button className={mode === 'clip' ? 'is-active' : ''} disabled={!shot?.clip} onClick={() => setMode('clip')}>{tr('studioCanvas.frameAnalysisEditor.clips')}</button><button onClick={download}><Download size={14} /> {tr('studioCanvas.frameAnalysisEditor.download')}</button></div>{preview?.url ? mode === 'clip' ? <video key={preview.url} controls src={preview.url} /> : <img src={preview.url} alt={tr('studioCanvas.frameAnalysisEditor.midFrame',{n:String(shot?.index ?? '')})} /> : <p>{tr('studioCanvas.frameAnalysisEditor.noMedia')}</p>}{result.audio?.url && <label>{tr('studioCanvas.frameAnalysisEditor.fullAudio')}<audio controls src={result.audio.url} /></label>}{!result.has_audio && <p>{tr('studioCanvas.frameAnalysisEditor.noAudio')}</p>}</main></> : <main><video src={url} controls /><p>{tr('studioCanvas.frameAnalysisEditor.intro')}</p></main>}
    </div>
    {error && <p role="alert" className="pf-editor-error">{error}</p>}
    <footer><span>{result ? tr('studioCanvas.frameAnalysisEditor.summary',{n:result.shots.length,dur:result.duration.toFixed(2)}) : tr('studioCanvas.frameAnalysisEditor.localNote')}</span>{busy ? <button onClick={() => controller.current?.abort()}>{tr('studioCanvas.frameAnalysisEditor.cancel')}</button> : writable && <button className="is-primary" disabled={!url || threshold <= 0 || minimum < .1 || minimum > 60 || threshold > (detector === 'content' ? 1 : 10)} onClick={() => void analyze()}>{result ? tr('studioCanvas.frameAnalysisEditor.reanalyze') : tr('studioCanvas.frameAnalysisEditor.start')}</button>}</footer>
  </section></div>
}
