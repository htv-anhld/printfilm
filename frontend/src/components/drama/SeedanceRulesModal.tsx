/** Seedance 传值与脚本规则说明弹窗（分集编辑页，对齐 docs/EPISODE_RULES.md） */
import { useState, type ReactNode } from 'react'
import Modal from '../ui/Modal'
import {
  DRAMA_SEGMENT_DURATION_MAX,
  DRAMA_SEGMENT_DURATION_MIN,
  DRAMA_SHOT_DURATION_HARD_MAX,
  FRAGMENT_CONTENT_DURATION_MAX,
} from '../../lib/dramaEpisodePromptEditor'
import {
  DIALOGUE_PREFIX as RAW_DIALOGUE_PREFIX,
  DRAMA_NARRATION_PREFIX as RAW_NARRATION_PREFIX,
  DRAMA_SUBTITLE_CUE as RAW_SUBTITLE_CUE,
  VISUAL_PREFIX as RAW_VISUAL_PREFIX,
} from '../../lib/dramaEpisodeScriptValidate'
import { localizeDramaMarkers } from '../../lib/dramaMarkerDisplay'
import { useI18n } from '../../i18n'
import { richText } from './richText'

type Tab = 'payload' | 'script' | 'usage'

type Props = {
  open: boolean
  onClose: () => void
}

