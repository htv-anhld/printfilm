"""上游 AI 服务（方舟 / TokenFree / 文字 LLM / 模型目录）的用户可见错误。

注意：部分短语（如「生图文案未通过内容审核」「参考图疑似真人」「分镜文案未通过内容审核」）
被代码按子串匹配错误类型，其译文必须是对应整句译文的子串。
"""

EN: dict[str, str] = {
    # 超时类型标签（{kind}）
    "生图": "Image generation",
    "生视频": "Video generation",
    "{kind}等待上游超时（ReadTimeout）：已连通 TokenFree，但 {sec} 秒内未返回结果，请稍后重试": (
        "{kind} timed out waiting for the upstream (ReadTimeout): connected to TokenFree, "
        "but no result within {sec} seconds. Please try again later"
    ),
    "{kind}发送请求超时（WriteTimeout）：已连通 TokenFree，但 {sec} 秒内未能发完请求，请稍后重试": (
        "{kind} timed out sending the request (WriteTimeout): connected to TokenFree, "
        "but the request couldn't be sent within {sec} seconds. Please try again later"
    ),
    "{kind}无法连接上游（{name}）：请检查网络、代理或 TokenFree 是否可达": (
        "{kind} cannot connect to the upstream ({name}). Check the network, proxy, or whether TokenFree is reachable"
    ),
    "上游 Seedream 账户欠费（AccountOverdueError），生图暂不可用，请联系管理员充值 TokenFree 账户": (
        "The upstream Seedream account is overdue (AccountOverdueError). Image generation is unavailable; "
        "ask an admin to top up the TokenFree account"
    ),
    "生图文案未通过内容审核": "Image prompt failed content moderation",
    "生图文案未通过内容审核（可能含敏感或历史名人相关表述），请修改提示词后重试。": (
        "Image prompt failed content moderation (it may contain sensitive wording or references to "
        "historical figures). Please edit the prompt and try again."
    ),
    " 详情：{detail}": " Details: {detail}",
    "参考图疑似真人": "Reference image may contain a real person",
    "参考图疑似真人：{label}（content[{idx}]，PrivacyInformation），请更换该形象为动漫或插画后重试": (
        "Reference image may contain a real person: {label} (content[{idx}], PrivacyInformation). "
        "Replace it with an anime or illustrated look and try again"
    ),
    "参考图疑似真人（提交内容第 {n} 项 / content[{idx}]，PrivacyInformation），请更换对应角色/场景形象为动漫或插画后重试": (
        "Reference image may contain a real person (item {n} / content[{idx}], PrivacyInformation). "
        "Replace that character/scene with an anime or illustrated look and try again"
    ),
    "参考图疑似真人（PrivacyInformation），请更换角色/场景形象为动漫或插画后重试": (
        "Reference image may contain a real person (PrivacyInformation). "
        "Replace the character/scene with an anime or illustrated look and try again"
    ),
    "分镜文案未通过内容审核": "Storyboard text failed content moderation",
    "分镜文案未通过内容审核，请修改敏感表述后重试": (
        "Storyboard text failed content moderation. Please revise sensitive wording and try again"
    ),
    "TokenFree 账户余额不足：剩余 ${left}，本次视频需预扣 ${need}。请到 TokenFree 充值，或改用更便宜的视频模型 / 更短时长后重试": (
        "TokenFree balance is too low: ${left} left, this video needs a ${need} hold. "
        "Top up TokenFree, or switch to a cheaper video model / shorter duration and try again"
    ),
    "TokenFree 账户余额不足，无法预扣本次视频费用。请到 TokenFree 充值后重试": (
        "TokenFree balance is too low to hold the cost of this video. Top up TokenFree and try again"
    ),
    "参考音频无法下载，请检查角色音色绑定后重试": "The reference audio can't be downloaded. Check the character's voice binding and try again",
    "提交内容第 {n} 项 / content[{idx}]": "item {n} / content[{idx}]",
    "某条参考音频": "a reference audio",
    "参考音频过短：{who}，Seedance 要求时长 ≥ 1.8 秒。请打开对应角色/旁白，重新生成或上传更长的试听音频后再生成该分镜。": (
        "Reference audio is too short: {who}. Seedance requires at least 1.8 seconds. Open the character/narrator, "
        "regenerate or upload a longer sample, then generate this shot again."
    ),
    "出图未返回图片地址，请稍后重试": "Image generation returned no image URL. Please try again later",
    "Seedance 需要公网可访问的图片 URL（请启用 OSS 并确保参考图已上传），本地 /static 图无法被方舟拉取": (
        "Seedance needs a publicly reachable image URL (enable OSS and make sure the reference image is uploaded); "
        "local /static images can't be fetched by Ark"
    ),
    "Seedance 不支持 data URI 图片，请使用 Ark CDN https 链接": "Seedance doesn't support data URI images. Use an Ark CDN https link",
    "配音失败：语音服务暂不可用，请稍后重试": "Voice generation failed: the speech service is temporarily unavailable. Please try again later",
    # TokenFree 出图 / 视频
    "出图上游任务失败，请稍后再点「生成画面」": "The upstream image task failed. Please click “Generate image” again later",
    "出图失败：{detail}": "Image generation failed: {detail}",
    "出图通道繁忙，同时进行的任务过多，请稍后再点「生成画面」": (
        "The image channel is busy with too many concurrent tasks. Please click “Generate image” again later"
    ),
    "出图通道暂时失败，请稍后再点「生成画面」": "The image channel failed temporarily. Please click “Generate image” again later",
    "出图失败 {code}: {detail}": "Image generation failed {code}: {detail}",
    "视频生成失败": "Video generation failed",
    # 文字 LLM
    "未配置 OPENAI_API_KEY，无法调用文字模型。请在管理后台「系统设置 → 模型」填写 TokenFree API Key 并选择文本模型。": (
        "OPENAI_API_KEY is not configured, so the text model can't be called. In Admin → System settings → Models, "
        "enter the TokenFree API key and choose a text model."
    ),
    "未解析到可用文字模型。请在管理后台填写 TokenFree API Key，拉取并选择文本模型。": (
        "No usable text model was found. Enter the TokenFree API key in Admin, then fetch and choose a text model."
    ),
    "LLM 返回空响应体 (HTTP {code})": "The LLM returned an empty response body (HTTP {code})",
    "LLM 渠道 Base URL 配置错误（返回了网页 HTML 而非 API JSON）。当前 base={base}，请检查管理后台「模型渠道」的 Base URL 是否为 OpenAI 兼容 API 地址（如 https://api.deepseek.com 或 https://api.moonshot.cn/v1），而非网站首页。": (
        "The LLM channel Base URL is misconfigured (it returned an HTML page instead of API JSON). Current base={base}. "
        "In Admin → Model channels, make sure the Base URL is an OpenAI-compatible API endpoint "
        "(e.g. https://api.deepseek.com or https://api.moonshot.cn/v1), not a website homepage."
    ),
    "LLM 响应不是合法 JSON: {detail}": "The LLM response is not valid JSON: {detail}",
    # 模型目录 / 额度
    "请先填写 Base URL": "Please enter the Base URL first",
    "请先填写 API Key，或使用已保存密钥的渠道": "Please enter the API key first, or use a channel with a saved key",
    "拉取模型目录失败 HTTP {code}: {detail}": "Failed to fetch the model catalog HTTP {code}: {detail}",
    "上游返回格式异常：缺少 data 列表": "Unexpected upstream response: missing data list",
    "豆包 TTS 暂不支持从上游拉取模型目录，请手动填写 speaker / 音色 ID": (
        "Doubao TTS doesn't support fetching a model catalog. Enter the speaker / voice ID manually"
    ),
    "未配置 TokenFree API Key，请先在「模型」填写": "TokenFree API key is not configured. Enter it under Models first",
    "TokenFree 返回非 JSON": "TokenFree returned non-JSON",
    "TokenFree 额度查询失败": "Failed to query the TokenFree quota",
    "TokenFree pricing 网络失败: {err}": "TokenFree pricing network error: {err}",
    "TokenFree 价目返回非 JSON": "TokenFree pricing returned non-JSON",
    "TokenFree 价目格式异常": "Unexpected TokenFree pricing format",
}

