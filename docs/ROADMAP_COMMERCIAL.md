# Lộ trình thương mại hoá PRINTFILM

> Mục tiêu: đưa bản PRINTFILM tự host thành một sản phẩm SaaS bán được tiền, lấy
> **Dravelio** (`https://ai.dravelio.com`) làm mốc tham chiếu.
> Ngày khảo sát: 2026-11-23 · Nhánh làm việc: `feat/i18n-vi-en`

Tài liệu này viết bằng tiếng Việt (khác quy ước tiếng Trung ở `docs/STANDARDS.md`)
vì đây là tài liệu nội bộ của nhánh Việt hoá.

---

## 0. Tóm tắt trong 10 dòng

1. Dravelio **chạy đúng codebase này**, không phải sản phẩm khác. Đã kiểm chứng bằng
   `/api/health`: cùng schema `task_runtime` / `db_pool` / `quality`, chỉ khác trường `app`.
2. Nghĩa là toàn bộ phần khó (pipeline sinh ảnh/video, task runtime, canvas phân cảnh,
   FFmpeg compose, admin) **đã có sẵn**. Việc còn lại là lớp vỏ thương mại.
3. Bốn thứ chặn đường ra thị trường, theo đúng thứ tự: **upstream AI bị khoá cứng** →
   **không có hạ tầng online** → **hệ thống tiền sai thị trường (CNY/Alipay)** →
   **không có thuê bao định kỳ**.
4. Việt hoá đã xong (`check:i18n` 0 lỗi) nhưng **chưa commit** — rủi ro mất 283 file.
5. Tổng khối lượng ước tính: **6–9 tuần** cho một người làm toàn thời gian để đạt mức
   "thu được tiền", thêm 4–6 tuần cho các module mở rộng (teams, affiliate, MCP, 3D).

---

## 1. Hiện trạng đo được

### 1.1 Máy local

| Hạng mục | Giá trị | Nguồn |
|---|---|---|
| Thư mục | `/Users/anhld209/MYWORK/FREELANCER/Reel_Video/printfilm` | |
| Remote | `git@github.com:yi1108/printfilm.git` (MIT) | `git remote -v` |
| Nhánh | `feat/i18n-vi-en`, **0 commit riêng**, **283 file sửa + 31 file mới chưa commit** | `git status` |
| Container | `printfilm-{web,admin-web,api,postgres,redis}` đang chạy | `docker compose ls` |
| Cổng | web 18080 · admin 18081 · api 18000 · pg 15432 · redis 16380 | |
| AI | `ARK_MOCK=true` — **chưa có key thật** | `deploy/.env.docker:17` |
| Tiền | `BILLING_ENABLED=false`, CNY, Alipay/WeChat, `markup=1.0` | `config.py`, `/api/billing/skus` |
| Lưu trữ | `OSS_ENABLED=false` — media nằm trên ổ cứng | `deploy/.env.docker:31` |
| i18n | vi / en / zh, `check:i18n` → **0 error** cả frontend lẫn admin | `npm run check:i18n` |

### 1.2 Dravelio (bản tham chiếu)

```
GET https://ai.dravelio.com/api/health
{"app":"Dravelio","ark_mock":false,
 "models":{"llm":"gpt-6-luna","image":"gpt-image-2.5-sunburst",
           "video":"apistore-Seedance-2.5","audio":"gemini-3.1-flash-tts"}}
```

| Hạng mục | Giá trị |
|---|---|
| Tên miền | `www.dravelio.com` (SEO, `index,follow`) + `ai.dravelio.com` (app, `noindex,nofollow`) — **cùng một build**, cùng `etag` |
| Hạ tầng | nginx 1.27.5 sau Caddy, HTTP/3, `cache-control: no-store` cho `index.html` |
| Tiền tệ | **USD**, `markup: 2.3`, thưởng lần nạp đầu 500 |
| Cổng thanh toán | `pay_types: ["creem"]`, mã Paddle cũng có trong bundle |
| Ngôn ngữ | `zh / en / vi` — chọn locale trước khi render, đổi cả `<title>` và `description` |
| Đăng nhập | email + **Google OAuth** (`/api/auth/providers → {"google":true}`) + xác minh email |

Bảng giá thuê bao (từ `/api/billing/plans`):

