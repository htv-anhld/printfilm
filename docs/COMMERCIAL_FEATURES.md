# Tính năng thương mại (nhánh `feat/dravelio-parity`)

Tài liệu nội bộ, viết tiếng Việt. Mỗi mục ứng với một commit trên nhánh, ghi cái gì đã đổi,
cấu hình ở đâu, và những điểm dễ sai. Bối cảnh và lộ trình xem `ROADMAP_COMMERCIAL.md`.

---

## 1. Nhiều kênh upstream + failover

**Cấu hình:** `UPSTREAM_LOCK_TOKENFREE=false` (mặc định). Đặt `true` để quay lại hành vi bản mã
nguồn mở (chỉ TokenFree).

**Admin → Cài đặt hệ thống → Mô hình:** thêm/xoá/sắp xếp kênh, mỗi kênh có Base URL, Key, giao
thức và danh sách mô hình riêng. **Thứ tự kênh = thứ tự failover.** Kênh có ID `tokenfree` luôn
cố định Base URL chính thức.

**Hoạt động:**

| Loại | Cách chuyển kênh |
|---|---|
| Văn bản (LLM) | Thử lần lượt từng kênh **ngay trong một request** khi gặp lỗi mạng / 5xx / 429. Lỗi 4xx (prompt sai…) không chuyển kênh |
| Ảnh / video | Request lỗi được ghi vào circuit breaker; sau 2 lỗi liên tiếp, kênh bị hạ xuống cuối danh sách trong 120 giây, request **tiếp theo** (hoặc lần retry của task) sẽ đi kênh khác |
| Kênh bị tắt | Bị bỏ qua hoàn toàn |

Task video tạo ở kênh phụ có ID dạng `{channel_id}::{raw_id}` để poll đúng kênh. Task ở kênh
chính giữ ID nguyên bản, nên dữ liệu cũ không bị ảnh hưởng.

**Kiểm tra:** `GET /api/health` → `upstream.active_channels` (kênh mỗi năng lực đang dùng) và
`upstream.breaker` (kênh nào đang bị hạ).

## 2. Ví USD/credit + hệ số giá bán

**Cấu hình** (env hoặc Admin → Thanh toán):

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `BILLING_CURRENCY` | `USD` | `USD`: 1 đơn vị ví = 1 cent = 1 credit. `CNY`: hành vi cũ (phân CNY) |
| `BILLING_MARKUP` | `2.3` | Giá người dùng = giá vốn upstream × hệ số, làm tròn lên. Tối thiểu 1 |
| `BILLING_USD_CNY` | `7.0` | Chỉ dùng để quy đổi giá vốn tính bằng CNY sang USD |
| `BILLING_FIRST_TOPUP_BONUS_FEN` | `500` | Thưởng cho lần thanh toán đầu tiên của mỗi tài khoản; 0 = tắt |
| `BILLING_SIGNUP_GRANT_FEN` | `500` | Tặng khi đăng ký ($5 với USD). **Tặng bao nhiêu mất bấy nhiêu cho mỗi tài khoản rác** |

**Không đổi tên cột.** `users.balance_fen`, `orders.amount_fen`… vẫn tên cũ, chỉ diễn giải lại
thành "đơn vị nhỏ nhất của `BILLING_CURRENCY`". Toàn bộ quy đổi nằm ở
`backend/app/services/billing/currency.py`:

- Nguồn tính bằng USD (quota New API, bảng giá TokenFree) → nhân `minor_per_usd()`
- Nguồn tính bằng CNY (giá Volcengine, đơn giá dự phòng `BILLING_*_PER_M`, Kie fen/credit) → nhân `major_per_cny()`
- Sau đó `user_charge_fen()` nhân markup

**Gói credit (USD):** 900 / 3.900 / 7.900 *(khuyên dùng)* / 14.900 credit với giá $9 / $39 /
$79 / $149, không hết hạn. Gói CNY cũ vẫn dùng khi `BILLING_CURRENCY=CNY`.

**API mới:** `GET /api/billing/config` → `{currency, symbol, unit, signup_grant_fen,
first_topup_bonus_fen, pay_types}` (không cần đăng nhập).

