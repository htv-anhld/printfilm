import { tz, tzKnown, zhLazy } from '../../i18n/zhText.ts'
import { getActiveLocale } from '../../i18n/detect.ts'
import { points } from '../../lib/points.ts'
const messages: Record<string, string> = zhLazy({
  MARKETPLACE_STORAGE_UNAVAILABLE: '文件服务暂未配置，请检查后台文件服务设置。',
  MARKETPLACE_PAYMENT_UNAVAILABLE: '支付服务暂不可用，请检查支付配置后重试。',
  MARKETPLACE_REVENUE_CONFIG_REQUIRED: '请先配置并启用平台抽成比例，再提交平台投放收益作品。',
  MARKETPLACE_RIGHTS_REQUIRED: '请补齐版权材料后再操作。',
  MARKETPLACE_EPISODE_NOT_READY: '完整播放版本尚未就绪，请稍后重试。',
  MARKETPLACE_ENTITLEMENT_REQUIRED: '尚未取得该版本的完整播放权益。',
  MARKETPLACE_SOURCE_NOT_READY: '源成片尚未完成，请完成所选分集的全部分镜视频后重新同步。',
  MARKETPLACE_SOURCE_CHANGED: '源成片已更新，请重新选择后同步。',
  MARKETPLACE_SOURCE_INCOMPATIBLE: '分镜视频规格不一致，请统一画面比例后重新同步。',
  MARKETPLACE_TARGET_CHANGED: '市场草稿已更新，请刷新查看后重新操作。',
  MARKETPLACE_SYNC_IN_PROGRESS: '成片正在同步，请等待同步完成后再保存或提交。',
  MARKETPLACE_SUBMISSIONS_DISABLED: '招募由客服撮合，请在招募详情中联系客服接单。',
})
const fields: Record<string, string> = zhLazy({
  version: '内容版本', title: '标题', reason: '审核原因', checks: '审核检查项', owner_id: '创作者编号', user_id: '购买用户编号',
  amount_fen: '金额', platform_share_bps: '平台抽成比例', enabled: '启用状态', status: '状态', note: '备注', names: '分类名称',
  name: '客服名称', wechat: '微信号', hours: '服务时间', qr_asset_id: '客服二维码', resolution: '举报处理结果',
})

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** 只展示业务说明：中文原文按词典翻译；后端按 X-Locale 返回的越南语 / 英文句子原样展示；底层异常不展示。 */
function readableText(value: string) {
  const text = value.trim().replace(/^Value error,\s*/i, '')
  if (!text || /Internal Server Error|Traceback|sqlalchemy|SELECT .* FROM|https?:\/\/|object at 0x|Error:|Exception:/i.test(text)) return undefined
  if (/[\u3400-\u9fff]/.test(text)) return tzKnown(text)
  const locale = getActiveLocale()
  if (locale === 'vi' && /[À-ỹđĐ]/.test(text)) return text
  if (locale === 'en' && /\s/.test(text) && /[.!?]$/.test(text)) return text
  return undefined
}

function boundary(value: unknown, field: string): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || !Number.isFinite(Number(value))) return tz("允许范围")
  if (field === 'unlock_price_fen') return points(Number(value))
  return field.endsWith('_fen') ? `¥${(Number(value) / 100).toFixed(2)}` : String(value)
}

