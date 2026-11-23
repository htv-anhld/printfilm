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