| Gói | Credit/tháng | Giá tháng | Giá năm | Luồng song song |
|---|---|---|---|---|
| Starter | 1.900 | $19 | $205 | 3 |
| Pro | 6.200 | $62 | $670 | 6 |
| Ultra A | 16.500 | $140 *(niêm yết $165)* | $1.584 | 8 |
| Ultra B | 34.500 | $293 *(niêm yết $345)* | $3.312 | 8 |
| Ultra C | 54.000 | $459 *(niêm yết $540)* | $5.184 | 8 |

Gói credit mua lẻ (`/api/billing/skus`): 900 / 3.900 / 7.900 *(khuyên dùng)* / 14.900 credit,
`1 credit = 1 cent`, **không hết hạn**.

Giá video tính **theo giây × model × độ phân giải** (ví dụ Seedance 2):

| Độ phân giải | credit/giây | 5s | 10s | 15s |
|---|---|---|---|---|
| 480p | 16,2 | 83 | 165 | 245 |
| 720p | 34,8 | 175 | 350 | 525 |
| 1080p | 86,1 | 435 | 865 | 1.300 |

Ảnh GPT Image 2 ở 2K = 42 credit.

---

## 2. Bảng khoảng cách (endpoint live ⟷ router local)

Đối chiếu endpoint trích từ bundle `ai.dravelio.com/assets/index-*.js` với
`backend/app/api/**` của repo local.

| Nhóm | Dravelio có | Local | Ưu tiên |
|---|---|---|---|
| Thuê bao | `/billing/plans`, `/subscriptions/{checkout,portal,upgrade}` | ✗ | **P0** |
| Cổng quốc tế | `/billing/paddle/checkout/*`, `/billing/portal`, Creem | ✗ (chỉ 易支付) | **P0** |
| Cấu hình tiền | `/billing/config` (currency, bonus) | ✗ | **P0** |
| Google OAuth | `/auth/google/start`, `/auth/google/exchange`, `/auth/providers` | ✗ | **P1** |
| Xác minh email | `/auth/verify-email`, `/verify-email-code`, `/resend-verification` | ✗ | **P1** |
| Thu lỗi client | `/api/error-reports` | ✗ | P1 |
| Nhóm / ghế | `/api/teams`, `/teams/invites/{accept,preview}`, `creditsPerSeat` | ✗ | P2 |
| Đối tác | `/api/partner-program/{apply,dashboard,me,submissions}` | ✗ | P2 |
| Agent ngoài | `/api/oauth/apps`, `/api/mcp/requests` (Claude connector) | ✗ | P2 |
| 3D | `/api/studio3d/scenes`, `/drama/layout3d/options` | ✗ | P3 |
| Nâng cấp ảnh | `/drama/upscale/options` | ✗ | P3 |
| Thư viện | `/drama/timeline/library`, `/api/avatars/library`, `/api/voices` | ✗ | P2 |
| Giọng Việt | `/drama/voices/vietnamese`, ElevenLabs | ✗ | **P1** |
| Công cụ thêm | `cinema-look`, `subtitle-translate`, `script-format`, `video-script` (từ link YouTube), `marketing/presets` | ✗ | P2 |
| Creative | `/api/creative/projects`, `/api/content/expand` | một phần | P3 |

Local **đã có** và dùng lại được nguyên vẹn: `/billing/{wallet,skus,preflight,orders,usage/*,alerts/*}`,
toàn bộ `/drama/*` lõi, `/projects/*`, `/tools/{run,runs}`, `/tasks`, `/api/v1/*` (API mở),
`/admin/*`, `/templates`, `/works`.

---

## 3. Ba quyết định kiến trúc phải chốt trước khi gõ code

### 3.1 Gỡ khoá upstream AI — **việc kỹ thuật số 1**

Bản mở nguồn **cố tình khoá cứng** mọi request về `tokenfree.com`:

- `backend/app/services/tokenfree_gateway.py:43` — `locked_tokenfree_channel()`,
  docstring ghi rõ *"构造不可改 Base URL / 协议的唯一渠道"* (dựng kênh duy nhất, không sửa được Base URL).
- `backend/app/services/tokenfree_gateway.py:79` — `apply_tokenfree_flat_overlay()` ghi đè
  `openai_base_url` và `ark_base_url` thành `TOKENFREE_BASE_URL` **mỗi lần load settings**,
  nên sửa trong admin hay `.env` đều vô hiệu.

Dravelio rõ ràng đã gỡ: model của họ là `apistore-Seedance-2.5`, `dreamina-seedance-2-0-*`,
`gpt-6-luna` — không phải namespace TokenFree.

