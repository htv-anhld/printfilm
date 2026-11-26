import { readEpisodeJob } from '../../lib/dramaEpisodeJobs'
import { isRequestAborted } from '../../api/http'
import { TeamEditingBoundary } from '../../features/teams/TeamEditingBoundary'
/** 剧情大纲：左栏分集目录 + 右栏本集梗概/剧本与可选创作备注 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Lightbulb,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Maximize2,
  Pencil,
} from 'lucide-react'
import { dramaApi, resolveDramaMediaUrl, type DramaEpisode, type DramaEpisodeBody, type DramaProject, type DramaScript } from '../../api/drama'
import { FragmentPlanSkillModal } from '../../components/drama/FragmentPlanSkillModal'
import { readEpisodePlanSkip } from '../../lib/dramaEpisodePlanSkip'
import { dialog } from '../../lib/dialog'
import {
  buildOutlineDirectory,
  episodeBodyCharLen,
  isImportedEpisode,
  isSubstantialEpisodeBody,
  isSubstantialEpisodeCreative,
  mergeDirectoryEpisodeBodies,
  MIN_EPISODE_BODY_CHARS,
  MIN_EPISODE_CREATIVE_CHARS,
  parseEpisodeBodies,
} from './dramaWorkspaceUtils'
import { sumFragmentContentDuration } from './dramaEpisodeEditUtils'
import { OutlineScriptParseModal, OutlineScriptPreview } from './outlineScriptPreview'
import { tr, useI18n } from '../../i18n'
import DramaStatusNotice, { DramaErrorNotice } from './DramaStatusNotice'

type SectionKey = 'creative' | 'summary' | 'body'

const GENERATION_MODES = ['creative', 'summary', 'brief', 'body', 'full']

/** 单集生成中的状态条标题（按生成模式） */
function generationTitle(mode: string | null): string {
  return mode && GENERATION_MODES.includes(mode)
    ? tr(`drama.outlineEp.genTitles.${mode}`)
    : tr('drama.outlineEp.genTitles.default')
}

/** 分集目录用的镜头合计文案 */
function formatOutlineShotDuration(sec: number): string {
  if (sec <= 0) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? tr('drama.outlinePreview.minSec', { m, s }) : tr('drama.outlinePreview.min', { m })
}

type OutlineEpisodePanelProps = {
  projectId: number
  script: DramaScript | null
  episodeCount: number
  summaryReady: boolean
  /** 全剧摘要生成中（外部目录/空态需显示，不依赖弹窗） */
  summaryGenerating?: boolean
  /** 整剧摘要后抽取资产中 */
  assetsSeeding?: boolean
  episodeGenerating: boolean
  /** 整剧分集剧本进度 */
  episodeProgress?: { done: number; total: number }
  imageStyleLabel?: string
  storyType?: string
  onScriptChange: (script: DramaScript) => void
  onProjectChange: (project: DramaProject) => void
  onError: (msg: string) => void
  onOpenEpisodes: () => void
  children?: (parts: { directory: ReactNode; bodies: ReactNode }) => ReactNode
}

type SectionCardProps = {
  sectionKey: SectionKey
  icon: ReactNode
  title: string
  subtitle: string
  text: string
  editing: boolean
  draft: string
  open: boolean
  busy: boolean
  /** 禁用「生成」按钮；其他集生成中时仍可编辑本集 */
  generateBusy?: boolean
  placeholder: string
  regenerateLabel: string
  onToggle: () => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onDraftChange: (v: string) => void
  onRegenerate?: () => void
  onCopy: () => void
  /** 剧本区：解析预览 + 分段编辑 */
  scriptPreview?: ReactNode
}