// 渲染 Seedance 规则说明弹窗
export function SeedanceRulesModal({ open, onClose }: Props) {
  const { t, locale } = useI18n()
  const [tab, setTab] = useState<Tab>('payload')
  /* 结构标记按界面语言显示（与分集编辑器一致；存储仍为中文标记） */
  const DRAMA_SUBTITLE_CUE = localizeDramaMarkers(RAW_SUBTITLE_CUE, locale)
  const VISUAL_PREFIX = localizeDramaMarkers(RAW_VISUAL_PREFIX, locale)
  const DIALOGUE_PREFIX = localizeDramaMarkers(RAW_DIALOGUE_PREFIX, locale)
  const DRAMA_NARRATION_PREFIX = localizeDramaMarkers(RAW_NARRATION_PREFIX, locale)
  const r = (key: string, nodes: Record<string, ReactNode>) => richText(t(`drama.seedanceRules.${key}`), nodes)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('drama.seedanceRules.title')}
      size="lg"
      className="pf-help-modal seedance-rules-modal"
      footer={
        <button type="button" className="pf-btn pf-btn-lime pf-btn-sm" onClick={onClose}>
          {t('drama.seedanceRules.gotIt')}
        </button>
      }
    >
      <div className="pf-help">
        <p className="pf-help-lede">{r('lede', { doc: <code>docs/EPISODE_RULES.md</code> })}</p>

        <div className="pf-help-tabs" role="tablist" aria-label={t('drama.seedanceRules.tabsAria')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'payload'}
            className={tab === 'payload' ? 'active' : undefined}
            onClick={() => setTab('payload')}
          >
            {t('drama.seedanceRules.tabPayload')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'script'}
            className={tab === 'script' ? 'active' : undefined}
            onClick={() => setTab('script')}
          >
            {t('drama.seedanceRules.tabScript')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'usage'}
            className={tab === 'usage' ? 'active' : undefined}
            onClick={() => setTab('usage')}
          >
            {t('drama.seedanceRules.tabUsage')}
          </button>
        </div>

        {tab === 'payload' ? (
          <div className="seedance-rules-section">
            <h4>{t('drama.seedanceRules.payload.toolbarTitle')}</h4>
            <ul className="seedance-rules-list">
              <li>
                <strong>{t('drama.seedanceRules.payload.model')}</strong>
                {r('payload.modelDesc', { code: <code>model</code> })}
              </li>
              <li>
                <strong>{t('drama.seedanceRules.payload.ratioRes')}</strong>
                {r('payload.ratioResDesc', { ratio: <code>ratio</code>, res: <code>resolution</code> })}
              </li>
              <li>
                <strong>{t('drama.seedanceRules.payload.duration')}</strong>
                {r('payload.durationDesc', {
                  code: <code>duration</code>,
                  tag: <code>@duration</code>,
                  max: FRAGMENT_CONTENT_DURATION_MAX,
                })}
              </li>
              <li>
                <strong>{t('drama.seedanceRules.payload.style')}</strong>
                {t('drama.seedanceRules.payload.styleDesc')}
              </li>
            </ul>

            <h4>{t('drama.seedanceRules.payload.contentTitle')}</h4>
            <ol className="seedance-rules-list">
              <li>
                <strong>text</strong>
                {t('drama.seedanceRules.payload.textDesc')}
              </li>
              <li>
                <strong>reference_image</strong>
                {t('drama.seedanceRules.payload.refImageDesc')}
              </li>
              {/* 音色难控：暂不提交 reference_audio，口播由 generate_audio 自发挥 */}
            </ol>
            <p className="seedance-rules-note">
              {r('payload.audioNote', { code: <code>generate_audio</code> })}
            </p>

            <h4>{t('drama.seedanceRules.payload.orderTitle')}</h4>
            <ol className="seedance-rules-list">
              <li>{t('drama.seedanceRules.payload.order1')}</li>
              <li>{t('drama.seedanceRules.payload.order2')}</li>
              {/* 角色音色 / 旁白音色约束块暂关 */}
              <li>{t('drama.seedanceRules.payload.order3')}</li>
              <li>{t('drama.seedanceRules.payload.order4')}</li>
              <li>{t('drama.seedanceRules.payload.order5')}</li>
              <li>
                {r('payload.order6', {
                  asset: <code>@asset:ID</code>,
                  duration: <code>@duration:N</code>,
                })}
              </li>
            </ol>
          </div>
        ) : null}

        {tab === 'script' ? (
          <div className="seedance-rules-section">
            <h4>{t('drama.seedanceRules.script.durationTitle')}</h4>
            <ul className="seedance-rules-list">
              <li>
                <code>@duration:N</code>
                {t('drama.seedanceRules.script.durationTag', {
                  min: DRAMA_SEGMENT_DURATION_MIN,
                  max: DRAMA_SEGMENT_DURATION_MAX,
                })}
              </li>
              <li>
                {t('drama.seedanceRules.script.durationTotal', {
                  max: FRAGMENT_CONTENT_DURATION_MAX,
                  hard: DRAMA_SHOT_DURATION_HARD_MAX,
                })}
              </li>
              <li>{r('script.atHint', { at: <code>@</code> })}</li>
            </ul>

            <h4>{t('drama.seedanceRules.script.assetTitle')}</h4>
            <ul className="seedance-rules-list">
              <li>
                <code>@asset:123</code>
                {t('drama.seedanceRules.script.assetRef')}
              </li>
              <li>{t('drama.seedanceRules.script.assetPanel')}</li>
              <li>{t('drama.seedanceRules.script.assetNeedImage')}</li>
            </ul>

            <h4>{t('drama.seedanceRules.script.cueTitle')}</h4>
            <div className="seedance-rules-examples">
              <code>{DRAMA_SUBTITLE_CUE}</code>
              <code>{t('drama.seedanceRules.script.exBgm')}</code>
              <code>@duration:4</code>
              <code>
                {VISUAL_PREFIX}
                {t('drama.seedanceRules.script.exVisual')}
              </code>
              <code>@duration:6</code>
              <code>
                {DIALOGUE_PREFIX}
                {t('drama.seedanceRules.script.exDialogue')}
              </code>
              <code>
                {DRAMA_NARRATION_PREFIX}
                {t('drama.seedanceRules.script.exNarration')}
              </code>
            </div>
            <ul className="seedance-rules-list">
              <li>
                <strong>{t('drama.seedanceRules.script.emptyShot')}</strong>
                {r('script.emptyShotDesc', {
                  prefix: <code>{VISUAL_PREFIX}</code>,
                  forbid: <strong>{t('drama.seedanceRules.script.forbid')}</strong>,
                })}
              </li>
              <li>
                <strong>{t('drama.seedanceRules.script.dialogue')}</strong>
                {r('script.dialogueDesc', {
                  code: <code>{t('drama.seedanceRules.script.dialogueSyntax')}</code>,
                  prefix: DIALOGUE_PREFIX,
                })}
              </li>
              <li>
                <strong>{t('drama.seedanceRules.script.narration')}</strong>
                {r('script.narrationDesc', { prefix: DRAMA_NARRATION_PREFIX })}
              </li>
              <li>
                <strong>{t('drama.seedanceRules.script.intro')}</strong>
                {r('script.introDesc', { beside: <strong>{t('drama.seedanceRules.script.beside')}</strong> })}
              </li>
              <li>
                <strong>BGM</strong>
                {t('drama.seedanceRules.script.bgmDesc')}
              </li>
            </ul>

            <h4>{t('drama.seedanceRules.script.cameraTitle')}</h4>
            <ul className="seedance-rules-list">
              <li>{r('script.cameraTool', { at: <code>@</code> })}</li>
              <li>{t('drama.seedanceRules.script.formula')}</li>
              <li>{t('drama.seedanceRules.script.closeRotate')}</li>
            </ul>
          </div>
        ) : null}

        {tab === 'usage' ? (
          <div className="seedance-rules-section">
            <h4>{t('drama.seedanceRules.usage.checkTitle')}</h4>
            <ul className="seedance-rules-list">
              <li>{t('drama.seedanceRules.usage.check1')}</li>
              <li>{t('drama.seedanceRules.usage.check2')}</li>
              <li>{t('drama.seedanceRules.usage.check3')}</li>
            </ul>

            <h4>{t('drama.seedanceRules.usage.queueTitle')}</h4>
            <ul className="seedance-rules-list">
              <li>{t('drama.seedanceRules.usage.queue1')}</li>
              <li>{t('drama.seedanceRules.usage.queue2')}</li>
              <li>{t('drama.seedanceRules.usage.queue3')}</li>
            </ul>

            <h4>{t('drama.seedanceRules.usage.linkTitle')}</h4>
            <ul className="seedance-rules-list">
              <li>
                {r('usage.link1', {
                  flag: <code>return_last_frame=true</code>,
                  param: <code>params.lastFrameUrl</code>,
                })}
              </li>
              <li>
                {r('usage.link2', {
                  ref: <code>reference_image</code>,
                  first: <code>first_frame</code>,
                  first2: <code>first_frame</code>,
                })}
              </li>
              <li>{t('drama.seedanceRules.usage.link3')}</li>
            </ul>

            <h4>{t('drama.seedanceRules.usage.audioTitle')}</h4>
            <ul className="seedance-rules-list">
              <li>{t('drama.seedanceRules.usage.audio1')}</li>
              <li>{t('drama.seedanceRules.usage.audio2')}</li>
            </ul>

            <h4>{t('drama.seedanceRules.usage.replanTitle')}</h4>
            <p className="seedance-rules-note">{t('drama.seedanceRules.usage.replanNote')}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
