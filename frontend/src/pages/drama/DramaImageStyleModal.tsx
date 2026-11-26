/** 画面风格选择：触发器 + Modal 卡片网格 */
import { useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'
import { DramaImageStyleCardGrid } from '../../components/drama/DramaImageStyleCardGrid'
import { DramaImageStylePreviewImg } from '../../components/drama/DramaImageStylePreviewImg'
import { DramaRealisticStyleBadge, DramaRealisticStyleNotice } from '../../components/drama/DramaRealisticStyleBadge'
import { useMediaModelsCatalog } from '../../hooks/useMediaModelsCatalog'
import Modal from '../../components/ui/Modal'
import { getImageStyleLabel, shouldWarnRealisticStyle, type ImageStyleId } from '../../lib/dramaImageStyles'
import { useI18n } from '../../i18n'

type Props = {
  value: ImageStyleId | ''
  onChange: (id: ImageStyleId | '') => void
  disabled?: boolean
  /** toolbar：列表页胶囊按钮；field：大纲页带缩略图字段 */
  variant?: 'toolbar' | 'field'
  /** field 变体左侧文案，默认「项目风格」 */
  fieldLabel?: string
  /** Modal 标题 */
  title?: string
  /** 未选时的触发文案 */
  emptyLabel?: string
  /** 当前视频模型（决定是否提示写实风格风险）；不传时用后台默认视频模型 */
  videoModelId?: string
}

// 渲染风格库触发器与画面风格 Modal
export function DramaImageStyleModal({
  value,
  onChange,
  disabled = false,
  variant = 'toolbar',
  fieldLabel: fieldLabelProp,
  title: titleProp,
  emptyLabel,
  videoModelId: videoModelIdProp,
}: Props) {
  const { t } = useI18n()
  const catalog = useMediaModelsCatalog()
  const videoModelId = videoModelIdProp || catalog?.defaults?.video_model || ''
  // warnSelected 选中的是写实风格且视频模型是 Seedance：触发器与弹窗都给提醒
  const warnSelected = shouldWarnRealisticStyle(value, videoModelId)
  const fieldLabel = fieldLabelProp ?? t('drama.styleModal.fieldLabel')
  const title = titleProp ?? t('drama.styleModal.title')
  const [open, setOpen] = useState(false)
  const styleLabel = getImageStyleLabel(value)
  const triggerLabel = styleLabel || emptyLabel || (variant === 'field' ? t('drama.styleModal.pick') : t('drama.styleModal.library'))
  const active = Boolean(value) || open

  // 选中风格并关闭
  function select(id: ImageStyleId | '') {
    onChange(id)
    setOpen(false)
  }

  return (
    <>
      {variant === 'field' ? (
        <div className="drama-style-picker-field">
          <span className="drama-style-picker-field-label">{fieldLabel}</span>
          <button
            type="button"
            className={`drama-style-picker-trigger${active ? ' is-active' : ''}`}
            disabled={disabled}
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            {value ? (
              <span className="drama-style-picker-thumb" aria-hidden>
                <DramaImageStylePreviewImg styleId={value} alt="" loading="lazy" />
              </span>
            ) : (
              <span className="drama-style-picker-thumb is-empty" aria-hidden />
            )}
            <span className="drama-style-picker-text">{triggerLabel}</span>
            {warnSelected ? <DramaRealisticStyleBadge variant="inline" /> : null}
            <ChevronDown size={14} strokeWidth={2} className={open ? 'is-open' : undefined} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`drama-agent-opt-trigger${active ? ' is-active' : ''}`}
          disabled={disabled}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <BookOpen size={15} strokeWidth={1.8} />
          <span className="drama-agent-opt-label">{triggerLabel}</span>
          {warnSelected ? <DramaRealisticStyleBadge variant="inline" /> : null}
          <ChevronDown size={13} strokeWidth={2} />
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={title} size="md" className="drama-style-modal">
        {/* 封面即画风参考图，避免用户以为只是缩略预览 */}
        <p className="drama-style-modal-hint">
          {t('drama.styleModal.coverNote')}
        </p>
        {warnSelected ? <DramaRealisticStyleNotice /> : null}
        <DramaImageStyleCardGrid
          value={value}
          onChange={select}
          noneLabel={t('drama.styleModal.none')}
          videoModelId={videoModelId}
        />
      </Modal>
    </>
  )
}