**Việc cần làm:** cho phép nhiều kênh có `base_url` tự do (bảng `system_model_channels` đã có cột này),
giữ `logical_model_router.py` nguyên vẹn, chỉ bỏ lớp ghi đè. Phải giữ được failover
priority/weight vì nó là thứ cứu bạn khi một nhà cung cấp sập.

**Tiêu chí hoàn thành:** cấu hình 2 kênh khác nhà cung cấp trong admin → `/api/health` báo
đúng model của kênh đang active → tắt kênh 1 thì request tự chuyển kênh 2.

### 3.2 Đơn vị tiền: từ "phân CNY" sang "credit USD"

Hiện tại ví là **分 (cent CNY)**: `backend/app/models.py:35` → `User.balance_fen`, `frozen_fen`.
Toàn bộ `services/billing/` xoay quanh đơn vị này:

- `settlement.py:121` `ensure_balance_for_task` → `:188` `freeze_for_task` → `:227` `settle_task`
  → `:413` `credit_topup` (vòng đời: **đóng băng → ghi usage → quyết toán**)
- `pricing.py:60` `user_charge_fen` (nhân `billing_markup`), `:107` `parse_upstream_cost_fen`

**Khuyến nghị: KHÔNG đổi tên cột.** Dravelio cũng không đổi — `/api/billing/skus` của họ vẫn trả
`amount_fen` / `credit_fen`, chỉ là diễn giải lại thành cent USD. Đổi tên cột trong dự án
không có migration tool là tự chuốc lấy rủi ro.

**Việc cần làm:** thêm `billing_currency: str = "USD"`, đặt `billing_markup = 2.3`
(`config.py:106` hiện là `1.0` và comment ghi "không nhân nữa" — phải khôi phục phép nhân trong
`user_charge_fen`), đổi hiển thị ở `services/billing/display.py` + `frontend/src/components/billing/*`.

**Tiêu chí hoàn thành:** sinh một video 720p/5s → `usage_events` ghi cost thật của upstream →
ví trừ đúng `cost × 2.3` → `/api/billing/wallet` hiển thị USD.

### 3.3 Chấp nhận giới hạn của tầng dữ liệu

**Dự án không có Alembic.** `backend/app/main.py:146` → `_apply_schema_patches()` là một chuỗi
`ALTER TABLE ... ADD COLUMN` viết tay, **chỉ hỗ trợ thêm cột** (xem các ví dụ ở dòng 151–194).
Bảng mới thì dựa vào `create_all()` lúc khởi động.

Hệ quả bắt buộc phải nhớ:
- Thêm cột cho subscription/teams → **phải viết tay vào đúng hàm đó**, và đồng bộ schema test
  trong `backend/tests/conftest.py`.
- Chạy production với **uvicorn 1 worker** để tránh đua tạo bảng (đã ghi trong `CLAUDE.md`).
- Không bao giờ đổi tên / xoá cột. Cần bỏ thì để chết (deprecated), thêm cột mới.

---

## 4. Lộ trình theo giai đoạn

### Giai đoạn 0 — Chốt nền (1–2 ngày) · **làm ngay hôm nay**

| # | Việc | Chỗ làm | Xong khi |
|---|---|---|---|
| 0.1 | Commit nhánh Việt hoá | `git` | `git status` sạch, 283 file đã vào lịch sử |
| 0.2 | Đặt remote riêng của bạn (`origin` → fork, upstream giữ `yi1108`) | `git remote` | push được, vẫn `git fetch upstream` được |
| 0.3 | Lấy key upstream AI, tắt mock | `deploy/.env.docker:17` | `/api/health` → `ark_mock:false` |
| 0.4 | **Đo giá vốn thật**: sinh 1 ảnh 2K + 1 video 720p/5s + 1 video 1080p/10s, đọc `usage_events.cost_fen` | admin → Task center | Có bảng giá vốn/giây cho từng model |
| 0.5 | Chạy `pytest` để có mốc xanh trước khi sửa | `backend/` (cần Postgres) | Biết test nào đang đỏ sẵn |

> 0.4 là việc quan trọng nhất giai đoạn này. **Mọi con số giá bán sau này đều dẫn xuất từ nó.**
> Không có nó thì bảng giá chỉ là phỏng đoán, và một sản phẩm AI định giá sai sẽ lỗ trên từng
> đơn hàng mà vẫn tưởng đang tăng trưởng.

### Giai đoạn 1 — Lên mạng (3–5 ngày)

