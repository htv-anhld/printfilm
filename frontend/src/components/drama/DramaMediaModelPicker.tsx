/** 图/视频模型选择列表：图标 + 简介 + 耗时 + 选用提示 */
import type { ReactNode } from 'react'
import { Check, Clapperboard, Film, Image as ImageIcon, Sparkles, Wand2, Zap } from 'lucide-react'
import type { MediaModelOption } from '../../api'
import {
  mediaModelCapabilityBadge,
  mediaModelClipDurationLabel,
  mediaModelHoverText,
  mediaModelIconKind,
  type MediaModelIconKind,
} from '../../lib/dramaMediaModelMeta'
import { useI18n } from '../../i18n'

type Props = {
  models: MediaModelOption[]
  selectedId: string
  emptyHint?: string
  onSelect: (model: MediaModelOption) => void
}

/** 按模型族渲染图标 */
function ModelIcon({ kind }: { kind: MediaModelIconKind }) {
  const common = { size: 16, strokeWidth: 1.9 } as const
  switch (kind) {
    case 'seedance25':
      return <Wand2 {...common} />
    case 'seedanceMini':
      return <Zap {...common} />
    case 'seedance':
      return <Clapperboard {...common} />
    case 'minimax':
      return <Sparkles {...common} />
    case 'seedream':
      return <ImageIcon {...common} />
    case 'gptImage':
      return <Film {...common} />
    default:
      return <Clapperboard {...common} />
  }
}

/** 渲染可选模型卡片列表（文案走 i18n；不可用模型禁用并给出提示） */
export function DramaMediaModelPicker({
  models,
  selectedId,
  emptyHint,
  onSelect,
}: Props) {
  const { t } = useI18n()
  if (models.length === 0) {
    return <p className="fc-gen-model-empty">{emptyHint || t('episode.genOpts.noModels')}</p>
  }

  return (
    <div className="fc-gen-model-list fc-gen-model-list--rich">
      {models.map((m) => {
        const selected = selectedId === m.id
        const kind = mediaModelIconKind(m.id)
        const badge = mediaModelCapabilityBadge(m)
        const desc = (m.description || '').trim()
        const price = m.prices && Object.keys(m.prices).length ? Object.entries(m.prices).map(([resolution, amount]) => t(m.billing_unit === 'second' ? 'episode.genOpts.modelPricePerSecond' : 'episode.genOpts.modelPricePerImage', { resolution, amount })).join(' · ') : (m.pricing_hint || '').trim()
        const eta = (m.eta_hint || '').trim()
        const clip = mediaModelClipDurationLabel(m)
        const metaBits = [clip, eta].filter(Boolean)
        const unavailable = m.available === false
        return (
          <button
            key={m.id}
            type="button"
            disabled={unavailable}
            className={`fc-gen-model-card${selected ? ' selected' : ''}`}
            title={unavailable ? `${mediaModelHoverText(m)}\n${t('episode.genOpts.modelUnavailable')}` : mediaModelHoverText(m)}
            aria-label={[m.label, desc, ...metaBits, price, unavailable ? t('episode.genOpts.modelUnavailable') : ''].filter(Boolean).join(', ')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(m)}
          >
            <span className={`fc-gen-model-card-icon is-${kind}`} aria-hidden>
              <ModelIcon kind={kind} />
            </span>
            <span className="fc-gen-model-card-body">
              <span className="fc-gen-model-card-head">
                <strong>{m.label}</strong>
                {m.recommended ? <em className="fc-gen-model-card-rec">{t('episode.genOpts.modelDefault')}</em> : null}
                <em className="fc-gen-model-card-badge">{badge}</em>
                {selected ? (
                  <Check className="fc-gen-model-card-check" size={15} strokeWidth={2.4} aria-hidden />
                ) : null}
              </span>
              {desc ? <span className="fc-gen-model-card-desc">{desc}</span> : null}
              {metaBits.length ? (
                <span className="fc-gen-model-card-meta">{metaBits.join(' · ')}</span>
              ) : null}
              {price ? <span className="fc-gen-model-card-price">{price}</span> : null}
              {m.reference_limits ? (
                <span className="fc-gen-model-card-meta">
                  {t('episode.genOpts.modelRefLimits', {
                    images: m.reference_limits.images,
                    videos: m.reference_limits.videos,
                    audios: m.reference_limits.audios,
                  })}
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** 供外部需要自定义点击时复用图标节点 */
export function dramaMediaModelIconNode(modelId: string): ReactNode {
  return <ModelIcon kind={mediaModelIconKind(modelId)} />
}