**Bẫy:**
- Đổi `BILLING_CURRENCY` khi đã có giao dịch sẽ làm số dư cũ bị hiểu sai đơn vị. Chốt trước khi mở bán.
- Đã sửa lỗi markup bị nhân hai lần ở giá ảnh theo lượt (trước đây không lộ vì markup = 1).
- Đã sửa lỗi admin luôn gửi `billing_markup: 1.0` khi lưu trang Thanh toán.
- `orders.currency` ghi lại đơn vị tiền lúc đặt; đơn cũ của 易支付 là `CNY`.

## 3. Cổng thanh toán Creem

Tài liệu API: <https://docs.creem.io>. Creem là Merchant of Record nên tự thu và nộp VAT/GST.

**Cấu hình** (env hoặc Admin → Thanh toán → Creem):

| Khoá | Ghi chú |
|---|---|
| `CREEM_API_KEY` | Key thử và Key thật **không dùng lẫn** được |
| `CREEM_WEBHOOK_SECRET` | Lấy ở Creem → Developers → Webhooks. **Thiếu secret thì mọi webhook bị từ chối** |
| `CREEM_TEST_MODE` | `true` → `test-api.creem.io` |
| `CREEM_CREDIT_PRODUCT_ID` | Một sản phẩm thanh toán một lần trên Creem; giá từng gói gửi qua `custom_price` (cent) |
| `CREEM_SKU_PRODUCTS` | Tuỳ chọn: `credits_900:prod_a,…`, ưu tiên hơn sản phẩm chung |
| `APP_PUBLIC_URL` | Địa chỉ trang người dùng; Creem đưa người mua về `/pricing?paid=1&order=…` |

**URL webhook:** `https://<domain API>/api/billing/creem/webhook`. Đăng ký ít nhất
`checkout.completed` và `refund.created` (thuê bao cần thêm các event `subscription.*`, xem mục 4).

**Luồng mua credit lẻ:**
1. `POST /api/billing/creem/checkout {sku_id}` → tạo `orders` (provider=creem, pending), gọi
   Creem với `request_id = out_trade_no` và `metadata.kind = "topup"` → trả về `checkout_url`
2. Frontend chuyển cả trang sang `checkout_url`
3. Webhook `checkout.completed` → xác minh chữ ký HMAC-SHA256 trên **raw body** → chống lặp
   theo event id (bảng `payment_events`) → **so khớp số tiền và đơn vị tiền** → `mark_order_paid`
4. `refund.created` → thu hồi credit theo tỷ lệ số tiền hoàn (gồm cả thưởng nạp lần đầu).
   Số dư **có thể âm**, thể hiện người dùng đang nợ

**Bẫy:**
- Đơn Creem chờ tối đa 24 giờ mới bị đóng (đơn 易支付 là 5 phút). Webhook đến muộn sau khi đơn đã đóng vẫn được cộng tiền.
- Trên tài liệu Creem có hai endpoint cổng khách hàng khác nhau (`/customers/billing` và
  `/customer-portal`). Code dùng `/customers/billing`; **cần gọi thử ở chế độ test** trước khi lên production.
- Tài liệu chưa mô tả tham số REST để huỷ thuê bao vào cuối kỳ. Code gửi body rỗng, nên huỷ cuối kỳ
  được chuyển sang cổng khách hàng của Creem.

## 4. Thuê bao định kỳ

**Gói** (`backend/app/services/subscriptions/plans.py`, bảng giá Dravelio):

| ID | Credit/tháng | Giá tháng | Giá năm | Luồng song song |
|---|---|---|---|---|
| `starter` | 1.900 | $19 | $205 | 3 |
| `pro` | 6.200 | $62 | $670 | 6 |
| `ultra_a` | 16.500 | $140 (niêm yết $165) | $1.584 | 8 |
| `ultra_b` | 34.500 | $293 (niêm yết $345) | $3.312 | 8 |
| `ultra_c` | 54.000 | $459 (niêm yết $540) | $5.184 | 8 |

**Cấu hình:** tạo trên Creem một *subscription product* cho mỗi gói × chu kỳ, rồi khai báo
`CREEM_PLAN_PRODUCTS=starter_month:prod_a,starter_year:prod_b,…`. Gói chưa map sẽ hiện
"Sắp ra mắt". Webhook cần đăng ký thêm: `subscription.active`, `subscription.paid`,
`subscription.update`, `subscription.scheduled_cancel`, `subscription.canceled`,
`subscription.expired`, `subscription.past_due`, `subscription.unpaid`, `subscription.paused`.

