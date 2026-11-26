/** 漫剧生成队列：把上游/平台原始错误翻成可读中文，并附处理建议 */

import { dialog } from './dialog'
import { isBillingError } from './billingError'
import { tr } from '../i18n'
import { formatCopyrightError } from './generationError.ts'

export type DramaGenErrorView = {
  /** 短标题 */
  title: string
  /** 用户可读说明 */
  message: string
  /** 建议操作 */
  suggestion?: string
  /** 是否余额不足（展示充值跳转） */
  billingBlocked?: boolean
  /** 是否上游模型账户欠费（提醒管理员，非用户钱包） */
  upstreamAccountBlocked?: boolean
}

/** 是否为上游 Seedream 账户欠费 */
export function isUpstreamAccountError(message: string): boolean {
  return /AccountOverdueError|上游 Seedream 账户欠费|上游.*账户欠费|upstream.*account.*(overdue|arrears)/i.test(message)
}

// 从 Seedance JSON 文案里取出 content[n]
function extractContentIndex(raw: string): number | null {
  const m = raw.match(/content\[(\d+)\]/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/** 判断文案是否像「具体根因」（优先于「重试上限」等包装句） */
function looksLikeRootCause(text: string): boolean {
  if (formatCopyrightError(text)) return true
  return /PrivacyInformation|InputImageSensitive|SensitiveContentDetected|参考图疑似|参考音频过短|参考音频过长|无法读取参考音频时长|may contain real person|Seedance create error|上一镜失败|无法衔接|分镜已变更|分镜上下文|InputTextSensitive|resource download failed|audio_url|audio duration|Credits insufficient|File type not supported|参考图格式不支持|invalid image format|参考图格式无效|未开通|previous shot failed|storyboard (has )?changed|reference audio too short/i.test(
    text,
  )
}

// 从错误里尽量抽出已标注的槽位名（后端 content_labels）
function extractNamedSlot(text: string): string | null {
  const named = matchNamedSlot(text, SLOT_ALL_RE)
  if (named) return tr('lib.genError.namedSlot', { kind: named.kind, name: named.name })
  return null
}

// 槽位类型（后端中文/英文标注）→ 当前语言展示名
const SLOT_KIND_KEYS: Record<string, string> = {
  角色: 'character',
  character: 'character',
  场景: 'scene',
  scene: 'scene',
  道具: 'prop',
  prop: 'prop',
  旁白: 'narration',
  narration: 'narration',
  参考图: 'refImage',
  'reference image': 'refImage',
  音色: 'voice',
  voice: 'voice',
}

const SLOT_ALL_RE =
  /(角色|场景|道具|旁白|参考图|音色)「([^」]+)」|\b(character|scene|prop|narration|reference image|voice)\s*[「"“]([^」"”]+)[」"”]/i
const SLOT_IMAGE_RE =
  /(角色|场景|道具|参考图)「([^」]+)」|\b(character|scene|prop|reference image)\s*[「"“]([^」"”]+)[」"”]/i
// 后端 realistic_style_privacy_hint 的三语特征片段（项目画面风格为真人写实）
const REALISTIC_STYLE_HINT_RE = /是真人写实风格|style "[^"]*" is photorealistic|» là tả thực/i

// 匹配「角色「名」」或 Character "名"，返回本地化类型名与名称
function matchNamedSlot(text: string, re: RegExp): { kind: string; name: string } | null {
  const m = text.match(re)
  if (!m) return null
  const rawKind = (m[1] || m[3] || '').toLowerCase()
  const name = m[2] || m[4] || ''
  const key = SLOT_KIND_KEYS[rawKind] || SLOT_KIND_KEYS[m[1] || '']
  return { kind: key ? tr(`lib.genError.slot.${key}`) : rawKind, name }
}

/**
 * 从多条候选错误里挑出最具体的根因（例如隐私图审核），
 * 避免只展示「重试超过上限」这类包装文案。
 */
export function pickRootDramaGenError(
  candidates: Array<string | null | undefined>,
): string {
  const cleaned = candidates.map((c) => String(c || '').trim()).filter(Boolean)
  const root = cleaned.find(looksLikeRootCause)
  if (root) return root
  return cleaned[0] || ''
}

/**
 * 将任务 error / error_message 转为前端展示文案。
 * 已是短句时尽量保留，仅补建议。
 */
export function formatDramaGenError(raw: string | null | undefined): DramaGenErrorView {
  const text = String(raw || '').trim()
  const g = (key: string, vars?: Record<string, string | number>) => tr(`lib.genError.${key}`, vars)
  const clip = (n: number) => (text.length > n ? `${text.slice(0, n)}…` : text)
  const copyright = formatCopyrightError(text)
  if (copyright) return copyright
  if (!text) {
    return {
      title: g('failedTitle'),
      message: g('empty.message'),
      suggestion: g('empty.suggestion'),
    }
  }

  if (/ReadTimeout|WriteTimeout|等待上游超时|响应超时|\btimed out\b/i.test(text)) {
    return {
      title: g('timeout.title'),
      message: clip(200),
      suggestion: g('timeout.suggestion'),
    }
  }

  if (
    /网络错误|ConnectError|ConnectTimeout|无法连接上游|network error|cannot connect|unable to connect|tokenfree\.com|api\.kie\.ai/i.test(
      text,
    )
  ) {
    return {
      title: g('network.title'),
      message: clip(200),
      suggestion: g('network.suggestion'),
    }
  }

  if (/^生图失败$|^image generation failed\.?$|^tạo ảnh thất bại\.?$/i.test(text)) {
    return {
      title: g('imageFailed.title'),
      message: g('imageFailed.message'),
      suggestion: g('imageFailed.suggestion'),
    }
  }

  if (isUpstreamAccountError(text) || (/Seedream error 403/i.test(text) && /AccountOverdue/i.test(text))) {
    return {
      title: g('upstreamAccount.title'),
      message: g('upstreamAccount.message'),
      suggestion: g('upstreamAccount.suggestion'),
      upstreamAccountBlocked: true,
    }
  }

  if (isBillingError(text)) {
    return {
      title: g('billing.title'),
      message: /余额不足|请先充值|insufficient balance|top up|số dư/i.test(text) ? text : g('billing.message'),
      suggestion: g('billing.suggestion'),
      billingBlocked: true,
    }
  }

  if (text.includes('参考音频未通过隐私审核')) {
    return {
      title: g('audioPrivacy.title'),
      message: text,
      suggestion: g('audioPrivacy.suggestion'),
    }
  }

  if (
    /参考图疑似真人|PrivacyInformation|InputImageSensitive|SensitiveContentDetected|may contain real person/i.test(
      text,
    )
  ) {
    const idx = extractContentIndex(text)
    const named = matchNamedSlot(text, SLOT_IMAGE_RE)
    // 后端在项目为写实风格时会追加「换插画风格」建议：此时优先建议改项目风格
    const realisticStyle = REALISTIC_STYLE_HINT_RE.test(text)
    if (named) {
      return {
        title: g('realPerson.title'),
        message: g('realPerson.namedMessage', { kind: named.kind, name: named.name }),
        suggestion: realisticStyle ? g('realPerson.styleSuggestion') : g('realPerson.namedSuggestion', { name: named.name }),
      }
    }
    const where = idx != null ? g('realPerson.whereIndex', { n: idx + 1, idx }) : g('realPerson.whereAny')
    return {
      title: g('realPerson.title'),
      message: g('realPerson.message', { where }),
      suggestion: realisticStyle ? g('realPerson.styleSuggestion') : g('realPerson.suggestion'),
    }
  }

  if (/重试超过上限|超过重试上限|内部自动重试超过上限|retr(y|ies).*(limit|exceeded)|exceeded.*retr/i.test(text)) {
    return {
      title: g('retryLimit.title'),
      message: text,
      suggestion: g('retryLimit.suggestion'),
    }
  }

  if (/上一镜失败|无法衔接尾帧|previous shot failed|cannot (chain|continue) from (the )?last frame/i.test(text)) {
    return {
      title: g('prevShot.title'),
      message: g('prevShot.message'),
      suggestion: g('prevShot.suggestion'),
    }
  }

  if (/分镜已变更|分镜上下文丢失|分镜不存在|storyboard (has )?changed|shot (not found|does not exist)/i.test(text)) {
    return {
      title: g('storyboardChanged.title'),
      message: g('storyboardChanged.message'),
      suggestion: g('storyboardChanged.suggestion'),
    }
  }

  if (/InputTextSensitive|text.*sensitive|敏感/i.test(text) && /Seedance|create error/i.test(text)) {
    return {
      title: g('textSensitive.title'),
      message: g('textSensitive.message'),
      suggestion: g('textSensitive.suggestion'),
    }
  }

  if (/resource download failed|audio_url/i.test(text) && !/audio duration/i.test(text)) {
    return {
      title: g('audioDownload.title'),
      message: g('audioDownload.message'),
      suggestion: g('audioDownload.suggestion'),
    }
  }

  if (/无法读取参考音频时长|参考音频地址为空/i.test(text)) {
    const named = extractNamedSlot(text)
    return {
      title: g('audioUnreadable.title'),
      message: named ? g('audioUnreadable.message', { named }) : clip(160),
      suggestion: g('audioUnreadable.suggestion'),
    }
  }

  if (/参考音频过长/i.test(text)) {
    const named = extractNamedSlot(text)
    const dur = text.match(/当前约\s*([\d.]+)\s*秒/)
    return {
      title: g('audioLong.title'),
      message: named
        ? dur
          ? g('audioLong.messageDur', { named, sec: dur[1] })
          : g('audioLong.message', { named })
        : clip(160),
      suggestion: g('audioLong.suggestion'),
    }
  }

  // Seedance r2v：reference_audio 须 ≥ 1.8 秒（不是参考图）
  if (
    /参考音频过短|reference audio too short/i.test(text) ||
    (/audio duration|1\.8/i.test(text) && /audio|音色|reference_audio|content\[/i.test(text))
  ) {
    const idx = extractContentIndex(text)
    const named = extractNamedSlot(text)
    const dur = text.match(/当前约\s*([\d.]+)\s*秒/)
    const where =
      named || (idx != null ? g('audioShort.whereIndex', { n: idx + 1, idx }) : g('audioShort.whereAny'))
    return {
      title: g('audioShort.title'),
      message: dur ? g('audioShort.messageDur', { where, sec: dur[1] }) : g('audioShort.message', { where }),
      suggestion: g('audioShort.suggestion'),
    }
  }

  if (/only support adaptive aspect ratio|adaptive aspect ratio/i.test(text)) {
    return {
      title: g('aspect.title'),
      message: g('aspect.message'),
      suggestion: g('aspect.suggestion'),
    }
  }

  if (/Credits insufficient|积分不足|余额不足.*[Kk]ie|Kie.*积分/i.test(text)) {
    return {
      title: g('credits.title'),
      message: g('credits.message'),
      suggestion: g('credits.suggestion'),
      upstreamAccountBlocked: true,
    }
  }

  if (/未开通|无可用渠道|distributor/i.test(text)) {
    return {
      title: g('notEnabled.title'),
      message: clip(180),
      suggestion: g('notEnabled.suggestion'),
    }
  }

  if (/File type not supported|参考图格式不支持|不支持 SVG|unsupported reference image/i.test(text)) {
    return {
      title: g('fileType.title'),
      message:
        text.includes('参考图格式不支持') || /unsupported reference image/i.test(text)
          ? text
          : g('fileType.message'),
      suggestion: g('fileType.suggestion'),
    }
  }

  // 参考图槽位收到非图片（常见：音色 mp3 误进 image_url）
  if (/invalid image format|参考图格式无效/i.test(text)) {
    const idx = extractContentIndex(text)
    const named = extractNamedSlot(text)
    const where =
      named ||
      (idx != null ? g('invalidImage.whereIndex', { n: idx + 1, idx }) : g('invalidImage.whereAny'))
    return {
      title: g('invalidImage.title'),
      message: g('invalidImage.message', { where }),
      suggestion: g('invalidImage.suggestion'),
    }
  }

  if (/Seedance create error\s*400|Kie createTask error/i.test(text)) {
    const idx = extractContentIndex(text)
    const named = extractNamedSlot(text)
    const where = named
      ? g('rejected.whereNamed', { where: named })
      : idx != null
        ? g('rejected.whereIndex', { n: idx + 1, idx })
        : ''
    return {
      title: g('rejected.title'),
      message: g('rejected.message', { where }),
      suggestion: g('rejected.suggestion'),
    }
  }

  if (/Seedance|上游生成失败|upstream generation failed/i.test(text)) {
    return {
      title: g('videoFailed.title'),
      message: clip(160),
      suggestion: g('videoFailed.suggestion'),
    }
  }

  if (/跳过重复任务|分镜已生成完成|duplicate task/i.test(text)) {
    return {
      title: g('skipped.title'),
      message: g('skipped.message'),
      suggestion: g('skipped.suggestion'),
    }
  }

  if (/已取消|任务已中断|cancell?ed|interrupted/i.test(text)) {
    return {
      title: /取消|cancel/i.test(text) ? g('cancelled.title') : g('interrupted.title'),
      message: text,
      suggestion: g('cancelled.suggestion'),
    }
  }

  // 成片下载被对端掐断（上游 content / CDN），不是参考图或脚本问题
  if (/RemoteProtocolError|peer closed|complete message body|incomplete download/i.test(text)) {
    return {
      title: g('downloadInterrupted.title'),
      message: g('downloadInterrupted.message'),
      suggestion: g('downloadInterrupted.suggestion'),
    }
  }

  // 浏览器层断连：不是脚本/参考图问题，常因后端热重载或瞬时网络
  if (/failed to fetch|networkerror|load failed|connection reset|连接被重置/i.test(text)) {
    return {
      title: g('fetchFailed.title'),
      message: g('fetchFailed.message'),
      suggestion: g('fetchFailed.suggestion'),
    }
  }

  // 已是较短的可读句子（中文 / 越南语）：原样展示，补通用建议
  if (!/[{\\[\]"]/.test(text) && text.length <= 120 && /[\u4e00-\u9fff\u00c0-\u1ef9]/.test(text)) {
    return {
      title: g('failedTitle'),
      message: text,
      suggestion: g('shortSuggestion'),
    }
  }

  return {
    title: g('failedTitle'),
    message: clip(200),
    suggestion: g('fallbackSuggestion'),
  }
}

/** 弹窗展示生成失败（含上游欠费 / 用户余额不足等） */
export async function alertDramaGenError(raw: unknown): Promise<void> {
  const text = raw instanceof Error ? raw.message : String(raw || '')
  const view = formatDramaGenError(text)
  const body = [view.message, view.suggestion].filter(Boolean).join('\n\n')
  await dialog.alert({
    title: view.title,
    message: body || view.title,
    tone: 'danger',
  })
}
