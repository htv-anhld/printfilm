"""商业化功能（多上游渠道、USD 计费、Creem、订阅、团队、合作伙伴、OAuth、邮箱验证等）的用户可见文案。

按功能分段；新增商业化文案统一放这里，方便与开源上游的目录区分。
"""

EN: dict[str, str] = {
    # ── 多上游渠道 ──
    "渠道 ID「{id}」不合法：只能用小写字母、数字、- 和 _": (
        "Channel ID “{id}” is invalid: use lowercase letters, digits, - and _ only"
    ),
    "渠道 ID「{id}」重复": "Channel ID “{id}” is duplicated",
    "渠道「{name}」的 Base URL 必须以 http:// 或 https:// 开头": (
        "The Base URL of channel “{name}” must start with http:// or https://"
    ),
    # ── 计费币种 / 充值包 ──
    "当前计费币种不支持该支付方式": "This payment method is not available for the current billing currency",
    "入门积分包": "Starter credits",
    "标准积分包": "Standard credits",
    "进阶积分包": "Plus credits",
    "专业积分包": "Pro credits",
    # ── Creem ──
    "Creem 未配置 API Key": "Creem API key is not configured",
    "连接 Creem 失败，请稍后重试": "Could not reach Creem. Please try again later",
    "Creem 返回错误（HTTP {code}）": "Creem returned an error (HTTP {code})",
    "Creem 返回内容无法解析": "Could not parse the Creem response",
    "Creem 未返回支付链接": "Creem did not return a checkout link",
    "Creem 未返回客户门户链接": "Creem did not return a customer portal link",
    "Creem 未配置 credit 产品（CREEM_CREDIT_PRODUCT_ID）": "No Creem credit product is configured (CREEM_CREDIT_PRODUCT_ID)",
}

VI: dict[str, str] = {
    # ── 多上游渠道 ──
    "渠道 ID「{id}」不合法：只能用小写字母、数字、- 和 _": (
        "ID kênh “{id}” không hợp lệ: chỉ dùng chữ thường, số, - và _"
    ),
    "渠道 ID「{id}」重复": "ID kênh “{id}” bị trùng",
    "渠道「{name}」的 Base URL 必须以 http:// 或 https:// 开头": (
        "Base URL của kênh “{name}” phải bắt đầu bằng http:// hoặc https://"
    ),
    # ── 计费币种 / 充值包 ──
    "当前计费币种不支持该支付方式": "Phương thức thanh toán này không dùng được với đơn vị tiền hiện tại",
    "入门积分包": "Gói credit Khởi đầu",
    "标准积分包": "Gói credit Tiêu chuẩn",
    "进阶积分包": "Gói credit Nâng cao",
    "专业积分包": "Gói credit Chuyên nghiệp",
    # ── Creem ──
    "Creem 未配置 API Key": "Chưa cấu hình API Key của Creem",
    "连接 Creem 失败，请稍后重试": "Không kết nối được Creem, vui lòng thử lại sau",
    "Creem 返回错误（HTTP {code}）": "Creem trả về lỗi (HTTP {code})",
    "Creem 返回内容无法解析": "Không đọc được phản hồi của Creem",
    "Creem 未返回支付链接": "Creem không trả về liên kết thanh toán",
    "Creem 未返回客户门户链接": "Creem không trả về liên kết cổng khách hàng",
    "Creem 未配置 credit 产品（CREEM_CREDIT_PRODUCT_ID）": "Chưa cấu hình sản phẩm credit trên Creem (CREEM_CREDIT_PRODUCT_ID)",
}