**Credit tháng và credit lẻ — không có ví thứ hai.** `users.sub_credit_fen` đánh dấu phần
nào của `balance_fen` là credit tháng:

- Mọi khoản trừ tiền (`_ledger` với delta âm) **trừ vào credit tháng trước**
- Khi freeze, task ghi lại phần lấy từ credit tháng (`task_runs.billing_sub_fen`); khi hoàn
  phần freeze thừa thì **trả đúng phần đó về credit tháng**, nên credit tháng không bị biến
  thành credit vĩnh viễn
- Sang tháng mới: phần credit tháng còn dư hết hạn (ledger `sub_expire`), rồi cấp credit tháng mới (`sub_grant`)
- Gói năm cũng **cấp theo từng tháng** (`next_grant_at`, job bảo trì 5 phút một lần trong
  scheduler), để tránh cấp 12 tháng một lần rồi khó thu hồi khi hoàn tiền
- Bảng `subscription_grants` (unique `subscription_id + period_key`) đảm bảo mỗi tháng chỉ cấp
  một lần, kể cả khi webhook gửi lặp hoặc job chạy lại

**Vòng đời:**

| Sự kiện | Xử lý |
|---|---|
| `checkout.completed` (metadata.kind=subscription) | Tạo bản ghi thuê bao, cấp credit tháng đầu, `users.plan` = gói |
| `subscription.paid` / `active` | Cập nhật kỳ, cấp credit tháng hiện tại (bỏ qua nếu đã cấp) |
| `subscription.update` (đổi gói) | Nâng gói giữa kỳ thì **cộng phần chênh lệch credit ngay**; hạ gói thì không thu lại |
| `scheduled_cancel` | Giữ quyền lợi tới cuối kỳ |
| `canceled` / `expired` / `unpaid` / `paused` | Credit tháng còn lại hết hạn, `users.plan` = `free`, số luồng song song về mặc định |
| Hết kỳ quá 2 ngày mà không có webhook gia hạn | Job bảo trì tự đánh dấu `expired` |

**Luồng song song theo gói:** scheduler đọc `users.plan` → `max_concurrent` của gói; user free
dùng `TASK_USER_MAX_CONCURRENCY`. Lưu ý vẫn bị chặn bởi giới hạn toàn hệ thống
`TASK_RUNTIME_MAX_CONCURRENCY`: **phải nâng giới hạn này** khi có nhiều người dùng gói Ultra.

**API:** `GET /api/billing/plans`, `GET /api/billing/subscription`,
`POST /api/billing/subscriptions/{checkout,upgrade,portal,cancel}`.

**Bẫy:** Nút "huỷ" trong app là **huỷ ngay** (credit tháng mất luôn). Huỷ vào cuối kỳ thì người
dùng làm trong cổng khách hàng Creem (nút "Quản lý thuê bao"), vì tài liệu REST của Creem chưa
mô tả tham số huỷ cuối kỳ.

## 5. Trang pháp lý: hoàn tiền và chính sách sử dụng

Cổng thanh toán (Creem/Paddle) **không duyệt** nếu site thiếu chính sách hoàn tiền và chính sách
sử dụng. Đã thêm `/refund` và `/acceptable-use` (ba ngôn ngữ, nội dung ở
`frontend/src/lib/legalPolicies.ts`), có liên kết ở footer và cuối mỗi trang pháp lý.

Khi đơn vị tiền là USD, mục 4 (tính phí) của `/terms` được thay bằng điều khoản thương mại (credit,
thuê bao, Creem, dẫn sang chính sách hoàn tiền). Bản gốc ghi "tính theo giá vốn, không cộng thêm, chỉ
支付宝/微信, không có thuê bao", không còn đúng với bản thương mại.

**Cần làm trước khi mở bán:** nhờ luật sư xem lại cả bốn văn bản. Các con số trong chính sách
hoàn tiền (14 ngày cho gói credit; 7 ngày và ≤ 20% mức dùng cho thuê bao đầu tiên) là **đề xuất mặc
định**, không phải con số Dravelio công bố; hãy chỉnh theo chính sách thật của bạn. Hiện việc hoàn
tiền vẫn làm thủ công trên dashboard Creem, còn hệ thống tự thu hồi credit qua webhook `refund.created`.

## 6. Xác minh email và đăng nhập Google

