"""kie.ai 媒体渠道（Seedance 2.0 / Fast / Mini、Seedream 4.5 / 5.5）的用户可见文案。"""

EN: dict[str, str] = {
    "Kie.ai API Key 无效或已失效，请管理员在「模型」渠道里更新 Key": (
        "The Kie.ai API key is invalid or expired. Ask an admin to update it in the Models channel settings"
    ),
    "Kie.ai 账户 credit 不足，请管理员充值后重试": (
        "The Kie.ai account is out of credits. Ask an admin to top up, then try again"
    ),
    "Kie.ai 找不到该任务或接口": "Kie.ai could not find this task or endpoint",
    "Kie.ai 生成超时，请稍后重试": "Kie.ai generation timed out. Please try again later",
    "Kie.ai 拒绝了请求参数，请调整提示词、素材或参数后重试": (
        "Kie.ai rejected the request parameters. Adjust the prompt, media or settings and try again"
    ),
    "Kie.ai 请求过于频繁，请稍后重试": "Too many requests to Kie.ai. Please try again shortly",
    "Kie.ai 正在维护，请稍后重试": "Kie.ai is under maintenance. Please try again later",
    "Kie.ai 服务暂时异常，请稍后重试": "Kie.ai is temporarily unavailable. Please try again later",
    "Kie.ai 生成失败，请调整提示词或素材后重试": (
        "Kie.ai generation failed. Adjust the prompt or media and try again"
    ),
    "Kie.ai 已关闭该功能，请换一个模型": "Kie.ai has disabled this feature. Please choose another model",
    "Kie.ai 请求失败（代码 {code}）": "Kie.ai request failed (code {code})",
    "无法连接 Kie.ai，请检查网络后重试": "Cannot reach Kie.ai. Check the network and try again",
    "Kie.ai 未返回任务号，请稍后重试": "Kie.ai did not return a task ID. Please try again later",
    "Kie.ai 返回的余额格式无法识别": "Could not read the balance returned by Kie.ai",
    "{field}: Kie.ai 需要公网可访问的 HTTPS 素材链接，请启用 OSS 或配置公网访问地址后重试": (
        "{field}: Kie.ai needs publicly reachable HTTPS media links. Enable OSS or configure a public "
        "base URL, then try again"
    ),
    "Kie.ai 不支持样片转正片，请直接重新生成": (
        "Kie.ai cannot turn a draft into a final video. Please generate again"
    ),
    "Kie.ai 任务成功但未返回视频地址，请重试": (
        "The Kie.ai task succeeded but returned no video URL. Please try again"
    ),
    "约 {prices} / 秒": "About {prices} / second",
    "约 {price} / 张起": "From about {price} / image",
    "未配置 Kie.ai API Key（请先在「模型」里添加 Kie.ai 渠道并填写 Key）": (
        "No Kie.ai API key configured (add a Kie.ai channel with a key under Models first)"
    ),
    "Kie.ai 渠道的 Base URL 必须以 https:// 开头": "The Kie.ai channel Base URL must start with https://",
    "2.0 经济档，适合草稿与批量出片；4–15 秒，最高 720p（Kie.ai）": (
        "Budget 2.0 tier for drafts and batch output; 4–15 s, up to 720p (Kie.ai)"
    ),
    "细节扎实的静帧，支持 2K / 4K，可带参考图编辑": (
        "Detailed stills in 2K / 4K; supports editing with reference images"
    ),
    "新一代 Seedream，1K / 2K，可带参考图改图（Kie.ai）": (
        "Next-gen Seedream, 1K / 2K; supports image-to-image with references (Kie.ai)"
    ),
    "约 1–3 分钟/镜": "About 1–3 min per shot",
    "约 15–60 秒/张": "About 15–60 s per image",
    '{model} 当前没有支持 {resolution} 的渠道，请换一个清晰度': '{model} has no channel that supports {resolution}. Please choose another resolution',
    '素材数据损坏，无法上传到 Kie.ai': 'The media data is corrupted and cannot be uploaded to Kie.ai',
    '素材文件超过 100MB，Kie.ai 无法接收': 'The media file is larger than 100MB, which Kie.ai cannot accept',
    '读取素材失败（HTTP {code}），无法上传到 Kie.ai': 'Could not read the media (HTTP {code}), so it cannot be uploaded to Kie.ai',
    '找不到素材文件，无法上传到 Kie.ai': 'The media file was not found, so it cannot be uploaded to Kie.ai',
    '素材文件为空，无法上传到 Kie.ai': 'The media file is empty and cannot be uploaded to Kie.ai',
    '回调内容不是合法 JSON': 'The callback body is not valid JSON',
    '回调缺少任务号': 'The callback is missing a task ID',
    '回调签名无效': 'Invalid callback signature',
}

