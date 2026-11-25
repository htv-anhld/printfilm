# -*- coding: utf-8 -*-
"""计费币种：钱包「分」列的含义随 BILLING_CURRENCY 变化。

数据库列名保持 ``*_fen``（无迁移工具，不改名），语义是「计费币种的最小单位」：

- ``CNY``：1 = 1 分人民币（开源版行为）
- ``USD``：1 = 1 美分 = 1 credit（商业版，对齐 Dravelio）

上游成本有两种原始币种：
- 美元：New API quota（500000 quota = 1 USD）、TokenFree 官方价目、OpenAI total_usage
- 人民币：火山 cost 元字段、本地兜底单价 ``billing_*_per_m``（元/百万 token）、Kie 分/credit

本模块负责把两种来源统一换成计费最小单位；之后再由 ``user_charge_fen`` 乘加价倍率。
"""
from __future__ import annotations

from app.config import Settings, get_settings

SUPPORTED_CURRENCIES = ("USD", "CNY")
DEFAULT_USD_CNY = 7.0

_SYMBOLS = {"USD": "$", "CNY": "¥"}


def billing_currency(settings: Settings | None = None) -> str:
    """当前计费币种（非法值回落 USD）。"""
    s = settings or get_settings()
    code = str(getattr(s, "billing_currency", "") or "USD").strip().upper()
    return code if code in SUPPORTED_CURRENCIES else "USD"


def currency_symbol(settings: Settings | None = None) -> str:
    """币种符号：$ / ¥。"""
    return _SYMBOLS[billing_currency(settings)]


def usd_cny(settings: Settings | None = None) -> float:
    """美元兑人民币汇率（只用于两种来源互转）。"""
    s = settings or get_settings()
    try:
        rate = float(getattr(s, "billing_usd_cny", None) or DEFAULT_USD_CNY)
    except (TypeError, ValueError):
        rate = DEFAULT_USD_CNY
    return max(0.01, rate)


def major_per_usd(settings: Settings | None = None) -> float:
    """1 美元 = 多少计费币种主单位（USD→1，CNY→汇率）。"""
    return 1.0 if billing_currency(settings) == "USD" else usd_cny(settings)


def major_per_cny(settings: Settings | None = None) -> float:
    """1 人民币元 = 多少计费币种主单位（CNY→1，USD→1/汇率）。"""
    return 1.0 if billing_currency(settings) == "CNY" else 1.0 / usd_cny(settings)


def minor_per_usd(settings: Settings | None = None) -> float:
    """1 美元 = 多少计费最小单位（USD→100 美分，CNY→汇率×100 分）。"""
    return major_per_usd(settings) * 100.0


def cny_fen_to_minor(cny_fen: float, settings: Settings | None = None) -> float:
    """人民币分 → 计费最小单位（未取整，调用方决定 ceil）。"""
    return float(cny_fen) * major_per_cny(settings)


def minor_to_major(amount: int | float) -> float:
    """最小单位 → 主单位（两位小数）。"""
    return round(float(amount or 0) / 100.0, 2)


def format_money(amount_minor: int | float, settings: Settings | None = None) -> str:
    """面向用户的金额字符串：$1.23 / ¥1.23。"""
    return f"{currency_symbol(settings)}{minor_to_major(amount_minor):,.2f}"


def billing_markup(settings: Settings | None = None) -> float:
    """用户价 / 上游成本倍率（≥1）。"""
    s = settings or get_settings()
    try:
        value = float(getattr(s, "billing_markup", 1.0) or 1.0)
    except (TypeError, ValueError):
        value = 1.0
    return max(1.0, value)


def localize_money_symbol(text: str, settings: Settings | None = None) -> str:
    """把文案里写死的 ¥ 换成当前币种符号（翻译目录的 key 保持不变）。"""
    symbol = currency_symbol(settings)
    if symbol == "¥" or not text:
        return text
    return text.replace("¥", symbol)
