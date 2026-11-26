# Ghi chú API kie.ai (đọc ngày 26/11/2026)

Nguồn: docs.kie.ai (quickstart, seedance-2, seedance-2-fast, get-task-detail, webhook-verification, seedream 4.5), kie.ai/pricing, kie.ai/seedance-2-0, kie.ai/seedance-2-0-mini, kie.ai/seedream-5-5.

## Chung
- Base URL: `https://api.kie.ai`; header `Authorization: Bearer <KEY>`, `Content-Type: application/json`.
- Lỗi trả **HTTP 200** kèm `code` khác 200 trong body → luôn kiểm tra `code`.
- Mã lỗi: 200 OK · 401 sai key · 402 hết credit · 404 · 408 quá 10 phút chưa có kết quả · 422 sai tham số / taskId không thuộc tài khoản · 429 vượt giới hạn · 455 bảo trì · 500 · 501 tạo thất bại · 505 tính năng bị tắt.
- Giới hạn: 20 request tạo mới / 10 giây / tài khoản (vượt → 429, bị từ chối chứ không xếp hàng); khoảng 100+ tác vụ chạy đồng thời.
- Kết quả lưu 14 ngày rồi bị xoá → phải tải về / chuyển sang lưu trữ của mình.
- Số dư credit: `GET /api/v1/chat/credit`. 1 credit ≈ $0,005. Tác vụ thất bại không bị trừ credit.

## Tạo tác vụ
`POST /api/v1/jobs/createTask`
```json
{"model": "<model id>", "callBackUrl": "<tuỳ chọn>", "input": { ... }}
```
Trả `{"code":200,"msg":"success","data":{"taskId":"..."}}`.

## Truy vấn tác vụ
`GET /api/v1/jobs/recordInfo?taskId=<id>`
- `data.state`: `waiting` | `queuing` | `generating` | `success` | `fail`
- `data.resultJson`: **chuỗi JSON**, ví dụ `{"resultUrls":["https://..."]}` (có `lastFrameUrl` nếu bật `return_last_frame`)
- `data.failCode` (chuỗi số), `data.failMsg`, `data.creditsConsumed`, `data.costTime` (giây), `createTime`/`completeTime` (ms)
- Nên poll bắt đầu 2–3 giây rồi giãn dần; video có thể quá 10 phút.

## Callback (tuỳ chọn)
Gửi cả khi thành công (code 200) lẫn thất bại (code 501), `data` giống recordInfo. Nếu bật HMAC: header `X-Webhook-Timestamp`, `X-Webhook-Signature` = base64(HMAC-SHA256(`taskId + "." + timestamp`, webhookHmacKey)).

## Seedance 2.0
Model id: `bytedance/seedance-2` · `bytedance/seedance-2-fast` · `bytedance/seedance-2-mini`

`input`:
- `prompt` (bắt buộc, 3–20000 ký tự)
- `first_frame_url`, `last_frame_url`: URL ảnh công khai (hoặc `asset://{id}`)
- `reference_image_urls` (≤9), `reference_video_urls` (≤3, tổng ≤15s, 480p/720p), `reference_audio_urls` (≤3)
- **Không được** dùng `first_frame_url`/`last_frame_url` cùng lúc với bất kỳ `reference_*`.
- Ảnh: jpeg/png/webp/bmp/tiff/gif, tỉ lệ w/h trong (0,4; 2,5), cạnh 300–6000px, <30MB.
- `generate_audio` (mặc định true), `resolution`: 2.0 = `480p|720p|1080p|4k`; Fast/Mini = `480p|720p`
- `aspect_ratio`: `1:1|4:3|3:4|16:9|9:16|21:9|adaptive` (bắt buộc)
- `duration`: số nguyên 4–15 (hoặc -1 để model tự chọn), mặc định 5
- `web_search` (chỉ text-to-video), `nsfw_checker`, `return_last_frame` (deprecated)

Giá (credit/giây, không có video tham chiếu): 2.0 — 480p 19 · 720p 41 · 1080p 102 · 4k 208; Fast — 480p 11,7 · 720p 24,8; Mini — 480p 3,8 · 720p 8,2. Có video tham chiếu: rẻ hơn nhưng tính cả giây video đầu vào.

