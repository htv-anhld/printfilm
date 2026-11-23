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
