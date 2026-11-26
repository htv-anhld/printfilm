/** 大纲「项目设置」：画幅/画风/字幕/人物介绍/尾帧衔接（全局可改；分镜页只读） */
import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import { DramaImageStyleModal } from './DramaImageStyleModal'
import {
  characterIntroModeEnabled,
  readEpisodeCharacterIntroMode,
  type DramaCharacterIntroMode,
} from '../../lib/dramaCharacterIntro'
import { type ImageStyleId } from '../../lib/dramaImageStyles'
import {
  DRAMA_RATIO_OPTIONS,
  readProjectAspectRatio,
  readProjectResolution,
  type DramaAspectRatio,
  type DramaResolution,
} from '../../lib/dramaProjectOutputSettings'
import {
  clampVideoResolutionForModel,
  hasKnownVideoModelResolutions,
  resolutionsForModel,
} from '../../lib/dramaVideoGenerationOptions'
import {
  catalogVideoModels,
  useMediaModelsCatalog,
} from '../../hooks/useMediaModelsCatalog'
import {
  readEpisodeSubtitleMode,
  subtitleModeUsesModelOutput,
  type DramaSubtitleMode,
} from '../../lib/dramaSubtitleSettings'
import type { DramaProject, DramaScript } from '../../api/drama'
import { dramaApi } from '../../api/drama'
import { useI18n } from '../../i18n'
import { useEpisodeDurationOptions } from '../../lib/videoModelOptions'
import {
  DRAMA_CONTENT_LOCALES,
  readDramaContentLocale,
  type DramaContentLocale,
} from '../../components/drama/dramaContentLocale'

type Props = {
  open: boolean
  projectId: number
  project: DramaProject
  script: DramaScript | null
  onClose: () => void
  onProjectChange: (p: DramaProject) => void
  onScriptChange: (s: DramaScript) => void
  onError: (msg: string) => void
}

type ChoiceProps<T extends string | boolean> = {
  options: Array<{ value: T; label: string }>
  value: T
  disabled?: boolean
  onChange: (value: T) => void
}

function coerceLinkLastFrame(params: Record<string, unknown> | null | undefined): boolean {
  const raw = params?.linkLastFrame ?? params?.link_last_frame
  if (raw == null) return true
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  if (typeof raw === 'string') {
    const n = raw.trim().toLowerCase()
    if (['0', 'false', 'no', 'off', ''].includes(n)) return false
  }
  return Boolean(raw)
}

