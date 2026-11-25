import { getImageStyleLabel } from './dramaImageStyles.ts'
import { tr } from '../i18n'
import { normalizeAssetDetailReferences, splitAssetDetailPrompt, type AssetDetailReference } from './assetDetailReferences.ts'
export { normalizeAssetDetailReferences, splitAssetDetailPrompt, type AssetDetailReference, type AssetDetailPromptPart } from './assetDetailReferences.ts'

/** 统一资产详情数据：成功媒体快照优先，上传素材不混入旧生成参数。 */
export type AssetDetailRecord = {
  id?: number
  name?: string | null
  type: string
  asset_type?: string
  cover?: string | null
  url?: string | null
  params?: Record<string, unknown> | null
  references?: AssetDetailReference[]
  project_id?: number | null
  updated_at?: string | null
}

/** 只处理普通对象，兼容历史脏数据。 */
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** 仅展示标量值；保留 false 和 0，避免把内部对象直接输出到页面。 */
function display(value: unknown): string {
  if (typeof value === 'boolean') return value ? tr('assetLib.info.yes') : tr('assetLib.info.no')
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

/** 成片时长最多保留两位小数，未知或无效值不伪造为零。 */
export function formatMediaDuration(value: unknown): string {
  const duration = typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(duration) && duration > 0 ? tr('assetLib.info.seconds', { n: Number(duration.toFixed(2)) }) : ''
}

/** 从当前媒体读取生成参数；新快照存在时绝不回退到旧模型。 */
export function assetDetailInfo(asset: AssetDetailRecord) {
  const params = object(asset.params)
  const gen = object(params.generation)
  const snapshot = object(params.media_metadata)
  const hasSnapshot = params.media_metadata != null && typeof params.media_metadata === 'object'
  const uploaded = (hasSnapshot ? snapshot.source : gen.source) === 'upload'
  const options = hasSnapshot ? object(snapshot.parameters) : { ...params, ...object(params.videoOptions), ...gen }
  const model = uploaded ? '' : display(hasSnapshot ? snapshot.model_id : options.model_id)
  const sourceKind: 'upload' | 'generated' | 'unknown' = uploaded ? 'upload' : (hasSnapshot ? snapshot.source === 'generated' : Boolean(model)) ? 'generated' : 'unknown'
  const source = tr(`assetLib.info.source.${sourceKind}`)
  const prompt = display(hasSnapshot ? snapshot.prompt : params.visualPrompt || params.visualImage || params.voicePrompt || params.prompt || params.description)
  // An explicit empty frozen list is authoritative; never borrow a later form's references.
  const references = uploaded ? [] : normalizeAssetDetailReferences(
    Object.hasOwn(snapshot, 'references') ? snapshot.references : asset.references,
  )
  const requested = snapshot.parameter_source === 'request'
  const p = (key: string) => tr(`assetLib.info.params.${key}`)
  const labels: Record<string, string> = {
    aspect_ratio: requested ? p('requestedAspect') : p('aspect'),
    resolution: requested ? p('requestedResolution') : p('resolution'),
    size: requested ? p('requestedSize') : p('size'), duration_sec: p('duration'), duration: p('duration'),
    requested_duration_sec: p('requestedDuration'), video_mode: p('videoMode'), count: p('count'), negative: p('negative'),
    strength: p('strength'), motion: p('motion'),
    image_style_id: p('imageStyle'), generate_audio: p('generateAudio'), watermark: p('watermark'), camera_fixed: p('cameraFixed'),
    seed: p('seed'), speaker: p('speaker'), sample_text: p('sampleText'), sampleText: p('sampleText'),
  }
  const parameters = uploaded ? [] : Object.entries(labels).flatMap(([key, label]) => {
    const modes: Record<string, string> = { text_to_video: tr('assetLib.info.modes.textToVideo'), first_last_frame: tr('assetLib.info.modes.firstLastFrame'), omni_reference: tr('assetLib.info.modes.omniReference') }
    const raw = options[key]
    const value = key === 'video_mode' ? modes[display(raw)] || ''
      : key === 'image_style_id' ? getImageStyleLabel(display(raw)) || display(raw)
      : ['generate_audio', 'watermark', 'camera_fixed'].includes(key) && typeof raw === 'string' && /^(true|false)$/i.test(raw) ? display(raw.toLowerCase() === 'true')
      : display(raw)
    const duration = key.includes('duration') && (typeof raw === 'number' || typeof raw === 'string') ? formatMediaDuration(Number(String(raw).replace(/\s*s$/i, ''))) : ''
    return value ? [{ key, label, value: key.includes('duration') ? duration : value }].filter((item) => item.value) : []
  })
  return {
    source, sourceKind, model, prompt, references, promptParts: splitAssetDetailPrompt(prompt, references),
    parameters, mediaDuration: formatMediaDuration(options.media_duration_sec),
    filename: display(snapshot.filename), fileSize: typeof snapshot.file_size === 'number' ? snapshot.file_size : null,
    createdAt: display(snapshot.created_at || gen.finished_at || asset.updated_at),
  }
}