**Xác minh email** (`services/email_verification.py`): sau khi đăng ký hệ thống gửi **mã 6 số
kèm link**, cả hai hiệu lực 30 phút, tối đa 5 lần nhập sai, gửi lại cách nhau 60 giây; Redis chỉ
lưu hash. **Credit tặng khi đăng ký chỉ cấp sau khi xác minh**, đây là hàng rào chống tài khoản rác.

- Chỉ bắt buộc khi `EMAIL_VERIFICATION_REQUIRED=true` **và SMTP đã cấu hình**. Thiếu SMTP thì đăng
  ký được coi là đã xác minh ngay (giống hành vi cũ), vì người dùng không thể nhận mã.
- User cũ được đánh dấu đã xác minh và đã nhận credit tặng (patch schema), để không ai bị cấp lại.
- API: `POST /auth/verify-email-code`, `POST /auth/verify-email` (link, trả về token đăng nhập),
  `POST /auth/resend-verification`, `GET /auth/providers`.
- Frontend: bước nhập mã sau khi đăng ký, `/auth?mode=verify&token=…` tự xác minh, banner nhắc
  xác minh trên mọi trang.

**Đăng nhập Google** (`services/google_oauth.py`): luồng authorization code phía server.

1. Tạo OAuth client loại *Web application* trong Google Cloud Console
2. Authorized redirect URI: `{APP_PUBLIC_URL}/auth/google/callback` (hoặc `GOOGLE_REDIRECT_URI`)
3. Điền `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (env hoặc Admin → Trang web → Đăng nhập)

`state` được ký HMAC bằng `SECRET_KEY`, chứa `next` và hạn 10 phút (không cần lưu phía server);
`next` chỉ nhận đường dẫn nội bộ để chống open redirect. `id_token` được kiểm tra qua Google
tokeninfo (`aud`, `iss`, `exp`, `email_verified`). Nếu email trùng tài khoản mật khẩu có sẵn thì
**liên kết** vào tài khoản đó; email đã gắn với tài khoản Google khác thì từ chối.

**Sửa lỗi có sẵn:** link đặt lại mật khẩu trước đây dùng `PUBLIC_BASE_URL` (địa chỉ API), nên
trong email trỏ về `:8000/auth` và không mở được. Giờ dùng `APP_PUBLIC_URL`.

## 7. SEO và thu thập lỗi client

**SEO** (`frontend/vite.seo.ts`, `frontend/index.html`):

- Khi build, đặt `VITE_SITE_URL=https://www.<domain>` để plugin thay `__SITE_URL__` trong
  canonical, OG, hreflang, JSON-LD, đồng thời sinh `robots.txt` và `sitemap.xml`
- `robots.txt` chặn các trang trong app (`/studio`, `/drama`, `/settings`, `/history`, `/auth`,
  `/api/`). **Không chặn `/assets`**, vì đó là thư mục JS/CSS của Vite, chặn thì Google không render được
- Một bản build phục vụ hai domain giống Dravelio: host bắt đầu bằng `app.` tự gắn `noindex,nofollow`
- Script inline đổi `lang`/title/description/OG theo ngôn ngữ **trước khi render**;
  `?lang=vi|en|zh` dùng cho hreflang và được ghi nhớ làm ngôn ngữ ưu tiên
- JSON-LD `Organization` + `SoftwareApplication` (giá $9–$459); ảnh OG `public/og-image.jpg`
  1200×630 hiện chỉ là ảnh tạm, **cần thay bằng ảnh có chữ khi đổi thương hiệu**
- Khối `.seo-fallback` nằm trong `#root`: bot không chạy JS đọc được; người dùng thật không thấy vì React
  thay nội dung ngay, còn khối này chỉ hiện sau 3 giây

**Thu thập lỗi** (`/api/error-reports`): frontend gửi `window.onerror` và promise bị từ chối
(chỉ ở build production, tối đa 20 lỗi mỗi lần tải trang, không gửi trùng). Backend giới hạn 30 lần/phút
mỗi IP, gom lỗi theo fingerprint (bỏ số dòng/hash bundle) và đếm số lần.
Admin → Hệ thống → **Lỗi phía client** để xem.

## 8. Giọng tiếng Việt và ElevenLabs

Trước đây giọng tiếng Việt chỉ có edge-tts (Hoài My / Nam Minh), chất lượng không đủ để bán.

**Cấu hình** (env hoặc Admin → Trang web → Giọng đọc):

