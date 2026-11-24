/** 首页创作输入框（参照 Dravelio 仪表盘）：选漫剧/短视频 → 输入创意 → 直接建项目或跳转创建页 */
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clapperboard, Film, Layers, Loader2, Palette, Sparkles } from 'lucide-react'
import OptionPicker from '../ui/OptionPicker'
import VideoGenSettings, { type VideoGenValue } from '../ui/VideoGenSettings'
import { isDraftCapableModel, useVideoModelOptions } from '../../lib/videoModelOptions'
import { dramaApi } from '../../api/drama'
import { useI18n } from '../../i18n'
import { IMAGE_STYLE_OPTIONS, type ImageStyleId } from '../../lib/dramaImageStyles'

type Mode = 'drama' | 'kepu'

const EPISODE_OPTIONS = [1, 2, 3, 6, 12]
const DRAMA_MIN_LENGTH = 20
const DRAMA_MAX_LENGTH = 2000

type Props = {
  /** 是否已登录；未登录提交时跳去登录 */
  loggedIn: boolean
}

/**
 * 首页输入框
 * - 漫剧：校验长度后调用 createProject，进入大纲步骤
 * - 短视频：带 topic 参数跳到 /studio/new，由创建页继续选模板
 */
export default function HomeComposer({ loggedIn }: Props) {
  const nav = useNavigate()
  const { t, locale } = useI18n()
  /*
   * mode 作品类型
   * text 创意文本
   * episodes 漫剧集数
   * styleId 漫剧画面风格（空 = 自动）
   * busy 创建中
   * error 错误文案
   */
  const [mode, setMode] = useState<Mode>('drama')
  const [text, setText] = useState('')
  const [episodes, setEpisodes] = useState(2)
  const [styleId, setStyleId] = useState<ImageStyleId | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // gen 视频模型 / 画幅 / 清晰度（漫剧写入项目 params）
  const [gen, setGen] = useState<VideoGenValue>({ model: '', ratio: '9:16', resolution: '480p', draft: false })
  const { defaultId } = useVideoModelOptions()

  // 目录到达后填入后台默认视频模型
  useEffect(() => {
    if (defaultId) setGen((prev) => (prev.model ? prev : { ...prev, model: defaultId }))
  }, [defaultId])

  // 提交：未登录去登录；漫剧建项目；短视频跳创建页
  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (busy) return
    const source = text.trim()
    if (!loggedIn) {
      nav('/auth?next=/')
      return
    }
    if (mode === 'kepu') {
      nav(source ? `/studio/new?topic=${encodeURIComponent(source)}` : '/studio/new')
      return
    }
    if (source.length < DRAMA_MIN_LENGTH) {
      setError(t('drama.list.storyTooShort', { n: DRAMA_MIN_LENGTH }))
      return
    }
    if (source.length > DRAMA_MAX_LENGTH) {
      setError(t('drama.list.storyTooLong', { n: DRAMA_MAX_LENGTH }))
      return
    }
    setBusy(true)
    setError('')
    try {
      const project = await dramaApi.createProject({
        source,
        episode_count: episodes,
        image_style_id: styleId || undefined,
        title: source.slice(0, 40),
        content_locale: locale,
        params: {
          aspect_ratio: gen.ratio,
          resolution: gen.resolution,
          draft_mode: Boolean(gen.draft && isDraftCapableModel(gen.model)),
          ...(gen.model ? { video_model: gen.model } : {}),
        },
      })
      nav(`/drama/projects/${project.id}`, { state: { activeStep: 'outline' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('drama.common.createFailed'))
      setBusy(false)
    }
  }

  // Enter 提交，Shift+Enter 换行（输入法组字中不提交）
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <form className="pf-dash-composer" onSubmit={submit}>
      <div className="pf-dash-modes" role="radiogroup" aria-label={t('home.dash.modeLabel')}>
        {(['drama', 'kepu'] as Mode[]).map((value) => {
          const Icon = value === 'drama' ? Clapperboard : Film
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              className={`pf-dash-mode${mode === value ? ' is-active' : ''}`}
              onClick={() => {
                setMode(value)
                setError('')
              }}
            >
              <Icon size={14} aria-hidden />
              {value === 'drama' ? t('home.dash.modeDrama') : t('home.dash.modeKepu')}
            </button>
          )
        })}
      </div>

      <textarea
        className="pf-dash-input"
        rows={3}
        value={text}
        maxLength={DRAMA_MAX_LENGTH}
        placeholder={mode === 'drama' ? t('home.dash.placeholderDrama') : t('home.dash.placeholderKepu')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={busy}
      />

      <div className="pf-dash-bar">
        {mode === 'drama' ? (
          <div className="pf-dash-opts">
            <OptionPicker
              tone="glass"
              icon={<Layers size={14} aria-hidden />}
              title={t('home.dash.episodeCount')}
              value={episodes}
              options={EPISODE_OPTIONS.map((n) => ({ value: n, label: t('home.dash.episodes', { count: n }) }))}
              onChange={setEpisodes}
              disabled={busy}
            />
            <OptionPicker
              tone="glass"
              icon={<Palette size={14} aria-hidden />}
              title={t('home.dash.imageStyle')}
              value={styleId}
              options={[
                { value: '' as ImageStyleId | '', label: t('home.dash.styleAuto') },
                ...IMAGE_STYLE_OPTIONS.map((o) => ({ value: o.id as ImageStyleId | '', label: o.label })),
              ]}
              onChange={setStyleId}
              disabled={busy}
            />
            <VideoGenSettings tone="glass" value={gen} onChange={setGen} disabled={busy} />
          </div>
        ) : (
          <span className="pf-dash-hint">{t('home.dash.hintKeys')}</span>
        )}
        <button type="submit" className="pf-dash-go" disabled={busy}>
          {busy ? <Loader2 size={15} className="pf-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
          {t('home.dash.generate')}
        </button>
      </div>
      {error ? (
        <p className="pf-dash-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
