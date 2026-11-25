import { compositeMaskPixels, validateInpaintAspect } from './maskPixels'
import { tr } from '../../../i18n'
export type InpaintData = { originalUrl: string; maskUrl: string; guideUrl: string }

export async function readCanvasImage(url: string) {
  const image = new Image(); image.crossOrigin = 'anonymous'; image.src = url
  await image.decode().catch(() => { throw new Error(tr('studioCanvas.maskMedia.readFailed')) })
  if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 16_777_216) throw new Error(tr('studioCanvas.maskMedia.tooLarge'))
  return image
}
export const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  try { canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(tr('studioCanvas.maskMedia.encodeFailed'))), 'image/png') }
  catch { reject(new Error(tr('studioCanvas.maskMedia.cors'))) }
})

export async function finishInpaint(data: InpaintData, generatedUrl: string) {
  const [original, mask, generated] = await Promise.all([readCanvasImage(data.originalUrl), readCanvasImage(data.maskUrl), readCanvasImage(generatedUrl)])
  if (mask.naturalWidth !== original.naturalWidth || mask.naturalHeight !== original.naturalHeight) throw new Error(tr('studioCanvas.maskMedia.maskSize'))
  validateInpaintAspect(original.naturalWidth, original.naturalHeight, generated.naturalWidth, generated.naturalHeight)
  const canvas = document.createElement('canvas'); canvas.width = original.naturalWidth; canvas.height = original.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const pixels = (image: HTMLImageElement) => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); return ctx.getImageData(0, 0, canvas.width, canvas.height).data }
  const result = compositeMaskPixels(pixels(original), pixels(generated), pixels(mask))
  ctx.putImageData(new ImageData(result, canvas.width, canvas.height), 0, 0)
  return canvasBlob(canvas)
}
