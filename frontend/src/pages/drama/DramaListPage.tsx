/** 漫剧 Agent 首页：AI 生剧本 / 自由画布 + 我的项目（多选删除）；workflow=canvas 时为自由画布项目列表 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  FolderOpen,
  LayoutGrid,
  Library,
  PenLine,
  Search,
  Sparkles,
  Clock,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import BillingErrorNotice from '../../components/billing/BillingErrorNotice'
import AppShell from '../../components/layout/AppShell'
import Button from '../../components/ui/Button'
import PillFilter, { type PillOption } from '../../components/ui/PillFilter'
import { dramaApi, resolveDramaMediaUrl, type DramaProjectListItem } from '../../api/drama'
import { dialog } from '../../lib/dialog'
import { IMAGE_STYLE_IDS, type ImageStyleId } from '../../lib/dramaImageStyles'
import { formatDramaUsageBrief } from '../../lib/dramaUsage'
import {
  dramaProjectEntryPath,
  formatDramaCardMeta,
  isCanvasWorkflow,
  type DramaProjectFilter,
  type DramaWorkflow,
} from '../../lib/dramaWorkflow'
import { pageCountOf } from '../../lib/pagination'
import Pagination from '../../components/ui/Pagination'
import RequireAuth from './RequireAuth'
import VideoGenSettings, { type VideoGenValue } from '../../components/ui/VideoGenSettings'
import {
  isDraftCapableModel,
  useEpisodeDurationOptions,
  useVideoModelOptions,
  type EpisodeDuration,
} from '../../lib/videoModelOptions'
import OptionPicker from '../../components/ui/OptionPicker'
import { tr, useI18n } from '../../i18n'
import { DramaContentLocaleSelect } from '../../components/drama/DramaContentLocaleSelect'
import type { DramaContentLocale } from '../../components/drama/dramaContentLocale'
import { DramaEpisodeCountPopover } from './DramaEpisodeCountPopover'
import { DramaImageStyleModal } from './DramaImageStyleModal'
import { DramaProjectCardMenu } from './DramaProjectCardMenu'
import DramaScriptUpload from './DramaScriptUpload'
import DramaPublishModal from '../../features/marketplace/DramaPublishModal'
import { useMarketplace } from '../../features/marketplace/hooks'
import './drama.css'

const CREATIVE_MIN_LENGTH = 20
const CREATIVE_MAX_LENGTH = 2000

type AgentTab = 'ai' | 'canvas'

// 格式化更新时间
function formatUpdatedAt(raw?: string) {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 封面标题是否适合竖排：仅中日韩文字竖排，拉丁/越南语等保持横排且保留空格
function isCjkTitle(name: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(name || '')
}

// 封面占位标题（无预览图时）：CJK 去空格竖排截断，其它文字保留空格并横排截断
function coverFallbackLabel(name: string): string {
  const cjk = isCjkTitle(name)
  const clean = cjk ? (name || '').replace(/\s+/g, '') : (name || '').replace(/\s+/g, ' ').trim()
  const max = cjk ? 12 : 40
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1)}…`
}

const FILTER_KEYS: DramaProjectFilter[] = ['all', 'running', 'done', 'draft']

const PAGE_SIZE_DEFAULT = 12

export default function DramaListPage({ workflow = 'script' }: { workflow?: DramaWorkflow }) {
  return (
    <RequireAuth>
      <DramaListInner key={workflow} workflow={workflow} />
    </RequireAuth>
  )
}

// 渲染 Agent 首页内容
function DramaListInner({ workflow }: { workflow: DramaWorkflow }) {
  const navigate = useNavigate()
  const { t, m, locale } = useI18n()
  // canvasMode 自由画布列表（/canvas）：只列画布项目，新建直接进画布
  const canvasMode = workflow === 'canvas'
  const { capabilities } = useMarketplace()
  const [publishProjectId, setPublishProjectId] = useState<number | null>(null)
  const filterOptions = useMemo<PillOption<DramaProjectFilter>[]>(
    () =>
      FILTER_KEYS.filter((value) => !canvasMode || value !== 'done').map((value) => ({
        value,
        label: canvasMode && value === 'draft' ? t('canvasList.emptyFilter') : m.dramaList.filters[value],
      })),
    [m, t, canvasMode],
  )
  /*
   * storyText AI 创意输入
   * episodeCount 目标集数
   * imageStyleId 画面风格
   * items 我的项目列表
   * loading 列表加载中
   * busy 创建中
   * canvasBusy 画布创建中
   * error 错误文案
   * selected 多选 id
   * deleting 批量删除中
   * filter 列表筛选
   * query 搜索
   * showCreate 是否展开新建面板
   */
  const [storyText, setStoryText] = useState('')
  const [episodeCount, setEpisodeCount] = useState(12)
  const [imageStyleId, setImageStyleId] = useState<ImageStyleId | ''>('')
  const [items, setItems] = useState<DramaProjectListItem[]>([])
  // total / page 服务端分页；relation 画布列表的「我创建 / 我参与」筛选
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = PAGE_SIZE_DEFAULT
  const [relation, setRelation] = useState<'all' | 'owned' | 'joined'>('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [canvasBusy, setCanvasBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [filter, setFilter] = useState<DramaProjectFilter>('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [contentLocale, setContentLocale] = useState<DramaContentLocale>(locale)
  const location = useLocation()
  // genSettings 项目级视频设置（模型 / 画幅 / 清晰度），写入项目 params
  const [genSettings, setGenSettings] = useState<VideoGenValue>({
    model: '',
    ratio: '9:16',
    resolution: '480p',
    draft: false,
  })
  // createTab 新建方式：上传剧本 / AI 写剧本；scriptFile 待上传的剧本文件
  const [createTab, setCreateTab] = useState<'upload' | 'ai'>('upload')
  const [scriptFile, setScriptFile] = useState<File | null>(null)
  // episodeDuration 单集时长（0 = 默认 60–90 秒），决定 AI 写正文篇幅与分镜条数
  const [episodeDuration, setEpisodeDuration] = useState<EpisodeDuration>(0)
  const durationOptions = useEpisodeDurationOptions()
  const { defaultId: defaultVideoModel } = useVideoModelOptions()

  // 目录到达后用后台默认视频模型填充
  useEffect(() => {
    if (!defaultVideoModel) return
    setGenSettings((prev) => (prev.model ? prev : { ...prev, model: defaultVideoModel }))
  }, [defaultVideoModel])

  // 首页「精选风格」带来的风格：预选并展开新建面板
  useEffect(() => {
    const picked = (location.state as { imageStyleId?: string } | null)?.imageStyleId
    if (!picked || !(IMAGE_STYLE_IDS as readonly string[]).includes(picked)) return
    setImageStyleId(picked as ImageStyleId)
    if (!canvasMode) setShowCreate(true)
  }, [location.state, canvasMode])

  // 搜索防抖，避免每敲一个字就请求一次
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  // 请求序号：筛选/页码连续变化时按序号丢弃过期响应，避免旧数据覆盖新页
  const loadSeq = useRef(0)

  // 加载当前页项目：筛选与分页均在服务端完成
  const loadProjects = useCallback(async () => {
    const seq = ++loadSeq.current
    try {
      const res = await dramaApi.listProjects({
        workflow,
        relation: canvasMode ? relation : undefined,
        status: filter,
        q: debouncedQuery || undefined,
        page,
        page_size: pageSize,
      })
      if (seq !== loadSeq.current) return
      setItems(res.items)
      setTotal(res.meta.total)
      setError('')
      // 服务端会对越界页码收口（如删除后末页变空），同步回真实页码
      if (res.meta.page !== page) setPage(res.meta.page)
    } catch (err) {
      if (seq !== loadSeq.current) return
      setError(err instanceof Error ? err.message : tr('drama.common.loadFailed'))
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [workflow, canvasMode, relation, filter, debouncedQuery, page, pageSize])

  useEffect(() => {
    setLoading(true)
    void loadProjects()
  }, [loadProjects])

  const pageCount = pageCountOf(total, pageSize)
  // 筛选后若当前页超出范围则回退
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  // 项目级生成设置 → params（视频模型 / 画幅 / 清晰度 / Draft）
  function projectGenParams(): Record<string, unknown> {
    return {
      aspect_ratio: genSettings.ratio,
      resolution: genSettings.resolution,
      draft_mode: Boolean(genSettings.draft && isDraftCapableModel(genSettings.model)),
      ...(episodeDuration ? { episode_duration_sec: episodeDuration } : {}),
      ...(genSettings.model ? { video_model: genSettings.model } : {}),
    }
  }

  // 上传剧本：建项目（原文按集保留）后进入大纲步骤，大纲会自动提取人物与梗概
  async function handleImport() {
    if (!scriptFile) {
      setError(t('scriptImport.needFile'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const project = await dramaApi.importScriptProject(scriptFile, {
        image_style_id: imageStyleId || undefined,
        content_locale: contentLocale,
        params: projectGenParams(),
      })
      navigate(`/drama/projects/${project.id}`, { state: { activeStep: 'outline' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('drama.common.createFailed'))
      setBusy(false)
    }
  }

  // AI 立即生成：创建项目并进入大纲步骤
  async function handleGenerate() {
    const source = storyText.trim()
    if (source.length < CREATIVE_MIN_LENGTH) {
      setError(t('drama.list.storyTooShort', { n: CREATIVE_MIN_LENGTH }))
      return
    }
    if (source.length > CREATIVE_MAX_LENGTH) {
      setError(t('drama.list.storyTooLong', { n: CREATIVE_MAX_LENGTH }))
      return
    }
    setBusy(true)
    setError('')
    try {
      // content_locale：后端按此语言生成大纲/剧本
      const body: Parameters<typeof dramaApi.createProject>[0] = {
        source,
        episode_count: episodeCount,
        image_style_id: imageStyleId || undefined,
        title: source.slice(0, 40),
        content_locale: contentLocale,
        params: projectGenParams(),
      }
      const project = await dramaApi.createProject(body)
      navigate(`/drama/projects/${project.id}`, { state: { activeStep: 'outline' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('drama.common.createFailed'))
    } finally {
      setBusy(false)
    }
  }

  // 自由画布：创建占位创意项目并进入画布
  async function handleEnterCanvas() {
    if (canvasBusy) return
    setCanvasBusy(true)
    setError('')
    try {
      const body: Parameters<typeof dramaApi.createProject>[0] = {
        source: t('drama.list.canvasPlaceholder'),
        episode_count: 1,
        title: t('drama.list.canvasProjectTitle'),
        workflow: 'canvas',
        content_locale: locale,
      }
      const project = await dramaApi.createProject(body)
      navigate(`/drama/projects/${project.id}/printfilm-studio`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('drama.list.canvasCreateFailed'))
    } finally {
      setCanvasBusy(false)
    }
  }

  // 切换 Tab；画布 Tab 直接创建并跳转
  function handleTabClick(next: AgentTab) {
    if (next === 'canvas') {
      void handleEnterCanvas()
    }
  }

  // 新建入口：画布列表直接建画布项目，剧本列表展开新建面板
  function openCreate() {
    if (canvasMode) {
      handleTabClick('canvas')
      return
    }
    setShowCreate(true)
    handleTabClick('ai')
  }

  const selectionMode = selected.size > 0
  const storyLen = storyText.trim().length
  const canGenerate = storyLen >= CREATIVE_MIN_LENGTH && storyLen <= CREATIVE_MAX_LENGTH && !busy
  const charCountClass =
    storyLen > CREATIVE_MAX_LENGTH
      ? ' is-over'
      : storyLen >= CREATIVE_MIN_LENGTH
        ? ' is-ok'
        : ''

  // 未加任何筛选且结果为空时才展示「还没有项目」大空态
  const pristineEmpty = total === 0 && filter === 'all' && relation === 'all' && !debouncedQuery

  // 切换选中
  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // 打开项目：自由画布进画布，普通项目进工作台
  function openProject(item: DramaProjectListItem) {
    if (selectionMode && item.is_owner !== false) {
      toggleSelect(item.id)
      return
    }
    navigate(dramaProjectEntryPath(item))
  }

  // 重命名
  async function handleRename(item: DramaProjectListItem) {
    const name = await dialog.prompt({
      title: t('dramaList.renameTitle'),
      message: t('dramaList.renameMessage'),
      defaultValue: item.title,
      confirmText: t('common.save'),
    })
    if (!name?.trim() || name.trim() === item.title) return
    try {
      await dramaApi.updateProject(item.id, { title: name.trim() })
      await loadProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dramaList.renameFailed'))
    }
  }

  // 删除单个
  async function handleDeleteOne(item: DramaProjectListItem) {
    const ok = await dialog.confirm({
      title: t('dramaList.deleteTitle'),
      message: t('dramaList.deleteOne', { title: item.title }),
      confirmText: t('common.delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await dramaApi.deleteProject(item.id)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      await loadProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dramaList.deleteFailed'))
    }
  }

  // 批量删除
  async function handleDeleteSelected() {
    const ids = [...selected]
    if (ids.length === 0) return
    const ok = await dialog.confirm({
      title: t('dramaList.deleteTitle'),
      message: t('dramaList.deleteMany', { count: ids.length }),
      confirmText: t('common.delete'),
      tone: 'danger',
    })
    if (!ok) return
    setDeleting(true)
    try {
      // allSettled 保证单项失败不影响其余删除；已被删除（404）的视为完成并移出选择
      const results = await Promise.allSettled(ids.map((id) => dramaApi.deleteProject(id)))
      const gone = new Set<number>()
      let failed = 0
      results.forEach((result, index) => {
        const status = result.status === 'rejected' ? (result.reason as { status?: number } | undefined)?.status : undefined
        if (result.status === 'fulfilled' || status === 404) gone.add(ids[index])
        else failed += 1
      })
      setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))))
      if (failed > 0) setError(t('dramaList.deleteFailed'))
      await loadProjects()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppShell active="drama">
      <div className="drama-page drama-agent-page pf-drama-list">
        <header className="pf-drama-list-head">
          <div className="pf-drama-list-title-row">
            <h1>{canvasMode ? t('canvasList.title') : t('dramaList.title')}</h1>
            <div className="pf-drama-list-actions">
              <Button variant="ghost" size="sm" to="/drama/assets">
                <Library size={15} strokeWidth={1.75} aria-hidden />
                {t('dramaList.assets')}
              </Button>
              {canvasMode ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={canvasBusy}
                  onClick={() => handleTabClick('canvas')}
                >
                  <LayoutGrid size={15} strokeWidth={1.75} aria-hidden />
                  {canvasBusy ? t('dramaList.creating') : t('dramaList.canvas')}
                </Button>
              )}
              <Button
                variant="lime"
                size="sm"
                disabled={canvasMode && canvasBusy}
                onClick={openCreate}
              >
                {canvasMode ? (canvasBusy ? t('dramaList.creating') : t('canvasList.newCanvas')) : t('dramaList.newProject')}
              </Button>
            </div>
          </div>
          {canvasMode ? <p className="pf-muted">{t('canvasList.description')}</p> : null}

          {canvasMode ? (
            <PillFilter<'all' | 'owned' | 'joined'>
              options={[
                { value: 'all', label: t('drama.list.relationAll') },
                { value: 'owned', label: t('drama.list.relationOwned') },
                { value: 'joined', label: t('drama.list.relationJoined') },
              ]}
              value={relation}
              onChange={(next) => { setRelation(next); setPage(1); setSelected(new Set()) }}
              ariaLabel={t('drama.list.relationAria')}
            />
          ) : null}
          <div className="pf-drama-list-toolbar">
            <PillFilter<DramaProjectFilter>
              options={filterOptions}
              value={filter}
              onChange={(next) => { setFilter(next); setPage(1) }}
              ariaLabel={t('dramaList.filterAria')}
            />
            <label className="pf-drama-search">
              <Search size={16} strokeWidth={2} aria-hidden />
              <span className="sr-only">{t('dramaList.searchAria')}</span>
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1) }}
                placeholder={canvasMode ? t('canvasList.searchPlaceholder') : t('dramaList.searchPlaceholder')}
              />
            </label>
          </div>
        </header>

        {showCreate && !canvasMode ? (
          <section className="drama-agent-panel pf-drama-create-panel" aria-label={t('dramaList.createAria')}>
            <div className="drama-agent-panel-head">
              <div className="drama-agent-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={createTab === 'upload'}
                  className={createTab === 'upload' ? 'active' : ''}
                  onClick={() => setCreateTab('upload')}
                >
                  <Upload size={15} strokeWidth={1.75} aria-hidden />
                  {t('scriptImport.tabUpload')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={createTab === 'ai'}
                  className={createTab === 'ai' ? 'active' : ''}
                  onClick={() => setCreateTab('ai')}
                >
                  <PenLine size={15} strokeWidth={1.75} aria-hidden />
                  {t('scriptImport.tabAi')}
                </button>
              </div>
              <button type="button" className="pf-link pf-drama-collapse" onClick={() => setShowCreate(false)}>
                {t('dramaList.collapse')}
              </button>
            </div>
            <div className="drama-agent-tips" role="note">
              <Sparkles size={15} strokeWidth={1.75} aria-hidden />
              <span>
                {createTab === 'upload'
                  ? t('scriptImport.uploadLead')
                  : t('dramaList.tipRest', {
                      a: t('dramaList.tipStrong1'),
                      b: t('dramaList.tipStrong2'),
                      c: t('dramaList.tipStrong3'),
                    })}
              </span>
            </div>
            <div className="drama-agent-ai">
              {createTab === 'upload' ? (
                <DramaScriptUpload file={scriptFile} onFileChange={setScriptFile} onError={setError} disabled={busy} />
              ) : (
              <>
              <label className="drama-agent-ai-label" htmlFor="drama-agent-story">
                {t('dramaList.storyLabel')}
              </label>
              <div className={`drama-agent-ai-field${storyText.trim() ? ' has-value' : ''}`}>
                <textarea
                  id="drama-agent-story"
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value.slice(0, CREATIVE_MAX_LENGTH + 50))}
                  disabled={busy}
                  placeholder={t('drama.list.storyPlaceholder')}
                  rows={7}
                  maxLength={CREATIVE_MAX_LENGTH + 50}
                />
                <span
                  className={`drama-agent-char-count${charCountClass}`}
                  aria-live="polite"
                >
                  {storyLen}
                  <span className="drama-agent-char-sep">/</span>
                  {CREATIVE_MAX_LENGTH}
                </span>
              </div>
              </>
              )}
              <div className="drama-agent-gen-settings">
                <span className="drama-agent-gen-label">{t('genSettings.title')}</span>
                <VideoGenSettings value={genSettings} onChange={setGenSettings} disabled={busy} />
              </div>
              <div className="drama-agent-ai-footer">
                <div className="drama-agent-ai-options">
                  <DramaImageStyleModal value={imageStyleId} onChange={setImageStyleId} disabled={busy} videoModelId={genSettings.model} />
                  {createTab === 'ai' ? (
                    <>
                      <span className="drama-agent-opt-divider" aria-hidden />
                      <DramaEpisodeCountPopover value={episodeCount} onChange={setEpisodeCount} disabled={busy} />
                      <span className="drama-agent-opt-divider" aria-hidden />
                      <OptionPicker
                        icon={<Clock size={14} aria-hidden />}
                        title={t('genSettings.episodeDuration')}
                        value={episodeDuration}
                        options={durationOptions}
                        onChange={setEpisodeDuration}
                        disabled={busy}
                      />
                    </>
                  ) : null}
                  <span className="drama-agent-opt-divider" aria-hidden />
                  <DramaContentLocaleSelect value={contentLocale} onChange={setContentLocale} disabled={busy} />
                </div>
                <Button
                  variant="lime"
                  size="md"
                  className="drama-agent-generate-btn"
                  disabled={createTab === 'ai' ? !canGenerate : busy || !scriptFile}
                  onClick={() => void (createTab === 'ai' ? handleGenerate() : handleImport())}
                >
                  {createTab === 'ai' ? (
                    <Sparkles size={16} strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Upload size={16} strokeWidth={1.75} aria-hidden />
                  )}
                  {createTab === 'ai'
                    ? busy
                      ? t('drama.common.creating')
                      : t('drama.list.generateNow')
                    : busy
                      ? t('scriptImport.creating')
                      : t('scriptImport.create')}
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {error ? <BillingErrorNotice message={error} className="drama-error drama-agent-error" /> : null}

        {loading ? (
          <div className="pf-drama-card-grid" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="pf-drama-card is-skeleton" />
            ))}
          </div>
        ) : pristineEmpty ? (
          <div className="pf-empty-state">
            <div className="pf-empty-illust" aria-hidden>
              <FolderOpen size={48} strokeWidth={1.2} />
            </div>
            <h2>{canvasMode ? t('canvasList.emptyTitle') : t('drama.list.emptyTitle')}</h2>
            <p className="pf-muted">{canvasMode ? t('canvasList.emptyDescription') : t('drama.list.emptyHint')}</p>
            <Button variant="lime" disabled={canvasMode && canvasBusy} onClick={openCreate}>
              {canvasMode ? t('canvasList.newCanvas') : t('drama.list.newProject')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="pf-empty-state is-compact">
            <p className="pf-muted">{t('drama.list.noMatch')}</p>
            <Button variant="ghost" size="sm" onClick={() => { setFilter('all'); setRelation('all'); setQuery(''); setPage(1) }}>
              {t('drama.list.clearFilter')}
            </Button>
          </div>
        ) : (
          <>
          <div className="pf-drama-card-grid">
            <button
              type="button"
              className="pf-drama-card pf-drama-card-new"
              disabled={canvasMode && canvasBusy}
              onClick={openCreate}
            >
              <span className="pf-drama-card-plus" aria-hidden>
                +
              </span>
              <strong>{canvasMode ? t('canvasList.newCanvas') : t('drama.list.newProject')}</strong>
            </button>
            {items.map((item) => {
              const isSelected = selected.has(item.id)
              // owned 非本人创建（团队参与）的项目不可删改 / 发布
              const owned = item.is_owner !== false
              const coverSrc = item.cover_url ? resolveDramaMediaUrl(item.cover_url) : ''
              const canvas = isCanvasWorkflow(item)
              return (
                <article
                  key={item.id}
                  className={`pf-drama-card${isSelected ? ' is-selected' : ''}${canvas ? ' is-canvas' : ''}`}
                >
                  <button
                    type="button"
                    className="pf-drama-card-cover"
                    onClick={() => openProject(item)}
                    aria-label={t('drama.list.openAria', { title: item.title })}
                  >
                    {coverSrc ? (
                      <img
                        src={coverSrc}
                        alt=""
                        className="pf-drama-card-cover-img"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className={`pf-drama-card-cover-fallback${isCjkTitle(item.title) ? '' : ' is-horizontal'}`}>{coverFallbackLabel(item.title)}</span>
                    )}
                    {canvas ? <span className="pf-drama-card-cover-badge is-canvas">{t('drama.list.badgeCanvas')}</span> : null}
                    {!canvas && item.cover_pending ? (
                      <span className="pf-drama-card-cover-badge">{t('drama.list.badgeCoverPending')}</span>
                    ) : null}
                    {!canvas && !coverSrc && !item.cover_pending && item.asset_count > 0 ? (
                      <span className="pf-drama-card-cover-badge is-muted">{t('drama.list.badgeNoImage')}</span>
                    ) : null}
                    {!owned ? (
                      <span className="pf-drama-card-cover-badge is-muted is-joined">
                        <UserRound size={12} aria-hidden /> {t('drama.list.relationJoined')}
                      </span>
                    ) : null}
                    {owned ? (
                      <label
                        className={`drama-project-row-check${isSelected || selectionMode ? ' is-visible' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} />
                      </label>
                    ) : null}
                  </button>
                  <div className="pf-drama-card-body">
                    <div className="pf-drama-card-top">
                      <button type="button" className="pf-drama-card-title" onClick={() => openProject(item)}>
                        {item.title}
                      </button>
                      {owned ? (
                        <DramaProjectCardMenu
                          onRename={() => void handleRename(item)}
                          onDelete={() => void handleDeleteOne(item)}
                          onPublish={capabilities?.enabled ? () => setPublishProjectId(item.id) : undefined}
                        />
                      ) : null}
                    </div>
                    <p className="pf-drama-card-meta">{formatDramaCardMeta(item)}</p>
                    <p className="pf-drama-card-usage" title={canvasMode ? t('canvasList.usageTitle') : t('drama.list.usageTitle')}>
                      {formatDramaUsageBrief(item.usage)}
                    </p>
                    <p className="pf-drama-card-time">{formatUpdatedAt(item.updated_at || item.created_at)}</p>
                  </div>
                </article>
              )
            })}
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            onChange={setPage}
            className="pf-drama-list-pagination"
          />
          </>
        )}

        {selected.size > 0 ? (
          <div className="drama-project-selection-bar">
            <div className="drama-project-selection-inner">
              <span>{t('drama.list.selectedCount', { n: selected.size })}</span>
              <button
                type="button"
                className="drama-project-selection-cancel"
                disabled={deleting}
                onClick={() => setSelected(new Set())}
              >
                {t('drama.list.clearSelection')}
              </button>
              <button
                type="button"
                className="drama-project-selection-delete"
                disabled={deleting}
                onClick={() => void handleDeleteSelected()}
              >
                <Trash2 size={16} strokeWidth={1.8} />
                {deleting ? t('drama.common.deleting') : t('drama.common.delete')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {publishProjectId && capabilities?.enabled ? (
        <DramaPublishModal projectId={publishProjectId} selectReady onClose={() => setPublishProjectId(null)} />
      ) : null}
    </AppShell>
  )
}