function explainValidation(value: Record<string, unknown>, field: string) {
  const raw = typeof value.msg === 'string' ? value.msg : ''
  const translated = readableText(raw)
  if (translated) return translated
  const ctx = record(value.ctx) || {}
  const length = (key: string) => typeof ctx[key] === 'number' && Number.isInteger(ctx[key]) && Number(ctx[key]) >= 0 ? String(ctx[key]) : tz("规定数量")
  switch (value.type) {
    case 'missing': return tz("这是必填项")
    case 'string_too_short': return tz("至少填写 {0} 个字符", [length('min_length')])
    case 'string_too_long': return tz("不能超过 {0} 个字符", [length('max_length')])
    case 'too_short': return tz("至少需要 {0} 项", [length('min_length')])
    case 'too_long': return tz("最多允许 {0} 项", [length('max_length')])
    case 'greater_than': return tz("数值须大于 {0}", [boundary(ctx.gt, field)])
    case 'greater_than_equal': return tz("数值不能小于 {0}", [boundary(ctx.ge, field)])
    case 'less_than': return tz("数值须小于 {0}", [boundary(ctx.lt, field)])
    case 'less_than_equal': return tz("数值不能大于 {0}", [boundary(ctx.le, field)])
    case 'int_parsing': case 'int_type': case 'int_from_float': return tz("请填写整数")
    case 'float_parsing': case 'float_type': case 'finite_number': return tz("请填写有效数字")
    case 'literal_error': return ctx.expected === 'True' ? tz("请勾选确认") : tz("请选择有效选项")
    case 'bool_parsing': case 'bool_type': return tz("请确认此选项")
    case 'extra_forbidden': return tz("此项不支持提交，请刷新后重试")
  }
  if (/field required/i.test(raw)) return tz("这是必填项")
  if (/valid integer/i.test(raw)) return tz("请填写整数")
  if (/valid number/i.test(raw)) return tz("请填写数字")
  const bound = raw.match(/(greater than or equal to|less than or equal to|greater than|less than|at least|at most)\s+(-?[\d.]+)/i)
  if (bound) {
    if (/string/i.test(raw)) return tz("请填写{0} {1} 个字符", [/at least/i.test(bound[1]) ? tz("至少") : tz("不超过"), bound[2]])
    return tz("数值{0} {1}", [/greater|at least/i.test(bound[1]) ? /or equal|at least/i.test(bound[1]) ? tz("不能小于") : tz("须大于") : /or equal|at most/i.test(bound[1]) ? tz("不能大于") : tz("须小于"), boundary(bound[2], field)])
  }
  return tz("请检查填写内容")
}

function validationMessage(detail: unknown[]) {
  // 中文沿用全角标点，其他语言用半角
  const zh = getActiveLocale() === 'zh'
  const lines = detail.flatMap(entry => {
    const value = record(entry)
    if (!value) return []
    const parts = (Array.isArray(value.loc) ? value.loc : []).filter(part => (typeof part === 'string' || typeof part === 'number') && !['body', 'query', 'path'].includes(String(part)))
    const field = String(parts.findLast(part => typeof part === 'string') || '')
    const location = parts.map(part => typeof part === 'number' ? tz("第 {0} 项", [part + 1]) : fields[String(part)] || tz("表单内容")).join(tz("的"))
    const message = explainValidation(value, field)
    return [location ? `${location}${zh ? '：' : ': '}${message}` : message]
  })
  return [...new Set(lines)].join(zh ? '；' : '; ') || tz("请检查表单内容和必填字段。")
}

function fallbackMessage(status: number) {
  if (status === 401) return tz("登录已过期，请重新登录后继续。")
  if (status === 403) return tz("当前账号没有执行此操作的权限。")
  if (status === 404) return tz("内容不存在或暂不可访问，请刷新后重试。")
  if (status === 409) return tz("内容状态已变化，请刷新后重新操作。")
  if (status === 422) return tz("请检查表单内容和必填字段。")
  if (status === 429) return tz("操作过于频繁，请稍后再试。")
  return tz("暂时无法完成操作，请稍后重试。")
}

export class MarketplaceRequestError extends Error {
  code: string | undefined
  status: number

  constructor(detail: unknown, status: number, fallback?: string, cause?: unknown) {
    const object = record(detail)
    const raw = typeof detail === 'string' ? detail : typeof object?.message === 'string' ? object.message : ''
    const match = raw.match(/^(MARKETPLACE_[A-Z_]+)(?=[:：\s]|$)/)
    const code = typeof object?.code === 'string' ? object.code : match?.[1]
    const text = match ? raw.slice(match[0].length).replace(/^\s*[:：]?\s*/, '') : raw
    const message = Array.isArray(detail) ? validationMessage(detail) : readableText(text) || (code ? messages[code] : undefined) || fallback || fallbackMessage(status)
    super(message, { cause })
    this.name = 'MarketplaceRequestError'
    this.code = code
    this.status = status
  }
}
