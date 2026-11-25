import { clearAuth, getToken, setCachedUser, setToken, type AdminUser } from "@/lib/auth";
import { tr } from "@/i18n";
import type * as Analytics from "./types/analytics";
import type * as Finance from "./types/finance";
import type * as Projects from "./types/projects";
import type * as Settings from "./types/settings";
import type * as Tasks from "./types/tasks";

type ApiError = {
  detail?: string | { msg?: string }[];
};

// 将 FastAPI 的校验错误或业务错误转换为可读文案
function errorMessage(data: ApiError, status: number): string {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return tr("common.api.requestFailed", { status });
}

// 为管理接口附加会话信息，统一处理响应与登录失效
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as ApiError & T) : ({} as T);
  // 登录 401 = 账号密码错误；其它 401 = 会话失效
  const isLoginRequest = path.includes("/api/auth/login");
  if (res.status === 401 && !isLoginRequest) {
    clearAuth();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error(tr("common.api.unauthorized"));
  }
  if (!res.ok) {
    throw new Error(errorMessage(data as ApiError, res.status));
  }
  return data as T;
}

// 登录后读取用户资料并验证管理员权限
export async function loginAsAdmin(email: string, password: string): Promise<AdminUser> {
  const tokenRes = await api<{ access_token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(tokenRes.access_token);
  const me = await api<AdminUser>("/api/auth/me");
  if (me.role !== "admin") {
    clearAuth();
    throw new Error(tr("common.api.notAdmin"));
  }
  setCachedUser(me);
  return me;
}

// 保持既有导入路径兼容，新增接口类型按领域存放在 types/。
export type * from "./types/common";
export type * from "./types/analytics";
export type * from "./types/finance";
export type * from "./types/projects";
export type * from "./types/tasks";
export type * from "./types/settings";

// Fork extensions: local declarations shadow the star re-exports above. Upstream
// dropped cost/profit, Volc TTS and USD/Creem fields from the shared contracts; the
// fork still displays them, so the public types here are the base shape plus extras.

export type AdminUsageBucket = Analytics.AdminUsageBucket & { cost_fen?: number };
export type AdminDailyUsage = Analytics.AdminDailyUsage & { cost_fen?: number };
export type AdminTopUser = Analytics.AdminTopUser & { cost_fen?: number };

export type AdminStats = Omit<
  Analytics.AdminStats,
  "usage_by_capability" | "usage_by_domain" | "daily_usage" | "top_users_by_charge"
> & {
  usage_cost_today_fen?: number;
  usage_cost_month_fen?: number;
  usage_cost_total_fen?: number;
  usage_by_capability?: AdminUsageBucket[];
  usage_by_domain?: AdminUsageBucket[];
  daily_usage?: AdminDailyUsage[];
  top_users_by_charge?: AdminTopUser[];
};

export type AdminFinanceDailyRow = Analytics.AdminFinanceDailyRow & {
  cost_fen: number;
  actual_cost_fen: number;
  profit_fen: number;
  profit_pct?: number | null;
};

export type AdminFinanceDailyTotals = Analytics.AdminFinanceDailyTotals & {
  cost_fen: number;
  actual_cost_fen: number;
  profit_fen: number;
  profit_pct?: number | null;
};

export type AdminFinanceDaily = Omit<Analytics.AdminFinanceDaily, "totals" | "series"> & {
  totals: AdminFinanceDailyTotals;
  series: AdminFinanceDailyRow[];
  configured: boolean;
  last_sync_at?: string | null;
};

export type AdminProjectUsage = Projects.AdminProjectUsage & { cost_fen: number };
export type AdminProject = Omit<Projects.AdminProject, "usage"> & { usage?: AdminProjectUsage };
export type AdminDramaProject = Omit<Projects.AdminDramaProject, "usage"> & { usage?: AdminProjectUsage };

export type AdminUsageEventBrief = Finance.AdminUsageEventBrief & { cost_fen?: number };
export type AdminUsageEvent = Finance.AdminUsageEvent & { cost_fen?: number };
export type AdminUsageEventListRes = Omit<Finance.AdminUsageEventListRes, "items"> & { items: AdminUsageEvent[] };
export type AdminTaskDetail = Omit<Tasks.AdminTaskDetail, "usage_lines"> & { usage_lines?: AdminUsageEventBrief[] };

export type AdminOrder = Finance.AdminOrder & {
  currency?: "USD" | "CNY";
  provider?: string | null;
  bonus_fen?: number;
};

export type AdminTemplate = Projects.AdminTemplate & {
  /** 展示用：按界面语言翻译的名称 / 简介 / 分类 */
  display_name?: string;
  display_description?: string;
  category_labels?: string[];
};

export type AdminModelSettings = Settings.AdminModelSettings & {
  volc_tts_app_id: string;
  volc_tts_access_key: string;
  volc_tts_api_key: string;
  volc_tts_resource_id: string;
  volc_tts_speaker: string;
  volc_tts_url: string;
  volc_tts_voice_design_url: string;
  volc_tts_voice_design_speaker_ids: string;
  has_volc_tts_access_key: boolean;
  has_volc_tts_api_key: boolean;
  /** 存储提供方：aliyun | s3（Cloudflare R2 / AWS S3 / MinIO 等） */
  oss_provider?: string;
  billing_currency?: "USD" | "CNY";
  creem_test_mode?: boolean;
  creem_credit_product_id?: string;
  creem_sku_products?: string;
  creem_plan_products?: string;
  email_verification_required?: boolean;
  google_client_id?: string;
  google_redirect_uri?: string;
  has_google_client_secret?: boolean;
  elevenlabs_model?: string;
  elevenlabs_voice_map?: string;
  elevenlabs_usd_per_1k_chars?: number;
  has_elevenlabs_api_key?: boolean;
  app_public_url?: string;
  has_creem_api_key?: boolean;
  has_creem_webhook_secret?: boolean;
  billing_usd_cny?: number;
  billing_first_topup_bonus_fen?: number;
  billing_admin_cost_alert_enabled: boolean;
  billing_admin_cost_alert_threshold_fen: number;
  billing_admin_cost_alert_emails: string;
  billing_admin_cost_alert_period: string;
  billing_admin_cost_alert_last_period_key: string;
  billing_admin_cost_alert_last_level: number;
};

export type AdminRoutingSettings = Settings.AdminRoutingSettings & {
  /** true = 开源锁定只允许 TokenFree；false = 多渠道 failover */
  upstream_locked?: boolean;
};

export type AdminUpstreamUsageDay = {
  date: string;
  local_cost_fen: number;
  local_tokens: number;
  official_tokens: number;
  official_cost_fen: number;
  delta_fen: number;
  delta_pct?: number | null;
};

export type AdminUpstreamUsage = {
  configured: boolean;
  days: number;
  last_sync_at?: string | null;
  series: AdminUpstreamUsageDay[];
};

export type AdminUpstreamUsageSync = {
  configured: boolean;
  synced: number;
  skipped: number;
  last_sync_at?: string | null;
};

export type AdminQueueTask = {
  task_id: string;
  task_name: string;
  label: string;
  args_repr: string;
  queue: string;
  state: string;
  started_at?: number | null;
  ref_id?: number | null;
  position?: number | null;
};

export type AdminQueueSummary = {
  name: string;
  label: string;
  pending: number;
  sample: AdminQueueTask[];
};

/** @deprecated 遗留 Celery 队列快照，任务中心已改用 /api/admin/tasks */
export type AdminQueuesSnapshot = {
  ok: boolean;
  redis_ok: boolean;
  unacked: number;
  total_pending: number;
  active_count: number;
  reserved_count: number;
  queues: AdminQueueSummary[];
  pending_tasks: AdminQueueTask[];
  active_tasks: AdminQueueTask[];
  reserved_tasks: AdminQueueTask[];
  runtime: Record<string, number | string>;
  fetched_at: string;
};
