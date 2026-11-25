import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { api } from '../api'
import AppShell from '../components/layout/AppShell'
import { useI18n } from '../i18n'

/** 画质放大：上传或粘贴本站媒体链接；图片 2× / 4×，视频放大到 1080p / 1440p / 2160p（FFmpeg，非 AI） */
export default function UpscalePage() {
  const { t } = useI18n()
  /* 输入 */
  const [kind, setKind] = useState<'image' | 'video'>('image')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [scale, setScale] = useState(2)
  const [target, setTarget] = useState('1080p')
  const [targets, setTargets] = useState<string[]>(['1080p'])
  const [maxSec, setMaxSec] = useState(60)
  /* 结果 */
  const [result, setResult] = useState<{ url: string; width: number; height: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .upscaleOptions()
      .then((o) => {
        setTargets(o.video.targets)
        setMaxSec(o.video.max_seconds)
      })
      .catch(() => undefined)
  }, [])

  if (!localStorage.getItem('token')) return <Navigate to="/auth?next=%2Ftools%2Fupscale" replace />

  async function run() {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await api.upscale({ kind, scale, target, url: url.trim(), file }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell active="tools">
      <div className="pf-text-tool">
        <Link to="/tools" className="pf-muted">
          <ArrowLeft size={14} /> {t('tools.title')}
        </Link>
        <h1>{t('upscale.title')}</h1>
        <p className="pf-muted">{t('upscale.lead', { n: maxSec })}</p>
        <div className="pf-text-tool-grid">
          <section className="pf-settings-card">
            <div className="pf-team-switch">
              {(['image', 'video'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`pf-btn pf-btn-sm ${kind === k ? 'pf-btn-lime' : 'pf-btn-ghost'}`}
                  onClick={() => {
                    setKind(k)
                    setFile(null)
                    setResult(null)
                  }}
                >
                  {t(`upscale.kind.${k}`)}
                </button>
              ))}
            </div>
            <label>
              {t('upscale.file')}
              <input
                type="file"
                accept={kind === 'image' ? 'image/png,image/jpeg,image/webp' : 'video/mp4,video/quicktime,video/webm'}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <label>
              {t('upscale.orUrl')}
              <input value={url} placeholder="/static/generated/…" onChange={(e) => setUrl(e.target.value)} />
            </label>
            {kind === 'image' ? (
              <label>
                {t('upscale.scale')}
                <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                  <option value={2}>2×</option>
                  <option value={4}>4×</option>
                </select>
              </label>
            ) : (
              <label>
                {t('upscale.target')}
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  {targets.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {error ? <p className="pf-error">{error}</p> : null}
            <button type="button" className="pf-btn pf-btn-lime" disabled={busy || (!file && !url.trim())} onClick={() => void run()}>
              {busy ? t('upscale.working') : t('upscale.run')}
            </button>
            <p className="pf-muted">{t('upscale.note')}</p>
          </section>
          <section className="pf-settings-card">
            <div className="pf-text-tool-out-head">
              <h3>{result ? `${result.width} × ${result.height}` : t('textTools.result')}</h3>
              {result ? (
                <a className="pf-btn pf-btn-ghost pf-btn-sm" href={api.assetUrl(result.url)} download>
                  <Download size={14} /> {t('textTools.download')}
                </a>
              ) : null}
            </div>
            {result ? (
              kind === 'image' ? (
                <img src={api.assetUrl(result.url)} alt="" style={{ width: '100%', borderRadius: 12 }} />
              ) : (
                <video src={api.assetUrl(result.url)} controls style={{ width: '100%', borderRadius: 12 }} />
              )
            ) : (
              <p className="pf-muted">{t('textTools.resultEmpty')}</p>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  )
}
