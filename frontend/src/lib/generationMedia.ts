import { useCallback } from 'react'
import { AudioLines, Image, Video } from 'lucide-react'
import { useI18n } from '../i18n'
import { generationTextVi } from './generationTextVi'

export type MediaKind = 'video' | 'image' | 'audio'
export const mediaKinds: MediaKind[] = ['video', 'image', 'audio']
export const mediaIcons = { video: Video, image: Image, audio: AudioLines }

/** 上游中/英双写文案：zh 显示中文，vi 查越南语译文，其余显示英文 */
export function useGenerationText() {
  const { locale } = useI18n()
  return useCallback((zh: string, en: string) => locale === 'zh' ? zh : locale === 'vi' ? generationTextVi(en) : en, [locale])
}
