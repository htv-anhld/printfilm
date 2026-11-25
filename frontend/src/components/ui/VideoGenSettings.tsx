/** 视频生成设置组：视频模型 + 画幅 + 清晰度（模型列表来自后台启用的模型） */
import { Monitor, RectangleHorizontal, RectangleVertical, Square, Zap } from 'lucide-react'
import { useI18n } from '../../i18n'
import {
  isDraftCapableModel,
  useRatioOptions,
  useResolutionOptions,
  useVideoModelOptions,
  type VideoRatio,
  type VideoResolution,
} from '../../lib/videoModelOptions'
import ModelTile from './ModelTile'
import OptionPicker from './OptionPicker'

export type VideoGenValue = {
  model: string
  ratio: VideoRatio
  resolution: VideoResolution
  /** Draft 样片开关；undefined 表示该场景不提供 Draft */
  draft?: boolean
}

type Props = {
  value: VideoGenValue
  onChange: (next: VideoGenValue) => void
  disabled?: boolean
  tone?: 'default' | 'glass'
  /** 隐藏清晰度（如首页精简版） */
  hideResolution?: boolean
}

// 画幅图标
function RatioIcon({ ratio }: { ratio: VideoRatio }) {
  if (ratio === '16:9') return <RectangleHorizontal size={15} aria-hidden />
  if (ratio === '1:1') return <Square size={15} aria-hidden />
  return <RectangleVertical size={15} aria-hidden />
}

/**
 * 三个选择器；模型目录为空时不渲染模型选择器（由后台默认模型兜底）
 */
export default function VideoGenSettings({ value, onChange, disabled, tone = 'default', hideResolution }: Props) {
  const { t } = useI18n()
  const { options: modelOptions } = useVideoModelOptions()
  const ratioOptions = useRatioOptions()
  const resolutionOptions = useResolutionOptions()

  return (
    <>
      {modelOptions.length ? (
        <OptionPicker
          tone={tone}
          icon={<ModelTile modelId={value.model} size="sm" />}
          title={t('genSettings.videoModel')}
          value={value.model}
          options={modelOptions}
          onChange={(model) => onChange({ ...value, model })}
          disabled={disabled}
        />
      ) : null}
      <OptionPicker
        tone={tone}
        icon={<RatioIcon ratio={value.ratio} />}
        title={t('genSettings.ratio')}
        value={value.ratio}
        options={ratioOptions}
        onChange={(ratio) => onChange({ ...value, ratio })}
        disabled={disabled}
      />
      {value.draft !== undefined && isDraftCapableModel(value.model) ? (
        <button
          type="button"
          className={`pf-picker pf-picker-toggle${tone === 'glass' ? ' is-glass' : ''}${value.draft ? ' is-on' : ''}`}
          aria-pressed={value.draft}
          title={t('genSettings.draftHint')}
          disabled={disabled}
          onClick={() => onChange({ ...value, draft: !value.draft })}
        >
          <Zap size={15} aria-hidden />
          <span className="pf-picker-value">{t('genSettings.draft')}</span>
        </button>
      ) : null}
      {hideResolution || (value.draft && isDraftCapableModel(value.model)) ? null : (
        <OptionPicker
          tone={tone}
          icon={<Monitor size={15} aria-hidden />}
          title={t('genSettings.resolution')}
          value={value.resolution}
          options={resolutionOptions}
          onChange={(resolution) => onChange({ ...value, resolution })}
          disabled={disabled}
        />
      )}
    </>
  )
}