/** 项目设置内选项条（复用大纲 chip 样式） */
function SettingsChoiceRow<T extends string | boolean>({
  options,
  value,
  disabled,
  onChange,
}: ChoiceProps<T>) {
  return (
    <div className="drama-project-settings-chips" role="group">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={`drama-outline-chip-btn${value === opt.value ? ' is-on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** 项目级全局成片设置弹窗 */
export function DramaProjectSettingsModal({
  open,
  projectId,
  project,
  script,
  onClose,
  onProjectChange,
  onScriptChange,
  onError,
}: Props) {
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)
  const contentLocale = readDramaContentLocale(project)
  const projectParams = (project.params || {}) as Record<string, unknown>
  // 单集时长：影响之后生成的分集正文篇幅与分镜条数
  const durationOptions = useEpisodeDurationOptions()
  const styleId = (String(script?.params?.image_style_id || projectParams.image_style_id || '') ||
    '') as ImageStyleId | ''
  const aspectRatio = readProjectAspectRatio(projectParams)
  const resolution = readProjectResolution(projectParams)
  const catalog = useMediaModelsCatalog()
  const videoModels = catalogVideoModels(catalog)
  const videoModelId =
    String(projectParams.video_model || projectParams.model_id || '').trim() ||
    catalog?.defaults.video_model ||
    ''
  const resolutionOptions = resolutionsForModel(videoModelId, catalog, videoModels)
  const clampedResolution = clampVideoResolutionForModel(
    videoModelId,
    resolution,
    catalog,
    videoModels,
  ) as DramaResolution
  const subtitleMode = readEpisodeSubtitleMode(projectParams)
  const characterIntroMode = readEpisodeCharacterIntroMode(projectParams)
  const linkLastFrame = coerceLinkLastFrame(projectParams)

  useEffect(() => {
    if (!open || saving) return
    if (!hasKnownVideoModelResolutions(videoModelId, catalog, videoModels)) return
    if (clampedResolution === resolution) return
    void patchProjectParams({ resolution: clampedResolution })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, videoModelId, catalog, clampedResolution])

  async function patchProjectParams(patch: Record<string, unknown>) {
    setSaving(true)
    try {
      const nextParams = { ...projectParams, ...patch }
      const updated = await dramaApi.updateProject(projectId, { params: nextParams })
      onProjectChange(updated)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('drama.settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleStyleChange(id: ImageStyleId | '') {
    setSaving(true)
    try {
      const updated = await dramaApi.updateScript(projectId, {
        image_style_id: id || undefined,
      })
      onScriptChange(updated)
      const p = await dramaApi.getProject(projectId)
      onProjectChange(p)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('drama.settings.styleSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // content_locale 为项目顶层字段
  async function handleContentLocaleChange(next: DramaContentLocale) {
    if (next === contentLocale) return
    setSaving(true)
    try {
      const body: Parameters<typeof dramaApi.updateProject>[1] = {
        content_locale: next,
      }
      const updated = await dramaApi.updateProject(projectId, body)
      onProjectChange(updated)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('drama.contentLocale.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('drama.settings.title')}
      size="md"
      className="drama-project-settings-modal"
      footer={
        <button type="button" className="drama-btn-primary" onClick={onClose} disabled={saving}>
          {t('drama.common.done')}
        </button>
      }
    >
      <div className="drama-project-settings">
        <p className="drama-muted drama-project-settings-lead">
          {t('drama.settings.lead')}
        </p>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>{t('drama.contentLocale.label')}</h4>
          </div>
          <SettingsChoiceRow
            value={contentLocale}
            disabled={saving}
            options={DRAMA_CONTENT_LOCALES.map((l) => ({ value: l, label: t(`drama.contentLocale.names.${l}`) }))}
            onChange={(l) => void handleContentLocaleChange(l)}
          />
          <p className="drama-muted">{t('drama.contentLocale.settingsNote')}</p>
        </section>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>{t('drama.settings.aspectRatio')}</h4>
          </div>
          <SettingsChoiceRow
            value={aspectRatio}
            disabled={saving}
            options={DRAMA_RATIO_OPTIONS.map((r) => ({ value: r as DramaAspectRatio, label: r }))}
            onChange={(ratio) => void patchProjectParams({ aspect_ratio: ratio })}
          />
          <div className="drama-project-settings-head">
            <h4>{t('drama.settings.resolution')}</h4>
          </div>
          <SettingsChoiceRow
            value={clampedResolution}
            disabled={saving}
            options={resolutionOptions.map((r) => ({ value: r as DramaResolution, label: r }))}
            onChange={(res) => void patchProjectParams({ resolution: res })}
          />
          <div className="drama-project-settings-head">
            <h4>{t('genSettings.episodeDuration')}</h4>
          </div>
          <SettingsChoiceRow
            value={String(Number(projectParams.episode_duration_sec) || 0)}
            disabled={saving}
            options={durationOptions.map((o) => ({ value: String(o.value), label: o.label }))}
            onChange={(sec) => void patchProjectParams({ episode_duration_sec: Number(sec) || 0 })}
          />
        </section>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>{t('drama.settings.imageStyle')}</h4>
          </div>
          <DramaImageStyleModal
            variant="field"
            fieldLabel=""
            title={t('drama.settings.pickStyleTitle')}
            emptyLabel={t('drama.settings.pickStyle')}
            value={styleId}
            disabled={saving}
            onChange={(id) => void handleStyleChange(id)}
            videoModelId={videoModelId}
          />
        </section>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>{t('drama.settings.subtitleMode')}</h4>
          </div>
          <SettingsChoiceRow
            value={subtitleMode}
            disabled={saving}
            options={[
              { value: 'post' as DramaSubtitleMode, label: t('drama.settings.subtitlePost') },
              { value: 'model' as DramaSubtitleMode, label: t('drama.settings.subtitleModel') },
            ]}
            onChange={(mode) =>
              void patchProjectParams({
                subtitleMode: mode,
                subtitleEnabled: subtitleModeUsesModelOutput(mode),
              })
            }
          />
          <p className="drama-muted">{t('drama.settings.subtitleHint')}</p>
        </section>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>{t('drama.settings.characterIntro')}</h4>
          </div>
          <SettingsChoiceRow
            value={characterIntroMode}
            disabled={saving}
            options={[
              { value: 'off' as DramaCharacterIntroMode, label: t('drama.settings.introOff') },
              { value: 'model' as DramaCharacterIntroMode, label: t('drama.settings.introOn') },
            ]}
            onChange={(mode) =>
              void patchProjectParams({
                characterIntroMode: mode,
                characterIntroEnabled: characterIntroModeEnabled(mode),
              })
            }
          />
        </section>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>{t('drama.settings.shotLink')}</h4>
          </div>
          <SettingsChoiceRow
            value={linkLastFrame}
            disabled={saving}
            options={[
              { value: true, label: t('drama.settings.linkLastFrame') },
              { value: false, label: t('drama.settings.parallel') },
            ]}
            onChange={(enabled) => void patchProjectParams({ linkLastFrame: enabled })}
          />
          <p className="drama-muted">{t('drama.settings.linkHint')}</p>
        </section>
      </div>
    </Modal>
  )
}