## Seedream (ảnh)
- 4.5: `seedream/4.5-text-to-image` (`prompt`, `aspect_ratio`, `quality`: `basic`=2K | `high`=4K), `seedream/4.5-edit` (+ `image_urls` ≤14). 6,5 credit/ảnh.
- 5.5: `seedream/5-5-text-to-image` (`prompt`, `aspect_ratio`, `size`: `1K|1.5K|2K`, `output_format`), `seedream/5-5-image-to-image` (`image_urls` 1–10). 1K/1.5K 3,6 credit, 2K 6,3 credit.
- Kết quả: `resultJson.resultUrls` (giống video).
- Ảnh đầu vào phải là URL công khai. Có "File Upload API" (Base64/stream/URL) nhưng chưa tìm được tài liệu endpoint.

## Cách cấu hình trong admin

Yêu cầu: `UPSTREAM_LOCK_TOKENFREE=false` (chế độ nhiều kênh) và OSS đang bật — kie chỉ tải được ảnh/video tham chiếu qua URL HTTPS công khai; ảnh `/static/...` khi OSS tắt sẽ báo lỗi rõ ràng thay vì gửi đi.

1. Vào **Cài đặt → Mô hình**, bấm **Thêm kênh Kie.ai**. Kênh mới có ID `kie`, giao thức `kie`, Base URL cố định `https://api.kie.ai` và đã tick sẵn 5 mô hình: `bytedance/seedance-2`, `bytedance/seedance-2-fast`, `bytedance/seedance-2-mini`, `seedream/4.5-text-to-image`, `seedream/5-5-text-to-image` (nút **Lấy mô hình** cũng trả về đúng danh mục tĩnh này — kie không có API `/models`).
2. Dán API Key (lấy ở https://kie.ai/api-key), bấm **Kiểm tra số dư credit** để thử Key, rồi **Lưu**.
3. Khi lưu, hệ thống tự gộp mô hình kie vào mô hình logic có tên thân thiện:
   - `seedance-2.0` → TokenFree `seedance-2.0` **và** kie `bytedance/seedance-2` (failover)
   - `seedance-2.0-fast` → kie `bytedance/seedance-2-fast`
   - `seedance-2.0-mini` → kie `bytedance/seedance-2-mini`
   - `seedream-4.5` → TokenFree `seedream-4.5` (nếu có) + kie `seedream/4.5-text-to-image`
   - `seedream-5.5` → kie `seedream/5-5-text-to-image`
   Có ảnh tham chiếu thì tự chuyển sang `seedream/4.5-edit` / `seedream/5-5-image-to-image`.
4. **Thứ tự kênh = thứ tự ưu tiên.** Muốn `seedance-2.0` chạy kie trước TokenFree thì kéo kênh Kie.ai lên trên rồi lưu. Kênh kie không bao giờ làm "kênh chính" (kênh chính dùng cho LLM / gọi dự phòng kiểu OpenAI).
5. Chọn **Video mặc định** (ví dụ `seedance-2.0-fast`) ở khối "Mô hình sử dụng" rồi lưu.

Hành vi khi chạy:
- Video (phân cảnh drama, video cảnh khoa phổ, công cụ tạo video) và ảnh Seedream đi qua kie; TaskRun/poller giữ nguyên. Mã tác vụ lưu dạng `kie::<taskId>`.
- Thời lượng kẹp 4–15 giây; Fast/Mini chỉ 480p/720p (yêu cầu 1080p tự hạ xuống 720p, có log). Lưu ý: chiến lược `seedance-2.0` của site vẫn chỉ mở 480p/720p, nên 1080p của kie `bytedance/seedance-2` chưa chọn được từ giao diện.
- Khung đầu/cuối và tư liệu tham chiếu loại trừ nhau: nếu có cả hai, giữ tham chiếu (chế độ "tham chiếu toàn năng"), bỏ khung đầu/cuối và ghi log.
- `generate_audio` theo cài đặt âm thanh gốc hiện có. Không hỗ trợ "nháp → bản chính" (draft).
- Tính tiền: tạm giữ theo bảng giá credit trong `backend/app/services/kie_models.py`, quyết toán theo `creditsConsumed` (xem `docs/BILLING.md`). Tác vụ lỗi không tính tiền.
