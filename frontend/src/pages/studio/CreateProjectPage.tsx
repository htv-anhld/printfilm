import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, defaultsFromTemplate } from '../../api'
import type { Template } from '../../api'
import BillingErrorNotice from '../../components/billing/BillingErrorNotice'
import AppShell from '../../components/layout/AppShell'
import Stepper from '../../components/ui/Stepper'
import PillTabs from '../../components/ui/PillTabs'
import { IconChevronLeft, IconRefresh, IconSparkles } from '../../components/ui/Icons'
import { CATEGORY_ORDER } from '../../lib/categories'
import { kepuStepIndex, kepuSteps } from '../../lib/status'
import { messages, useI18n, type Locale } from '../../i18n'
import { categoryLabel, templateCategoryLabel } from './categoryLabel'
import { isMarketingPreset } from '../../lib/marketingPresets'

type Inspiration = {
  title: string
  theme: string
  script: string
}


const CONTENT_LOCALES: Locale[] = ['vi', 'en', 'zh']

// 灵感示例按内容语言取（示例会作为主题/文案发给 AI）
function inspirationPool(locale: Locale): Inspiration[] {
  return messages[locale].studio.create.pool
}

const PAGE_SIZE = 6

// 各语言的默认标题都视为「未命名」
function isDefaultTitle(value: string) {
  const v = value.trim()
  return !v || CONTENT_LOCALES.some((l) => messages[l].studio.create.untitled === v)
}

// 脚本行首的结构标签（[Visual]: / VO: / HOOK (0:00-0:03) / Cảnh 1 / 第1场 / 时间码），去掉后取正文
const LEADING_LABEL_RE =
  /^(?:\[[^\]]*\]\s*[:：]?|\(?\d{1,2}:\d{2}(?:\s*[-–]\s*\d{1,2}:\d{2})?\)?|(?:hook|cta|outro|intro|scene|cảnh|đoạn|shot|vo|v\.o\.|visual|audio|text|caption|bgm|music|nhạc nền|lời dẫn|画面|旁白|字幕|镜头)(?:\s*\d+)?(?:\s*\([^)]*\))?\s*[:：]?|第\s*\d+\s*[场幕镜集]\s*[:：]?)\s*/i

/** 去掉一行开头的所有结构标签 */
function stripLeadingLabels(line: string): string {
  let out = line
  for (let i = 0; i < 4; i++) {
    const next = out.replace(LEADING_LABEL_RE, '')
    if (next === out) break
    out = next
  }
  return out.trim()
}

/**
 * 从主题 / 脚本推一个项目名：去掉 Markdown 与引号和行首结构标签，
 * 取第一句有意义的话，按词边界截到约 40 字（中文约 18 字）。
 */
