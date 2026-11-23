import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, type LibraryItem, type LibraryKind } from '../api'
import AppShell from '../components/layout/AppShell'
import { useI18n } from '../i18n'
import { dialog } from '../lib/dialog'

type Tab = LibraryKind | 'clips'

type Clip = { id: string; url: string; cover?: string | null; duration_sec?: number | null; project: string }

/** 素材库：头像（含漫剧角色）、背景音乐、音效、我生成的分镜片段；可上传私有素材、复制链接 */
export default function LibraryPage() {
  const { t } = useI18n()
  /* 当前分区与各分区数据 */
  const [tab, setTab] = useState<Tab>('avatar')
  const [avatars, setAvatars] = useState<LibraryItem[]>([])
  const [characters, setCharacters] = useState<LibraryItem[]>([])
  const [bgm, setBgm] = useState<LibraryItem[]>([])
  const [sfx, setSfx] = useState<LibraryItem[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  /* 上传与状态 */
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    const [a, tl] = await Promise.all([api.avatarLibrary(), api.timelineLibrary()])
    setAvatars(a.items)
    setCharacters(a.characters)
    setBgm(tl.bgm)
    setSfx(tl.sfx)
    setClips(tl.clips)
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    load().catch((e) => setError(e instanceof Error ? e.message : t('common.fail')))
  }, [load, t])

  if (!localStorage.getItem('token')) return <Navigate to="/auth?next=%2Flibrary" replace />

  async function upload(file: File | undefined) {
    if (!file || tab === 'clips') return
    setBusy(true)
    setError('')
    try {
      await api.uploadLibraryItem(tab, file, name || file.name.replace(/\.[^.]+$/, ''))
      setName('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: LibraryItem) {
    if (!(await dialog.confirm({ message: t('library.deleteConfirm', { name: item.name }), tone: 'danger' }))) return
    try {
      await api.deleteLibraryItem(item.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
    }
  }

  async function copy(url: string) {
    const full = api.assetUrl(url)
    await navigator.clipboard?.writeText(full)
    setCopied(url)
    window.setTimeout(() => setCopied(''), 1500)
  }

  const list = tab === 'avatar' ? [...avatars, ...characters] : tab === 'bgm' ? bgm : tab === 'sfx' ? sfx : []
  const accept = tab === 'avatar' ? 'image/png,image/jpeg,image/webp' : 'audio/*'

  return (
    <AppShell active="tools">
      <div className="pf-library">
        <h1>{t('library.title')}</h1>
        <p className="pf-muted">{t('library.lead')}</p>
        <div className="pf-team-switch" role="tablist">
          {(['avatar', 'bgm', 'sfx', 'clips'] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`pf-btn pf-btn-sm ${tab === key ? 'pf-btn-lime' : 'pf-btn-ghost'}`}
              onClick={() => setTab(key)}
            >
              {t(`library.tabs.${key}`)}
            </button>
          ))}
        </div>
        {error ? <p className="pf-error">{error}</p> : null}

        {tab !== 'clips' ? (
          <div className="pf-api-create">
            <input value={name} maxLength={128} placeholder={t('library.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
            <label className={`pf-btn pf-btn-lime pf-btn-sm${busy ? ' is-disabled' : ''}`}>
              {busy ? t('auth.processing') : t('library.upload')}
              <input type="file" hidden accept={accept} disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
          </div>
        ) : null}

        {tab === 'clips' ? (
          clips.length === 0 ? (
            <p className="pf-muted">{t('library.empty')}</p>
          ) : (
            <div className="pf-library-grid">
              {clips.map((c) => (
                <figure key={c.id} className="pf-library-card">
                  <video src={api.assetUrl(c.url)} poster={c.cover ? api.assetUrl(c.cover) : undefined} controls preload="none" />
                  <figcaption>
                    <span>{c.project}</span>
                    <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => void copy(c.url)}>
                      {copied === c.url ? t('library.copied') : t('library.copy')}
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )
        ) : list.length === 0 ? (
          <p className="pf-muted">{t('library.empty')}</p>
        ) : (
          <div className="pf-library-grid">
            {list.map((item) => (
              <figure key={`${item.scope}-${item.id}`} className="pf-library-card">
                {item.kind === 'avatar' ? (
                  <img src={api.assetUrl(item.url)} alt={item.name} loading="lazy" />
                ) : (
                  <audio src={api.assetUrl(item.url)} controls preload="none" />
                )}
                <figcaption>
                  <span>
                    <strong>{item.name}</strong>
                    <em className="pf-muted">
                      {t(`library.scope.${item.scope}`)}
                      {item.project ? ` · ${item.project}` : ''}
                      {item.tags?.length ? ` · ${item.tags.join(', ')}` : ''}
                      {item.duration_sec ? ` · ${Math.round(item.duration_sec)}s` : ''}
                    </em>
                  </span>
                  <span className="pf-team-actions">
                    <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => void copy(item.url)}>
                      {copied === item.url ? t('library.copied') : t('library.copy')}
                    </button>
                    {item.scope === 'mine' ? (
                      <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => void remove(item)}>
                        {t('library.delete')}
                      </button>
                    ) : null}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
