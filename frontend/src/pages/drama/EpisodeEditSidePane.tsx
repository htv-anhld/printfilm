/** 分集编辑右侧：分段视频预览 + 入口打开全屏分镜画布 */
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import DramaPublishModal from '../../features/marketplace/DramaPublishModal'
import { useMarketplace } from '../../features/marketplace/hooks'
import type { DramaFragment } from '../../api/drama'
import { DramaSubtitleBoard } from '../../components/drama/DramaSubtitleBoard'
import { DramaFragmentSegmentedVideoPlayer } from '../../components/drama/DramaFragmentSegmentedVideoPlayer'
import { triggerBlobDownload } from '../../lib/clientDownload'
import {
  composeEpisodeVideoClient,
  episodeComposeFilename,
  listEpisodeComposeClips,
  type EpisodeComposeProgress,
} from '../../lib/composeEpisodeVideoClient'
import { dialog } from '../../lib/dialog'
import { buildDramaSubtitleBoard, type DramaSubtitleMode } from '../../lib/dramaSubtitleBoard'
import { tr, useI18n } from '../../i18n'

type Props = {
  fragments: DramaFragment[]
  playingFragmentId: number | null
  onPlayingFragmentChange: (fragmentId: number) => void
  aspectRatio: string
  episodeId?: number
  projectId?: string
  episodeName?: string
  subtitleMode: DramaSubtitleMode
  onOpenStoryboard: () => void
  /** 预览历史版本时覆盖当前镜 video src */
  previewVideoUrl?: string | null
  previewPosterUrl?: string | null
  previewLabel?: string
  onClearPreview?: () => void
  onActivatePreview?: () => void
}

/** 把合成进度转成按钮文案（burnSubtitles：服务端同时烧录后期字幕） */
function composeProgressLabel(
  progress: EpisodeComposeProgress | null,
  busy: boolean,
  burnSubtitles = false,
) {
  if (!busy) return tr('episode.sidePane.composeDownload')
  if (!progress) return tr('episode.sidePane.composing')
  if (progress.phase === 'download')
    return tr('episode.sidePane.composeFetching', { done: progress.done, total: progress.total })
  if (progress.phase === 'server')
    return tr(burnSubtitles ? 'episode.sidePane.composeServerSubtitles' : 'episode.sidePane.composeServer')
  return tr('episode.sidePane.composeStitching')
}

