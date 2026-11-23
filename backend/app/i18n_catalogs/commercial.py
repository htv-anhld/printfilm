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
}
