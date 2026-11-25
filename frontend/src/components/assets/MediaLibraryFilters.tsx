import { AudioLines, Image, Video } from 'lucide-react'
import type { MediaLibraryGenerationStatus } from '../../api/drama'
import { tr } from '../../i18n'
import { AssetTypeFilter } from './AssetLibrary'

export type MediaLibraryFilter = {
  kind: 'image' | 'video' | 'audio'
  imageType: 'all' | 'character' | 'scene' | 'prop'
  generationStatus: MediaLibraryGenerationStatus
}

const MEDIA_TYPES = [
  { value: 'image', labelKey: 'assetLib.types.image', icon: Image },
  { value: 'video', labelKey: 'assetLib.types.video', icon: Video },
  { value: 'audio', labelKey: 'assetLib.types.audio', icon: AudioLines },
] as const
const IMAGE_TYPES = [
  { value: 'all', labelKey: 'assetLib.filters.allImages' },
  { value: 'character', labelKey: 'assetLib.types.character' },
  { value: 'scene', labelKey: 'assetLib.types.scene' },
  { value: 'prop', labelKey: 'assetLib.types.prop' },
] as const
const GENERATION_STATUSES = [
  { value: 'all', labelKey: 'assetLib.filters.all' },
  { value: 'generated', labelKey: 'assetLib.filters.generated' },
  { value: 'ungenerated', labelKey: 'assetLib.filters.ungenerated' },
] as const

/** 把 labelKey 选项转成当前语言的筛选项 */
function localized<T extends string>(items: readonly { value: T; labelKey: string }[]) {
  return items.map(({ value, labelKey }) => ({ value, label: tr(labelKey) }))
}

/** 先选媒体大类，业务分类仅用于图片；切换大类时清空图片分类。 */
export default function MediaLibraryFilters({ value, onChange }: {
  value: MediaLibraryFilter
  onChange: (value: MediaLibraryFilter) => void
}) {
  return <div className="pf-library-filter-stack">
    <div className="pf-library-media-tabs" role="group" aria-label={tr('assetLib.filters.mediaAria')}>
      {MEDIA_TYPES.map(({ value: kind, labelKey, icon: Icon }) => <button key={kind} type="button"
        className={`pf-library-pill${value.kind === kind ? ' is-active' : ''}`}
        aria-pressed={value.kind === kind}
        onClick={() => { if (value.kind !== kind) onChange({ ...value, kind, imageType: 'all' }) }}>
        <Icon size={17} aria-hidden />{tr(labelKey)}
      </button>)}
    </div>
    {value.kind === 'image' && <div className="pf-library-image-categories">
      <span>{tr('assetLib.filters.imageCategory')}</span>
      <AssetTypeFilter options={localized(IMAGE_TYPES)} value={value.imageType} ariaLabel={tr('assetLib.filters.imageCategoryAria')}
        onChange={imageType => onChange({ ...value, kind: 'image', imageType })} />
    </div>}
    <div className="pf-library-generation-status">
      <span>{tr('assetLib.filters.generationStatus')}</span>
      <AssetTypeFilter options={localized(GENERATION_STATUSES)} value={value.generationStatus} ariaLabel={tr('assetLib.filters.generationStatusAria')}
        onChange={generationStatus => onChange({ ...value, generationStatus })} />
    </div>
  </div>
}