| Khoá | Ghi chú |
|---|---|
| `ELEVENLABS_API_KEY` | |
| `ELEVENLABS_MODEL` | Mặc định `eleven_flash_v2_5`, **có tiếng Việt**. `eleven_multilingual_v2` **không có** tiếng Việt |
| `ELEVENLABS_VOICE_MAP` | `vi-VN-HoaiMyNeural:<voice_id>,vi-VN-NamMinhNeural:<voice_id>`: project đang dùng giọng edge tiếng Việt **tự động chuyển** sang ElevenLabs |
| `ELEVENLABS_USD_PER_1K_CHARS` | Giá vốn để tính tiền; tra theo gói ElevenLabs bạn mua |

**Cách hoạt động:** speaker có dạng `el:<voice_id>`. `ark.tts` thử ElevenLabs trước, kèm
`language_code` tự nhận diện (có chữ có dấu tiếng Việt → `vi`, chữ Latin không dấu → `en`). Lỗi thì
chuyển sang giọng edge **cùng ngôn ngữ và giới tính**, không rơi về giọng tiếng Trung.

**Tính tiền:** sau mỗi lần đọc, chi phí thật theo số ký tự được ghi vào ContextVar; `record_line(tts)`
dùng con số này thay cho ước tính token (vốn chỉ khoảng 1 cent mỗi lần, quá thấp). Nếu TTS chạy trong
`asyncio.gather`/task riêng thì ContextVar không truyền ngược lên, khi đó vẫn tính theo ước tính cũ.

**API:** `GET /api/voices` (gồm giọng trong tài khoản ElevenLabs, cache 10 phút),
`GET /api/drama/voices/vietnamese`.

## 9. Nhóm và ghế

**Mô hình:** không làm ví chung. Freeze/settle vẫn tính trên ví từng người; quản trị nhóm
**phân bổ / thu hồi** credit giữa ví mình và ví thành viên (ledger `team_allocate` / `team_reclaim`).
Thu hồi không vượt quá số đã phân bổ và số dư hiện có của thành viên.

**Ghế = `units` của Creem:** tạo trên Creem một sản phẩm thuê bao **giá theo ghế**, khai báo
`team_month:prod_x,team_year:prod_y` trong `CREEM_PLAN_PRODUCTS`. Mỗi tháng chủ nhóm nhận
`TEAM_CREDITS_PER_SEAT × số ghế` vào credit tháng (hết hạn cuối kỳ như gói cá nhân) để phân bổ.
Nhóm chưa mua ghế được dùng `TEAM_FREE_SEATS` ghế (gồm cả chủ nhóm). Thuê bao nhóm tách biệt
với thuê bao cá nhân, nên một người có thể có cả hai.

**Vai trò:** `owner` (đổi vai trò, mua ghế), `admin` (mời, xoá thành viên, phân bổ),
`member`. Không xoá được owner; admin không xoá được admin khác.

**Lời mời:** gửi link qua email (SMTP), hạn 7 ngày, dùng một lần, token chỉ lưu dạng hash. **Phải
đăng nhập đúng email được mời** mới chấp nhận được, để link bị chuyển tiếp không chiếm mất ghế.
Lời mời đang chờ cũng tính là đã dùng ghế. API trả lại link để admin tự gửi khi chưa có SMTP.

**API:** `GET/POST /api/teams`, `GET/PATCH /api/teams/{id}`, `/invites`, `/members/{uid}`
(PATCH vai trò, DELETE), `/members/{uid}/{allocate,reclaim}`, `/seats/checkout`,
`GET /api/teams/invites/preview`, `POST /api/teams/invites/accept`.

**Giao diện:** tab Nhóm trong Cài đặt, trang `/teams/invite?token=…`, admin có thêm trang **Thuê bao**
và **Nhóm**.

## 10. Chương trình đối tác (affiliate)

**Luồng:** người dùng đăng ký tại `/partners` → admin duyệt (đặt tỷ lệ riêng nếu cần) →
đối tác nhận link `https://<app>/?ref=CODE`.

**Gắn người giới thiệu:** frontend lưu `?ref=` 60 ngày, gửi kèm khi đăng ký (email lẫn Google, chỉ
áp dụng tài khoản mới) → `users.referred_by_partner_id`. Không tự giới thiệu chính mình được.