| # | Việc | Chi tiết |
|---|---|---|
| 1.1 | VPS | Tối thiểu 4 vCPU / 8 GB / 100 GB SSD. **FFmpeg bắt buộc** (`config.py` → `ffmpeg_path`, `ffprobe_path`). Khâu compose ăn CPU, không ăn GPU. |
| 1.2 | Hai tên miền một app | `www.<domain>` → SEO (`index,follow`); `app.<domain>` → ứng dụng (`noindex,nofollow`). Dravelio làm đúng vậy, cùng một build. Mẫu nginx: `deploy/nginx.local.conf` |
| 1.3 | TLS + reverse proxy | Caddy tự lo chứng chỉ, nginx phục vụ tĩnh. Nhớ `cache-control: no-store` cho `index.html` (tránh lỗi bundle cũ — chính là lý do có đoạn `staleReload` trong `index.html`) |
| 1.4 | Bật OSS/S3 | `OSS_ENABLED=true`, `oss_*` trong `config.py:168+`. **Bắt buộc** — vài chục video là đầy đĩa. Lưu ý: FFmpeg vẫn đọc file local, OSS chỉ là nơi lưu sau cùng (`oss_queue.py` upload bất đồng bộ) |
| 1.5 | SMTP thật | Hiện `smtp_*` (`config.py:141`) chỉ dùng cho **email cảnh báo chi phí gửi admin**. Cần mở rộng cho quên mật khẩu (`services/password_reset.py` đã có) và xác minh email (chưa có) |
| 1.6 | Sao lưu | `pg_dump` hằng ngày + OSS versioning. Không có migration tool nghĩa là **khôi phục từ backup là phương án sửa sai duy nhất** |
| 1.7 | Đổi thương hiệu | `config.py:17` `app_name`, `frontend/index.html`, `public/brand/*`, favicon, OG image |

**Tiêu chí hoàn thành giai đoạn 1:** người lạ truy cập được domain, đăng ký, sinh một video thật
từ đầu đến cuối, file nằm trên OSS, email đặt lại mật khẩu đến hộp thư.

### Giai đoạn 2 — Thu được tiền (1–2 tuần) · phần viết code nhiều nhất

**2.1 Thay cổng thanh toán.** Điểm cắm hiện tại:

- `backend/app/services/epay.py` — ký MD5, dựng form, `create_mapi_payment()`
- `backend/app/api/billing.py:125` `create_order` → `:401` `epay_notify` (webhook)
- `frontend/src/components/billing/PaymentModal.tsx`
- `admin/src/components/settings/PaymentSettingsPanel.tsx`

Viết `services/creem.py` (hoặc `paddle.py`) cùng hình dạng: tạo phiên thanh toán + xác thực
webhook bằng chữ ký. Giữ nguyên `Order` (`models.py:267`: `out_trade_no`, `amount_fen`,
`credit_fen`, `status`) và gọi lại `settlement.credit_topup()` (`settlement.py:413`) khi webhook báo paid.

> **Bẫy đã biết:** `epay.py:63` ghi chú URL callback **không được chứa `/api/`** vì WAF của cổng
> cũ chặn. Creem/Paddle không có ràng buộc này, nhưng hãy giữ route `/epay/notify` ngoài `/api/`
> nếu còn muốn dùng cổng Trung Quốc song song.

**2.2 Thêm thuê bao định kỳ.** Đây là phần **hoàn toàn mới**, local không có khái niệm này.

Cần:
- Bảng `subscriptions` (user_id, plan_id, status, period_start/end, credits_granted, provider_sub_id)
  + bảng `plans` hoặc cấu hình tĩnh.
- `GET /api/billing/plans`, `POST /api/billing/subscriptions/checkout`, `/portal`, `/upgrade`.
- Job cấp credit định kỳ mỗi chu kỳ. Tận dụng được task runtime sẵn có
  (`services/tasks/scheduler.py`) thay vì thêm cron ngoài.
- Phân biệt **hạn mức tháng (hết hạn)** và **credit mua lẻ (không hết hạn)** — Dravelio quảng cáo
  đúng điểm này; cần 2 trường riêng trên ví, trừ hạn mức tháng trước.
- `max_concurrent` theo gói → nối vào `TASK_USER_MAX_CONCURRENCY` (đã có sẵn cơ chế slot
  theo user trong `scheduler.py`).

