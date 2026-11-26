import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, type CreativeBoard, type CreativeItem } from '../api'
import { listToolRuns, resolveToolMediaUrl, type ToolRunRecord } from '../api/tools'
import AppShell from '../components/layout/AppShell'
import { useI18n } from '../i18n'
import { dialog } from '../lib/dialog'
import { IconImage, IconPlus } from '../components/ui/Icons'
import './drama/project-list.css'
import './creativeBoards.css'

/** 创意看板：按活动归档图 / 视频 / 文案 / 链接，可一键加入最近的工具产出 */
export default function CreativeBoardsPage() {
  const { t } = useI18n()
  /* 看板列表与当前看板 */
  const [boards, setBoards] = useState<CreativeBoard[]>([])
  const [board, setBoard] = useState<CreativeBoard | null>(null)
  const [recent, setRecent] = useState<ToolRunRecord[]>([])
  /* 表单 */
  const [newName, setNewName] = useState('')
  const [kind, setKind] = useState<CreativeItem['kind']>('text')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const loggedIn = Boolean(localStorage.getItem('token'))

  const loadBoards = useCallback(async () => {
    const res = await api.creativeBoards()
    setBoards(res.items)
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    loadBoards().catch((e) => setError(e instanceof Error ? e.message : t('common.fail')))
    listToolRuns(1, 12)
      .then((r) => setRecent(r.items.filter((x) => x.status === 'succeeded' && x.urls.length && (x.kind === 'image' || x.kind === 'video'))))
      .catch(() => undefined)
  }, [loadBoards, loggedIn, t])

  if (!loggedIn) return <Navigate to="/auth?next=%2Fcreative" replace />

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
    } finally {
      setBusy(false)
    }
  }

  async function addItem(item: Parameters<typeof api.addCreativeItem>[1]) {
    if (!board) return
    await run(async () => {
      setBoard(await api.addCreativeItem(board.id, item))
      await loadBoards()
    })
  }

  return (
    <AppShell active="tools">
      <div className="pf-project-list-page pf-creative-page">
        <header className="pf-project-page-header">
          <div>
            <span className="pf-project-page-eyebrow">{t('creative.eyebrow')}</span>
            <h1>{t('creative.title')}</h1>
            <p>{t('creative.lead')}</p>
          </div>
        </header>
        {error ? <p className="pf-error">{error}</p> : null}

        <section className="pf-project-list-panel">
          <div className="pf-project-list-heading">
            <h2>
              {t('creative.boardsHeading')} <span>{boards.length}</span>
            </h2>
          </div>
          <form
            className="pf-creative-row"
            onSubmit={(e) => {
              e.preventDefault()
              if (busy || !newName.trim()) return
              void run(async () => {
                setBoard(await api.createCreativeBoard(newName.trim()))
                setNewName('')
                await loadBoards()
              })
            }}
          >
            <input className="pf-creative-input" value={newName} maxLength={128} placeholder={t('creative.namePlaceholder')} onChange={(e) => setNewName(e.target.value)} />
            <button type="submit" className="pf-btn pf-btn-lime" disabled={busy || !newName.trim()}>
              <IconPlus size={16} />
              {t('creative.create')}
            </button>
          </form>
          {boards.length === 0 ? (
            <p className="pf-muted pf-creative-empty">{t('creative.noBoards')}</p>
          ) : (
            <div className="pf-creative-boards" role="tablist" aria-label={t('creative.boardsAria')}>
              {boards.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={board?.id === b.id}
                  className={`pf-pill${board?.id === b.id ? ' active' : ''}`}
                  onClick={() => void run(async () => setBoard(await api.creativeBoard(b.id)))}
                >
                  {b.name}
                  <span className="pf-creative-count">{b.item_count}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {board ? (
          <section className="pf-project-list-panel pf-creative-board">
            <div className="pf-project-list-heading">
              <div>
                <h2>{board.name}</h2>
                <p>{t('creative.boardMeta', { n: (board.items || []).length })}</p>
              </div>
              <button
                type="button"
                className="pf-btn pf-btn-ghost pf-btn-sm pf-creative-danger"
                onClick={async () => {
                  if (!(await dialog.confirm({ message: t('creative.deleteBoard', { name: board.name }), tone: 'danger' }))) return
                  await run(async () => {
                    await api.deleteCreativeBoard(board.id)
                    setBoard(null)
                    await loadBoards()
                  })
                }}
              >
                {t('library.delete')}
              </button>
            </div>

            <form
              className="pf-creative-row"
              onSubmit={(e) => {
                e.preventDefault()
                if (busy || !value.trim()) return
                void addItem(kind === 'text' ? { kind, text: value } : { kind, url: value.trim() })
                setValue('')
              }}
            >
              <select className="pf-type-select" value={kind} aria-label={t('creative.kindAria')} onChange={(e) => setKind(e.target.value as CreativeItem['kind'])}>
                {(['text', 'image', 'video', 'link'] as const).map((k) => (
                  <option key={k} value={k}>
                    {t(`creative.kinds.${k}`)}
                  </option>
                ))}
              </select>
              <input className="pf-creative-input" value={value} placeholder={kind === 'text' ? t('creative.textPlaceholder') : t('creative.urlPlaceholder')} onChange={(e) => setValue(e.target.value)} />
              <button type="submit" className="pf-btn pf-btn-lime" disabled={busy || !value.trim()}>
                <IconPlus size={16} />
                {t('creative.add')}
              </button>
            </form>

            {recent.length > 0 ? (
              <>
                <h3 className="pf-creative-subhead">{t('creative.recent')}</h3>
                <div className="pf-creative-recent">
                  {recent.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      title={r.prompt}
                      onClick={() => void addItem({ kind: r.kind === 'video' ? 'video' : 'image', url: r.urls[0], note: r.prompt.slice(0, 200), source: r.tool_id })}
                    >
                      <CreativeMedia kind={r.kind === 'video' ? 'video' : 'image'} src={resolveToolMediaUrl(r.urls[0])} compact />
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {(board.items || []).length === 0 ? (
              <p className="pf-muted pf-creative-empty">{t('creative.empty')}</p>
            ) : (
              <div className="pf-creative-grid">
                {(board.items || []).map((item) => (
                  <figure key={item.id} className="pf-creative-card">
                    {(item.kind === 'image' || item.kind === 'video') && item.url ? <CreativeMedia kind={item.kind} src={api.assetUrl(item.url)} /> : null}
                    <figcaption>
                      {item.kind === 'text' ? <span className="pf-creative-text">{item.text}</span> : null}
                      {item.kind === 'link' && item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer noopener">
                          {item.url}
                        </a>
                      ) : null}
                      {item.note ? <em className="pf-muted">{item.note}</em> : null}
                      <button
                        type="button"
                        className="pf-btn pf-btn-ghost pf-btn-sm pf-creative-danger"
                        onClick={() =>
                          void run(async () => {
                            setBoard(await api.removeCreativeItem(board.id, item.id))
                            await loadBoards()
                          })
                        }
                      >
                        {t('library.delete')}
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </AppShell>
  )
}

/** 看板里的图片/视频：加载失败（素材已清理或不可达）时显示占位，避免破图图标 */
function CreativeMedia({ kind, src, compact = false }: { kind: 'image' | 'video'; src: string; compact?: boolean }) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  if (failed || !src) {
    return (
      <div className="pf-creative-missing" role="img" aria-label={t('creative.mediaMissing')}>
        <IconImage size={compact ? 22 : 30} />
        {compact ? null : <small>{t('creative.mediaMissing')}</small>}
      </div>
    )
  }
  if (kind === 'video') {
    return <video className="pf-creative-media" src={src} muted={compact} controls={!compact} preload="metadata" onError={() => setFailed(true)} />
  }
  return <img className="pf-creative-media" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
}