function deriveTitle(text: string, untitled: string) {
  const lines = (text || '')
    .split(/\n/)
    .map((l) =>
      stripLeadingLabels(
        l
          .replace(/[*_`#>]+/g, '')
          .replace(/^\s*[-•·]\s*/, '')
          .replace(/[“”"'‘’「」]/g, '')
          .trim(),
      ),
    )
    .filter((l) => /[\p{L}]{2,}/u.test(l))
  const sentence = (lines[0] || '').split(/[。！？!?]|[.:：](?=\s|$)/)[0].trim()
  if (!sentence) return untitled
  const cjk = /[\u4e00-\u9fff]/.test(sentence)
  const max = cjk ? 18 : 40
  if (sentence.length <= max) return sentence
  const cut = sentence.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > max * 0.5 ? cut.slice(0, space) : cut).trim() + '…'
}

export default function CreateProjectPage() {
  const nav = useNavigate()
  const { t, locale } = useI18n()
  const [params] = useSearchParams()
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateId, setTemplateId] = useState(params.get('template') || '')
  const [category, setCategory] = useState('全部')
  const [q, setQ] = useState('')
  const [inputTab, setInputTab] = useState<'theme' | 'script'>('theme')
  // contentLocale AI 写脚本/旁白/字幕所用语言，默认跟随界面语言
  const [contentLocale, setContentLocale] = useState<Locale>(locale)
  const [sourceText, setSourceText] = useState(() => inspirationPool(locale)[0].theme)
  const [title, setTitle] = useState(() => inspirationPool(locale)[0].title)
  const [titleTouched, setTitleTouched] = useState(false)
  const [inspPage, setInspPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [error, setError] = useState('')
  const untitled = t('studio.create.untitled')

  // 首页输入框带来的主题（/studio/new?topic=…）：主题模式 + 预填主题与标题
  useEffect(() => {
    const topic = params.get('topic')?.trim()
    if (!topic) return
    setInputTab('theme')
    setSourceText(topic.slice(0, 2000))
    setTitle(topic.slice(0, 24))
  }, [params])

  // 营销预设（/studio/new?preset=…）：脚本模式 + 预设脚本与标题
  useEffect(() => {
    const preset = params.get('preset')
    if (!isMarketingPreset(preset)) return
    setInputTab('script')
    setSourceText(t(`marketing.presets.${preset}.script`))
    setTitle(t(`marketing.presets.${preset}.title`))
    setTitleTouched(true)
  }, [params, t])

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      nav('/auth')
      return
    }
    api.me().catch(() => nav('/auth'))
    api.templates().then((list) => {
      setTemplates(list)
      const fromUrl = params.get('template') || ''
      setTemplateId((prev) => prev || fromUrl || list[0]?.id || '')
    })
  }, [nav, params])

  // 筛选 key 保持中文原值（与模板 category 比较），只翻译展示名
  const categories = useMemo(() => {
    const found = new Set<string>()
    for (const tpl of templates) {
      for (const c of tpl.category || []) {
        if (CATEGORY_ORDER.includes(c)) found.add(c)
      }
    }
    return ['全部', '热门推荐', ...CATEGORY_ORDER.filter((c) => found.has(c))]
  }, [templates])
  const visibleCategories = categories.slice(0, 6)
  const categoryLabels = visibleCategories.map((c) => categoryLabel(t, c))

  const filtered = useMemo(() => {
    let list = templates
    if (category === '热门推荐') list = [...templates].sort((a, b) => a.sort_order - b.sort_order).slice(0, 8)
    else if (category !== '全部') list = list.filter((tpl) => (tpl.category || []).includes(category))
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      list = list.filter((tpl) => tpl.name.toLowerCase().includes(s))
    }
    return list
  }, [templates, category, q])

  const selected = templates.find((tpl) => tpl.id === templateId)
  const sourceType = inputTab
  const pool = inspirationPool(contentLocale)
  const inspTotal = Math.ceil(pool.length / PAGE_SIZE)
  const inspirations = pool.slice(inspPage * PAGE_SIZE, inspPage * PAGE_SIZE + PAGE_SIZE)
  const tabLabel = (tab: 'theme' | 'script') =>
    tab === 'script' ? t('studio.create.tabScript') : t('studio.create.tabTheme')

  // 把灵感示例填进主题/文案，并同步短标题
  function applyInspiration(item: Inspiration) {
    if (sourceType === 'script') {
      setInputTab('script')
      setSourceText(item.script.slice(0, 8000))
    } else {
      setInputTab('theme')
      setSourceText(item.theme.slice(0, 100))
    }
    setTitle(item.title.slice(0, 24))
    setTitleTouched(false)
    setError('')
  }

  // 切换内容语言：若当前内容仍是未改动的示例，换成新语言的同一条示例
  function changeContentLocale(next: Locale) {
    const prevPool = inspirationPool(contentLocale)
    const nextPool = inspirationPool(next)
    const i = prevPool.findIndex((it) => it.theme === sourceText || it.script === sourceText)
    if (i >= 0 && nextPool[i]) {
      const item = nextPool[i]
      setSourceText(sourceType === 'script' ? item.script.slice(0, 8000) : item.theme.slice(0, 100))
      if (!titleTouched || isDefaultTitle(title) || title === prevPool[i].title.slice(0, 24)) {
        setTitle(item.title.slice(0, 24))
        setTitleTouched(false)
      }
    }
    setContentLocale(next)
  }

  function shuffleInspirations() {
    setInspPage((p) => (p + 1) % inspTotal)
  }

  async function aiExpand() {
    const seed = sourceText.trim() || title.trim() || t('studio.create.aiSeedFallback')
    setAiBusy(true)
    setError('')
    try {
      const mode = sourceType === 'script' ? 'script' : 'theme'
      const result = await api.expandContent(seed, mode, contentLocale)
      setSourceText(result.content.slice(0, mode === 'theme' ? 100 : 8000))
      if (!titleTouched || isDefaultTitle(title)) {
        setTitle(result.title.slice(0, 24))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('studio.create.errAi'))
    } finally {
      setAiBusy(false)
    }
  }

  async function next() {
    if (!templateId || !sourceText.trim()) {
      setError(t('studio.create.errRequired'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const tpl = templates.find((x) => x.id === templateId)
      const d = tpl ? defaultsFromTemplate(tpl) : undefined
      const modeParam = params.get('mode')
      const pipeline_mode: 'full' | 'image_text' =
        modeParam === 'image_text' || modeParam === 'full' ? modeParam : 'full'
      const finalTitle =
        title.trim() || deriveTitle(sourceText, untitled) || sourceText.trim().slice(0, 24) || untitled
      const body: Parameters<typeof api.createProject>[0] = {
        template_id: templateId,
        title: finalTitle,
        source_type: sourceType,
        source_text: sourceText.trim(),
        resolution_mode: 'preview',
        pipeline_mode,
        output_ratio: d?.output_ratio || '16:9',
        voice_id: d?.voice_id,
        content_locale: contentLocale,
      }
      const project = await api.createProject(body)
      nav(`/studio/${project.id}/style`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('studio.create.errCreate'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell active="studio" wide>
      <header className="pf-page-head">
        <div className="pf-page-head-row">
          <div>
            <button type="button" className="pf-back" onClick={() => nav('/')}>
              <IconChevronLeft size={18} />
              {t('studio.create.back')}
            </button>
            <h1 className="pf-page-title">{t('studio.create.title')}</h1>
          </div>
          <Stepper steps={kepuSteps()} current={kepuStepIndex('create')} doneThrough={-1} />
        </div>
      </header>

      <div className="pf-create">
        <aside className="pf-create-col">
          <h3>{t('studio.create.chooseTemplate')}</h3>
          <div className="pf-search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('studio.create.searchPlaceholder')}
            />
          </div>
          <PillTabs
            items={categoryLabels}
            value={categoryLabel(t, category)}
            onChange={(label) => {
              const i = categoryLabels.indexOf(label)
              setCategory(i >= 0 ? visibleCategories[i] : '全部')
            }}
            ariaLabel={t('studio.create.categoryAria')}
          />
          <div className="pf-tpl-list" style={{ marginTop: '0.75rem' }}>
            {filtered.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className={templateId === tpl.id ? 'pf-tpl-mini selected' : 'pf-tpl-mini'}
                onClick={() => setTemplateId(tpl.id)}
              >
                <img src={api.assetUrl(tpl.preview_cover)} alt="" />
                <div>
                  <strong>{tpl.name}</strong>
                  <span>
                    {tpl.default_ratio} ·{' '}
                    {(tpl.category || [])[0]
                      ? templateCategoryLabel(t, tpl, 0)
                      : t('studio.category.general')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="pf-create-col">
          <h3>{t('studio.create.inputContent')}</h3>
          <div className="pf-input-tabs">
            {(['theme', 'script'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={['pf-pill', inputTab === tab ? 'lime active' : ''].join(' ')}
                onClick={() => setInputTab(tab)}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>

          <label className="pf-field">
            <span className="pf-field-label">{t('studio.create.projectName')}</span>
            <input
              className="pf-field-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setTitleTouched(true)
              }}
              onBlur={() => {
                if (isDefaultTitle(title) && sourceText.trim()) {
                  setTitle(deriveTitle(sourceText, untitled))
                  setTitleTouched(false)
                }
              }}
              placeholder={t('studio.create.projectNamePlaceholder')}
            />
          </label>

          <label className="pf-field">
            <span className="pf-field-label">{t('studio.contentLocale.label')}</span>
            <select
              className="pf-field-input"
              value={contentLocale}
              disabled={busy}
              onChange={(e) => changeContentLocale(e.target.value as Locale)}
            >
              {CONTENT_LOCALES.map((l) => (
                <option key={l} value={l}>
                  {t(`studio.contentLocale.options.${l}`)}
                </option>
              ))}
            </select>
            <span className="pf-muted" style={{ fontSize: '0.75rem' }}>
              {t('studio.contentLocale.hint')}
            </span>
          </label>

          <div className="pf-textarea-wrap">
            <div className="pf-textarea-toolbar">
              <button
                type="button"
                className="pf-btn pf-btn-ai pf-btn-sm pf-btn-icon"
                disabled={aiBusy || busy}
                onClick={aiExpand}
              >
                <IconSparkles size={14} />
                {aiBusy
                  ? t('studio.create.aiBusy')
                  : sourceType === 'script'
                    ? t('studio.create.aiExpandScript')
                    : t('studio.create.aiGenerateTheme')}
              </button>
              <span className="pf-muted" style={{ fontSize: '0.75rem' }}>
                {sourceType === 'script' ? t('studio.create.aiHintScript') : t('studio.create.aiHintTheme')}
              </span>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => {
                const nextText = e.target.value.slice(0, sourceType === 'theme' ? 100 : 8000)
                setSourceText(nextText)
                if (!titleTouched || isDefaultTitle(title)) {
                  setTitle(deriveTitle(nextText, untitled))
                }
              }}
              placeholder={
                sourceType === 'theme'
                  ? t('studio.create.placeholderTheme')
                  : t('studio.create.placeholderScript')
              }
            />
            {sourceType === 'theme' ? (
              <span className="pf-char-count">{sourceText.length}/100</span>
            ) : (
              <span className="pf-char-count">{t('studio.create.charCount', { n: sourceText.length })}</span>
            )}
          </div>

          <div className="pf-inspire">
            <div className="pf-inspire-head">
              <strong>{t('studio.create.inspirations')}</strong>
              <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm pf-btn-icon" onClick={shuffleInspirations}>
                <IconRefresh size={14} />
                {t('studio.create.shuffle')}
              </button>
            </div>
            <div className="pf-chips">
              {inspirations.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className="pf-chip"
                  title={sourceType === 'script' ? item.script.slice(0, 80) : item.theme}
                  onClick={() => applyInspiration(item)}
                >
                  {item.title}
                </button>
              ))}
            </div>
            <p className="pf-muted" style={{ fontSize: '0.78rem', margin: '0.55rem 0 0' }}>
              {sourceType === 'script'
                ? t('studio.create.inspirationHintScript')
                : t('studio.create.inspirationHintTheme')}
            </p>
          </div>

          <div className="pf-hint" style={{ marginTop: '1rem' }}>
            {t('studio.create.tip')}
          </div>
          {error ? <BillingErrorNotice message={error} /> : null}
        </section>

        <aside className="pf-create-col">
          <h3>{t('studio.create.summary')}</h3>
          {selected ? (
            <div style={{ marginBottom: '0.85rem' }}>
              <img
                src={api.assetUrl(selected.preview_cover)}
                alt=""
                style={{ width: '100%', borderRadius: 12, aspectRatio: '16/9', objectFit: 'cover' }}
              />
              <strong style={{ display: 'block', marginTop: '0.5rem' }}>{selected.name}</strong>
              <p className="pf-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                {selected.description}
              </p>
            </div>
          ) : (
            <p className="pf-muted">{t('studio.create.pickTemplate')}</p>
          )}
          <div className="pf-summary-row">
            <span>{t('studio.create.workName')}</span>
            <span>{title.trim() || untitled}</span>
          </div>
          <div className="pf-summary-row">
            <span>{t('studio.create.outputMode')}</span>
            <span>
              {t('studio.create.outputVideo', {
                ratio: selected?.default_ratio === '9:16' ? '9:16' : '16:9',
              })}
            </span>
          </div>
          <div className="pf-summary-row">
            <span>{t('studio.create.estDuration')}</span>
            <span>{t('studio.create.estDurationValue')}</span>
          </div>
          <div className="pf-summary-row">
            <span>{t('studio.contentLocale.label')}</span>
            <span>{t(`studio.contentLocale.options.${contentLocale}`)}</span>
          </div>
          <div className="pf-summary-row">
            <span>{t('studio.create.inputMode')}</span>
            <span>{tabLabel(inputTab)}</span>
          </div>
          <button
            type="button"
            className="pf-btn pf-btn-lime pf-btn-block pf-btn-lg pf-btn-icon"
            style={{ marginTop: '1.25rem' }}
            disabled={busy || aiBusy || !templateId || !sourceText.trim()}
            onClick={next}
          >
            {busy ? t('studio.create.creating') : t('studio.create.nextStyle')}
            {!busy ? <span aria-hidden>→</span> : null}
          </button>
          <button
            type="button"
            className="pf-btn pf-btn-ghost pf-btn-block pf-btn-sm pf-btn-icon"
            style={{ marginTop: '0.55rem' }}
            disabled={aiBusy || busy}
            onClick={aiExpand}
          >
            <IconSparkles size={14} />
            {aiBusy ? t('studio.create.aiBusyLong') : t('studio.create.aiHelp')}
          </button>
          <p className="pf-muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
            {t('studio.create.footHint')}
          </p>
        </aside>
      </div>
    </AppShell>
  )
}
