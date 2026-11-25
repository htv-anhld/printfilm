import { tr } from '../i18n'

// 展示标签按界面语言取 assetLib.types.*，兼容画布中的图片与音频类型。
const ASSET_LABEL_KEYS = ['character', 'scene', 'prop', 'voice', 'audio', 'image', 'video', 'text'] as const

/** 资产类型的展示名；未知类型原样返回。 */
export function assetTypeLabel(type: string): string {
  return (ASSET_LABEL_KEYS as readonly string[]).includes(type) ? tr(`assetLib.types.${type}`) : type
}