// 渲染分集右侧预览与画布入口
export function EpisodeEditSidePane({
  fragments,
  playingFragmentId,
  onPlayingFragmentChange,
  aspectRatio,
  episodeId,
  projectId,
  episodeName: episodeNameProp,
  subtitleMode,
  onOpenStoryboard,
  previewVideoUrl = null,
  previewPosterUrl = null,
  previewLabel = '',
  onClearPreview,
  onActivatePreview,
}: Props) {
  const { t } = useI18n()
  const episodeName = episodeNameProp ?? t('episode.sidePane.thisEpisode')
  const hasSelection = playingFragmentId !== null
  /*
   * composeBusy 本地拼接中
   * composeProgress 拉取/拼接进度
   * composeError 失败原因
   */
  const { capabilities } = useMarketplace()
  const [publishOpen, setPublishOpen] = useState(false)
  const [composeBusy, setComposeBusy] = useState(false)
  const [composeProgress, setComposeProgress] = useState<EpisodeComposeProgress | null>(null)
  const [composeError, setComposeError] = useState('')
  const composeClips = listEpisodeComposeClips(fragments)
  const missingCount = fragments.length - composeClips.length
  // 后期字幕模式且字幕板有内容：成片需在服务端烧录字幕
  const burnSubtitles =
    subtitleMode === 'post' &&
    buildDramaSubtitleBoard(fragments.filter((f) => Boolean(f.video))).length > 0

  // 拼接已生成镜头并下载成片（后期字幕模式由服务端烧录字幕）
  async function handleComposeDownload() {
    if (composeBusy || composeClips.length === 0) return
    if (missingCount > 0) {
      const ok = await dialog.confirm({
        title: t('episode.sidePane.missingTitle'),
        message: t('episode.sidePane.missingMsg', { missing: missingCount, n: composeClips.length }),
        confirmText: t('episode.sidePane.continueCompose'),
      })
      if (!ok) return
    }
    setComposeError('')
    setComposeBusy(true)
    setComposeProgress({
      phase: burnSubtitles ? 'server' : 'download',
      done: 0,
      total: composeClips.length,
    })
    try {
      const blob = await composeEpisodeVideoClient(composeClips, setComposeProgress, {
        episodeId,
        burnSubtitles,
      })
      triggerBlobDownload(blob, episodeComposeFilename(episodeName))
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : t('episode.sidePane.composeFailed'))
    } finally {
      setComposeBusy(false)
      setComposeProgress(null)
    }
  }

  return (
    <aside className="drama-ep-preview">
      <div className="drama-ep-side-header">
        <div className="drama-ep-side-tabs" role="tablist" aria-label={t('episode.sidePane.tabsAria')}>
          <button type="button" role="tab" aria-selected className="active">
            {t('episode.sidePane.preview')}
          </button>
          <button type="button" role="tab" onClick={onOpenStoryboard}>
            {t('episode.sidePane.canvas')}
          </button>
        </div>
        <button
          type="button"
          className="drama-ep-compose-btn drama-ep-compose-btn--header"
          disabled={composeBusy || composeClips.length === 0}
          title={
            composeClips.length === 0
              ? t('episode.sidePane.composeNeedVideo')
              : burnSubtitles
                ? t('episode.sidePane.composeHintSubtitles')
                : t('episode.sidePane.composeHint')
          }
          onClick={() => void handleComposeDownload()}
        >
          {composeBusy ? (
            <Loader2 size={14} className="drama-ep-compose-spin" />
          ) : (
            <Download size={14} strokeWidth={1.8} />
          )}
          {composeProgressLabel(composeProgress, composeBusy, burnSubtitles)}
        </button>
        {capabilities?.enabled && projectId && episodeId ? (
          <button
            type="button"
            className="drama-ep-compose-btn drama-ep-compose-btn--header"
            onClick={() => setPublishOpen(true)}
          >
            {t('episode.sidePane.publishMarket')}
          </button>
        ) : null}
      </div>
      {composeError ? <p className="drama-ep-compose-error drama-ep-compose-error--header">{composeError}</p> : null}

      {previewVideoUrl ? (
        <div className="drama-ep-preview-banner">
          <span>
            {t('episode.sidePane.previewingVersion')}
            {previewLabel ? ` · ${previewLabel}` : ''}
          </span>
          <div className="drama-ep-preview-banner-actions">
            {onActivatePreview ? (
              <button type="button" className="drama-ep-preview-banner-btn" onClick={onActivatePreview}>
                {t('episode.sidePane.setCurrent')}
              </button>
            ) : null}
            {onClearPreview ? (
              <button type="button" className="drama-ep-preview-banner-btn is-ghost" onClick={onClearPreview}>
                {t('episode.sidePane.exitPreview')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!hasSelection || fragments.length === 0 ? (
        <p className="drama-ep-empty">{t('episode.sidePane.selectFragment')}</p>
      ) : (
        <>
          <div className="drama-ep-preview-inner">
            <DramaFragmentSegmentedVideoPlayer
              fragments={fragments}
              playingFragmentId={playingFragmentId}
              onPlayingFragmentChange={onPlayingFragmentChange}
              aspectRatio={aspectRatio}
              overrideVideoUrl={previewVideoUrl}
              overridePosterUrl={previewPosterUrl}
            />
            {!fragments.some((f) => f.video) && (
              <button type="button" className="drama-ep-open-canvas" onClick={onOpenStoryboard}>
                {t('episode.sidePane.openCanvas')}
              </button>
            )}
          </div>
          <DramaSubtitleBoard
            fragments={fragments}
            episodeName={episodeName}
            subtitleMode={subtitleMode}
          />
        </>
      )}
      {publishOpen && capabilities?.enabled && projectId && <DramaPublishModal projectId={Number(projectId)} initialEpisodeId={episodeId} onClose={() => setPublishOpen(false)} />}
    </aside>
  )
}