**Hoa hồng** = `PARTNER_COMMISSION_RATE` × **số tiền thật đã thanh toán** của người được giới thiệu,
trong `PARTNER_COMMISSION_MONTHS` tháng đầu kể từ khi họ đăng ký:

| Nguồn | Thời điểm tính | Mã nguồn (unique) |
|---|---|---|
| Gói credit | `mark_order_paid` (cả 易支付 lẫn Creem) | `out_trade_no` |
| Thuê bao | `checkout.completed` và `subscription.paid` | **transaction id** của Creem: lần thanh toán đầu nhận cả hai event nhưng chỉ tính một lần |

Trạng thái: `held` (giữ `PARTNER_HOLD_DAYS` ngày, nên ≥ cửa sổ hoàn tiền) → `available` →
`redeemed` (đối tác tự đổi sang credit) hoặc `paid` (admin chuyển khoản rồi bấm "Đã chuyển khoản").
**`refund.created` tự đổi sang `reversed`**; nếu đối tác đã đổi khoản đó sang credit thì trừ lại khỏi ví họ.

**Nội dung quảng bá:** đối tác gửi link video/bài viết; admin duyệt kèm số credit thưởng (chỉ cộng một lần).

**API:** `/api/partner-program/{me,apply,dashboard,redeem,submissions}`; admin `/api/admin/partners`,
`/partners/{id}/review`, `/partners/{id}/mark-paid`, `/partner-submissions`, `/partner-submissions/{id}/review`.

## 11. OAuth apps và MCP (kết nối agent AI)

Người dùng kết nối PRINTFILM với **Claude** (Settings → Connectors → Add custom connector →
dán `https://<API>/api/mcp`) hoặc agent khác hỗ trợ MCP. Claude tự đăng ký client, chuyển người dùng sang
trang đồng ý `/oauth/authorize`, rồi gọi các tool.

**Máy chủ OAuth 2.1** (`services/oauth_provider.py`):

- Authorization code + **PKCE S256 bắt buộc**; client bí mật còn phải gửi kèm secret (post hoặc basic)
- **Dynamic client registration** (`POST /api/oauth/register`, RFC 7591) cho MCP client
- Metadata: `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`.
  **Nginx phải chuyển tiếp `/.well-known/oauth-` sang API** (đã thêm vào `frontend/nginx.conf`, `deploy/nginx.local.conf`)
- **Access token chính là một API key** (`pf_live_…`, hạn 1 giờ, gắn `oauth_app_id`), nên dùng lại nguyên
  `/api/v1/*`, cơ chế tính tiền và thu hồi. Token OAuth không hiện trong danh sách API key người dùng tự tạo
- Refresh token 30 ngày, **mỗi lần refresh tạo token mới và huỷ token cũ**. **Mã uỷ quyền bị dùng lại** thì
  thu hồi mọi token đã cấp (RFC 6749 §4.1.2)
- Redirect URI phải đăng ký trước: chỉ chấp nhận https (http chỉ cho localhost), không có fragment

**MCP** (`/api/mcp`, Streamable HTTP, JSON-RPC 2.0, protocol `2025-06-18`/`2025-03-26`/`2024-11-05`):
tool `generate_image`, `generate_video`, `get_video_task`, `get_balance`, gọi lại đúng code của `/api/v1`
(cùng cách tính tiền và kiểm tra quyền sở hữu task). Lỗi nghiệp vụ (hết tiền, tham số sai) trả về
`isError: true` để agent tự xử lý. Không có token thì trả 401 kèm `WWW-Authenticate: Bearer resource_metadata=…`.

**Giao diện:** Cài đặt → API có thêm mục "Ứng dụng & MCP": URL kết nối, ứng dụng đã cấp quyền (thu hồi
được), tạo OAuth app riêng (secret chỉ hiện một lần), lịch sử gọi MCP (`GET /api/mcp/requests`).

**Cũng thêm trong commit này:** `frontend/nginx.conf` đặt `Cache-Control: no-store` cho `index.html`
và cache dài hạn cho `/assets/` (roadmap mục 1.3: tránh trình duyệt giữ bundle cũ sau khi deploy).

## 12. Công cụ lẻ: cinema-look, dịch phụ đề, định dạng kịch bản, kịch bản từ YouTube, preset marketing

