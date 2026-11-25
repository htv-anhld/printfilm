/** 资产形象历史版本读写 */
import { tr } from '../i18n'
import { resolveDramaMediaUrl, type DramaAsset } from '../api/drama'

export type AssetImageVersion = {
  id: string
  url: string
  cover?: string
  prompt?: string | null
  createdAt?: string
  source?: string
  mediaMetadata?: Record<string, unknown>
}

// 从 params.image_versions 读取可展示的历史形象
export function readAssetImageVersions(asset: DramaAsset | null | undefined): AssetImageVersion[] {
  const raw = (asset?.params as Record<string, unknown> | null | undefined)?.image_versions
  if (!Array.isArray(raw)) return []
  const out: AssetImageVersion[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = String(row.id || '').trim()
    const url = String(row.url || row.cover || '').trim()
    if (!id || !url) continue
    out.push({
      id,
      url,
      cover: typeof row.cover === 'string' ? row.cover : undefined,
      prompt: typeof row.prompt === 'string' ? row.prompt : null,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
      source: typeof row.source === 'string' ? row.source : undefined,
      mediaMetadata: row.media_metadata && typeof row.media_metadata === 'object' ? row.media_metadata as Record<string, unknown> : undefined,
    })
  }
  return out
}

export function resolveAssetImageVersionUrl(version: AssetImageVersion): string {
  return resolveDramaMediaUrl(version.cover || version.url) || version.url
}

export function formatAssetImageVersionLabel(version: AssetImageVersion): string {
  // 新版本记录把来源写在 media_metadata.source；旧记录仍读顶层 source
  const src = String(version.mediaMetadata?.source || version.source || '').toLowerCase()
  if (src === 'upload') return tr('lib.assetImage.version.upload')
  if (src === 'replaced') return tr('lib.assetImage.version.replaced')
  if (src === 'generate' || src === 'generated') return tr('lib.assetImage.version.generate')
  if (src === 'restored') return tr('lib.assetImage.version.restored')
  return tr('lib.assetImage.version.history')
}
