import { tr } from '../../../i18n'
import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { printfilmStudioApi } from '../api'
import { MessageContent } from '../agent/MessageContent'
import './textGeneration.css'

export function TextGenerationEditor({ projectId, title, initialPrompt, text, references, headers, writable, onClose, onApply }: { projectId: number; title: string; initialPrompt: string; text: string; references: { id: string; label: string; text: string }[]; headers: HeadersInit; writable: boolean; onClose: () => void; onApply: (result: string, prompt: string, expected: string) => void }) {
  const [prompt, setPrompt] = useState(initialPrompt), [result, setResult] = useState(''), [model, setModel] = useState('')
  const [models, setModels] = useState<{ id: string; label: string }[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const active = useRef<{ controller: AbortController; sessionId?: string } | null>(null)
  const expected = useRef(text)
  useEffect(() => { let alive = true; void printfilmStudioApi.agentConfig().then((config) => { if (alive) { setModels(config.models); setModel(config.models[0]?.id || '') } }).catch((reason) => { if (alive) setError(reason instanceof Error ? reason.message : tr('studioCanvas.textGenerationEditor.modelLoadFailed')) }); return () => { alive = false } }, [])
  const stop = async () => {
    const current = active.current
    if (!current) return
    try { if (current.sessionId) await printfilmStudioApi.stopSession(current.sessionId) }
    catch (reason) { setError(reason instanceof Error ? reason.message : tr('studioCanvas.textGenerationEditor.stopFailed')) }
    finally { current.controller.abort() }
  }
  useEffect(() => () => { const current = active.current; current?.controller.abort(); if (current?.sessionId) void printfilmStudioApi.stopSession(current.sessionId).catch(() => undefined) }, [])
  const generate = async () => {
    if (active.current || !writable || !prompt.trim()) return
    const run: { controller: AbortController; sessionId?: string } = { controller: new AbortController() }; active.current = run
    expected.current = text; setResult(''); setBusy(true); setError('')
    try {
      const session = await printfilmStudioApi.createSession(projectId); run.sessionId = session.id
      if (run.controller.signal.aborted) return
      await printfilmStudioApi.updateSession(session.id, { title: tr('studioCanvas.textGenerationEditor.sessionTitle', { title }).slice(0, 200), model_id: model || null })
      let output = '', failure = ''
      await printfilmStudioApi.stream(session.id, `这是文本节点内容生成任务。只输出最终正文，可使用 Markdown，不要解释，不要调用工具，不要修改画布。\n创作要求：${prompt}\n现有正文：${text.slice(0, 8000)}\n参考文本：${references.map((item) => `${item.label}：${item.text}`).join('\n').slice(0, 6000)}`, (event) => {
        if (event.type === 'message_delta') { output += String(event.content || ''); setResult(output) }
        if (event.type === 'error') failure = String(event.message || tr('studioCanvas.textGenerationEditor.genFailed'))
      }, run.controller.signal, headers, { enabled_tools: [] })
      if (failure) throw new Error(failure)
      if (!output.trim()) throw new Error(tr('studioCanvas.textGenerationEditor.empty'))
    } catch (reason) { if (!run.controller.signal.aborted) setError(reason instanceof Error ? reason.message : tr('studioCanvas.textGenerationEditor.textFailed')) }
    finally { if (active.current === run) { active.current = null; setBusy(false) } }
  }
  return <div className="pf-edit-overlay"><section className="pf-text-generation" role="dialog" aria-modal="true" aria-label={tr('studioCanvas.textGenerationEditor.dialog')}><header><b><Sparkles size={18} /> {tr('studioCanvas.textGenerationEditor.heading', { title })}</b><button aria-label={tr('studioCanvas.textGenerationEditor.close')} onClick={() => { void stop(); onClose() }}><X size={18} /></button></header><div className="pf-text-generation-body"><aside><label>{tr('studioCanvas.textGenerationEditor.model')}<select aria-label={tr('studioCanvas.textGenerationEditor.model')} disabled={busy || !writable} value={model} onChange={(event) => setModel(event.target.value)}>{models.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>{tr('studioCanvas.textGenerationEditor.requirement')}<textarea aria-label={tr('studioCanvas.textGenerationEditor.requirement')} value={prompt} maxLength={5000} disabled={busy || !writable} onChange={(event) => setPrompt(event.target.value)} placeholder={tr('studioCanvas.textGenerationEditor.placeholder')} /></label><p>{tr('studioCanvas.textGenerationEditor.refCount', { n: references.length })}</p><p>{tr('studioCanvas.textGenerationEditor.hint')}</p></aside><article aria-label={tr('studioCanvas.textGenerationEditor.preview')}>{result ? <MessageContent text={result} /> : <p>{tr('studioCanvas.textGenerationEditor.previewEmpty')}</p>}</article></div>{error && <p role="alert" className="pf-editor-error">{error}</p>}<footer><span>{busy ? tr('studioCanvas.textGenerationEditor.generating') : tr('studioCanvas.textGenerationEditor.chars', { n: result.length })}</span>{busy ? <button onClick={() => void stop()}>{tr('studioCanvas.textGenerationEditor.stop')}</button> : <button disabled={!writable || !prompt.trim() || !models.length} onClick={() => void generate()}>{tr('studioCanvas.textGenerationEditor.start')}</button>}<button className="is-primary" disabled={busy || !writable || !result.trim()} onClick={() => { try { onApply(result, prompt, expected.current); onClose() } catch (reason) { setError(reason instanceof Error ? reason.message : tr('studioCanvas.textGenerationEditor.applyFailed')) } }}>{tr('studioCanvas.textGenerationEditor.apply')}</button></footer></section></div>
}
