import { throwApiError } from './lib/apiError'
import { tr } from './i18n'

function defaultApiBase() {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location
    // Same host as Vite; API listens on 8000 for LAN + local
    return `${protocol}//${hostname}:8000`
  }
  return 'http://127.0.0.1:8000'
}

// Empty string = same-origin (nginx proxies /api). Undefined = LAN default :8000.
const _viteApiBase = import.meta.env.VITE_API_BASE
export const API_BASE =
  _viteApiBase === undefined || _viteApiBase === null ? defaultApiBase() : String(_viteApiBase)

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token')
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers || {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throwApiError(res.status, err.detail, res.statusText)
  }
  return res.json()
}

export type PipelineMode = 'full' | 'image_text'

export type Template = {
  id: string
  name: string
  description: string
  category: string[]
  preview_cover: string
  default_ratio: string
  shot_duration_min: number
  shot_duration_max: number
  is_premium: boolean
  sort_order: number
  style_prefix?: string
  negative_prompt?: string
  llm_system_addon?: string
  seedream_config?: {
    ref_images?: string[]
    strength?: number
    character_prompt?: string
    extra_prompt?: string
    consistency_mode?: 'character' | 'style' | 'diverse'
  }
  audio_config?: {
    voice_preset?: string
    bgm_mood?: string
  }
}

/** Template voice_preset alias → openspeech speaker id */
export const VOICE_PRESET_ALIASES: Record<string, string> = {
  narrator_calm: 'zh_female_cancan_uranus_bigtts',
  warm_storyteller: 'zh_female_tianmeixiaoyuan_uranus_bigtts',
  teacher_clear: 'zh_male_shaonianzixin_uranus_bigtts',
  urban_editorial: 'zh_female_shuangkuaisisi_uranus_bigtts',
  retro_host: 'zh_male_shaonianzixin_uranus_bigtts',
  guqin_narrator: 'zh_female_vv_uranus_bigtts',
}

export function defaultsFromTemplate(t: Template): {
  style_prompt: string
  character_prompt: string
  extra_prompt: string
  voice_id: string
  output_ratio: string
} {
  const cfg = t.seedream_config || {}
  const preset = t.audio_config?.voice_preset || ''
  const voice_id =
    VOICE_PRESET_ALIASES[preset] ||
    (preset.startsWith('zh_') ? preset : 'zh_female_cancan_uranus_bigtts')
  return {
    style_prompt: (t.style_prefix || '').trim(),
    character_prompt: (cfg.character_prompt || '').trim(),
    extra_prompt: (cfg.extra_prompt || '').trim(),
    voice_id,
    output_ratio: t.default_ratio || '16:9',
  }
}

export type Shot = {
  id: number
  shot_no: number
  duration: number
  narration: string
  overlay_title?: string
  overlay_subtitle?: string
  img_prompt: string
  video_prompt: string
  segment_script?: string
  camera: string
  bgm_mood: string
  image_url: string | null
  video_url: string | null
  audio_url: string | null
  status: string
  version: number
}

export type VoicePreset = {
  id: string
  label: string
  gender: string
  speaker: string
}

/** 项目 voice_id / 模板别名 → 与音色列表一致的 speaker id */
export function resolveVoiceId(raw: string, voices: VoicePreset[]): string {
  const id = (raw || '').trim()
  if (!id) {
    const first = voices[0]
    return first ? first.speaker || first.id : ''
  }
  const alias = VOICE_PRESET_ALIASES[id]
  if (alias) return alias
  const hit = voices.find((v) => v.id === id || v.speaker === id)
  return hit ? hit.speaker || hit.id : id
}

/** 项目内容语言 */
export type ContentLocale = 'zh' | 'en' | 'vi'

export type Project = {
  id: number
  template_id: string
  title: string
  source_type: string
  source_text: string
  status: string
  progress: number
  error_msg: string | null
  cover_url: string | null
  final_video_url: string | null
  resolution_mode: string
  pipeline_mode?: PipelineMode
  /** 内容语言（AI 生成的标题/旁白/字幕等） */
  content_locale?: ContentLocale
  output_ratio?: string
  voice_id?: string
  character_bible?: string
  bgm_lock?: string
  subtitle_preset?: string
  style_prompt?: string
  character_prompt?: string
  extra_prompt?: string
  image_model?: string
  video_model?: string
  ref_image_url: string | null
  created_at: string
  updated_at: string
  shots: Shot[]
  active_tasks?: Array<{
    id: number
    domain: string
    task_type: string
    status: string
    current_step_key?: string | null
    current_step_status?: string | null
    progress_percent?: number
    cancel_requested?: boolean
    provider_task_id?: string | null
    error_message?: string | null
    project_id?: number | null
    shot_id?: number | null
    created_at?: string
    updated_at?: string
  }>
}