// 分区卡片：图标标题 + 编辑/生成/复制/折叠
function SectionCard({
  sectionKey,
  icon,
  title,
  subtitle,
  text,
  editing,
  draft,
  open,
  busy,
  generateBusy,
  placeholder,
  regenerateLabel,
  onToggle,
  onEdit,
  onCancel,
  onSave,
  onDraftChange,
  onRegenerate,
  onCopy,
  scriptPreview,
}: SectionCardProps) {
  const { t } = useI18n()
  const genBusy = generateBusy ?? busy
  return (
    <article className={`drama-outline-section${open ? ' is-open' : ''}`}>
      <header className="drama-outline-section-head">
        <div className="drama-outline-section-title">
          <span className={`drama-outline-section-icon is-${sectionKey}`} aria-hidden>
            {icon}
          </span>
          <div>
            <strong>{title}</strong>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="drama-outline-section-actions">
          <button type="button" className="drama-outline-text-btn" disabled={busy} onClick={onEdit}>
            <Pencil size={14} strokeWidth={2} />
            {t('drama.common.edit')}
          </button>
          {onRegenerate ? (
            <button type="button" className="drama-outline-text-btn" disabled={genBusy} onClick={onRegenerate}>
              <RefreshCw size={14} strokeWidth={2} />
              {regenerateLabel}
            </button>
          ) : null}
          <button type="button" className="drama-outline-text-btn" onClick={onCopy}>
            <Copy size={14} strokeWidth={2} />
            {t('drama.outlineEp.copy')}
          </button>
          <button
            type="button"
            className="drama-outline-text-btn drama-outline-text-btn-icon"
            onClick={onToggle}
            aria-label={
              sectionKey === 'body'
                ? t('drama.outlineEp.popupParse')
                : open
                  ? t('drama.outlineEp.collapse')
                  : t('drama.outlineEp.expand')
            }
          >
            {sectionKey === 'body' ? (
              <Maximize2 size={14} strokeWidth={2} />
            ) : open ? (
              <ChevronUp size={14} strokeWidth={2} />
            ) : (
              <ChevronDown size={14} strokeWidth={2} />
            )}
            {sectionKey === 'body'
              ? t('drama.outlineEp.parsePreview')
              : open
                ? t('drama.outlineEp.collapse')
                : t('drama.outlineEp.expand')}
          </button>
        </div>
      </header>
      {open ? (
        <div className="drama-outline-section-body">
          {editing ? (
            <>
              <textarea
                className="drama-ep-section-textarea"
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                rows={sectionKey === 'body' ? 14 : 8}
                placeholder={placeholder}
                disabled={busy}
              />
              <div className="drama-ep-section-edit-actions">
                <button type="button" className="drama-btn-ghost" disabled={busy} onClick={onCancel}>
                  {t('drama.common.cancel')}
                </button>
                <button type="button" className="drama-btn-primary" disabled={busy} onClick={onSave}>
                  {t('drama.common.save')}
                </button>
              </div>
            </>
          ) : scriptPreview ? (
            scriptPreview
          ) : (
            <p className="drama-pre drama-outline-section-text">{text.trim() || placeholder}</p>
          )}
        </div>
      ) : null}
    </article>
  )
}
// 分集目录 + 本集梗概、拍摄剧本、可选备注
export function OutlineEpisodePanel({
  projectId,
  script,
  episodeCount,
  summaryReady,
  summaryGenerating = false,
  assetsSeeding = false,
  episodeGenerating,
  episodeProgress = { done: 0, total: 0 },
  imageStyleLabel,
  storyType,
  onScriptChange,
  onProjectChange,
  onError,
  onOpenEpisodes,
  children,
}: OutlineEpisodePanelProps) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [activeEpisodeNumber, setActiveEpisodeNumber] = useState(1)
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    () => new Set(['summary', 'body']),
  )
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null)
  const [sectionDraft, setSectionDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [localJobs, setLocalJobs] = useState<Record<number, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [enterSkillOpen, setEnterSkillOpen] = useState(false)
  const [localError, setLocalError] = useState('')
  const [localNotice, setLocalNotice] = useState('')
  const [scriptModalOpen, setScriptModalOpen] = useState(false)
  const [sceneEditing, setSceneEditing] = useState(false)
  const [episodeCovers, setEpisodeCovers] = useState<Record<number, string>>({})
  const [episodeShotStats, setEpisodeShotStats] = useState<
    Record<number, { episodeId: number; fragmentCount: number; totalSec: number; planStatus: string; scriptChanged: boolean }>
  >({})

  const episodeBodies = parseEpisodeBodies(script)
  const directoryEpisodes = buildOutlineDirectory(episodeBodies, episodeCount)
  const displayEpisodes = mergeDirectoryEpisodeBodies(directoryEpisodes, episodeBodies)
  const selected =
    displayEpisodes.find((ep) => ep.episodeNumber === activeEpisodeNumber) || displayEpisodes[0] || null

  const selectedJob = readEpisodeJob(script, selected?.episodeNumber || 0)
  const generatingMode = selected ? localJobs[selected.episodeNumber || 0] || selectedJob.mode || null : null
  const generatingEpisodeNumber = Number(Object.keys(localJobs).find((number) => Number(number) !== selected?.episodeNumber) || 0) || null

  useEffect(() => {
    if (!selected) return
    if (!displayEpisodes.some((ep) => ep.episodeNumber === activeEpisodeNumber) && displayEpisodes[0]) {
      setActiveEpisodeNumber(displayEpisodes[0].episodeNumber || 1)
    }
  }, [displayEpisodes, activeEpisodeNumber, selected])

  useEffect(() => {
    setEditingSection(null)
    setSectionDraft('')
    setTitleDraft(selected?.title || '')
    setLocalError('')
    setLocalNotice('')
    setScriptModalOpen(false)
    setSceneEditing(false)
  }, [selected?.episodeNumber])

  useEffect(() => {
    if (!editingSection) setTitleDraft(selected?.title || '')
  }, [selected?.title, editingSection])

  // 读取分集 AI 分镜状态（含自动入队）
  function readPlanStatus(ep: DramaEpisode): string {
    const active = (ep.active_tasks || []).find((task) => task.task_type === 'fragment_plan')
    if (
      active &&
      !active.cancel_requested &&
      ['pending', 'leased', 'running', 'awaiting_poll', 'awaiting_review'].includes(active.status)
    ) {
      return 'generating'
    }
    const st = ep.params?.fragment_plan_status
    return typeof st === 'string' ? st : ''
  }

  // 从分集列表刷新封面 / 镜数 / 分镜状态
  function applyEpisodeRows(rows: DramaEpisode[]) {
    const map: Record<number, string> = {}
    const shotMap: Record<number, { episodeId: number; fragmentCount: number; totalSec: number; planStatus: string; scriptChanged: boolean }> =
      {}
    for (const ep of rows) {
      const epNo = Number(ep.params?.episodeNumber) || 0
      if (!epNo) continue
      const frags = [...(ep.fragments || [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      )
      const planStatus = readPlanStatus(ep)
      const totalSec =
        frags.length > 0
          ? frags.reduce((sum, f) => {
              const stored = Number(f.duration_sec)
              if (Number.isFinite(stored) && stored > 0) return sum + Math.round(stored)
              return sum + sumFragmentContentDuration(f.content || '')
            }, 0)
          : 0
      shotMap[epNo] = {
        episodeId: ep.id,
        fragmentCount: frags.length,
        totalSec,
        planStatus,
        scriptChanged: ep.params?.fragment_script_changed === true,
      }
      const first = frags.find((f) => (f.cover || '').trim() || (f.video || '').trim())
      if (!first) continue
      const raw = (first.cover || first.video || '').trim()
      if (raw) map[epNo] = resolveDramaMediaUrl(raw)
    }
    setEpisodeCovers(map)
    setEpisodeShotStats(shotMap)
  }

  // 只读已有分集行；勿提前规则 seed（否则会假显示「1 镜」）。分镜中持续轮询。
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    async function refresh() {
      try {
        const rows: DramaEpisode[] = await dramaApi.listEpisodes(projectId)
        if (cancelled) return
        applyEpisodeRows(rows)
        const anyPlanning = rows.some((ep) => readPlanStatus(ep) === 'generating')
        // 分集剧本还在跑时也继续刷，以便每集完成后立刻看到「AI 分镜中」
        if (anyPlanning || episodeGenerating) {
          timer = window.setTimeout(() => {
            void refresh()
          }, 2500)
        }
      } catch {
        if (!cancelled) {
          setEpisodeCovers({})
          setEpisodeShotStats({})
        }
      }
    }

    void refresh()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [projectId, script?.id, script?.episode_content, episodeCount, episodeGenerating, generatingMode])

  const selectedGenerating = Boolean(selected && localJobs[selected.episodeNumber || 0]) || ['queued', 'generating', 'running'].includes(selectedJob.status)
  const anyEpisodeGenerating = Object.keys(localJobs).length > 0
  const effectiveCreative =
    editingSection === 'creative' ? sectionDraft : selected?.creative || ''
  const effectiveSummary =
    editingSection === 'summary' ? sectionDraft : selected?.summary || ''
  const canGenerateBody =
    episodeBodyCharLen(effectiveCreative) >= 10 || episodeBodyCharLen(effectiveSummary) >= 40
  const canRegenerateEpisode =
    isSubstantialEpisodeCreative(effectiveCreative) || episodeBodyCharLen(effectiveSummary) >= 40
  const canAdd =
    summaryReady &&
    !episodeGenerating &&
    !adding &&
    !anyEpisodeGenerating &&
    !confirming &&
    directoryEpisodes.length < 120

  // 整剧批量生成时：已写完正文的集可编辑 / 进分镜 / 重生成；未完成集仍锁生成
  // 单集任务按集号独立；只禁用当前正在生成的一集
  const selectedBodyReady = isSubstantialEpisodeBody(selected?.body)
  const summaryGenerateMode = selectedBodyReady
    ? 'brief'
    : isSubstantialEpisodeCreative(selected?.creative) ? 'summary' : null
  const batchLocksThisEpisode = episodeGenerating && !selectedBodyReady
  const busy = selectedGenerating || confirming || saving || adding
  const generateBusy =
    selectedGenerating || batchLocksThisEpisode || confirming || saving || adding
  // 上传导入的分集正文可能较短，同样允许进入分镜
  const selectedEnterReady = selectedBodyReady || isImportedEpisode(selected ?? undefined)
  const enterBusy = busy || !selectedEnterReady
  // 自动分镜被后端跳过（正文过短等）：显示可操作提示，替代一直转圈的「正在准备 AI 分镜」
  const selectedPlanSkip =
    selected && !episodeShotStats[selected.episodeNumber || 0]?.planStatus
      ? readEpisodePlanSkip(script, selected.episodeNumber)
      : null
  const planSkipMessage = (() => {
    if (!selectedPlanSkip) return ''
    if (selectedPlanSkip.status === 'failed' || selectedPlanSkip.minUnits <= 0) {
      return t('drama.outlineEp.noticePlanFailedBody', { reason: selectedPlanSkip.reason })
    }
    // 后端篇幅为「汉字当量」：中文按字，vi/en 为词数 × 1.6，展示时换回词数
    const cjk = /[\u3400-\u9fff]/.test(selected?.body || '')
    const toShown = (units: number) => (cjk ? units : Math.round(units / 1.6))
    return t(cjk ? 'drama.outlineEp.noticePlanTooShortChars' : 'drama.outlineEp.noticePlanTooShortWords', {
      have: toShown(selectedPlanSkip.units),
      need: toShown(selectedPlanSkip.minUnits),
    })
  })()

  async function pollOptimize(tokenEpisode: number) {
    const started = Date.now()
    let lastErr: Error | null = null
    while (Date.now() - started < 8 * 60 * 1000) {
      await new Promise((r) => setTimeout(r, 2000))
      let cur: DramaScript
      try { cur = await dramaApi.getScript(projectId) }
      catch (err) { if (isRequestAborted(err)) throw err; lastErr = err instanceof Error ? err : new Error(tr('drama.outlineEp.pollFailed')); continue }
      onScriptChange(cur)
      lastErr = null
      const job = readEpisodeJob(cur, tokenEpisode)
      if (job.status === 'completed') return cur
      if (job.status === 'failed' || job.status === 'cancelled') throw new Error(job.error || tr('drama.outlineEp.jobFailedOrCancelled'))

    }
    throw lastErr || new Error(tr('drama.outlineEp.genTimeout'))
  }

  async function saveBodies(nextBodies: DramaEpisodeBody[]) {
    if (!selected?.episodeNumber) throw new Error(tr('drama.outlineEp.selectEpisodeFirst'))
    const current = nextBodies.find((item) => item.episodeNumber === selected.episodeNumber)
    if (!current) throw new Error(tr('drama.outlineEp.episodeMissing'))
    await dramaApi.updateScriptEpisode(projectId, selected.episodeNumber, { title: current.title, creative: current.creative, summary: current.summary, body: current.body, version: Number((script?.params?.episode_versions as Record<string, number> | undefined)?.[String(selected.episodeNumber)] ?? 0) })
    const updated = await dramaApi.getScript(projectId)
    onScriptChange(updated)
    return updated
  }

  async function handleAddEpisode() {
    if (!canAdd) return
    setAdding(true)
    setLocalError('')
    try {
      const res = await dramaApi.addEpisode({ project_id: projectId })
      onScriptChange(res.script)
      const p = await dramaApi.getProject(projectId)
      onProjectChange(p)
      setActiveEpisodeNumber(res.episode_number)
      setEditingSection('summary')
      setSectionDraft('')
      setOpenSections((prev) => new Set(prev).add('summary'))
      onOpenEpisodes()
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : t('drama.outlineEp.addFailed')
      setLocalError(msg)
      onError(msg)
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveSection(section: SectionKey) {
    if (!selected?.episodeNumber) return
    setSaving(true)
    setLocalError('')
    try {
      const num = selected.episodeNumber
      const next = displayEpisodes.map((ep) => {
        if (ep.episodeNumber !== num) return ep
        if (section === 'creative') return { ...ep, creative: sectionDraft, title: titleDraft || ep.title }
        if (section === 'summary') return { ...ep, summary: sectionDraft, title: titleDraft || ep.title }
        return { ...ep, body: sectionDraft, title: titleDraft || ep.title }
      })
      await saveBodies(next)
      setEditingSection(null)
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : t('drama.common.saveFailed')
      setLocalError(msg)
      onError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate(mode: 'summary' | 'body' | 'full' | 'brief') {
    if (!selected?.episodeNumber) return
    if (editingSection || sceneEditing) {
      setLocalError(t('drama.outlineEp.saveBeforeGenerate'))
      return
    }
    const creative = selected.creative || ''
    const summary = selected.summary || ''
    if (mode === 'summary' && !isSubstantialEpisodeCreative(creative)) {
      setLocalError(t('drama.outlineEp.creativeTooShort', { n: MIN_EPISODE_CREATIVE_CHARS }))
      return
    }
    if (mode === 'full' && !isSubstantialEpisodeCreative(creative) && episodeBodyCharLen(summary) < 40) {
      setLocalError(t('drama.outlineEp.needSummaryOrCreative', { n: MIN_EPISODE_CREATIVE_CHARS }))
      return
    }
    // 与后端 run_episode_body_from_brief 一致：创意≥10 或摘要≥40
    if (mode === 'body' && episodeBodyCharLen(creative) < 10 && episodeBodyCharLen(summary) < 40) {
      setLocalError(t('drama.outlineEp.needSummaryBeforeBody'))
      return
    }
    if (mode === 'brief' && !isSubstantialEpisodeBody(selected.body)) {
      setLocalError(t('drama.outlineEp.bodyBeforeExtract', { n: MIN_EPISODE_BODY_CHARS }))
      return
    }
    if (mode === 'full') {
      const ok = await dialog.confirm({
        title: t('drama.outlineEp.regenTitle'),
        message: t('drama.outlineEp.regenMessageV2'),
        confirmText: t('drama.outline.regenerate'),
        tone: 'danger',
      })
      if (!ok) return
    }
    const targetEpisode = selected.episodeNumber
    setLocalJobs((jobs) => ({ ...jobs, [targetEpisode]: mode }))
    setLocalError('')
    setLocalNotice('')
    try {
      await dramaApi.episodeScript({
        project_id: projectId,
        episode_number: targetEpisode,
        generate_mode: mode,
        creative: creative || undefined,
        title: selected.title,
      })
      const cur = await pollOptimize(targetEpisode)
      const created = readEpisodeJob(cur, targetEpisode).assetsCreated
      if ((mode === 'body' || mode === 'full') && created > 0) {
        setLocalNotice(t('drama.outlineEp.assetsCreated', { n: created }))
      }
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : t('drama.common.generateFailed')
      setLocalError(msg)
      onError(msg)
    } finally {
      setLocalJobs((jobs) => { const next = { ...jobs }; delete next[targetEpisode]; return next })
    }
  }

  async function handleConfirmEnter() {
    if (!selected?.episodeNumber) return
    if (editingSection || sceneEditing) {
      setLocalError(t('drama.outlineEp.saveBeforeEnter'))
      return
    }
    if (!isSubstantialEpisodeBody(selected.body) && !isImportedEpisode(selected)) {
      setLocalError(t('drama.outlineEp.bodyBeforeStoryboard', { n: MIN_EPISODE_BODY_CHARS }))
      return
    }
    setLocalError('')
    setConfirming(true)
    try {
      // 已自动入队/完成 AI 分镜：直接进入编辑页（页内会轮询「AI 分镜中」）
      const rows = await dramaApi.listEpisodes(projectId)
      const existing = rows.find(
        (ep) => Number(ep.params?.episodeNumber) === Number(selected.episodeNumber),
      )
      const planSt = existing ? readPlanStatus(existing) : ''
      if (
        existing &&
        (planSt === 'generating' ||
          planSt === 'completed' ||
          (existing.fragments || []).length > 0)
      ) {
        navigate(`/drama/projects/${projectId}/episodes/${existing.id}`)
        return
      }
      setEnterSkillOpen(true)
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : t('drama.outlineEp.enterFailed')
      setLocalError(msg)
      onError(msg)
    } finally {
      setConfirming(false)
    }
  }

  // 首次进入：确认剧本 + 按所选 Skill 做 AI 分镜
  async function startEnterWithSkills(skillIds: number[]) {
    if (!selected?.episodeNumber) return
    setEnterSkillOpen(false)
    setConfirming(true)
    setLocalError('')
    try {
      const res = await dramaApi.confirmEpisodeFromScript({
        project_id: projectId,
        episode_number: selected.episodeNumber,
      })
      const episodeId = res.episode.id
      try {
        await dramaApi.planEpisodeFragments(episodeId, {
          force: true,
          fallback_rules: true,
          skill_ids: skillIds,
        })
      } catch (planErr) {
        if (isRequestAborted(planErr)) return
        onError(planErr instanceof Error ? planErr.message : t('drama.outlineEp.planQueueFailed'))
      }
      navigate(`/drama/projects/${projectId}/episodes/${episodeId}`)
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : t('drama.outlineEp.enterFailed')
      setLocalError(msg)
      onError(msg)
    } finally {
      setConfirming(false)
    }
  }

  async function handleSaveScenes(nextBody: string) {
    if (!selected?.episodeNumber) return
    setSaving(true)
    setLocalError('')
    try {
      const num = selected.episodeNumber
      const next = displayEpisodes.map((ep) =>
        ep.episodeNumber === num ? { ...ep, body: nextBody, title: titleDraft || ep.title } : ep,
      )
      await saveBodies(next)
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : t('drama.common.saveFailed')
      setLocalError(msg)
      onError(msg)
      throw err
    } finally {
      setSaving(false)
    }
  }

  function toggleSection(key: SectionKey) {
    if (key === 'body') {
      setScriptModalOpen(true)
      setOpenSections((prev) => new Set(prev).add('body'))
      return
    }
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function startEdit(section: SectionKey) {
    if (!selected) return
    if (sceneEditing) {
      setLocalError(t('drama.outlineEp.saveSceneFirst'))
      return
    }
    setEditingSection(section)
    setSectionDraft(
      section === 'creative'
        ? selected.creative || ''
        : section === 'summary'
          ? selected.summary || ''
          : selected.body || '',
    )
    setOpenSections((prev) => new Set(prev).add(section))
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text || '')
    } catch {
      setLocalError(t('drama.outlineEp.copyFailed'))
    }
  }

  const metaTags = useMemo(() => {
    const tags: string[] = []
    if (storyType) tags.push(storyType.split(/\s*[+＋]\s*/).filter(Boolean).join(' · '))
    if (selected?.origin === 'manual') tags.push(t('drama.outlineEp.tagManual'))
    else if (selected?.origin === 'import') tags.push(t('drama.outlineEp.tagImport'))
    else if (selected?.body) tags.push(t('drama.outlineEp.tagAuto'))
    return tags
  }, [storyType, selected, t])

  const bodyReady = selectedEnterReady
  const selectedShot = episodeShotStats[selected?.episodeNumber || 0]
  const charHint = selected
    ? [
        selected.summary ? t('drama.outlineEp.hintSummary', { n: episodeBodyCharLen(selected.summary) }) : null,
        selected.body ? t('drama.outlineEp.hintBody', { n: episodeBodyCharLen(selected.body) }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  const directory = (
    <aside className="drama-outline-sidebar">
      <div className="drama-outline-sidebar-head">
        <div>
          <h3>{t('drama.outlineEp.directory')}</h3>
          <p>{t('drama.outlineEp.totalEpisodes', { n: directoryEpisodes.length })}</p>
        </div>
        {summaryReady ? (
          <button
            type="button"
            className="drama-outline-add-btn"
            disabled={!canAdd}
            onClick={() => void handleAddEpisode()}
          >
            <Plus size={14} strokeWidth={2.5} />
            {adding ? t('drama.outlineEp.adding') : t('drama.outlineEp.addEpisode')}
          </button>
        ) : null}
      </div>
      <ul className="drama-outline-ep-list">
        {directoryEpisodes.map((ep) => {
          const body = displayEpisodes.find((x) => x.episodeNumber === ep.episodeNumber)
          const ready = isSubstantialEpisodeBody(body?.body) || isImportedEpisode(body)
          const active = activeEpisodeNumber === ep.episodeNumber
          const shot = episodeShotStats[ep.episodeNumber || 0]
          const shotLabel = shot ? t('drama.outlineEp.shotStatus', { n: shot.fragmentCount, d: formatOutlineShotDuration(shot.totalSec) }) : ''
          const statusLabel = summaryGenerating
            ? t('drama.outline.pipelineSummary')
            : assetsSeeding
              ? t('drama.outline.pipelineAssets')
              : shot?.planStatus === 'generating'
                ? t('drama.outlineEp.planGenerating')
                : shot?.planStatus === 'failed'
                  ? t('drama.outlineEp.planFailed')
                  : shot?.scriptChanged && shot.fragmentCount > 0
                    ? t('drama.outlineEp.shotStatusStale', { s: shotLabel })
                    : shot?.planStatus === 'completed' &&
                      shot.fragmentCount > 0 &&
                      shot.totalSec > 0
                    ? shot.fragmentCount <= 1 && ready
                      ? t('drama.outlineEp.shotStatusFew', { s: shotLabel })
                      : shotLabel
                    : episodeGenerating && !ready && !body?.summary && !body?.creative
                      ? episodeProgress.total > 0
                        ? t('drama.outlineEp.wholeProgress', { done: episodeProgress.done, total: episodeProgress.total })
                        : t('drama.outlineEp.waitingScript')
                      : ready
                        ? t('drama.outlineEp.waitingPlan')
                        : body?.summary || body?.creative
                          ? t('drama.outlineEp.needScript')
                          : t('drama.outlineEp.needSummary')
          return (
            <li key={ep.episodeNumber}>
              <button
                type="button"
                className={`drama-outline-ep-card${active ? ' is-active' : ''}`}
                onClick={() => {
                  onOpenEpisodes()
                  setActiveEpisodeNumber(ep.episodeNumber)
                }}
              >
                <span className="drama-outline-ep-thumb" aria-hidden>
                  {(() => {
                    const cover = episodeCovers[ep.episodeNumber || 0]
                    if (!cover) return ep.episodeNumber
                    if (/\.(mp4|webm|mov)(\?|$)/i.test(cover)) {
                      return <video src={cover} muted playsInline preload="metadata" />
                    }
                    return <img src={cover} alt="" />
                  })()}
                </span>
                <span className="drama-outline-ep-meta">
                  <strong>{t('drama.common.episodeN', { n: ep.episodeNumber })}</strong>
                  <small>{ep.title || t('drama.outlineEp.untitled')}</small>
                  <em
                    className={
                      summaryGenerating ||
                      assetsSeeding ||
                      shot?.planStatus === 'generating' ||
                      (episodeGenerating && !ready) ||
                      (ready && shot?.planStatus !== 'completed')
                        ? 'is-waiting'
                        : shot?.planStatus === 'completed' && shot.fragmentCount > 0
                          ? 'is-shot'
                          : undefined
                    }
                  >
                    {statusLabel}
                  </em>
                </span>
                <span className="drama-outline-ep-more" aria-hidden>
                  <MoreHorizontal size={16} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )

  const bodies = !selected ? (
    <div className="drama-outline-detail-empty">
      <p>
        {summaryGenerating
          ? t('drama.outlineEp.emptySummaryGenerating')
          : assetsSeeding
            ? t('drama.outlineEp.emptyAssetsSeeding')
            : summaryReady
              ? t('drama.outlineEp.emptyReady')
              : t('drama.outlineEp.emptyNotReady')}
      </p>
    </div>
  ) : (
    <section className="drama-outline-detail">
      <header className="drama-outline-detail-head">
        <div className="drama-outline-detail-title">
          {editingSection ? (
            <input
              className="drama-title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder={t('drama.outlineEp.titlePlaceholder')}
            />
          ) : (
            <h2>
              {t('drama.common.episodeN', { n: selected.episodeNumber ?? '' })}
              {selected.title ? `${t('drama.outlineEp.titleSep')}${selected.title}` : ''}
            </h2>
          )}
          {imageStyleLabel ? <span className="drama-outline-style-badge">{imageStyleLabel}</span> : null}
          <div className="drama-outline-detail-meta">
            {charHint ? <span>{charHint}</span> : <span>{t('drama.outlineEp.noContent')}</span>}
            {metaTags.map((tag) => (
              <span key={tag} className="drama-outline-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="drama-outline-detail-actions">
          <span className={`drama-outline-saved${bodyReady && !editingSection && !sceneEditing && !selectedShot?.scriptChanged ? ' is-ready' : ''}`}>
            <Check size={14} strokeWidth={2.5} />
            {editingSection || sceneEditing
              ? t('drama.outlineEp.unsavedEdit')
              : selectedShot?.scriptChanged
                ? t('drama.outlineEp.planStale')
                : bodyReady
                  ? t('drama.outlineEp.canStoryboard')
                  : saving ? t('drama.outlineEp.savingShort') : t('drama.outlineEp.synced')}
          </span>
          {bodyReady && episodeBodyCharLen(selected.summary) < 40 ? (
            <button
              type="button"
              className="drama-btn-ghost"
              disabled={generateBusy}
              onClick={() => void handleGenerate('brief')}
            >
              {selectedGenerating && generatingMode === 'brief'
                ? t('drama.outlineEp.extracting')
                : t('drama.outlineEp.extractBrief')}
            </button>
          ) : null}
          <button
            type="button"
            className="drama-outline-regen-btn"
            disabled={generateBusy || !canRegenerateEpisode}
            onClick={() => void handleGenerate('full')}
            title={
              batchLocksThisEpisode
                ? t('drama.outlineEp.batchLocksHint')
                : anyEpisodeGenerating
                  ? t('drama.outlineEp.otherJobHint')
                  : undefined
            }
          >
            <RefreshCw size={15} strokeWidth={2.25} />
            {selectedGenerating && generatingMode === 'full'
              ? t('drama.common.generating')
              : t('drama.outlineEp.regenTitle')}
          </button>
          {selectedShot?.episodeId && !editingSection && !sceneEditing ? (
            <Link className="drama-btn-primary" to={`/drama/projects/${projectId}/episodes/${selectedShot.episodeId}`}>
              {t('drama.outlineEp.enterStoryboard')}
            </Link>
          ) : (
          <button
            type="button"
            className="drama-btn-primary"
            disabled={enterBusy}
            onClick={() => void handleConfirmEnter()}
            title={!selectedEnterReady ? t('drama.outlineEp.bodyMinHint', { n: MIN_EPISODE_BODY_CHARS }) : undefined}
          >
            {confirming ? t('drama.outlineEp.entering') : t('drama.outlineEp.enterStoryboard')}
          </button>
          )}
        </div>
      </header>

      <div className="drama-outline-status-list">
        {localError ? <DramaErrorNotice message={localError} onDismiss={() => setLocalError('')} /> : null}
        {localNotice ? <DramaStatusNotice tone="success" title={localNotice} onDismiss={() => setLocalNotice('')} /> : null}
        {selectedShot?.scriptChanged ? (
          <DramaStatusNotice tone="warning" title={t('drama.outlineEp.noticeScriptChangedTitle')}>
            {t('drama.outlineEp.noticeScriptChangedBody')}
          </DramaStatusNotice>
        ) : null}
        {summaryGenerating ? (
          <DramaStatusNotice tone="busy" title={t('drama.outlineEp.noticeSummaryTitle')}>
            {t('drama.outlineEp.noticeSummaryBody')}
          </DramaStatusNotice>
        ) : null}
        {assetsSeeding ? (
          <DramaStatusNotice tone="busy" title={t('drama.outlineEp.noticeAssetsTitle')}>
            {t('drama.outlineEp.noticeAssetsBody')}
          </DramaStatusNotice>
        ) : null}
        {episodeGenerating ? (
          <DramaStatusNotice tone="busy" title={t('drama.outlineEp.noticeEpisodesTitle')}>
            {episodeProgress.total > 0
              ? t('drama.outlineEp.noticeEpisodesProgress', { done: episodeProgress.done, total: episodeProgress.total })
              : t('drama.outlineEp.noticeEpisodesBody')}
          </DramaStatusNotice>
        ) : null}
        {selectedGenerating ? (
          <DramaStatusNotice tone="busy" title={generationTitle(generatingMode)}>
            {t('drama.outlineEp.noticeThisBody')}
          </DramaStatusNotice>
        ) : anyEpisodeGenerating && generatingEpisodeNumber ? (
          <DramaStatusNotice tone="busy" title={t('drama.outlineEp.noticeOtherTitle', { n: generatingEpisodeNumber })}>
            {t('drama.outlineEp.noticeOtherBody')}
          </DramaStatusNotice>
        ) : null}
        {selected && episodeShotStats[selected.episodeNumber || 0]?.planStatus === 'generating' ? (
          <DramaStatusNotice tone="busy" title={t('drama.outlineEp.noticePlanTitle')}>
            {t('drama.outlineEp.noticePlanBody')}
          </DramaStatusNotice>
        ) : null}
        {selectedPlanSkip ? (
          <DramaStatusNotice tone="warning" title={t('drama.outlineEp.noticePlanSkippedTitle')}>
            {planSkipMessage}
          </DramaStatusNotice>
        ) : null}
        {selected &&
        !selectedPlanSkip &&
        isSubstantialEpisodeBody(selected.body) &&
        !episodeShotStats[selected.episodeNumber || 0]?.planStatus &&
        !selectedGenerating &&
        !episodeGenerating &&
        !summaryGenerating &&
        !assetsSeeding ? (
          <DramaStatusNotice tone="busy" title={t('drama.outlineEp.noticePlanPreparing')} />
        ) : null}
      </div>

      <div className="drama-outline-sections">
        <SectionCard
          sectionKey="summary"
          icon={<BookOpen size={18} strokeWidth={1.9} />}
          title={t('drama.outlineEp.summaryTitle')}
          subtitle={t('drama.outlineEp.summarySubV2')}
          text={selected.summary || ''}
          editing={editingSection === 'summary'}
          draft={sectionDraft}
          open={openSections.has('summary')}
          busy={busy}
          generateBusy={generateBusy}
          placeholder={t('drama.outlineEp.summaryPlaceholderV2')}
          regenerateLabel={
            selectedGenerating && generatingMode === 'brief'
              ? t('drama.outlineEp.extracting')
              : selectedGenerating && generatingMode === 'summary'
                ? t('drama.common.generating')
                : summaryGenerateMode === 'brief'
                  ? t('drama.outlineEp.extractFromScript')
                  : t('drama.outlineEp.genFromNotes')
          }
          onToggle={() => toggleSection('summary')}
          onEdit={() => startEdit('summary')}
          onCancel={() => setEditingSection(null)}
          onSave={() => void handleSaveSection('summary')}
          onDraftChange={setSectionDraft}
          onRegenerate={summaryGenerateMode ? () => void handleGenerate(summaryGenerateMode) : undefined}
          onCopy={() => void copyText(selected.summary || '')}
        />
        <SectionCard
          sectionKey="body"
          icon={<FileText size={18} strokeWidth={1.9} />}
          title={t('drama.outlineEp.bodyTitle')}
          subtitle={t('drama.outlineEp.bodySub')}
          text={selected.body || ''}
          editing={editingSection === 'body'}
          draft={sectionDraft}
          open={openSections.has('body')}
          busy={busy}
          generateBusy={generateBusy || !canGenerateBody}
          placeholder={t('drama.outlineEp.bodyPlaceholder', { n: MIN_EPISODE_BODY_CHARS })}
          regenerateLabel={
            selectedGenerating && generatingMode === 'body'
              ? t('drama.common.generating')
              : t('drama.outlineEp.genScript')
          }
          onToggle={() => toggleSection('body')}
          onEdit={() => startEdit('body')}
          onCancel={() => setEditingSection(null)}
          onSave={() => void handleSaveSection('body')}
          onDraftChange={setSectionDraft}
          onRegenerate={() => void handleGenerate('body')}
          onCopy={() => void copyText(selected.body || '')}
          scriptPreview={
            <OutlineScriptPreview
              key={selected.episodeNumber}
              text={selected.body || ''}
              empty={t('drama.outlineEp.bodyPlaceholder', { n: MIN_EPISODE_BODY_CHARS })}
              busy={busy}
              shotStats={episodeShotStats[selected.episodeNumber || 0] || null}
              onSaveScenes={handleSaveScenes}
              onEditingChange={setSceneEditing}
            />
          }
        />
        <SectionCard
          sectionKey="creative"
          icon={<Lightbulb size={18} strokeWidth={1.9} />}
          title={t('drama.outlineEp.notesTitle')}
          subtitle={t('drama.outlineEp.notesSub')}
          text={selected.creative || ''}
          editing={editingSection === 'creative'}
          draft={sectionDraft}
          open={openSections.has('creative')}
          busy={busy}
          placeholder={t('drama.outlineEp.notesPlaceholder')}
          regenerateLabel={t('drama.outlineEp.genSummary')}
          onToggle={() => toggleSection('creative')}
          onEdit={() => startEdit('creative')}
          onCancel={() => setEditingSection(null)}
          onSave={() => void handleSaveSection('creative')}
          onDraftChange={setSectionDraft}
          onCopy={() => void copyText(selected.creative || '')}
        />
      </div>
      <OutlineScriptParseModal
        open={scriptModalOpen}
        onClose={() => setScriptModalOpen(false)}
        title={t('drama.outlineEp.parseTitle', { n: selected.episodeNumber ?? '' })}
        text={selected.body || ''}
      />
    </section>
  )

  const editableBodies = <TeamEditingBoundary projectId={projectId} type="episode" resourceId={selected?.episodeNumber || 0} enabled={Boolean(selected)} showReadOnlyNotice={false} allowReadOnlyNavigation onAcquired={async (isCurrent) => { const fresh = await dramaApi.getScript(projectId); if (isCurrent()) onScriptChange(fresh) }}>{bodies}</TeamEditingBoundary>

  if (children) {
    return (
      <>
        {children({ directory, bodies: editableBodies })}
        <FragmentPlanSkillModal
          open={enterSkillOpen}
          title={t('drama.outlineEp.enterStoryboard')}
          message={t('drama.outlineEp.enterSkillMessage')}
          confirmText={confirming ? t('drama.outlineEp.entering') : t('drama.outlineEp.startStoryboard')}
          onCancel={() => {
            if (!confirming) setEnterSkillOpen(false)
          }}
          onConfirm={(skillIds) => void startEnterWithSkills(skillIds)}
        />
      </>
    )
  }
  return (
    <div className="drama-outline drama-outline-v2">
      {directory}
      <div className="drama-outline-main">{editableBodies}</div>
      <FragmentPlanSkillModal
        open={enterSkillOpen}
        title={t('drama.outlineEp.enterStoryboard')}
        message={t('drama.outlineEp.enterSkillMessage')}
        confirmText={confirming ? t('drama.outlineEp.entering') : t('drama.outlineEp.startStoryboard')}
        onCancel={() => {
          if (!confirming) setEnterSkillOpen(false)
        }}
        onConfirm={(skillIds) => void startEnterWithSkills(skillIds)}
      />
    </div>
  )
}