**2.3 Trang pháp lý.** Cổng thanh toán **sẽ không duyệt** nếu thiếu. Dravelio có `/refund` và
`/acceptable-use`; local mới có `/terms`, `/privacy`, `/contact`
(`frontend/src/App.tsx:45-47`, nội dung ở `frontend/src/lib/legalContent.ts`).
Thêm 2 route + 2 mục nội dung, dịch cả 3 ngôn ngữ.

**2.4 Chặn lạm dụng — làm TRƯỚC khi mở cửa.**
- `BILLING_ENABLED=true` (`config.py:106`)
- Giới hạn `TASK_RUNTIME_MAX_CONCURRENCY` và `TASK_USER_MAX_CONCURRENCY`
- `billing_signup_grant_fen` (`config.py:127`, mặc định 500) — tặng bao nhiêu thì mất bấy nhiêu
  cho mỗi tài khoản rác, nên phải có xác minh email trước
- Bật cảnh báo chi phí: `billing_admin_cost_alert_*` (`config.py:134`)

**Tiêu chí hoàn thành giai đoạn 2:** một người lạ mua gói Starter bằng thẻ quốc tế → credit vào ví
→ sinh video → ví trừ đúng → hoá đơn và lịch sử hiện đủ → bạn xem được doanh thu và giá vốn
trong admin → biên lợi nhuận dương.

### Giai đoạn 3 — Để khách tìm thấy (song song giai đoạn 2)

| # | Việc | Ghi chú |
|---|---|---|
| 3.1 | Google OAuth | `/auth/google/start` + `/exchange` + `/providers`. Giảm bỏ cuộc ở bước đăng ký rõ rệt |
| 3.2 | Xác minh email | `/auth/verify-email`, `/verify-email-code`, `/resend-verification` — cũng là hàng rào chống tài khoản rác ăn tiền tặng |
| 3.3 | SEO | `sitemap.xml`, `robots.txt` (chặn `/studio`, `/drama`, `/wallet`, `/settings`, `/history`, `/auth` như Dravelio), OG image 1200×630, JSON-LD `Organization` + `SoftwareApplication` |
| 3.4 | Meta đa ngôn ngữ | Dravelio đổi `<title>`/`description` theo locale **trước khi render** ngay trong `index.html`; thêm `hreflang` cho vi/en/zh |
| 3.5 | Fallback cho bot | Khối `.seo-fallback` hiện sau 3 giây để crawler đọc được nội dung khi JS chưa chạy |
| 3.6 | Analytics + thu lỗi | Pixel/GA + `/api/error-reports` |

### Giai đoạn 4 — Mở rộng (sau khi có doanh thu đều)

Thứ tự theo tỷ lệ *doanh thu / công sức*:

1. **Giọng Việt + ElevenLabs** (`/drama/voices/vietnamese`) — lợi thế cạnh tranh riêng ở thị trường
   Việt Nam, và bạn đã có sẵn nền i18n nội dung (`services/kepu_locale.py`,
   `services/drama/content_locale.py`). Hiện fallback là `edge-tts`, chất lượng không bán được.
2. **Teams / ghế** — mở cửa khách doanh nghiệp, giá trị đơn hàng cao hơn hẳn.
3. **Partner program** — affiliate, tăng trưởng không tốn tiền quảng cáo.
4. **Công cụ lẻ**: `video-script` (viết kịch bản từ link YouTube), `subtitle-translate`,
   `cinema-look` — mồi câu khách, dùng chung pipeline có sẵn.
5. **MCP / OAuth apps** — cho AI agent bên ngoài gọi vào. Thị trường nhỏ nhưng gần như không có
   đối thủ, và API `/api/v1/*` đã có sẵn Bearer + `X-Api-Key`.
6. **3D studio / upscale** — đắt, để cuối.

---

## 5. Rủi ro và cách chặn

| Rủi ro | Vì sao nguy hiểm | Chặn thế nào |
|---|---|---|
| **Đốt key qua đêm** | 1080p ≈ 86 credit/giây. Một tập 3 phút ≈ 15.000 credit ≈ $150 **giá bán**. Vài tài khoản rác đủ gây thiệt hại thật | Bật billing + giới hạn concurrency + xác minh email **trước** khi public |
| **283 file chưa commit** | Mất là mất vĩnh viễn, không có bản sao nào | Commit ngay (việc 0.1) |
| **Không có migration** | Một `ALTER` sai là hỏng schema production, không rollback được | Luôn additive, luôn `pg_dump` trước khi deploy, uvicorn 1 worker |
| **Khoá upstream** | Nhà cung cấp đổi giá hoặc chặn là đứng sản phẩm | Gỡ khoá (3.1) + cấu hình ≥2 kênh failover |
| **Nội dung vi phạm** | Người dùng sinh deepfake/khiêu dâm → cổng thanh toán khoá tài khoản bán hàng | `/acceptable-use` + kiểm duyệt (bảng `works` đã có cột `audit_status`) |
| **Đĩa đầy giữa chừng** | FFmpeg fail hàng loạt, task treo | OSS + cron dọn `backend/static/generated/` |
| **Phụ thuộc upstream repo** | Upstream là dự án Trung Quốc, có thể đổi hướng | Fork riêng, chỉ `fetch upstream` có chọn lọc |

