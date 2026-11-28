# Bộ nhận diện Prismreel

Logo chính thức của Prismreel: chữ **P** được uốn từ **một dải phim 35mm**. Dải tím cuộn từ trên xuống thành bụng chữ P, rồi gấp lại thành dải cam đi xuống làm chân chữ. Ý nghĩa: ánh sáng (lăng kính) biến thành phim (reel).

Bản vector vẽ lại từ mẫu AI số 05 (trang "Prismreel – 16 mẫu AI" trên bảng thiết kế).

## Các file

| File | Dùng khi |
|---|---|
| `prismreel-logo.svg` | Logo chính (ngang), đặt trên nền sáng |
| `prismreel-logo-white.svg` | Logo ngang, chữ trắng, đặt trên nền tối / ảnh |
| `prismreel-logo-black.svg` | In một màu (hoá đơn, con dấu, khắc laser) |
| `prismreel-logo-vertical.svg` | Bố cục dọc: trang đăng nhập, poster, slide mở đầu |
| `prismreel-mark.svg` | Chỉ biểu tượng chữ P (avatar mạng xã hội, watermark video) |
| `prismreel-mark-black.svg` / `-white.svg` | Biểu tượng một màu; lỗ răng cưa được khoét trong suốt |
| `prismreel-app-icon.svg` | Icon ứng dụng (nền đêm, bo góc) |
| `favicon.svg`, `favicon.ico` | Favicon trình duyệt (bản rút gọn, bỏ lỗ răng cưa cho rõ ở 16 px) |
| `png/app-icon-{1024,512,192,180}.png` | App Store / Google Play / PWA / apple-touch-icon |
| `png/logo-2000.png`, `png/logo-white-2000.png` | Khi nơi nhận không đọc được SVG (Word, một số mạng xã hội) |
| `png/mark-1024.png` | Ảnh đại diện mạng xã hội |

Mọi chữ trong SVG đã chuyển thành đường nét: mở ở máy nào cũng hiển thị đúng, không cần cài font.

## Màu

| Tên | Mã | Vai trò |
|---|---|---|
| Violet | `#8B3DFF` | Màu chủ đạo (dải trên, nút chính) |
| Electric purple | `#C026FF` | Đầu dải, điểm nhấn |
| Magenta | `#E23D9B` | Chuyển màu giữa |
| Orange | `#FF8A1A` | Dải dưới, điểm nhấn ấm |
| Ink | `#1A1530` | Chữ logo trên nền sáng, chữ nội dung |
| Night | `#14102A` | Nền icon app, nền giao diện tối |
| Paper | `#F7F5FB` | Nền sáng |

Gradient chuẩn của dải phim: `#C026FF → #8B3DFF` (dải trên), `#8239F8 → #E23D9B → #FF8A1A` (dải dưới).

## Font

- Chữ logo: **Plus Jakarta Sans ExtraBold (800)**, giãn chữ hơi hẹp. Đã chuyển nét sẵn trong SVG.
- Font giao diện gợi ý đi kèm: Plus Jakarta Sans (400/600/700), có dấu tiếng Việt đầy đủ.
- Giấy phép SIL Open Font License: dùng thương mại miễn phí.

## Quy tắc dùng

- **Khoảng trống tối thiểu** quanh logo bằng chiều rộng một nét dải phim (khoảng 1/5 chiều cao biểu tượng).
- **Cỡ nhỏ nhất**: logo ngang cao ≥ 24 px; chỉ biểu tượng ≥ 16 px (dùng `favicon.svg` ở cỡ 16–32 px).
- **Không**: kéo méo tỉ lệ, đổi màu gradient, thêm bóng/viền, xoay, đặt bản chữ tối lên nền tối.
- Trên ảnh hoặc video nhiều màu: dùng `prismreel-logo-white.svg` hoặc `prismreel-mark-white.svg`.

## Dựng lại

Các file được sinh bằng script (biểu tượng vẽ tay bằng SVG + chữ chuyển nét từ font). Muốn chỉnh màu hoặc tỉ lệ thì sửa thông số trong script, không sửa tay từng file.

## Việc còn lại trước khi dùng chính thức

- Tra nhãn hiệu "Prismreel" (USPTO, WIPO Global Brand Database, Cục SHTT Việt Nam) và mua tên miền `prismreel.com` / `.ai`.
- Thay thương hiệu trong app (logo thanh bên, favicon, tiêu đề trang, email) khi đã chốt tên.