VI: dict[str, str] = {
    "生图": "Tạo ảnh",
    "生视频": "Tạo video",
    "{kind}等待上游超时（ReadTimeout）：已连通 TokenFree，但 {sec} 秒内未返回结果，请稍后重试": (
        "{kind} hết thời gian chờ máy chủ gốc (ReadTimeout): đã kết nối TokenFree nhưng không có kết quả "
        "trong {sec} giây, vui lòng thử lại sau"
    ),
    "{kind}发送请求超时（WriteTimeout）：已连通 TokenFree，但 {sec} 秒内未能发完请求，请稍后重试": (
        "{kind} hết thời gian gửi yêu cầu (WriteTimeout): đã kết nối TokenFree nhưng không gửi xong yêu cầu "
        "trong {sec} giây, vui lòng thử lại sau"
    ),
    "{kind}无法连接上游（{name}）：请检查网络、代理或 TokenFree 是否可达": (
        "{kind} không kết nối được máy chủ gốc ({name}): hãy kiểm tra mạng, proxy hoặc TokenFree có truy cập được không"
    ),
    "上游 Seedream 账户欠费（AccountOverdueError），生图暂不可用，请联系管理员充值 TokenFree 账户": (
        "Tài khoản Seedream phía máy chủ gốc đang nợ phí (AccountOverdueError), tạm thời không thể tạo ảnh; "
        "vui lòng liên hệ quản trị viên nạp tiền tài khoản TokenFree"
    ),
    "生图文案未通过内容审核": "Prompt tạo ảnh không vượt qua kiểm duyệt nội dung",
    "生图文案未通过内容审核（可能含敏感或历史名人相关表述），请修改提示词后重试。": (
        "Prompt tạo ảnh không vượt qua kiểm duyệt nội dung (có thể chứa từ ngữ nhạy cảm hoặc liên quan đến "
        "nhân vật lịch sử), vui lòng sửa prompt rồi thử lại."
    ),
    " 详情：{detail}": " Chi tiết: {detail}",
    "参考图疑似真人": "Ảnh tham chiếu có thể chứa người thật",
    "参考图疑似真人：{label}（content[{idx}]，PrivacyInformation），请更换该形象为动漫或插画后重试": (
        "Ảnh tham chiếu có thể chứa người thật: {label} (content[{idx}], PrivacyInformation), "
        "vui lòng đổi hình tượng này sang anime hoặc minh họa rồi thử lại"
    ),
    "参考图疑似真人（提交内容第 {n} 项 / content[{idx}]，PrivacyInformation），请更换对应角色/场景形象为动漫或插画后重试": (
        "Ảnh tham chiếu có thể chứa người thật (mục thứ {n} / content[{idx}], PrivacyInformation), "
        "vui lòng đổi hình tượng nhân vật/bối cảnh tương ứng sang anime hoặc minh họa rồi thử lại"
    ),
    "参考图疑似真人（PrivacyInformation），请更换角色/场景形象为动漫或插画后重试": (
        "Ảnh tham chiếu có thể chứa người thật (PrivacyInformation), "
        "vui lòng đổi hình tượng nhân vật/bối cảnh sang anime hoặc minh họa rồi thử lại"
    ),
    "分镜文案未通过内容审核": "Nội dung phân cảnh không vượt qua kiểm duyệt",
    "分镜文案未通过内容审核，请修改敏感表述后重试": (
        "Nội dung phân cảnh không vượt qua kiểm duyệt, vui lòng sửa các cụm từ nhạy cảm rồi thử lại"
    ),
    "TokenFree 账户余额不足：剩余 ${left}，本次视频需预扣 ${need}。请到 TokenFree 充值，或改用更便宜的视频模型 / 更短时长后重试": (
        "Số dư TokenFree không đủ: còn ${left}, video này cần tạm giữ ${need}. "
        "Hãy nạp thêm tiền vào TokenFree, hoặc đổi sang model video rẻ hơn / thời lượng ngắn hơn rồi thử lại"
    ),
    "TokenFree 账户余额不足，无法预扣本次视频费用。请到 TokenFree 充值后重试": (
        "Số dư TokenFree không đủ để tạm giữ chi phí video này. Hãy nạp thêm tiền vào TokenFree rồi thử lại"
    ),
    "参考音频无法下载，请检查角色音色绑定后重试": "Không tải được âm thanh tham chiếu, hãy kiểm tra giọng đọc gắn với nhân vật rồi thử lại",
    "提交内容第 {n} 项 / content[{idx}]": "mục thứ {n} / content[{idx}]",
    "某条参考音频": "một âm thanh tham chiếu",
    "参考音频过短：{who}，Seedance 要求时长 ≥ 1.8 秒。请打开对应角色/旁白，重新生成或上传更长的试听音频后再生成该分镜。": (
        "Âm thanh tham chiếu quá ngắn: {who}, Seedance yêu cầu thời lượng ≥ 1,8 giây. Hãy mở nhân vật/lời dẫn tương ứng, "
        "tạo lại hoặc tải lên đoạn nghe thử dài hơn rồi tạo lại phân cảnh này."
    ),
    "出图未返回图片地址，请稍后重试": "Tạo ảnh không trả về địa chỉ ảnh, vui lòng thử lại sau",
    "Seedance 需要公网可访问的图片 URL（请启用 OSS 并确保参考图已上传），本地 /static 图无法被方舟拉取": (
        "Seedance cần URL ảnh truy cập công khai được (hãy bật OSS và đảm bảo ảnh tham chiếu đã được tải lên); "
        "Ark không lấy được ảnh cục bộ /static"
    ),
    "Seedance 不支持 data URI 图片，请使用 Ark CDN https 链接": "Seedance không hỗ trợ ảnh data URI, hãy dùng liên kết https của Ark CDN",
    "配音失败：语音服务暂不可用，请稍后重试": "Lồng tiếng thất bại: dịch vụ giọng nói tạm thời không khả dụng, vui lòng thử lại sau",
    "出图上游任务失败，请稍后再点「生成画面」": "Tác vụ tạo ảnh phía máy chủ gốc thất bại, vui lòng bấm “Tạo ảnh” lại sau",
    "出图失败：{detail}": "Tạo ảnh thất bại: {detail}",
    "出图通道繁忙，同时进行的任务过多，请稍后再点「生成画面」": (
        "Kênh tạo ảnh đang bận do quá nhiều tác vụ cùng lúc, vui lòng bấm “Tạo ảnh” lại sau"
    ),
    "出图通道暂时失败，请稍后再点「生成画面」": "Kênh tạo ảnh tạm thời lỗi, vui lòng bấm “Tạo ảnh” lại sau",
    "出图失败 {code}: {detail}": "Tạo ảnh thất bại {code}: {detail}",
    "视频生成失败": "Tạo video thất bại",
    "未配置 OPENAI_API_KEY，无法调用文字模型。请在管理后台「系统设置 → 模型」填写 TokenFree API Key 并选择文本模型。": (
        "Chưa cấu hình OPENAI_API_KEY nên không gọi được mô hình văn bản. Vào Trang quản trị → Cài đặt hệ thống → "
        "Mô hình, nhập TokenFree API Key và chọn mô hình văn bản."
    ),
    "未解析到可用文字模型。请在管理后台填写 TokenFree API Key，拉取并选择文本模型。": (
        "Không tìm thấy mô hình văn bản khả dụng. Hãy nhập TokenFree API Key trong Trang quản trị, "
        "tải danh sách và chọn mô hình văn bản."
    ),
    "LLM 返回空响应体 (HTTP {code})": "LLM trả về phản hồi trống (HTTP {code})",
    "LLM 渠道 Base URL 配置错误（返回了网页 HTML 而非 API JSON）。当前 base={base}，请检查管理后台「模型渠道」的 Base URL 是否为 OpenAI 兼容 API 地址（如 https://api.deepseek.com 或 https://api.moonshot.cn/v1），而非网站首页。": (
        "Base URL của kênh LLM bị cấu hình sai (trả về trang HTML thay vì JSON của API). base hiện tại={base}. "
        "Hãy kiểm tra trong Trang quản trị → Kênh mô hình rằng Base URL là địa chỉ API tương thích OpenAI "
        "(ví dụ https://api.deepseek.com hoặc https://api.moonshot.cn/v1), không phải trang chủ website."
    ),
    "LLM 响应不是合法 JSON: {detail}": "Phản hồi của LLM không phải JSON hợp lệ: {detail}",
    "请先填写 Base URL": "Vui lòng nhập Base URL trước",
    "请先填写 API Key，或使用已保存密钥的渠道": "Vui lòng nhập API Key trước, hoặc dùng kênh đã lưu khóa",
    "拉取模型目录失败 HTTP {code}: {detail}": "Tải danh mục mô hình thất bại HTTP {code}: {detail}",
    "上游返回格式异常：缺少 data 列表": "Máy chủ gốc trả về sai định dạng: thiếu danh sách data",
    "豆包 TTS 暂不支持从上游拉取模型目录，请手动填写 speaker / 音色 ID": (
        "Doubao TTS chưa hỗ trợ tải danh mục mô hình, vui lòng tự nhập speaker / ID giọng đọc"
    ),
    "未配置 TokenFree API Key，请先在「模型」填写": "Chưa cấu hình TokenFree API Key, vui lòng nhập ở mục “Mô hình” trước",
    "TokenFree 返回非 JSON": "TokenFree trả về dữ liệu không phải JSON",
    "TokenFree 额度查询失败": "Truy vấn hạn mức TokenFree thất bại",
    "TokenFree pricing 网络失败: {err}": "Lỗi mạng khi lấy bảng giá TokenFree: {err}",
    "TokenFree 价目返回非 JSON": "Bảng giá TokenFree trả về dữ liệu không phải JSON",
    "TokenFree 价目格式异常": "Định dạng bảng giá TokenFree bất thường",
}