export type MediaModelOption = {
  id: string
  label: string
  description: string
  provider: string
  recommended?: boolean
}

export type MediaModelsCatalog = {
  image_models: MediaModelOption[]
  video_models: MediaModelOption[]
  defaults: {
    image_model: string
    video_model: string
  }
}

export type User = {
  id: number
  email: string
  nickname: string
  quota_left: number
  balance_fen?: number
  frozen_fen?: number
  plan?: string
  avatar_url?: string
  phone?: string
  email_verified?: boolean
  sub_credit_fen?: number
}

export type OAuthAppRow = {
  id: number
  name: string
  client_id: string
  redirect_uris: string[]
  confidential: boolean
  registration: string
  created_at?: string | null
  client_secret?: string
}

export type McpRequestRow = {
  id: number
  app?: string | null
  method: string
  tool?: string | null
  status: string
  summary?: string | null
  duration_ms: number
  created_at?: string | null
}

export type LibraryKind = 'avatar' | 'bgm' | 'sfx'

export type LibraryItem = {
  id: number | string
  kind: LibraryKind
  name: string
  url: string
  tags?: string[]
  duration_sec?: number | null
  scope: 'mine' | 'global' | 'project'
  project?: string
}

export type PartnerInfo = {
  status: 'none' | 'pending' | 'approved' | 'rejected' | 'suspended'
  ref_code?: string | null
  ref_link?: string | null
  commission_rate?: number
  channel?: string
  website?: string
  audience?: string
  note?: string
  review_note?: string
}

export type PartnerDashboard = {
  partner: PartnerInfo
  signups: number
  paying_users: number
  held_fen: number
  available_fen: number
  redeemed_fen: number
  reversed_fen: number
  hold_days: number
  recent: { id: number; source_type: string; paid_fen: number; commission_fen: number; status: string; available_at: string; created_at?: string | null }[]
}

export type PartnerSubmission = {
  id: number
  url: string
  platform: string
  note: string
  status: 'pending' | 'approved' | 'rejected'
  reward_fen: number
  review_note: string
  created_at?: string | null
}

export type TeamRole = 'owner' | 'admin' | 'member'

export type TeamSummary = { id: number; name: string; role: TeamRole; seats: number; members: number; owner_id: number }

export type TeamMemberRow = {
  user_id: number
  email: string
  nickname: string
  role: TeamRole
  joined_at?: string | null
  balance_fen?: number
  allocated_fen?: number
  month_charge_fen?: number
}

export type TeamDetail = {
  id: number
  name: string
  seats: number
  owner_id: number
  my_role: TeamRole
  members: TeamMemberRow[]
  invites: { id: number; email: string; role: TeamRole; expires_at: string; expired: boolean }[]
  credits_per_seat: number
}

export type BillingSku = {
  id: string
  name: string
  amount_fen: number
  credit_fen: number
  recommended?: boolean
}

export type BillingOrder = {
  out_trade_no: string
  sku_id: string
  sku_name: string
  amount_fen: number
  credit_fen: number
  pay_type: string
  status: string
  trade_no?: string | null
  paid_at?: string | null
  created_at?: string | null
  currency?: BillingCurrency
  provider?: string
  bonus_fen?: number
}

export type UsageSummary = {
  period: string
  tokens: number
  charge_fen: number
  charge_yuan: number
  cost_fen: number
  calls: number
  balance_fen: number
  balance_yuan: number
  frozen_fen: number
  frozen_yuan: number
}

export type UsageChargeRecord = {
  id: number
  billing_key: string
  billing_label: string
  model: string
  context: string
  total_tokens: number
  charge_fen: number
  charge_yuan: number
  estimated: boolean
  created_at: string | null
}

export type UsageChargeList = {
  items: UsageChargeRecord[]
  meta: { page: number; page_size: number; total: number }
}

