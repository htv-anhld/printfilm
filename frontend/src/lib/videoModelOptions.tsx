/** 视频生成设置的选项：模型图块 + 模型/画幅/清晰度选项（数据来自后台 /api/media-models） */
import { useMemo } from 'react'
import type { MediaModelOption } from '../api'
import { useMediaModelsCatalog } from '../hooks/useMediaModelsCatalog'
import { useI18n } from '../i18n'
import ModelTile from '../components/ui/ModelTile'
import type { PickerOption } from '../components/ui/OptionPicker'

export const VIDEO_RATIOS = ['9:16', '16:9', '1:1'] as const
export const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'] as const
export type VideoRatio = (typeof VIDEO_RATIOS)[number]
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number]

type ModelTier = 'fast' | 'pro' | 'std' | 'other'

/** 是否支持 Draft 样片（仅 Seedance 2.5 正式版，与后端 is_draft_capable_model 一致） */
export function isDraftCapableModel(id: string | null | undefined): boolean {
  const s = (id || '').toLowerCase()
  if (!s.includes('seedance') || /fast|lite|flash|mini/.test(s)) return false
  return /2[.-]5/.test(s)
}

// 按模型 id 判断档位（决定说明文案）
function modelTier(id: string): ModelTier {
  const s = id.toLowerCase()
  if (/fast|lite|mini|turbo/.test(s)) return 'fast'
  if (/2[.-]5|pro/.test(s)) return 'pro'
  if (/2[.-]0|seedance-2\b/.test(s)) return 'std'
  return 'other'
}


/**
 * 视频模型选项与默认值
 * @returns options 选择器选项；defaultId 后台默认模型；loading 目录未到
 */
export function useVideoModelOptions(): {
  models: MediaModelOption[]
  options: PickerOption<string>[]
  defaultId: string
  loading: boolean
} {
  const { t } = useI18n()
  const catalog = useMediaModelsCatalog()
  return useMemo(() => {
    const models = catalog?.video_models ?? []
    const hintKey: Record<ModelTier, string> = {
      fast: 'genSettings.hintFast',
      pro: 'genSettings.hintPro',
      std: 'genSettings.hintStd',
      other: 'genSettings.hintOther',
    }
    const options = models.map((m) => ({
      value: m.id,
      label: m.label || m.id,
      icon: <ModelTile modelId={m.id} />,
      hint: m.description || t(hintKey[modelTier(m.id)]),
      badge: m.recommended ? t('genSettings.recommended') : undefined,
    }))
    return {
      models,
      options,
      defaultId: catalog?.defaults.video_model || models[0]?.id || '',
      loading: catalog === null,
    }
  }, [catalog, t])
}

/** 画幅选项（带用途说明） */
export function useRatioOptions(): PickerOption<VideoRatio>[] {
  const { t } = useI18n()
  return useMemo(
    () => [
      { value: '9:16', label: '9:16', hint: t('genSettings.ratioPortrait') },
      { value: '16:9', label: '16:9', hint: t('genSettings.ratioLandscape') },
      { value: '1:1', label: '1:1', hint: t('genSettings.ratioSquare') },
    ],
    [t],
  )
}

/** 清晰度选项（带成本说明） */
export function useResolutionOptions(): PickerOption<VideoResolution>[] {
  const { t } = useI18n()
  return useMemo(
    () => [
      { value: '480p', label: '480p', hint: t('genSettings.res480') },
      { value: '720p', label: '720p', hint: t('genSettings.res720') },
      { value: '1080p', label: '1080p', hint: t('genSettings.res1080') },
    ],
    [t],
  )
}

/** 单集时长选项（0 = 默认 60–90 秒）；镜数按约 8 秒/镜估算，与后端 episode_length 一致 */
export const EPISODE_DURATION_VALUES = [0, 120, 180, 300] as const
export type EpisodeDuration = (typeof EPISODE_DURATION_VALUES)[number]

/** 单集时长选择项 */
export function useEpisodeDurationOptions(): PickerOption<EpisodeDuration>[] {
  const { t } = useI18n()
  return useMemo(
    () => [
      { value: 0, label: t('genSettings.durationDefault'), hint: t('genSettings.durationDefaultHint') },
      ...([120, 180, 300] as const).map((sec) => ({
        value: sec,
        label: t(`genSettings.duration${sec}`),
        hint: t('genSettings.durationShotsHint', { n: Math.ceil(sec / 8) }),
      })),
    ],
    [t],
  )
}