VI: dict[str, str] = {
    "Kie.ai API Key 无效或已失效，请管理员在「模型」渠道里更新 Key": (
        "API Key Kie.ai không hợp lệ hoặc đã hết hạn. Hãy nhờ quản trị viên cập nhật Key trong kênh ở mục «Mô hình»"
    ),
    "Kie.ai 账户 credit 不足，请管理员充值后重试": (
        "Tài khoản Kie.ai đã hết credit. Hãy nhờ quản trị viên nạp thêm rồi thử lại"
    ),
    "Kie.ai 找不到该任务或接口": "Kie.ai không tìm thấy tác vụ hoặc endpoint này",
    "Kie.ai 生成超时，请稍后重试": "Kie.ai tạo quá thời gian chờ. Vui lòng thử lại sau",
    "Kie.ai 拒绝了请求参数，请调整提示词、素材或参数后重试": (
        "Kie.ai từ chối tham số yêu cầu. Hãy chỉnh prompt, tư liệu hoặc tham số rồi thử lại"
    ),
    "Kie.ai 请求过于频繁，请稍后重试": "Gửi yêu cầu tới Kie.ai quá dày. Vui lòng thử lại sau ít phút",
    "Kie.ai 正在维护，请稍后重试": "Kie.ai đang bảo trì. Vui lòng thử lại sau",
    "Kie.ai 服务暂时异常，请稍后重试": "Dịch vụ Kie.ai tạm thời gặp sự cố. Vui lòng thử lại sau",
    "Kie.ai 生成失败，请调整提示词或素材后重试": (
        "Kie.ai tạo thất bại. Hãy chỉnh prompt hoặc tư liệu rồi thử lại"
    ),
    "Kie.ai 已关闭该功能，请换一个模型": "Kie.ai đã tắt tính năng này. Vui lòng chọn mô hình khác",
    "Kie.ai 请求失败（代码 {code}）": "Yêu cầu tới Kie.ai thất bại (mã {code})",
    "无法连接 Kie.ai，请检查网络后重试": "Không kết nối được Kie.ai. Hãy kiểm tra mạng rồi thử lại",
    "Kie.ai 未返回任务号，请稍后重试": "Kie.ai không trả về mã tác vụ. Vui lòng thử lại sau",
    "Kie.ai 返回的余额格式无法识别": "Không đọc được số dư do Kie.ai trả về",
    "{field}: Kie.ai 需要公网可访问的 HTTPS 素材链接，请启用 OSS 或配置公网访问地址后重试": (
        "{field}: Kie.ai cần liên kết tư liệu HTTPS truy cập công khai được. Hãy bật OSS hoặc cấu hình "
        "địa chỉ công khai rồi thử lại"
    ),
    "Kie.ai 不支持样片转正片，请直接重新生成": (
        "Kie.ai không hỗ trợ chuyển bản nháp thành bản chính thức. Vui lòng tạo lại"
    ),
    "Kie.ai 任务成功但未返回视频地址，请重试": (
        "Tác vụ Kie.ai thành công nhưng không trả về địa chỉ video. Vui lòng thử lại"
    ),
    "约 {prices} / 秒": "Khoảng {prices} / giây",
    "约 {price} / 张起": "Từ khoảng {price} / ảnh",
    "未配置 Kie.ai API Key（请先在「模型」里添加 Kie.ai 渠道并填写 Key）": (
        "Chưa cấu hình API Key Kie.ai (hãy thêm kênh Kie.ai kèm Key ở mục «Mô hình» trước)"
    ),
    "Kie.ai 渠道的 Base URL 必须以 https:// 开头": "Base URL của kênh Kie.ai phải bắt đầu bằng https://",
    "2.0 经济档，适合草稿与批量出片；4–15 秒，最高 720p（Kie.ai）": (
        "Bản 2.0 tiết kiệm, hợp làm nháp và xuất hàng loạt; 4–15 giây, tối đa 720p (Kie.ai)"
    ),
    "细节扎实的静帧，支持 2K / 4K，可带参考图编辑": (
        "Ảnh tĩnh chi tiết, hỗ trợ 2K / 4K, có thể chỉnh sửa theo ảnh tham chiếu"
    ),
    "新一代 Seedream，1K / 2K，可带参考图改图（Kie.ai）": (
        "Seedream thế hệ mới, 1K / 2K, hỗ trợ biến đổi từ ảnh tham chiếu (Kie.ai)"
    ),
    "约 1–3 分钟/镜": "Khoảng 1–3 phút/cảnh",
    "约 15–60 秒/张": "Khoảng 15–60 giây/ảnh",
    '{model} 当前没有支持 {resolution} 的渠道，请换一个清晰度': '{model} hiện không có kênh nào hỗ trợ {resolution}, vui lòng chọn độ phân giải khác',
    '素材数据损坏，无法上传到 Kie.ai': 'Dữ liệu tư liệu bị hỏng, không thể tải lên Kie.ai',
    '素材文件超过 100MB，Kie.ai 无法接收': 'Tệp tư liệu lớn hơn 100MB, Kie.ai không nhận được',
    '读取素材失败（HTTP {code}），无法上传到 Kie.ai': 'Không đọc được tư liệu (HTTP {code}), không thể tải lên Kie.ai',
    '找不到素材文件，无法上传到 Kie.ai': 'Không tìm thấy tệp tư liệu, không thể tải lên Kie.ai',
    '素材文件为空，无法上传到 Kie.ai': 'Tệp tư liệu trống, không thể tải lên Kie.ai',
    '回调内容不是合法 JSON': 'Nội dung callback không phải JSON hợp lệ',
    '回调缺少任务号': 'Callback thiếu mã tác vụ',
    '回调签名无效': 'Chữ ký callback không hợp lệ',
}
