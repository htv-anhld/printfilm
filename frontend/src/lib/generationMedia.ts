import { useCallback } from 'react'
import { AudioLines, Image, Video } from 'lucide-react'
import { useI18n } from '../i18n'
import { generationTextVi } from './generationTextVi'

export type MediaKind = 'video' | 'image' | 'audio'
export const mediaKinds: MediaKind[] = ['video', 'image', 'audio']
export const mediaIcons = { video: Video, image: Image, audio: AudioLines }

/** 上游中/英双写文案：zh 显示中文，vi 查越南语译文，其余显示英文 */
/** 日期格式化用的 BCP 47 语言标签（随界面语言） */
export function useGenerationDateLocale(): string {
  const { locale } = useI18n()
  return locale === 'zh' ? 'zh-CN' : locale === 'vi' ? 'vi-VN' : 'en-US'
}

export function useGenerationText() {
  const { locale } = useI18n()
  return useCallback((zh: string, en: string) => locale === 'zh' ? zh : locale === 'vi' ? generationTextVi(en) : en, [locale])
}

/**
 * 生成记录轮询间隔：有排队 / 生成中的任务时 5s，全部结束 30s；页面隐藏时 60s（减少无效请求）。
 * @param items 当前列表记录（只看 status）
 */
export function generationPollDelay(items: Array<{ status: string }>): number {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return 60000
  return items.some(item => item.status === 'queued' || item.status === 'running') ? 5000 : 30000
}
