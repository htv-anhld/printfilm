import { tr } from '../../../i18n'
export type MediaKind = 'image' | 'video' | 'audio'
export type StudioVideoMode = 'text_to_video' | 'omni_reference' | 'image_to_video' | 'first_last_frame'
export const VIDEO_MODES: { id: StudioVideoMode; label: string }[] = [
  { id: 'text_to_video', get label() { return tr('studioCanvas.generationReferences.mode.text_to_video') } }, { id: 'omni_reference', get label() { return tr('studioCanvas.generationReferences.mode.omni_reference') } },
  { id: 'image_to_video', get label() { return tr('studioCanvas.generationReferences.mode.image_to_video') } }, { id: 'first_last_frame', get label() { return tr('studioCanvas.generationReferences.mode.first_last_frame') } },
]

export function fixedFrameNodes<T extends { id: string }>(ids: unknown, connected: T[]): [T, T] | undefined {
  if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) return undefined
  const first = connected.find(node => node.id === ids[0])
  const last = connected.find(node => node.id === ids[1])
  return first && last ? [first, last] : undefined
}
export function videoReferenceError(kinds: MediaKind[], mode: StudioVideoMode, limits?: { images: number; videos: number; audios: number }, total = 12): string | undefined {
  if (mode === 'text_to_video') return kinds.length ? tr('studioCanvas.generationReferences.t2vNoRefs') : undefined
  if (mode === 'image_to_video' && (kinds.length !== 1 || kinds[0] !== 'image')) return tr('studioCanvas.generationReferences.i2vNeedsFrame')
  if (mode === 'first_last_frame' && (kinds.length !== 2 || kinds.some((kind) => kind !== 'image'))) return tr('studioCanvas.generationReferences.needTwoFrames')
  if (mode === 'omni_reference' && !kinds.length) return tr('studioCanvas.generationReferences.needOne')
  if (mode === 'omni_reference' && kinds.length > total) return tr('studioCanvas.generationReferences.maxTotal', { n: total })
  if (limits) for (const [kind, key, label] of [['image', 'images', 'image'], ['video', 'videos', 'video'], ['audio', 'audios', 'audio']] as const) {
    if (kinds.filter((item) => item === kind).length > limits[key]) return tr('studioCanvas.generationReferences.maxKind', { n: limits[key], kind: tr(`studioCanvas.generationReferences.kind.${label}`) })
  }
}
export function videoFileReferences(kinds: MediaKind[], preferReference = false, explicitMode?: StudioVideoMode) {
  if (explicitMode) {
    const frames = explicitMode === 'image_to_video' || explicitMode === 'first_last_frame'
    return { mode: explicitMode === 'text_to_video' ? 'text_to_video' as const : frames ? 'first_last_frame' as const : 'omni_reference' as const,
      references: explicitMode === 'text_to_video' ? [] : kinds.map((kind, file_index) => ({ file_index, role: frames ? (file_index === 0 ? 'first_frame' as const : 'last_frame' as const) : kind === 'video' ? 'reference_video' as const : kind === 'audio' ? 'reference_audio' as const : 'reference_image' as const })) }
  }
  if (!kinds.length) return { mode: 'text_to_video' as const, references: [] }
  const frameMode = !preferReference && kinds.length <= 2 && kinds.every((kind) => kind === 'image')
  return {
    mode: frameMode ? 'first_last_frame' as const : 'omni_reference' as const,
    references: kinds.map((kind, file_index) => ({ file_index, role: frameMode ? (file_index === 0 ? 'first_frame' as const : 'last_frame' as const) : kind === 'video' ? 'reference_video' as const : kind === 'audio' ? 'reference_audio' as const : 'reference_image' as const })),
  }
}
