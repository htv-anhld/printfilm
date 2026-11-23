/** 漫剧全局生成队列：右下角圆钮，展示图片 / 视频等任务 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clapperboard, ImageIcon, Layers, Octagon, Trash2, X } from 'lucide-react'
import { dramaApi } from '../../api/drama'
import { DramaGenTaskDetail } from './DramaGenTaskDetail'
import { formatDramaGenError } from '../../lib/dramaGenError'
import BillingTopupLink from '../billing/BillingTopupLink'
import {
  clearFinishedDramaGenJobs,
  DRAMA_GEN_SUBTYPE_FRAGMENT_VIDEO,
  formatDramaGenJobSubtype,
  ensureEpisodeVideoStatusPoll,
  markVideoJobsCancelled,
  subscribeDramaGenQueueOpen,
  useDramaGenQueue,
  type DramaGenJob,
} from '../../lib/dramaGenQueue'
import { tr, useI18n } from '../../i18n'
import '../../pages/drama/drama.css'

const OPEN_STORAGE_KEY = 'drama-gen-queue-fab-open'

const IMAGE_SUBTYPES = new Set(['character', 'scene', 'prop', 'material'])

// 读取折叠偏好
function readOpenPreference(): boolean {
  try {
    return localStorage.getItem(OPEN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// 任务类型展示
function jobTypeLabel(job: DramaGenJob): string {
  if (job.kind === 'video') return formatDramaGenJobSubtype(job.subtype || DRAMA_GEN_SUBTYPE_FRAGMENT_VIDEO)
  if (IMAGE_SUBTYPES.has(job.subtype)) return tr(`drama.genQueue.imageSubtype.${job.subtype}`)
  return job.subtype || tr('drama.genQueue.image')
}

// 任务图标
function JobKindIcon({ kind }: { kind: DramaGenJob['kind'] }) {
  if (kind === 'video') return <Clapperboard size={16} strokeWidth={1.75} aria-hidden />
  return <ImageIcon size={16} strokeWidth={1.75} aria-hidden />
}

// 渲染右下角统一生成队列
export function DramaGenQueuePanel() {
  const { t } = useI18n()
  const queue = useDramaGenQueue()
  const [open, setOpen] = useState(readOpenPreference)
  const [detailJob, setDetailJob] = useState<DramaGenJob | null>(null)

  const active = useMemo(
    () => queue.filter((j) => j.status === 'queued' || j.status === 'running'),
    [queue],
  )
  const finished = useMemo(
    () => queue.filter((j) => j.status === 'done' || j.status === 'failed'),
    [queue],
  )
  const failed = useMemo(() => queue.filter((j) => j.status === 'failed'), [queue])

  // 列表按入队时间倒序（最新在上）；排队序号仍按先入先出
  const sortedQueue = useMemo(
    () => [...queue].sort((a, b) => b.createdAt - a.createdAt),
    [queue],
  )
  const queuedOnly = useMemo(
    () =>
      queue
        .filter((j) => j.status === 'queued' || j.status === 'running')
        .sort((a, b) => a.createdAt - b.createdAt),
    [queue],
  )

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, open ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [open])

  // 入队后自动展开面板
  useEffect(() => {
    return subscribeDramaGenQueueOpen(() => {
      setOpen(true)
    })
  }, [])

  // 有进行中的分镜视频时后台轮询，离开编辑页也不中断
  useEffect(() => {
    if (active.some((job) => job.kind === 'video' && job.subtype === DRAMA_GEN_SUBTYPE_FRAGMENT_VIDEO)) {
      ensureEpisodeVideoStatusPoll()
    }
  }, [active])

  // 详情随队列刷新同步同一 job
  useEffect(() => {
    if (!detailJob) return
    const latest = queue.find((j) => j.id === detailJob.id)
    if (!latest) {
      setDetailJob(null)
      return
    }
    if (latest !== detailJob) setDetailJob(latest)
  }, [queue, detailJob])

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setDetailJob(null)
  }, [])

  const cancelAllVideo = useCallback(async () => {
    try {
      await dramaApi.cancelAllVideoJobs()
      markVideoJobsCancelled()
    } catch {
      /* ignore */
    }
  }, [])

  if (queue.length === 0) return null

  const badgeCount = active.length

  return (
    <div className="drama-gen-fab-root">
      {open ? (
        <div className="drama-gen-fab-panel" role="dialog" aria-label={t('drama.genQueue.title')}>
          {detailJob ? (
            <DramaGenTaskDetail job={detailJob} onClose={() => setDetailJob(null)} />
          ) : (
            <>
              <header className="drama-gen-fab-head">
                <div className="drama-gen-fab-title">
                  <Layers size={18} strokeWidth={1.75} aria-hidden />
                  <div>
                    <strong>{t('drama.genQueue.title')}</strong>
                    <span>
                      {active.length > 0
                        ? t('drama.genQueue.activeN', { n: active.length })
                        : failed.length > 0
                          ? t('drama.genQueue.failedN', { n: failed.length })
                          : finished.length > 0
                            ? t('drama.genQueue.allDone')
                            : ''}
                    </span>
                  </div>
                </div>
                <div className="drama-gen-fab-actions">
                  {active.some((j) => j.kind === 'video') ? (
                    <button
                      type="button"
                      className="drama-gen-fab-icon-btn"
                      onClick={cancelAllVideo}
                      title={t('drama.genQueue.cancelAllVideo')}
                      aria-label={t('drama.genQueue.cancelAllVideo')}
                    >
                      <Octagon size={16} />
                    </button>
                  ) : null}
                  {finished.length > 0 ? (
                    <button
                      type="button"
                      className="drama-gen-fab-icon-btn"
                      onClick={clearFinishedDramaGenJobs}
                      title={t('drama.genQueue.clearFinished')}
                      aria-label={t('drama.genQueue.clearFinished')}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="drama-gen-fab-icon-btn"
                    onClick={close}
                    title={t('drama.genQueue.closeQueue')}
                    aria-label={t('drama.genQueue.closeQueue')}
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>

              <ul className="drama-gen-fab-list">
                {sortedQueue.map((job) => {
                  const queueIndex = queuedOnly.findIndex((j) => j.id === job.id)
                  const errView = job.status === 'failed' ? formatDramaGenError(job.error) : null
                  return (
                    <li key={job.id}>
                      <button
                        type="button"
                        className={`drama-gen-fab-item is-${job.status} is-clickable`}
                        onClick={() => setDetailJob(job)}
                      >
                        <div className="drama-gen-fab-item-head">
                          <div className="drama-gen-fab-item-main">
                            <span className="drama-gen-fab-kind">
                              <JobKindIcon kind={job.kind} />
                              <em>{job.kind === 'video' ? t('drama.genQueue.video') : t('drama.genQueue.image')}</em>
                            </span>
                            <span className="drama-gen-fab-name">{job.title}</span>
                            <span className="drama-gen-fab-type">{jobTypeLabel(job)}</span>
                            {job.message && (job.status === 'queued' || job.status === 'running') ? (
                              <span className="drama-gen-fab-msg">{job.message}</span>
                            ) : null}
                          </div>
                          <span className="drama-gen-fab-status">
                            {job.status === 'queued' && queueIndex >= 0
                              ? queuedOnly.length <= 1 || queueIndex === 0
                                ? t('drama.genQueue.status.queued')
                                : t('drama.genQueue.queuePos', { n: queueIndex + 1 })
                              : t(`drama.genQueue.status.${job.status}`)}
                          </span>
                        </div>
                        {errView ? (
                          <div className="drama-gen-fab-error-block">
                            <p className="drama-gen-fab-error-title">{errView.title}</p>
                            <p className="drama-gen-fab-error">{errView.message}</p>
                            {errView.suggestion ? (
                              <p className="drama-gen-fab-error-tip">{errView.suggestion}</p>
                            ) : null}
                            {errView.billingBlocked ? (
                              <p className="drama-gen-fab-error-tip">
                                <BillingTopupLink className="pf-link pf-billing-topup-link drama-gen-fab-topup-link" />
                              </p>
                            ) : null}
                            {errView.upstreamAccountBlocked ? (
                              <p className="drama-gen-fab-error-tip drama-gen-fab-upstream-tip">
                                {t('drama.genQueue.upstreamTip')}
                              </p>
                            ) : null}
                            <span className="drama-gen-fab-open-hint">{t('drama.genQueue.viewReason')}</span>
                          </div>
                        ) : (
                          <span className="drama-gen-fab-open-hint">{t('drama.genQueue.viewDetail')}</span>
                        )}
                        {(job.status === 'queued' || job.status === 'running') && (
                          <div className="drama-gen-fab-bar" aria-hidden />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>

              {active.length > 0 ? (
                <footer className="drama-gen-fab-foot">
                  <span className="drama-gen-fab-foot-dot" aria-hidden />
                </footer>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className={`drama-gen-fab-btn${active.length > 0 ? ' is-busy' : ''}${failed.length > 0 && active.length === 0 ? ' is-failed' : ''}`}
        onClick={toggleOpen}
        title={open ? t('drama.genQueue.collapse') : t('drama.genQueue.expand')}
        aria-expanded={open}
        aria-label={t('drama.genQueue.title')}
      >
        <Layers size={22} strokeWidth={1.75} aria-hidden />
        {badgeCount > 0 ? <span className="drama-gen-fab-badge">{badgeCount}</span> : null}
      </button>
    </div>
  )
}