---

## 6. Phụ lục A — Bản đồ file cần sửa

```
backend/app/
  config.py:17              app_name  ← đổi thương hiệu
  config.py:100-200         toàn bộ khoá billing / smtp / epay / oss
  main.py:146               _apply_schema_patches()  ← THÊM CỘT MỚI Ở ĐÂY
  api/auth.py               thêm google OAuth + verify email
  api/billing.py:54         /skus       ← đổi sang gói USD
  api/billing.py:125        create_order ← cắm cổng mới
  api/billing.py:401        /epay/notify ← thêm webhook Creem/Paddle song song
  models.py:35              User.balance_fen / frozen_fen (GIỮ TÊN)
  models.py:253             WalletLedger
  models.py:267             Order
  services/epay.py          mẫu để viết creem.py / paddle.py
  services/billing/
    pricing.py:60           user_charge_fen  ← khôi phục nhân markup
    pricing.py:107          parse_upstream_cost_fen (đọc quota thật của upstream)
    settlement.py:121/188/227/413  ensure → freeze → settle → credit_topup
    display.py              đơn vị hiển thị
  services/tokenfree_gateway.py:43,79   ← GỠ KHOÁ UPSTREAM
  services/logical_model_router.py      giữ nguyên (failover)
  services/tasks/scheduler.py           nối max_concurrent theo gói

frontend/src/
  App.tsx:45-49             thêm /refund, /acceptable-use
  lib/legalContent.ts       nội dung pháp lý 3 ngôn ngữ
  pages/PricingPage.tsx     bảng giá mới
  components/billing/       PaymentModal, PricingWalletCard, MonthlyUsageCard...
  i18n/locales/{vi,en,zh}/  bổ sung chuỗi mới (chạy npm run check:i18n)
index.html                  meta đa ngôn ngữ, OG, JSON-LD, seo-fallback

admin/src/components/settings/
  PaymentSettingsPanel.tsx  cấu hình cổng mới
  RoutingSettingsPanel.tsx  nhiều kênh upstream
```

## 7. Phụ lục B — Lệnh hay dùng

```bash
# Khởi động stack local (đang chạy sẵn)
docker compose -f docker-compose.full.yml -f docker-compose.local.yml \
  --env-file deploy/.env.docker up -d

# Kiểm tra sức khoẻ
curl -s localhost:18000/api/health | python3 -m json.tool

# Kiểm tra i18n trước mỗi commit  (node ở /usr/local/bin)
cd frontend && npm run check:i18n && npm run lint
cd ../admin  && npm run check:i18n && npm run lint

# Test backend (cần Postgres đang chạy)
cd backend && pytest

# Xem tài khoản
docker exec printfilm-postgres-1 psql -U printfilm -d printfilm \
  -c "select id,email,role from users;"

# Sao lưu trước mỗi lần deploy
docker exec printfilm-postgres-1 pg_dump -U printfilm printfilm > backup_$(date +%F).sql
```

## 8. Phụ lục C — Thứ tự ưu tiên rút gọn

```
TUẦN 1   0.1 commit → 0.3 key thật → 0.4 ĐO GIÁ VỐN → 3.1 gỡ khoá upstream
TUẦN 2   VPS + domain + TLS + OSS + SMTP + đổi thương hiệu
TUẦN 3-4 Cổng thanh toán quốc tế + ví USD + markup 2.3 + trang pháp lý
TUẦN 5-6 Thuê bao định kỳ + hạn mức tháng + max_concurrent theo gói
TUẦN 7   Google OAuth + xác minh email + chặn lạm dụng → MỞ CỬA
TUẦN 8+  SEO, analytics, rồi giọng Việt → teams → affiliate → MCP
```

Mốc "thu được tiền" là **cuối tuần 7**. Mọi thứ ở giai đoạn 4 đều có thể hoãn mà không ảnh
hưởng đến việc bán hàng.