export type Wallet = {
  balance_fen: number
  frozen_fen: number
  /** 历史字段名：计费币种主单位（USD 下即美元） */
  balance_yuan: number
  frozen_yuan: number
  currency?: BillingCurrency
  symbol?: string
  balance_display?: string
  /** 余额中属于订阅月额度（期末过期）的部分 */
  sub_credit_fen?: number
  plan: string
  billing_enabled: boolean
  markup: number
}

export type BillingCurrency = 'USD' | 'CNY'

export type PlanInterval = 'month' | 'year'

/** /api/billing/plans 单个套餐（金额单位美分） */
export type SubscriptionPlan = {
  id: string
  name: string
  credits_per_month: number
  price_month: number
  price_year: number
  list_price_month?: number
  max_concurrent: number
  rank: number
  recommended?: boolean
  purchasable: Record<PlanInterval, boolean>
}

/** /api/billing/subscription */
export type MySubscription = {
  id?: number
  plan_id: string
  plan_name?: string
  interval?: PlanInterval
  status: string
  credits_per_period?: number
  max_concurrent?: number
  current_period_start?: string | null
  current_period_end?: string | null
  next_grant_at?: string | null
  cancel_at_period_end?: boolean
  sub_credit_fen: number
  can_manage?: boolean
}

/** /api/billing/config：全站计费展示配置 */
export type BillingConfig = {
  billing_enabled: boolean
  currency: BillingCurrency
  symbol: string
  /** USD 下钱包整数单位是 credit（1 credit = 1 美分） */
  unit: 'credit' | 'fen'
  units_per_major: number
  signup_grant_fen: number
  first_topup_bonus_fen: number
  pay_types: string[]
}

export type BillingPreflight = {
  ok: boolean
  billing_enabled: boolean
  balance_fen: number
  balance_yuan?: number
  unit_estimate_fen: number
  unit_estimate_yuan?: number
  pending_commitment_fen: number
  pending_commitment_yuan?: number
  requested_total_fen: number
  requested_total_yuan?: number
  required_total_fen: number
  required_total_yuan?: number
  count?: number
  domain?: string
  task_type?: string
}

export type Work = {
  id: number
  project_id: number
  user_id: number
  title: string
  cover_url: string | null
  video_url: string
  visibility: string
  published_at: string
}

