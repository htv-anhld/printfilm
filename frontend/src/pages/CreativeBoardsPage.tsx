import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, type CreativeBoard, type CreativeItem } from '../api'
import { listToolRuns, resolveToolMediaUrl, type ToolRunRecord } from '../api/tools'
import AppShell from '../components/layout/AppShell'
import { useI18n } from '../i18n'
import { dialog } from '../lib/dialog'

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
      .then((r) => setRecent(r.items.filter((x) => x.status === 'succeeded' && x.urls.length)))
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
      <div className="pf-library">
        <h1>{t('creative.title')}</h1>
        <p className="pf-muted">{t('creative.lead')}</p>
        {error ? <p className="pf-error">{error}</p> : null}
        <div className="pf-api-create">
          <input value={newName} maxLength={128} placeholder={t('creative.namePlaceholder')} onChange={(e) => setNewName(e.target.value)} />
          <button
            type="button"
            className="pf-btn pf-btn-lime pf-btn-sm"
            disabled={busy || !newName.trim()}
            onClick={() =>
              void run(async () => {
                setBoard(await api.createCreativeBoard(newName.trim()))
                setNewName('')
                await loadBoards()
              })
            }
          >
            {t('creative.create')}
          </button>
        </div>

        <div className="pf-team-switch">
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`pf-btn pf-btn-sm ${board?.id === b.id ? 'pf-btn-lime' : 'pf-btn-ghost'}`}
              onClick={() => void run(async () => setBoard(await api.creativeBoard(b.id)))}
            >
              {b.name} · {b.item_count}
            </button>
          ))}
        </div>

        {board ? (
          <section className="pf-settings-card">
            <div className="pf-text-tool-out-head">
              <h2>{board.name}</h2>
              <button
                type="button"
                className="pf-btn pf-btn-ghost pf-btn-sm"
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

            <div className="pf-api-create">
              <select value={kind} onChange={(e) => setKind(e.target.value as CreativeItem['kind'])}>
                {(['text', 'image', 'video', 'link'] as const).map((k) => (
                  <option key={k} value={k}>
                    {t(`creative.kinds.${k}`)}
                  </option>
                ))}
              </select>
              <input value={value} placeholder={kind === 'text' ? t('creative.textPlaceholder') : 'https://… /static/…'} onChange={(e) => setValue(e.target.value)} />
              <button
                type="button"
                className="pf-btn pf-btn-lime pf-btn-sm"
                disabled={busy || !value.trim()}
                onClick={() => {
                  void addItem(kind === 'text' ? { kind, text: value } : { kind, url: value.trim() })
                  setValue('')
                }}
              >
                {t('creative.add')}
              </button>
            </div>

            {recent.length > 0 ? (
              <>
                <h3>{t('creative.recent')}</h3>
                <div className="pf-creative-recent">
                  {recent.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      title={r.prompt}
                      onClick={() => void addItem({ kind: r.kind === 'video' ? 'video' : 'image', url: r.urls[0], note: r.prompt.slice(0, 200), source: r.tool_id })}
                    >
                      {r.kind === 'video' ? <video src={resolveToolMediaUrl(r.urls[0])} muted preload="metadata" /> : <img src={resolveToolMediaUrl(r.urls[0])} alt="" loading="lazy" />}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {(board.items || []).length === 0 ? (
              <p className="pf-muted">{t('creative.empty')}</p>
            ) : (
              <div className="pf-library-grid">
                {(board.items || []).map((item) => (
                  <figure key={item.id} className="pf-library-card">
                    {item.kind === 'image' && item.url ? <img src={api.assetUrl(item.url)} alt="" loading="lazy" /> : null}
                    {item.kind === 'video' && item.url ? <video src={api.assetUrl(item.url)} controls preload="none" /> : null}
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
                        className="pf-btn pf-btn-ghost pf-btn-sm"
                        onClick={() => void run(async () => setBoard(await api.removeCreativeItem(board.id, item.id)))}
                      >
                        {t('library.delete')}
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        ) : boards.length === 0 ? (
          <p className="pf-muted">{t('creative.noBoards')}</p>
        ) : null}
      </div>
    </AppShell>
  )
}
