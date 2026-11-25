/** 大纲工具栏「合成整部影片」：后台按集序拼接所有分镜视频，轮询进度并给出下载链接 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Film, Loader2 } from 'lucide-react'
import { dramaApi, resolveDramaMediaUrl, type DramaFilmState } from '../../api/drama'
import { dialog } from '../../lib/dialog'
import { useI18n } from '../../i18n'

const POLL_MS = 3000

type Props = {
  projectId: number
  onError: (message: string) => void
}

/** 合成按钮 + 进度/下载 */
export default function DramaFilmComposeButton({ projectId, onError }: Props) {
  const { t } = useI18n()
  // state 后端返回的合成状态
  const [state, setState] = useState<DramaFilmState | null>(null)
  const timerRef = useRef<number | null>(null)

  // 拉一次状态；running 时继续轮询
  const poll = useCallback(async () => {
    try {
      const next = await dramaApi.getFilmState(projectId)
      setState(next)
      if (next.status === 'running') {
        timerRef.current = window.setTimeout(() => void poll(), POLL_MS)
      } else if (next.status === 'failed' && next.error) {
        onError(`${t('genSettings.filmFailed')}: ${next.error}`)
      }
    } catch {
      /* 状态查询失败不打断页面 */
    }
  }, [projectId, onError, t])

  useEffect(() => {
    void poll()
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [poll])

  // 确认后发起合成
  async function start() {
    const ok = await dialog.confirm({
      title: t('genSettings.filmComposeTitle'),
      message: t('genSettings.filmComposeMsg'),
      confirmText: t('genSettings.filmCompose'),
    })
    if (!ok) return
    try {
      setState(await dramaApi.composeFilm(projectId))
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => void poll(), 1200)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('genSettings.filmFailed'))
    }
  }

  const running = state?.status === 'running'
  const skipped = state?.status === 'done' ? state.skipped_episodes || [] : []

  return (
    <span className="drama-film-compose">
      <button type="button" className="drama-outline-chip-btn" disabled={running} onClick={() => void start()}>
        {running ? <Loader2 size={14} className="pf-spin" aria-hidden /> : <Film size={14} aria-hidden />}
        {running
          ? state?.total
            ? t('genSettings.filmComposing', { done: state.done || 0, total: state.total })
            : t('genSettings.filmStarting')
          : t('genSettings.filmCompose')}
      </button>
      {state?.status === 'done' && state.url ? (
        <a
          className="drama-outline-chip-btn is-on"
          href={resolveDramaMediaUrl(state.url)}
          target="_blank"
          rel="noopener noreferrer"
          download
          title={skipped.length ? t('genSettings.filmSkipped', { list: skipped.join(', ') }) : undefined}
        >
          <Download size={14} aria-hidden />
          {t('genSettings.filmDownload')}
        </a>
      ) : null}
    </span>
  )
}