export const api = {
  assetUrl(path: string | null | undefined, cacheBust?: string | number) {
    if (!path) return ''
    if (path.startsWith('http')) return path
    // Only bust when caller passes a stable version (e.g. updated_at) — never Date.now()
    const q = cacheBust != null && cacheBust !== '' ? `?v=${encodeURIComponent(String(cacheBust))}` : ''
    return `${API_BASE}${path}${q}`
  },
  register(email: string, password: string, nickname: string, ref?: string) {
    return request<{ access_token: string; email_verification_required?: boolean }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nickname, ref }),
    })
  },
  login(email: string, password: string) {
    return request<{ access_token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },
  forgotPassword(email: string) {
    return request<{ ok: boolean; message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },
  resetPassword(token: string, new_password: string) {
    return request<{ ok: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password }),
    })
  },
  me() {
    return request<User>('/api/auth/me')
  },
  authProviders() {
    return request<{ google: boolean; email_verification: boolean }>('/api/auth/providers')
  },
  resendVerification() {
    return request<{ ok: boolean; sent?: boolean; cooldown?: number; verified?: boolean }>(
      '/api/auth/resend-verification',
      { method: 'POST' },
    )
  },
  verifyEmailCode(code: string) {
    return request<User>('/api/auth/verify-email-code', { method: 'POST', body: JSON.stringify({ code }) })
  },
  verifyEmailToken(token: string) {
    return request<{ access_token: string }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  },
  googleStart(next: string) {
    return request<{ url: string }>(`/api/auth/google/start?next=${encodeURIComponent(next)}`)
  },
  googleExchange(code: string, state: string, ref?: string) {
    return request<{ access_token: string; next: string; created: boolean }>('/api/auth/google/exchange', {
      method: 'POST',
      body: JSON.stringify({ code, state, ref }),
    })
  },
  oauthApps() {
    return request<{ items: OAuthAppRow[]; authorized: { id: number; name: string; client_id: string; authorized_at?: string | null }[] }>(
      '/api/oauth/apps',
    )
  },
  createOAuthApp(name: string, redirect_uris: string[]) {
    return request<OAuthAppRow>('/api/oauth/apps', { method: 'POST', body: JSON.stringify({ name, redirect_uris, confidential: true }) })
  },
  deleteOAuthApp(id: number) {
    return request<{ ok: boolean }>(`/api/oauth/apps/${id}`, { method: 'DELETE' })
  },
  revokeOAuthAuthorization(id: number) {
    return request<{ ok: boolean }>(`/api/oauth/authorized/${id}`, { method: 'DELETE' })
  },
  oauthAuthorizePreview(client_id: string, redirect_uri: string) {
    return request<{ name: string; redirect_host: string; scopes: string[] }>(
      `/api/oauth/authorize/preview?client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}`,
    )
  },
  oauthAuthorize(body: {
    client_id: string
    redirect_uri: string
    scope?: string | null
    state?: string | null
    code_challenge: string
    code_challenge_method: string
    approve: boolean
  }) {
    return request<{ redirect_url: string }>('/api/oauth/authorize', { method: 'POST', body: JSON.stringify(body) })
  },
  mcpRequests(page = 1) {
    return request<{ items: McpRequestRow[]; meta: { page: number; page_size: number; total: number } }>(
      `/api/mcp/requests?page=${page}&page_size=20`,
    )
  },
  subtitleTranslate(body: { content: string; target_lang: string; source_lang?: string }) {
    return request<{ content: string; cues: number; task_id: number }>('/api/tools/subtitle-translate', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  scriptFormat(body: { content: string; format: string; lang: string }) {
    return request<{ content: string; task_id: number }>('/api/tools/script-format', { method: 'POST', body: JSON.stringify(body) })
  },
  videoScript(body: { url?: string; material?: string; lang: string; duration: number; style: string }) {
    return request<{ title: string; script: string; source_title: string; task_id: number }>('/api/tools/video-script', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  marketingPresets() {
    return request<{ presets: { id: string; ratio: string; duration: number; prompt: string }[] }>('/api/marketing/presets')
  },
  avatarLibrary() {
    return request<{ items: LibraryItem[]; characters: LibraryItem[] }>('/api/avatars/library')
  },
  timelineLibrary() {
    return request<{
      bgm: LibraryItem[]
      sfx: LibraryItem[]
      clips: { id: string; url: string; cover?: string | null; duration_sec?: number | null; project: string }[]
      moods: string[]
    }>('/api/drama/timeline/library')
  },
  async uploadLibraryItem(kind: LibraryKind, file: File, name: string, tags = '') {
    const token = localStorage.getItem('token')
    const form = new FormData()
    form.append('kind', kind)
    form.append('name', name)
    form.append('tags', tags)
    form.append('file', file)
    const res = await fetch(`${API_BASE}/api/library/items`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throwApiError(res.status, err.detail, res.statusText)
    }
    return (await res.json()) as LibraryItem
  },
  deleteLibraryItem(id: number | string) {
    return request<{ ok: boolean }>(`/api/library/items/${id}`, { method: 'DELETE' })
  },
  upscaleOptions() {
    return request<{ engine: string; ai: boolean; image: { scales: number[] }; video: { targets: string[]; max_seconds: number } }>(
      '/api/drama/upscale/options',
    )
  },
  async upscale(body: { kind: 'image' | 'video'; scale?: number; target?: string; url?: string; file?: File | null }) {
    const token = localStorage.getItem('token')
    const form = new FormData()
    form.append('kind', body.kind)
    form.append('scale', String(body.scale ?? 2))
    form.append('target', body.target ?? '1080p')
    form.append('url', body.url ?? '')
    if (body.file) form.append('file', body.file)
    const res = await fetch(`${API_BASE}/api/drama/upscale`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throwApiError(res.status, err.detail, res.statusText)
    }
    return (await res.json()) as { url: string; width: number; height: number; engine: string }
  },
  partnerMe() {
    return request<PartnerInfo>('/api/partner-program/me')
  },
  partnerApply(body: { channel: string; website: string; audience: string; note: string }) {
    return request<PartnerInfo>('/api/partner-program/apply', { method: 'POST', body: JSON.stringify(body) })
  },
  partnerDashboard() {
    return request<PartnerDashboard>('/api/partner-program/dashboard')
  },
  partnerRedeem() {
    return request<{ ok: boolean; redeemed_fen: number }>('/api/partner-program/redeem', { method: 'POST' })
  },
  partnerSubmissions() {
    return request<{ items: PartnerSubmission[] }>('/api/partner-program/submissions')
  },
  partnerSubmit(body: { url: string; platform: string; note: string }) {
    return request<PartnerSubmission>('/api/partner-program/submissions', { method: 'POST', body: JSON.stringify(body) })
  },
  updateProfile(body: { nickname: string; email: string; phone: string }) {
    return request<User>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },
  changePassword(body: { current_password: string; new_password: string }) {
    return request<{ ok: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  async uploadAvatar(file: File) {
    const token = localStorage.getItem('token')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/api/auth/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      const detail = err.detail
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ')
            : res.statusText
      throw new Error(message || tr('settings.avatarFailed'))
    }
    return res.json() as Promise<User>
  },
  templates() {
    return request<Template[]>('/api/templates')
  },
  createProject(body: {
    template_id: string
    title: string
    source_type: 'theme' | 'script'
    source_text: string
    resolution_mode?: 'preview' | 'hd'
    pipeline_mode?: PipelineMode
    output_ratio?: string
    voice_id?: string
    style_prompt?: string
    character_prompt?: string
    extra_prompt?: string
    content_locale?: ContentLocale
  }) {
    return request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) })
  },
  updateProject(
    id: number,
    body: {
      title?: string
      source_type?: 'theme' | 'script'
      source_text?: string
      template_id?: string
      pipeline_mode?: PipelineMode
      output_ratio?: string
      resolution_mode?: 'preview' | 'hd'
      voice_id?: string
      style_prompt?: string
      character_prompt?: string
      extra_prompt?: string
      image_model?: string
      video_model?: string
      bgm_lock?: string
      subtitle_preset?: string
      cover_url?: string | null
    },
  ) {
    return request<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },
  mediaModels() {
    return request<MediaModelsCatalog>('/api/media-models')
  },
  async uploadCover(id: number, file: File) {
    const token = localStorage.getItem('token')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/api/projects/${id}/cover`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      const detail = err.detail
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ')
            : res.statusText
      throw new Error(message || tr('common.coverUploadFailed'))
    }
    return res.json() as Promise<Project>
  },
  voices() {
    return request<VoicePreset[]>('/api/voices')
  },
  previewVoice(voiceId: string) {
    return request<{ url: string; voice_id: string }>('/api/voices/preview', {
      method: 'POST',
      body: JSON.stringify({ voice_id: voiceId }),
    })
  },
  listProjects(params?: {
    page?: number
    page_size?: number
    status?: 'all' | 'draft' | 'running' | 'done' | 'published' | string
    q?: string
    pipeline_mode?: '' | 'full' | 'image_text' | string
  }) {
    const sp = new URLSearchParams()
    if (params?.page) sp.set('page', String(params.page))
    if (params?.page_size) sp.set('page_size', String(params.page_size))
    if (params?.status && params.status !== 'all') sp.set('status', params.status)
    if (params?.q?.trim()) sp.set('q', params.q.trim())
    if (params?.pipeline_mode) sp.set('pipeline_mode', params.pipeline_mode)
    const qs = sp.toString()
    return request<{
      items: Array<{
        id: number
        title: string
        template_id: string
        status: string
        progress: number
        cover_url: string | null
        final_video_url?: string | null
        error_msg?: string | null
        pipeline_mode?: PipelineMode
        output_ratio?: string
        published?: boolean
        created_at: string
        updated_at?: string
        active_tasks?: Project['active_tasks']
      }>
      meta: { page: number; page_size: number; total: number }
      stats: { total: number; generating: number; done: number; published: number }
    }>(`/api/projects${qs ? `?${qs}` : ''}`)
  },
  async downloadZip(ids: number[]) {
    const res = await fetch(`${API_BASE}/api/projects/download-zip`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      const detail = err.detail
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ')
            : res.statusText
      throw new Error(message || tr('common.zipFailed'))
    }
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition') || ''
    const m = cd.match(/filename="?([^"]+)"?/)
    const filename = m?.[1] || `framecut_videos_${Date.now()}.zip`
    return { blob, filename }
  },
  getProject(id: number) {
    return request<Project>(`/api/projects/${id}`)
  },
  generate(id: number, opts?: { restart?: boolean }) {
    const q = opts?.restart ? '?restart=true' : ''
    return request<Project>(`/api/projects/${id}/generate${q}`, { method: 'POST' })
  },
  cancelProject(id: number) {
    return request<Project>(`/api/projects/${id}/cancel`, { method: 'POST' })
  },
  deleteProject(id: number) {
    return request<{ ok: boolean; id: number }>(`/api/projects/${id}`, { method: 'DELETE' })
  },
  updateShot(projectId: number, shotId: number, body: Partial<Shot>) {
    return request<Shot>(`/api/projects/${projectId}/shots/${shotId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },
  createShot(projectId: number) {
    return request<Shot>(`/api/projects/${projectId}/shots`, { method: 'POST' })
  },
  reorderShots(projectId: number, shotIds: number[]) {
    return request<Project>(`/api/projects/${projectId}/shots/reorder`, {
      method: 'POST',
      body: JSON.stringify({ shot_ids: shotIds }),
    })
  },
  async uploadShotImage(projectId: number, shotId: number, file: File) {
    const token = localStorage.getItem('token')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/shots/${shotId}/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      const detail = err.detail
      throw new Error(typeof detail === 'string' ? detail : tr('common.imageUploadFailed'))
    }
    return res.json() as Promise<Project>
  },
  regenImage(projectId: number, shotId: number) {
    return request<Project>(`/api/projects/${projectId}/shots/${shotId}/regen-image`, {
      method: 'POST',
    })
  },
  regenVideo(projectId: number, shotId: number) {
    return request<Project>(`/api/projects/${projectId}/shots/${shotId}/regen-video`, {
      method: 'POST',
    })
  },
  regenAudio(projectId: number, shotId: number) {
    return request<Project>(`/api/projects/${projectId}/shots/${shotId}/regen-audio`, {
      method: 'POST',
    })
  },
  regenAllAudio(projectId: number) {
    return request<Project>(`/api/projects/${projectId}/regen-audio`, { method: 'POST' })
  },
  compose(projectId: number) {
    return request<Project>(`/api/projects/${projectId}/compose`, { method: 'POST' })
  },
  expandContent(topic: string, mode: 'theme' | 'script' = 'theme', contentLocale?: ContentLocale) {
    return request<{ title: string; content: string }>('/api/content/expand', {
      method: 'POST',
      body: JSON.stringify(contentLocale ? { topic, mode, content_locale: contentLocale } : { topic, mode }),
    })
  },
  publish(projectId: number) {
    return request<Work>(`/api/projects/${projectId}/publish`, { method: 'POST' })
  },
  works() {
    return request<Work[]>('/api/works')
  },
  wallet() {
    return request<Wallet>('/api/billing/wallet')
  },
  billingSkus() {
    return request<{
      skus: BillingSku[]
      pay_types: string[]
      markup: number
      currency?: BillingCurrency
      symbol?: string
      first_topup_bonus_fen?: number
    }>('/api/billing/skus')
  },
  creemCheckout(sku_id: string) {
    return request<{ out_trade_no: string; checkout_url: string; amount_fen: number; credit_fen: number }>(
      '/api/billing/creem/checkout',
      { method: 'POST', body: JSON.stringify({ sku_id }) },
    )
  },
  billingPlans() {
    return request<{ plans: SubscriptionPlan[]; currency: BillingCurrency; symbol: string; enabled: boolean }>(
      '/api/billing/plans',
    )
  },
  mySubscription() {
    return request<MySubscription>('/api/billing/subscription')
  },
  subscriptionCheckout(plan_id: string, interval: PlanInterval) {
    return request<{ checkout_url: string }>('/api/billing/subscriptions/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan_id, interval }),
    })
  },
  subscriptionChange(plan_id: string, interval: PlanInterval) {
    return request<MySubscription>('/api/billing/subscriptions/upgrade', {
      method: 'POST',
      body: JSON.stringify({ plan_id, interval }),
    })
  },
  subscriptionPortal() {
    return request<{ url: string }>('/api/billing/subscriptions/portal', { method: 'POST' })
  },
  subscriptionCancel() {
    return request<MySubscription>('/api/billing/subscriptions/cancel', { method: 'POST' })
  },
  myTeams() {
    return request<{ items: TeamSummary[] }>('/api/teams')
  },
  createTeam(name: string) {
    return request<TeamDetail>('/api/teams', { method: 'POST', body: JSON.stringify({ name }) })
  },
  team(id: number) {
    return request<TeamDetail>(`/api/teams/${id}`)
  },
  inviteTeamMember(id: number, email: string, role: 'admin' | 'member') {
    return request<{ id: number; email: string; link: string }>(`/api/teams/${id}/invites`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
  },
  revokeTeamInvite(id: number, inviteId: number) {
    return request<{ ok: boolean }>(`/api/teams/${id}/invites/${inviteId}`, { method: 'DELETE' })
  },
  setTeamRole(id: number, userId: number, role: 'admin' | 'member') {
    return request<{ ok: boolean }>(`/api/teams/${id}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  },
  removeTeamMember(id: number, userId: number) {
    return request<{ ok: boolean }>(`/api/teams/${id}/members/${userId}`, { method: 'DELETE' })
  },
  allocateTeamCredits(id: number, userId: number, amount_fen: number) {
    return request<{ giver_balance_fen: number; member_balance_fen: number }>(
      `/api/teams/${id}/members/${userId}/allocate`,
      { method: 'POST', body: JSON.stringify({ amount_fen }) },
    )
  },
  reclaimTeamCredits(id: number, userId: number, amount_fen: number) {
    return request<{ reclaimed_fen: number; member_balance_fen: number }>(
      `/api/teams/${id}/members/${userId}/reclaim`,
      { method: 'POST', body: JSON.stringify({ amount_fen }) },
    )
  },
  teamSeatsCheckout(id: number, seats: number, interval: PlanInterval) {
    return request<{ checkout_url: string }>(`/api/teams/${id}/seats/checkout`, {
      method: 'POST',
      body: JSON.stringify({ seats, interval }),
    })
  },
  previewTeamInvite(token: string) {
    return request<{ team_name: string; inviter: string; email: string; role: TeamRole; expires_at: string }>(
      `/api/teams/invites/preview?token=${encodeURIComponent(token)}`,
    )
  },
  acceptTeamInvite(token: string) {
    return request<{ ok: boolean; team_id: number; team_name: string }>('/api/teams/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  },
  billingConfig() {
    return request<BillingConfig>('/api/billing/config')
  },
  createBillingOrder(sku_id: string, pay_type: 'alipay' | 'wxpay') {
    return request<{
      out_trade_no: string
      sku_id: string
      sku_name: string
      submit_url: string
      amount_fen: number
      credit_fen: number
      pay_type: string
      trade_no?: string
      qrcode?: string
      payurl?: string
      img?: string
      qr_payload?: string
      /** qr=原生扫码；redirect=新开易支付收银台 */
      pay_mode?: 'qr' | 'redirect' | string
      expire_seconds?: number
    }>('/api/billing/orders', {
      method: 'POST',
      body: JSON.stringify({ sku_id, pay_type }),
    })
  },
  getBillingOrder(outTradeNo: string) {
    return request<{
      out_trade_no: string
      status: string
      amount_fen: number
      credit_fen: number
    }>(`/api/billing/orders/${encodeURIComponent(outTradeNo)}`)
  },
  /** 关闭待支付订单 */
  closeBillingOrder(outTradeNo: string) {
    return request<{ out_trade_no: string; status: string }>(
      `/api/billing/orders/${encodeURIComponent(outTradeNo)}/close`,
      { method: 'POST' },
    )
  },
  listBillingOrders(limit = 50) {
    return request<{ orders: BillingOrder[] }>(`/api/billing/orders?limit=${limit}`)
  },
  usageSummary() {
    return request<UsageSummary>('/api/billing/usage/summary')
  },
  usageEvents(page = 1, pageSize = 20) {
    return request<UsageChargeList>(
      `/api/billing/usage/events?page=${page}&page_size=${pageSize}`,
    )
  },
  billingAlertsPending() {
    return request<{
      items: Array<{
        id: number
        kind: string
        title: string
        message: string
        milestone_fen: number
        milestone_yuan: number
        created_at?: string | null
      }>
    }>('/api/billing/alerts/pending')
  },
  billingAlertAck(alertId: number) {
    return request<{ ok: boolean }>(`/api/billing/alerts/${alertId}/ack`, { method: 'POST' })
  },
  billingPreflight(params: { domain: string; task_type: string; count?: number }) {
    const q = new URLSearchParams({
      domain: params.domain,
      task_type: params.task_type,
      count: String(params.count ?? 1),
    })
    return request<BillingPreflight>(`/api/billing/preflight?${q.toString()}`)
  },
  eventsUrl(projectId: number) {
    return `${API_BASE}/api/projects/${projectId}/events`
  },
}
