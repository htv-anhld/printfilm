import { tr } from '../../../i18n'
import { useEffect, useRef, useState } from 'react'
import { Box, Camera, Film, Pause, Play, Plus, Save, Trash2, X } from 'lucide-react'
import { normalizeScene, renderScene, sceneAtTime, type DirectorScene, type SceneObject } from './scene3d'
import { canvasBlob } from './maskMedia'

export function DirectorEditor({ initial, writable, onSave, onExport, onClose }: { initial: unknown; writable: boolean; onSave: (scene: DirectorScene) => void; onExport: (scene: DirectorScene, blob: Blob, kind: 'image' | 'video') => Promise<void>; onClose: () => void }) {
  const [scene, setScene] = useState(() => normalizeScene(initial))
  const [selected, setSelected] = useState<string | null>(scene.objects[0]?.id || null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [previewFrame, setPreviewFrame] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)
  const alive = useRef(true)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const selectedObject = scene.objects.find((o) => o.id === selected)
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (recorderRef.current?.state === 'recording') recorderRef.current.stop() } }, [])
  useEffect(() => { if (canvas.current && !busy) renderScene(canvas.current, previewFrame ? sceneAtTime(scene, time) : scene) }, [scene, time, previewFrame, busy])
  useEffect(() => {
    if (!playing || busy) return
    const start = performance.now() - time * 1000
    let frame = 0
    const tick = () => { const next = (performance.now() - start) / 1000; setTime(Math.min(next, scene.duration)); if (next >= scene.duration) { setPlaying(false); return }; frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // The playback clock captures the scrub position only when playback starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, busy, scene.duration])
  const changeObject = (key: keyof SceneObject, value: string | number) => { setPreviewFrame(false); setScene((current) => ({ ...current, objects: current.objects.map((o) => o.id === selected ? { ...o, [key]: value } : o) })) }
  const add = (kind: 'person' | 'box') => { const id = crypto.randomUUID(); setScene((current) => ({ ...current, objects: [...current.objects, { id, name: kind === 'person' ? tr('studioCanvas.directorEditor.personN', { n: current.objects.length + 1 }) : tr('studioCanvas.directorEditor.prop'), kind, x: current.objects.length * .7, y: 0, z: 0, rotation: 0, scale: 1, pose: 0, color: kind === 'person' ? '#b7a0ce' : '#a0b8ce' }] })); setSelected(id); setPreviewFrame(false) }
  const recordFrame = () => { const displayed = previewFrame ? sceneAtTime(scene, time) : scene; const frame = { time: Math.round(time * 10) / 10, camera: structuredClone(displayed.camera), objects: structuredClone(displayed.objects) }; setScene((current) => ({ ...current, frames: [...current.frames.filter((f) => f.time !== frame.time), frame].sort((a, b) => a.time - b.time) })) }
  const exportMedia = async (kind: 'image' | 'video') => {
    if (!canvas.current || busy || !writable) return
    setBusy(true); setPlaying(false); setError('')
    try {
      const el = canvas.current
      if (kind === 'image') { renderScene(el, previewFrame ? sceneAtTime(scene, time) : scene); await onExport(scene, await canvasBlob(el), 'image'); return }
      if (scene.frames.length < 2) throw new Error(tr('studioCanvas.directorEditor.needFrames'))
      if (typeof MediaRecorder === 'undefined' || !el.captureStream) throw new Error(tr('studioCanvas.directorEditor.noExport'))
      const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((mime) => MediaRecorder.isTypeSupported(mime))
      if (!mimeType) throw new Error(tr('studioCanvas.directorEditor.noWebm'))
      const stream = el.captureStream(24)
      try {
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 }); recorderRef.current = recorder
        const chunks: Blob[] = []
        let hidden = false, frame = 0
        const visibility = () => { if (document.hidden && recorder.state === 'recording') { hidden = true; recorder.stop() } }
        document.addEventListener('visibilitychange', visibility)
        try {
          const blob = await new Promise<Blob>((resolve, reject) => {
            recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
            recorder.onerror = () => reject(new Error(tr('studioCanvas.directorEditor.encodeFailed')))
            recorder.onstop = () => hidden ? reject(new Error(tr('studioCanvas.directorEditor.hidden'))) : resolve(new Blob(chunks, { type: 'video/webm' }))
            renderScene(el, sceneAtTime(scene, 0)); recorder.start(250)
            const start = performance.now()
            const tick = () => {
              if (recorder.state !== 'recording') return
              const next = Math.min((performance.now() - start) / 1000, scene.duration)
              renderScene(el, sceneAtTime(scene, next)); setTime(next)
              if (next >= scene.duration || !alive.current) { recorder.stop(); return }
              frame = requestAnimationFrame(tick)
            }
            frame = requestAnimationFrame(tick)
          })
          if (alive.current) await onExport(scene, blob, 'video')
        } finally { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); if (recorder.state === 'recording') recorder.stop() }
      } finally { stream.getTracks().forEach((track) => track.stop()); recorderRef.current = null }
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : tr('studioCanvas.directorEditor.exportFailed')) }
    finally { if (alive.current) setBusy(false) }
  }
  return <div className="pf-workflow-backdrop"><section className="pf-workflow-dialog pf-director-dialog" role="dialog" aria-modal="true" aria-label={tr('studioCanvas.directorEditor.title')}><header><h2><Box size={20} />{tr('studioCanvas.directorEditor.title')}</h2><button disabled={busy} onClick={onClose} aria-label={tr('studioCanvas.directorEditor.close')}><X size={20} /></button></header><p>{tr('studioCanvas.directorEditor.intro')}</p>
    <div className="pf-director-layout"><div><canvas ref={canvas} width={1280} height={720} onPointerDown={(e) => { if (!writable || busy) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, yaw: scene.camera.yaw, pitch: scene.camera.pitch }; setPreviewFrame(false) }} onPointerMove={(e) => { if (!drag.current) return; const d = drag.current; setScene((current) => ({ ...current, camera: { ...current.camera, yaw: d.yaw + (e.clientX - d.x) * .3, pitch: Math.max(-10, Math.min(80, d.pitch + (e.clientY - d.y) * .2)) } })) }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} />
      <div className="pf-director-timeline"><button disabled={busy || !scene.frames.length} onClick={() => { if (time >= scene.duration) setTime(0); setPreviewFrame(true); setPlaying((value) => !value) }}>{playing ? <Pause size={16} /> : <Play size={16} />}</button><input aria-label={tr('studioCanvas.directorEditor.timeline')} type="range" min="0" max={scene.duration} step=".05" value={time} disabled={busy} onChange={(e) => { setTime(Number(e.target.value)); setPreviewFrame(true); setPlaying(false) }} /><span>{time.toFixed(1)}s / {scene.duration}s</span><button disabled={!writable || busy} onClick={recordFrame}><Plus size={16} />{tr('studioCanvas.directorEditor.record')}</button></div>
      <div className="pf-keyframes">{scene.frames.map((frame, index) => <span key={index}><button disabled={busy} onClick={() => { setTime(frame.time); setScene((current) => ({ ...current, camera: structuredClone(frame.camera), objects: structuredClone(frame.objects) })); setPreviewFrame(false); setPlaying(false) }}>{tr('studioCanvas.directorEditor.keyframeN', { time: frame.time.toFixed(1), n: index + 1 })}</button><button aria-label={tr('studioCanvas.directorEditor.deleteKeyframe', { n: index + 1 })} disabled={!writable || busy} onClick={() => setScene((current) => ({ ...current, frames: current.frames.filter((_, i) => i !== index) }))}><X size={12} /></button></span>)}</div></div>
    <fieldset disabled={!writable || busy}><legend>{tr('studioCanvas.directorEditor.sceneCamera')}</legend><div className="pf-mask-tools"><button disabled={scene.objects.length >= 30} onClick={() => add('person')}><Plus size={15} />{tr('studioCanvas.directorEditor.person')}</button><button disabled={scene.objects.length >= 30} onClick={() => add('box')}><Plus size={15} />{tr('studioCanvas.directorEditor.prop')}</button></div><select aria-label={tr('studioCanvas.directorEditor.objects')} value={selected || ''} onChange={(e) => setSelected(e.target.value)}>{scene.objects.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}</select>
      {selectedObject && <><input aria-label={tr('studioCanvas.directorEditor.objectName')} value={selectedObject.name} onChange={(e) => changeObject('name', e.target.value)} />{(['x', 'y', 'z', 'rotation', 'scale', 'pose'] as const).map((key) => <label key={key}>{({ x: tr('studioCanvas.directorEditor.x'), y: tr('studioCanvas.directorEditor.y'), z: tr('studioCanvas.directorEditor.z'), rotation: tr('studioCanvas.directorEditor.rotation'), scale: tr('studioCanvas.directorEditor.scale'), pose: tr('studioCanvas.directorEditor.pose') })[key]}<input type="range" min={key === 'scale' ? .2 : key === 'y' ? 0 : key === 'rotation' ? -180 : key === 'pose' ? -80 : -10} max={key === 'scale' ? 4 : key === 'rotation' ? 180 : key === 'pose' ? 80 : 10} step={key === 'pose' || key === 'rotation' ? 1 : .1} value={selectedObject[key]} onChange={(e) => changeObject(key, Number(e.target.value))} /><output>{selectedObject[key]}</output></label>)}<label>{tr('studioCanvas.directorEditor.color')}<input type="color" value={selectedObject.color} onChange={(e) => changeObject('color', e.target.value)} /></label><button onClick={() => { setScene((current) => ({ ...current, objects: current.objects.filter((o) => o.id !== selected) })); setSelected(null) }}><Trash2 size={14} />{tr('studioCanvas.directorEditor.deleteObject')}</button></>}
      <hr />{(['distance', 'fov', 'targetY'] as const).map((key) => <label key={key}>{({ distance: tr('studioCanvas.directorEditor.distance'), fov: tr('studioCanvas.directorEditor.fov'), targetY: tr('studioCanvas.directorEditor.targetY') })[key]}<input type="range" min={key === 'fov' ? 15 : key === 'distance' ? 1.5 : -2} max={key === 'fov' ? 100 : key === 'distance' ? 25 : 5} step=".1" value={scene.camera[key]} onChange={(e) => { setPreviewFrame(false); setScene((current) => ({ ...current, camera: { ...current.camera, [key]: Number(e.target.value) } })) }} /></label>)}<label>{tr('studioCanvas.directorEditor.duration')}<input type="number" min="1" max="30" value={scene.duration} onChange={(e) => { const duration = Math.max(1, Math.min(30, Number(e.target.value))); setTime((t) => Math.min(t, duration)); setScene((current) => ({ ...current, duration, frames: current.frames.filter((f) => f.time <= duration) })) }} /></label><label>{tr('studioCanvas.directorEditor.background')}<input type="color" value={scene.background} onChange={(e) => setScene((current) => ({ ...current, background: e.target.value }))} /></label></fieldset></div>
    {error && <p role="alert" className="pf-workflow-error">{error}</p>}<footer><button disabled={!writable || busy} onClick={() => { onSave(scene); onClose() }}><Save size={16} />{tr('studioCanvas.directorEditor.save')}</button><button disabled={!writable || busy} onClick={() => void exportMedia('image')}><Camera size={16} />{tr('studioCanvas.directorEditor.exportFrame')}</button><button disabled={!writable || busy} onClick={() => void exportMedia('video')}><Film size={16} />{busy ? tr('studioCanvas.directorEditor.exporting') : tr('studioCanvas.directorEditor.exportVideo')}</button></footer>
  </section></div>
}
