import { tr } from '../../../i18n'
export class InpaintAspectMismatchError extends Error {}

export function validateInpaintAspect(originalWidth: number, originalHeight: number, generatedWidth: number, generatedHeight: number) {
  const originalRatio = originalWidth / originalHeight
  const generatedRatio = generatedWidth / generatedHeight
  if (![originalWidth, originalHeight, generatedWidth, generatedHeight].every((value) => Number.isFinite(value) && value > 0)
    || Math.abs(generatedRatio / originalRatio - 1) > .02) {
    throw new InpaintAspectMismatchError(tr('studioCanvas.maskPixels.aspectMismatch'))
  }
}

/** Alpha compositing in straight RGBA; unselected pixels remain byte-identical. */
export function compositeMaskPixels(original: Uint8ClampedArray, generated: Uint8ClampedArray, mask: Uint8ClampedArray) {
  if (original.length !== generated.length || mask.length !== original.length || original.length % 4) throw new Error(tr('studioCanvas.maskPixels.sizeMismatch'))
  const result = original.slice()
  for (let i = 0; i < result.length; i += 4) {
    const strength = mask[i + 3] / 255
    if (!strength) continue
    const fg = generated[i + 3] / 255 * strength
    const bg = original[i + 3] / 255 * (1 - fg)
    const alpha = fg + bg
    for (let channel = 0; channel < 3; channel++) result[i + channel] = alpha ? (generated[i + channel] * fg + original[i + channel] * bg) / alpha : 0
    result[i + 3] = alpha * 255
  }
  return result
}
