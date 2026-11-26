/** Client-side video download + zip (no server pack endpoint). */

import JSZip from 'jszip'
import { tr } from '../i18n'

export function safeDownloadBasename(title: string, projectId: number): string {
  const untitled = tr('common.untitledWork')
  const raw = (title || untitled).trim() || untitled
  const cleaned = raw
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return `${cleaned || untitled}_p${projectId}`
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function fetchMediaBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) {
    throw new Error(tr('common.downloadFailedStatus', { status: res.status }))
  }
  return res.blob()
}

export async function downloadSingleVideo(opts: {
  url: string
  title: string
  projectId: number
}): Promise<void> {
  await downloadMediaUrl(opts.url, `${safeDownloadBasename(opts.title, opts.projectId)}.mp4`)
}

/**
 * 下载单个媒体：优先 fetch→blob（可自定义文件名）；
 * OSS/CDN 未配 CORS 时 fetch 抛 TypeError，退回直链（新标签打开，浏览器可另存）。
 */
export async function downloadMediaUrl(url: string, filename: string): Promise<void> {
  let blob: Blob
  try {
    blob = await fetchMediaBlob(url)
  } catch (err) {
    if (err instanceof TypeError) {
      triggerUrlDownload(url, filename)
      return
    }
    throw err
  }
  triggerBlobDownload(blob, filename)
}

/** 直链下载：同源时 download 属性生效；跨域时浏览器在新标签打开媒体 */
export function triggerUrlDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export type ZipVideoItem = {
  id: number
  title: string
  url: string
}

export async function zipVideosClient(
  items: ZipVideoItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  if (!items.length) {
    throw new Error(tr('common.selectDoneProjects'))
  }
  const zip = new JSZip()
  const used = new Set<string>()
  const total = items.length

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const blob = await fetchMediaBlob(item.url)
    let base = `${safeDownloadBasename(item.title, item.id)}.mp4`
    if (used.has(base)) {
      base = `${safeDownloadBasename(item.title, item.id)}_${i + 1}.mp4`
    }
    used.add(base)
    zip.file(base, blob)
    onProgress?.(i + 1, total)
  }

  const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return { blob: out, filename: `printfilm_videos_${stamp}_${items.length}.zip` }
}