| Công cụ | Endpoint | Cách tính tiền |
|---|---|---|
| **Cinema look** (8 tông màu phim) | `POST /api/tools/run` với `tool_id=cinema`, `mode=<preset>`; `GET /api/tools/cinema-look/presets` | Như tool ảnh (theo lượt) |
| **Dịch phụ đề** SRT/VTT | `POST /api/tools/subtitle-translate` | LLM, mỗi 60 dòng một lần gọi |
| **Định dạng kịch bản** (screenplay / shot list / lời dẫn / dàn ý tập) | `POST /api/tools/script-format` | LLM, 1 lần gọi |
| **Kịch bản từ YouTube** | `POST /api/tools/video-script` | LLM, 1 lần gọi |
| **Preset marketing** (8 mẫu) | `GET /api/marketing/presets` | Không tính (chỉ điền sẵn `/studio/new?preset=…`) |

Các công cụ văn bản dùng task type mới `("studio", "tool_text")` (đã đăng ký trong `TASK_HANDLERS` và có
ước tính giá theo số lần gọi LLM).

**Dịch phụ đề:** chỉ dịch dòng thoại, giữ nguyên số thứ tự và mốc thời gian; dòng nào model bỏ sót thì giữ
bản gốc (không làm vỡ file).

**Kịch bản từ YouTube:** chỉ đọc **thông tin công khai** (tiêu đề và kênh qua oEmbed, mô tả trong meta của
trang), **không tải video, không lấy phụ đề**. Prompt bắt model viết kịch bản **mới hoàn toàn**, chỉ lấy chủ
đề làm cảm hứng, để tránh vấn đề bản quyền. Nếu YouTube chặn IP máy chủ thì vẫn dùng được với văn bản tư liệu.

## 13. Thư viện tư liệu (avatar, nhạc nền, hiệu ứng âm thanh, clip)

Bảng `library_items` (kind `avatar` | `bgm` | `sfx`): mục **toàn hệ thống** do admin tải lên
(Admin → Thư viện tư liệu) và mục **riêng** do người dùng tự tải lên (trang `/library`, tối đa 200 mục).

- `GET /api/avatars/library`: avatar chung + avatar riêng + **ảnh nhân vật đã tạo trong phim truyện**
- `GET /api/drama/timeline/library`: nhạc nền / hiệu ứng âm thanh + **clip phân cảnh đã tạo**
- `POST/DELETE /api/library/items`; admin `GET/POST/DELETE /api/admin/library`

**Nhạc nền được dùng thật khi ghép phim:** repo không kèm file nhạc nào (thư mục `static/bgm` trống), nên trước
đây video ghép ra **không có nhạc nền**. Nhạc admin tải lên kèm mood (`tense`, `warm`, `tech`, `epic`,
`upbeat`, `calm`, `default`) được lưu vào `static/bgm/<mood>/`, và `bgm.resolve_bgm_path` ưu tiên lấy từ đó.
**Hãy tải ít nhất một bài `default`** để video luôn có nhạc nền.

Lưu ý bản quyền: chỉ tải lên nhạc bạn có quyền dùng thương mại (nhạc mua license hoặc royalty-free).
Hai thư mục `backend/static/bgm/` và `backend/static/library/` đã thêm vào `.gitignore`.

## 14. Phóng to chất lượng (upscale)

`GET /api/drama/upscale/options`, `POST /api/drama/upscale` (multipart: `kind`, `scale`, `target`,
`url` hoặc `file`); trang `/tools/upscale`.

**Không dùng AI, ghi rõ trên giao diện.** Model ảnh hiện có (Seedream Pro, gpt-image qua TokenFree) giới hạn ở
2K, code cũng ép 3K/4K về 2K, nên không thể upscale bằng AI vượt mức đó. Hệ thống dùng FFmpeg (lanczos +
unsharp) chạy trên CPU máy chủ: ảnh 2×/4× (tối đa 8192 px), video lên 1080p/1440p/2160p (tối đa 60 giây, x264
crf 18). **Miễn phí** vì không tốn chi phí upstream. Nếu sau này có upstream upscale AI, thêm engine mới vào
`services/upscale.py`.

**Chặn SSRF và đọc file tuỳ ý:** chỉ nhận file tải lên, URL `/static/…` của chính hệ thống (đã chặn `../`) hoặc
URL thuộc domain OSS đã cấu hình. **Video 4K tốn nhiều CPU**: nếu máy chủ yếu, nên giảm `VIDEO_TARGETS` hoặc chuyển
sang chạy nền qua task runtime.

