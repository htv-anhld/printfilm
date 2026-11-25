import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { api } from '../api'
import BillingErrorNotice from '../components/billing/BillingErrorNotice'
import AppShell from '../components/layout/AppShell'
import { useI18n } from '../i18n'

export const TEXT_TOOLS = ['subtitle', 'script', 'video-script'] as const
type TextTool = (typeof TEXT_TOOLS)[number]

const LANGS = ['vi', 'en', 'zh', 'ja', 'ko', 'th', 'id', 'es']
const FORMATS = ['screenplay', 'shotlist', 'narration', 'episodes']

/** 文本类工具：字幕翻译 / 剧本格式化 / 视频脚本（输入 → LLM → 可下载结果） */
export default function TextToolPage() {
  const { kind } = useParams()
  const { t, locale } = useI18n()
  /* 输入 */
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [lang, setLang] = useState(locale)
  const [format, setFormat] = useState('screenplay')
  const [duration, setDuration] = useState(60)
  const [style, setStyle] = useState('')
  /* 输出与状态 */
  const [output, setOutput] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!TEXT_TOOLS.includes(kind as TextTool)) return <Navigate to="/tools" replace />
  if (!localStorage.getItem('token')) return <Navigate to={`/auth?next=/tools/text/${kind}`} replace />
  const tool = kind as TextTool

  // 读本地 .srt / .vtt / .txt
  async function onFile(file: File | undefined) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError(t('textTools.fileTooLarge'))
      return
    }
    setContent(await file.text())
  }

  async function run() {
    setBusy(true)
    setError('')
    setOutput('')
    setTitle('')
    try {
      if (tool === 'subtitle') {
        setOutput((await api.subtitleTranslate({ content, target_lang: lang })).content)
      } else if (tool === 'script') {
        setOutput((await api.scriptFormat({ content, format, lang })).content)
      } else {
        const res = await api.videoScript({ url: url.trim() || undefined, material: content.trim() || undefined, lang, duration, style })
        setTitle(res.title)
        setOutput(res.script)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
    } finally {
      setBusy(false)
    }
  }

  function download() {
    const ext = tool === 'subtitle' ? (content.trim().toUpperCase().startsWith('WEBVTT') ? 'vtt' : 'srt') : tool === 'script' && format === 'shotlist' ? 'md' : 'txt'
    const blob = new Blob([title ? `${title}\n\n${output}` : output], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `printfilm-${tool}-${lang}.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const canRun = tool === 'video-script' ? Boolean(url.trim() || content.trim()) : content.trim().length >= (tool === 'subtitle' ? 10 : 20)

  return (
    <AppShell active="tools">
      <div className="pf-text-tool">
        <Link to="/tools" className="pf-muted">
          <ArrowLeft size={14} /> {t('tools.title')}
        </Link>
        <h1>{t(`textTools.${tool}.title`)}</h1>
        <p className="pf-muted">{t(`textTools.${tool}.lead`)}</p>

        <div className="pf-text-tool-grid">
          <section className="pf-settings-card">
            {tool === 'video-script' ? (
              <label>
                {t('textTools.youtube')}
                <input value={url} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => setUrl(e.target.value)} />
              </label>
            ) : null}
            <label>
              {tool === 'subtitle' ? t('textTools.subtitleInput') : tool === 'script' ? t('textTools.scriptInput') : t('textTools.materialInput')}
              <textarea rows={14} value={content} onChange={(e) => setContent(e.target.value)} />
            </label>
            {tool === 'subtitle' ? (
              <label className="pf-text-tool-file">
                {t('textTools.upload')}
                <input type="file" accept=".srt,.vtt,.txt,text/plain" onChange={(e) => void onFile(e.target.files?.[0])} />
              </label>
            ) : null}
            <div className="pf-text-tool-row">
              <label>
                {tool === 'subtitle' ? t('textTools.targetLang') : t('textTools.outputLang')}
                <select value={lang} onChange={(e) => setLang(e.target.value as typeof locale)}>
                  {LANGS.map((l) => (
                    <option key={l} value={l}>
                      {t(`textTools.langs.${l}`)}
                    </option>
                  ))}
                </select>
              </label>
              {tool === 'script' ? (
                <label>
                  {t('textTools.format')}
                  <select value={format} onChange={(e) => setFormat(e.target.value)}>
                    {FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {t(`textTools.formats.${f}`)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {tool === 'video-script' ? (
                <>
                  <label>
                    {t('textTools.duration')}
                    <input type="number" min={15} max={600} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                  </label>
                  <label>
                    {t('textTools.style')}
                    <input value={style} maxLength={80} placeholder={t('textTools.stylePlaceholder')} onChange={(e) => setStyle(e.target.value)} />
                  </label>
                </>
              ) : null}
            </div>
            <BillingErrorNotice message={error} />
            <button type="button" className="pf-btn pf-btn-lime" disabled={busy || !canRun} onClick={() => void run()}>
              {busy ? t('auth.processing') : t(`textTools.${tool}.cta`)}
            </button>
          </section>

          <section className="pf-settings-card">
            <div className="pf-text-tool-out-head">
              <h3>{title || t('textTools.result')}</h3>
              {output ? (
                <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" onClick={download}>
                  <Download size={14} /> {t('textTools.download')}
                </button>
              ) : null}
            </div>
            <textarea className="pf-text-tool-output" rows={22} readOnly value={output} placeholder={t('textTools.resultEmpty')} />
          </section>
        </div>
      </div>
    </AppShell>
  )
}
