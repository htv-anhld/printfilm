import { tr } from '../../../i18n'
export function studioGenerationError(value: unknown): string {
  const message = typeof value === 'string' ? value : ''
  if (/at most one first[_ ]frame/i.test(message)) return tr('studioCanvas.generationError.multiFirstFrame')
  if (/ModelNotOpen|model.+not.+activated/i.test(message)) {
    const model = message.match(/(?:doubao-)?seedance-2[.-](?:0|5)(?:-fast)?(?:-\d{6})?/i)?.[0]
    const label = model ? `Seedance ${/2[.-]5/.test(model) ? '2.5' : '2.0'}${/-fast/i.test(model) ? ' Fast' : ''}` : tr('studioCanvas.generationError.thatModel')
    return tr('studioCanvas.generationError.notOpen',{model:model ? ` ${label}` : label})
  }
  if (/insufficient_quota|insufficient.balance|余额不足|欠费/i.test(message)) return tr('studioCanvas.generationError.quota')
  if (/InvalidApiKey|Unauthorized|AuthenticationError|invalid.api.key/i.test(message)) return tr('studioCanvas.generationError.auth')
  if (/copyright restrictions/i.test(message)) {
    const requestId = message.match(/\brequest[ _-]?id\s*[:：]\s*([a-z0-9_-]{1,128})\b/i)?.[1]
    const explanation = tr('studioCanvas.generationError.copyright')
    return requestId ? `${explanation} ${tr('studioCanvas.generationError.requestId',{id:requestId})}` : explanation
  }
  if (/ContentPolicy|content.policy|sensitive|moderation/i.test(message)) return tr('studioCanvas.generationError.moderation')
  return message ? message.slice(0, 600) : tr('studioCanvas.generationError.generic')
}
