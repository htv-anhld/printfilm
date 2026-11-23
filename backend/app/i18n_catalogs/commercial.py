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
    # ── 订阅 ──
    "订阅仅在美元计费时可用": "Subscriptions are only available with USD billing",
    "未知订阅套餐": "Unknown subscription plan",
    "该套餐暂未开放购买": "This plan is not available for purchase yet",
    "你已有订阅，请使用升级 / 变更套餐": "You already have a subscription. Use upgrade / change plan instead",
    "当前没有订阅": "You don't have a subscription",
    "已经是该套餐": "You are already on this plan",
    "当前没有可管理的订阅": "There is no subscription to manage",
    # ── 邮箱验证 / Google 登录 ──
    "欢迎注册 PRINTFILM。您的邮箱验证码是：": "Welcome to PRINTFILM. Your email verification code is:",
    "也可以在 30 分钟内打开以下链接完成验证：": "Or open this link within 30 minutes to verify:",
    "PRINTFILM 邮箱验证": "Verify your PRINTFILM email",
    "验证码已过期，请重新发送": "The code has expired. Please request a new one",
    "尝试次数过多，请重新发送验证码": "Too many attempts. Please request a new code",
    "验证码不正确": "Incorrect code",
    "验证链接无效或已过期": "The verification link is invalid or has expired",
    "登录状态无效，请重新登录": "Invalid sign-in state. Please sign in again",
    "登录已超时，请重新登录": "Sign-in timed out. Please sign in again",
    "未配置 Google 登录": "Google sign-in is not configured",
    "Google 登录失败，请重试": "Google sign-in failed. Please try again",
    "连接 Google 失败，请稍后重试": "Could not reach Google. Please try again later",
    "该 Google 账号的邮箱未验证": "This Google account's email is not verified",
    "该邮箱已绑定其它 Google 账号": "This email is already linked to another Google account",
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
    # ── 订阅 ──
    "订阅仅在美元计费时可用": "Thuê bao chỉ dùng được khi tính phí bằng USD",
    "未知订阅套餐": "Gói thuê bao không tồn tại",
    "该套餐暂未开放购买": "Gói này chưa mở bán",
    "你已有订阅，请使用升级 / 变更套餐": "Bạn đã có thuê bao, hãy dùng chức năng nâng cấp / đổi gói",
    "当前没有订阅": "Bạn chưa có thuê bao",
    "已经是该套餐": "Bạn đang dùng gói này rồi",
    "当前没有可管理的订阅": "Không có thuê bao nào để quản lý",
    # ── 邮箱验证 / Google 登录 ──
    "欢迎注册 PRINTFILM。您的邮箱验证码是：": "Chào mừng bạn đến với PRINTFILM. Mã xác minh email của bạn là:",
    "也可以在 30 分钟内打开以下链接完成验证：": "Hoặc mở liên kết sau trong vòng 30 phút để xác minh:",
    "PRINTFILM 邮箱验证": "Xác minh email PRINTFILM",
    "验证码已过期，请重新发送": "Mã đã hết hạn, vui lòng gửi lại",
    "尝试次数过多，请重新发送验证码": "Nhập sai quá nhiều lần, vui lòng gửi lại mã",
    "验证码不正确": "Mã không đúng",
    "验证链接无效或已过期": "Liên kết xác minh không hợp lệ hoặc đã hết hạn",
    "登录状态无效，请重新登录": "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại",
    "登录已超时，请重新登录": "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
    "未配置 Google 登录": "Chưa cấu hình đăng nhập bằng Google",
    "Google 登录失败，请重试": "Đăng nhập Google thất bại, vui lòng thử lại",
    "连接 Google 失败，请稍后重试": "Không kết nối được Google, vui lòng thử lại sau",
    "该 Google 账号的邮箱未验证": "Email của tài khoản Google này chưa được xác minh",
    "该邮箱已绑定其它 Google 账号": "Email này đã liên kết với một tài khoản Google khác",
}
