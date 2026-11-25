import { tr } from '../../../i18n'
/** Read a local image file into a data URL that can be stored with the canvas. */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(tr('studioCanvas.nodeMedia.readFailed')))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

/** Center-crop an image to the requested width/height ratio and return a PNG data URL. */
export function cropImageToDataUrl(src: string, ratio: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
      const sourceRatio = image.width / image.height
      const cropWidth = sourceRatio > ratio ? image.height * ratio : image.width
      const cropHeight = sourceRatio > ratio ? image.height : image.width / ratio
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(cropWidth))
      canvas.height = Math.max(1, Math.round(cropHeight))
      const context = canvas.getContext('2d')
      if (!context) { reject(new Error(tr('studioCanvas.nodeMedia.cropCanvas'))); return }
      context.drawImage(image, (image.width - cropWidth) / 2, (image.height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
      } catch { reject(new Error(tr('studioCanvas.nodeMedia.cropCors'))) }
    }
    image.onerror = () => reject(new Error(tr('studioCanvas.nodeMedia.cropLoad')))
    image.src = src
  })
}
