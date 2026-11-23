/** 漫剧「内容语言」：决定 AI 生成大纲/剧本/分镜/台词所用语言（与界面语言独立） */
import { isLocale, type Locale } from '../../i18n'

export type DramaContentLocale = Locale

export const DRAMA_CONTENT_LOCALES: DramaContentLocale[] = ['vi', 'en', 'zh']

/** 从项目响应读取 content_locale；旧项目无该字段时视为中文 */
export function readDramaContentLocale(project: unknown): DramaContentLocale {
  const raw = (project as { content_locale?: unknown } | null | undefined)?.content_locale
  return isLocale(raw) ? raw : 'zh'
}