## 15. Dàn cảnh 3D (3D layout)

Trang `/studio3d` (three.js, **lazy-load**: `three` nằm trong chunk riêng khoảng 560 KB): đặt người
đứng/ngồi, bàn ghế, tường, cửa, ô tô, cây, đèn; kéo/xoay/phóng to bằng gizmo; chọn ống kính 14–135 mm và tỉ lệ
khung; xem qua góc máy (có viền đen theo tỉ lệ); **chụp PNG 1280 px từ góc máy** để làm ảnh tham chiếu bố
cục cho tool tạo ảnh/video.

API: `GET /api/drama/layout3d/options`, `GET/POST /api/studio3d/scenes`,
`GET/PATCH/DELETE /api/studio3d/scenes/{id}`, `POST /api/studio3d/scenes/{id}/snapshot` (chỉ nhận PNG,
≤ 8 MB). Mỗi cảnh ≤ 60 đối tượng / 200 KB JSON, mỗi người ≤ 100 cảnh.

**Giới hạn hiện tại:** ảnh chụp chưa tự điền vào tool tạo ảnh hay canvas phim truyện; người dùng phải sao chép
link hoặc tải ảnh về rồi tải lên. Mô hình 3D là khối hình học cơ bản (chưa có model nhân vật có khớp để
tạo dáng). **Chưa kiểm thử bằng trình duyệt thật** trong lần làm này: mới qua typecheck, build, và test API.

## 16. Bảng sáng tạo (creative boards)

Tôi **không có tài liệu** về ngữ nghĩa chính xác của `/api/creative/projects` bên Dravelio (roadmap ghi
"một phần"). Đây là cách diễn giải của tôi, phù hợp nhất với sản phẩm: **bảng gom kết quả theo chiến dịch**
gồm ảnh, video, văn bản, link; trang `/creative` cho phép thêm nhanh bằng một cú bấm từ kết quả tool gần đây.
Nếu bạn biết Dravelio làm khác, đây là phần dễ chỉnh nhất.

API: `GET/POST /api/creative/projects`, `GET/PATCH/DELETE /api/creative/projects/{id}`,
`POST /api/creative/projects/{id}/items`, `DELETE …/items/{item_id}`, `PUT …/order`. URL mục chỉ nhận
`http(s)` hoặc `/static/` (chặn `javascript:`); ≤ 100 bảng, ≤ 300 mục mỗi bảng.

`/api/content/expand` (mở rộng chủ đề thành kịch bản) **đã có sẵn** từ trước, không cần làm thêm.

## 17. Dùng key OpenAI / Claude cho LLM văn bản

Thêm kênh ở **Admin → Cài đặt hệ thống → Mô hình**, giao thức `openai`:

| Kênh | Endpoint | Ghi chú |
|---|---|---|
| Claude | `https://api.anthropic.com/v1` | Dùng lớp tương thích OpenAI của Anthropic. Tải danh mục model tự gửi `x-api-key` + `anthropic-version` |
| OpenAI | `https://api.openai.com/v1` | Model văn bản như `gpt-4o-mini`, `gpt-5` |

Sau đó đặt **Text model** mặc định là model của kênh đó.

Code tự xử lý khác biệt tham số giữa các nhà cung cấp (`backend/app/services/llm_client.py`):
- Upstream báo 400 vì `temperature` / `response_format` không hỗ trợ → bỏ tham số đó và gửi lại
- Model đòi `max_completion_tokens` (dòng `gpt-5`) → đổi tên `max_tokens` và gửi lại
- JSON trả về bọc trong khối ```json → tự bóc
- Kênh báo hết số dư (`insufficient_user_quota`...) → coi là lỗi kênh, chuyển sang kênh dự phòng nếu model có binding ở kênh khác

Giới hạn hiện tại: **ảnh và video chưa chạy qua OpenAI** (code đang theo định dạng Seedream/Seedance và TokenFree). Claude không sinh ảnh / video.

**Thử LLM thật khi chưa có key ảnh/video:** trong `deploy/.env.docker` đặt `ARK_MOCK=true` và `ARK_MOCK_TEXT=false`. Ảnh/video vẫn là file giả lập, còn kịch bản (storyboard, mở rộng chủ đề) gọi LLM thật. Mặc định `ARK_MOCK_TEXT=true` (giữ hành vi cũ: mock toàn bộ).
