# -*- coding: utf-8 -*-
"""订阅套餐（静态配置，对齐 Dravelio /api/billing/plans）。

金额单位均为美分；credits_per_month 为每个计费月发放的额度（1 credit = 1 美分），月底未用完过期。
Creem 产品 ID 由 CREEM_PLAN_PRODUCTS 配置："starter_month:prod_x,starter_year:prod_y,…"。
"""
from __future__ import annotations

from typing import Any

from app.config import Settings, get_settings

# 仍在发放月额度 / 享受套餐权益的订阅状态
LIVE_STATUSES = ("active", "trialing", "past_due", "scheduled_cancel")

PLANS: list[dict[str, Any]] = [
    {
        "id": "starter",
        "name": "Starter",
        "credits_per_month": 1900,
        "price_month": 1900,
        "price_year": 20500,
        "max_concurrent": 3,
        "rank": 1,
    },
    {
        "id": "pro",
        "name": "Pro",
        "credits_per_month": 6200,
        "price_month": 6200,
        "price_year": 67000,
        "max_concurrent": 6,
        "rank": 2,
        "recommended": True,
    },
    {
        "id": "ultra_a",
        "name": "Ultra A",
        "credits_per_month": 16500,
        "price_month": 14000,
        "list_price_month": 16500,
        "price_year": 158400,
        "max_concurrent": 8,
        "rank": 3,
    },
    {
        "id": "ultra_b",
        "name": "Ultra B",
        "credits_per_month": 34500,
        "price_month": 29300,
        "list_price_month": 34500,
        "price_year": 331200,
        "max_concurrent": 8,
        "rank": 4,
    },
    {
        "id": "ultra_c",
        "name": "Ultra C",
        "credits_per_month": 54000,
        "price_month": 45900,
        "list_price_month": 54000,
        "price_year": 518400,
        "max_concurrent": 8,
        "rank": 5,
    },
]

INTERVALS = ("month", "year")

# 团队席位套餐：按席位计价（Creem units = 席位数），额度 = TEAM_CREDITS_PER_SEAT × 席位，发给 owner 再分配
TEAM_PLAN: dict[str, Any] = {
    "id": "team",
    "name": "Team",
    "kind": "team",
    "credits_per_month": 0,
    "max_concurrent": 8,
    "rank": 10,
}


def plan_by_id(plan_id: str | None) -> dict[str, Any] | None:
    """按 ID 找套餐（含团队席位套餐）。"""
    pid = (plan_id or "").strip().lower()
    if pid == TEAM_PLAN["id"]:
        return TEAM_PLAN
    return next((plan for plan in PLANS if plan["id"] == pid), None)


def plan_credits(plan: dict[str, Any], seats: int = 1, settings: Settings | None = None) -> int:
    """一个计费月的额度：个人套餐取固定值；团队套餐 = 每席位额度 × 席位数。"""
    if plan.get("kind") == "team":
        s = settings or get_settings()
        return max(1, int(seats)) * int(getattr(s, "team_credits_per_seat", 2000) or 0)
    return int(plan["credits_per_month"])


def plan_product_map(settings: Settings | None = None) -> dict[str, str]:
    """解析 CREEM_PLAN_PRODUCTS → {"starter_month": "prod_…"}。"""
    s = settings or get_settings()
    out: dict[str, str] = {}
    for part in (getattr(s, "creem_plan_products", "") or "").split(","):
        if ":" not in part:
            continue
        key, prod = part.split(":", 1)
        if key.strip() and prod.strip():
            out[key.strip().lower()] = prod.strip()
    return out


def product_for(plan_id: str, interval: str, settings: Settings | None = None) -> str:
    """套餐 + 周期对应的 Creem 产品 ID；未配置返回空串。"""
    return plan_product_map(settings).get(f"{plan_id}_{interval}".lower(), "")


def plan_from_product(product_id: str, settings: Settings | None = None) -> tuple[dict[str, Any] | None, str]:
    """Creem 产品 ID → (套餐, 周期)；未知产品返回 (None, "")。"""
    pid = (product_id or "").strip()
    for key, prod in plan_product_map(settings).items():
        if prod == pid and "_" in key:
            plan_id, interval = key.rsplit("_", 1)
            plan = plan_by_id(plan_id)
            if plan and interval in INTERVALS:
                return plan, interval
    return None, ""


def plan_concurrency(plan_id: str | None, default: int) -> int:
    """用户并发上限：订阅套餐的 max_concurrent，免费用户用全站默认。"""
    plan = plan_by_id(plan_id)
    if plan is None:
        return max(1, int(default))
    return max(1, int(plan["max_concurrent"]))


def public_plans(settings: Settings | None = None) -> list[dict[str, Any]]:
    """前端展示用：附带各周期是否已配置 Creem 产品（未配置的不可购买）。"""
    out = []
    for plan in PLANS:
        out.append(
            {
                **plan,
                "purchasable": {
                    interval: bool(product_for(plan["id"], interval, settings)) for interval in INTERVALS
                },
            }
        )
    return out
