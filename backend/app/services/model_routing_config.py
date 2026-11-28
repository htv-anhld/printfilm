"""Synchronize and validate logical models against upstream channels."""

from __future__ import annotations

import re

from app.i18n import _
from app.schemas_routing import (
    DefaultModels,
    LogicalModel,
    LogicalModelBinding,
    LogicalModelCapability,
    SystemModelChannel,
)

CAPABILITY_DEFAULT_KEYS: dict[LogicalModelCapability, str] = {
    "text": "text_model",
    "image": "image_model",
    "video": "video_model",
    "audio": "audio_model",
}


# 规范化模型名用于比较
def normalize_model_name(value: str) -> str:
    return re.sub(r"\s+", "", (value or "").strip()).lower()


# 从模型名推断能力类型（优先 TokenFree 价目 tags / endpoints）
def infer_model_capability(model: str) -> LogicalModelCapability:
    mid = normalize_model_name(model)
    if not mid:
        return "text"
    try:
        from app.services.tokenfree_pricing import lookup_tokenfree_capability

        priced = lookup_tokenfree_capability(model)
        if priced in {"text", "image", "video", "audio"}:
            return priced  # type: ignore[return-value]
    except Exception:  # noqa: BLE001 — 价目未就绪时回退名字规则
        pass
    if (
        "tts" in mid
        or "text-to-speech" in mid
        or "text-to-dialogue" in mid
        or "elevenlabs" in mid
        or mid.startswith("zh_")
        or "speaker" in mid
        or mid.startswith("s_")
    ):
        return "audio"
    if (
        "seedance" in mid
        or "veo" in mid
        or "video" in mid
        or "i2v" in mid
        or "minimax-h" in mid
        or "hailuo" in mid
    ):
        return "video"
    if (
        "seedream" in mid
        or "nano-banana" in mid
        or "banana" in mid
        or "dream" in mid
        or mid.startswith("gpt-image")
        or "grok-imagine" in mid
        or "image" in mid
    ):
        return "image"
    return "text"


# 判断渠道是否具备连接信息
def channel_connection_ready(channel: SystemModelChannel) -> bool:
    if not channel.enabled:
        return False
    return bool(channel.base_url and channel.has_api_key)


# 判断渠道是否包含指定上游模型
def channel_supports_model(channel: SystemModelChannel, upstream_model: str) -> bool:
    from app.services.tokenfree_pricing import canonicalize_channel_model_id

    target = normalize_model_name(upstream_model)
    if not target:
        return False
    target_c = canonicalize_channel_model_id(target)
    return any(
        normalize_model_name(item) == target or canonicalize_channel_model_id(item) == target_c
        for item in channel.models
    )


# 解析渠道下单模型的能力
def resolve_channel_model_capability(channel: SystemModelChannel, upstream_model: str) -> LogicalModelCapability:
    protocol = (channel.protocol or "auto").lower()
    # TokenFree / New API 也标 openai，不能整渠道路径判成 text；走价目+名字推断
    if protocol in {"openai", "auto"}:
        return infer_model_capability(upstream_model)
    advanced = channel.advanced_config
    if advanced:
        if advanced.text_model and normalize_model_name(upstream_model) == normalize_model_name(advanced.text_model):
            return "text"
        if advanced.image_model and normalize_model_name(upstream_model) == normalize_model_name(advanced.image_model):
            return "image"
        if advanced.video_model and normalize_model_name(upstream_model) == normalize_model_name(advanced.video_model):
            return "video"
    return infer_model_capability(upstream_model)


# 根据渠道列表同步逻辑模型
def synchronize_logical_models_with_channels(
    existing_models: list[LogicalModel],
    channels: list[SystemModelChannel],
) -> list[LogicalModel]:
    catalog: dict[str, dict] = {}
    for channel_index, channel in enumerate(channels):
        if not channel.enabled:
            continue
        for upstream_model in channel.models:
            raw = (upstream_model or "").strip()
            if not raw:
                continue
            key = normalize_model_name(raw)
            entry = catalog.get(key)
            if not entry:
                entry = {
                    "upstream_model": raw,
                    "capability": resolve_channel_model_capability(channel, raw),
                    "bindings": [],
                }
                catalog[key] = entry
            if not any(item["channel"].id == channel.id for item in entry["bindings"]):
                entry["bindings"].append(
                    {"channel": channel, "channel_index": channel_index, "upstream_model": raw}
                )

    from app.services.kie_models import kie_logical_id

    used_existing_ids: set[str] = set()
    used_model_ids: set[str] = set()
    result: list[LogicalModel] = []
    # 已产出的逻辑模型（小写 id → 下标）：不同上游名可并进同一逻辑模型（如 TokenFree seedance-2.0 + kie bytedance/seedance-2）
    result_index: dict[str, int] = {}
    # 由 kie 友好 id 产生 / 认领的逻辑模型：同名上游（TokenFree seedance-2.0）可并入
    friendly_ids: set[str] = set()
    for model_key, catalog_model in sorted(catalog.items(), key=lambda item: item[0]):
        matching = [
            model
            for model in existing_models
            if any(
                normalize_model_name(binding.upstream_model) == model_key
                for binding in model.bindings
            )
        ]
        friendly = kie_logical_id(catalog_model["upstream_model"])
        existing = next(
            (
                model
                for model in matching
                if normalize_model_name(model.id) == model_key and model.id.lower() not in used_existing_ids
            ),
            None,
        ) or next((model for model in matching if model.id.lower() not in used_existing_ids), None)
        if existing is None and not matching and friendly:
            # kie 新上游：默认并到友好逻辑 id（seedance-2.0-fast 等），而不是 bytedance/… 原名
            existing = next(
                (model for model in existing_models
                 if model.id.lower() == friendly.lower() and model.id.lower() not in used_existing_ids),
                None,
            )
        bindings = _catalog_bindings(existing_models, catalog_model)
        merge_target = None
        if existing is None:
            merge_ids = [model.id.lower() for model in matching] + ([friendly.lower()] if friendly and not matching else [])
            if not matching and catalog_model["upstream_model"].lower() in friendly_ids:
                merge_ids.append(catalog_model["upstream_model"].lower())
            merge_target = next((result_index[key] for key in merge_ids if key in result_index), None)
        if merge_target is not None:
            merged = result[merge_target]
            known = {(b.channel_id, normalize_model_name(b.upstream_model)) for b in merged.bindings}
            extra = [b for b in bindings if (b.channel_id, normalize_model_name(b.upstream_model)) not in known]
            result[merge_target] = merged.model_copy(
                update={"bindings": sorted([*merged.bindings, *extra], key=lambda b: (b.priority, b.id))}
            )
            continue
        if existing:
            used_existing_ids.add(existing.id.lower())
        base_id = existing.id if existing else (friendly or catalog_model["upstream_model"])
        logical_id = _unique_logical_model_id(base_id, used_model_ids)
        catalog_cap = catalog_model["capability"]
        # 价目已给出图/视频/音频时，纠正历史上误标成 text 的逻辑模型
        if existing and existing.capability == "text" and catalog_cap in {"image", "video", "audio"}:
            synced_cap = catalog_cap
        else:
            synced_cap = existing.capability if existing else catalog_cap
        default_name = friendly or catalog_model["upstream_model"]
        result_index[logical_id.lower()] = len(result)
        if friendly:
            friendly_ids.add(logical_id.lower())
        result.append(
            LogicalModel(
                id=logical_id,
                name=(existing.name if existing and existing.name else default_name),
                capability=synced_cap,
                strategy_id=existing.strategy_id if existing else None,
                enabled=existing.enabled if existing else True,
                bindings=bindings,
            )
        )
    return result


def _catalog_bindings(existing_models: list[LogicalModel], catalog_model: dict) -> list[LogicalModelBinding]:
    """某上游模型在各渠道上的绑定；沿用已存绑定的启停 / 优先级 / 权重。"""
    bindings: list[LogicalModelBinding] = []
    for item in catalog_model["bindings"]:
        channel: SystemModelChannel = item["channel"]
        upstream = item["upstream_model"]
        stored = _find_stored_binding(existing_models, channel.id, upstream)
        bindings.append(
            LogicalModelBinding(
                id=(stored.id if stored else f"{channel.id}:{upstream}"),
                channel_id=channel.id,
                upstream_model=upstream,
                enabled=stored.enabled if stored else True,
                priority=stored.priority if stored else int(item["channel_index"]) + 1,
                weight=stored.weight if stored else None,
            )
        )
    bindings.sort(key=lambda binding: (binding.priority, binding.id))
    return bindings


# 规范化默认模型 ID
def normalize_default_models(
    defaults: DefaultModels | None,
    logical_models: list[LogicalModel],
    channels: list[SystemModelChannel],
) -> DefaultModels:
    raw = defaults or DefaultModels()
    normalized = DefaultModels()
    for capability, attr in CAPABILITY_DEFAULT_KEYS.items():
        model_id = getattr(raw, attr, "") or ""
        if model_id and is_logical_model_resolvable(logical_models, channels, capability, model_id):
            setattr(normalized, attr, model_id)
            continue
        fallback = next(
            (
                model
                for model in logical_models
                if model.enabled
                and model.capability == capability
                and is_logical_model_resolvable(logical_models, channels, capability, model.id)
            ),
            None,
        )
        setattr(normalized, attr, fallback.id if fallback else "")
    return normalized


# 判断逻辑模型是否可解析到可用渠道
def is_logical_model_resolvable(
    logical_models: list[LogicalModel],
    channels: list[SystemModelChannel],
    capability: LogicalModelCapability,
    model_id: str,
) -> bool:
    return resolve_logical_model_config(logical_models, channels, capability, model_id) is not None


# 解析单条逻辑模型配置
def resolve_logical_model_config(
    logical_models: list[LogicalModel],
    channels: list[SystemModelChannel],
    capability: LogicalModelCapability,
    model_id: str,
):
    requested = (model_id or "").strip()
    if not requested:
        return None
    logical = next(
        (
            model
            for model in logical_models
            if model.enabled
            and model.capability == capability
            and model.id.lower() == requested.lower()
        ),
        None,
    )
    if not logical:
        return None
    bindings = sorted(
        [binding for binding in logical.bindings if binding.enabled],
        key=lambda binding: (binding.priority, binding.id),
    )
    for binding in bindings:
        channel = next((item for item in channels if item.id == binding.channel_id), None)
        if not channel or not channel_connection_ready(channel):
            continue
        if not channel_supports_model(channel, binding.upstream_model):
            continue
        return {"logical_model": logical, "binding": binding, "channel": channel}
    return None


# 校验路由配置
def model_routing_validation_errors(
    logical_models: list[LogicalModel],
    channels: list[SystemModelChannel],
    defaults: DefaultModels,
) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    channel_ids = {channel.id for channel in channels}
    for model in logical_models:
        key = (model.id or "").strip().lower()
        if not key:
            errors.append(_("逻辑模型 ID 不能为空"))
        elif key in seen_ids:
            errors.append(_("逻辑模型 ID 重复：{id}", id=model.id))
        seen_ids.add(key)
        if not model.bindings:
            errors.append(_("逻辑模型 {name} 至少需要一个渠道绑定", name=model.name or model.id))
        binding_keys: set[str] = set()
        for binding in model.bindings:
            if model.capability in {"image", "video"}:
                from app.services.media_models import get_strategy
                try:
                    strategy = get_strategy(model.strategy_id or model.id)
                    if strategy.capability != model.capability or get_strategy(binding.upstream_model).model_id != strategy.model_id:
                        errors.append(f"逻辑模型 {model.id} 的渠道绑定必须匹配同款模型策略")
                except ValueError:
                    if model.strategy_id:
                        errors.append(f"逻辑模型 {model.id} 的策略或上游模型未注册")
            binding_key = f"{binding.channel_id}:{normalize_model_name(binding.upstream_model)}"
            if binding.channel_id not in channel_ids:
                errors.append(_("逻辑模型 {id} 引用了不存在的渠道 {channel}", id=model.id, channel=binding.channel_id))
            else:
                channel = next(item for item in channels if item.id == binding.channel_id)
                if not channel_supports_model(channel, binding.upstream_model):
                    errors.append(
                        _(
                            "渠道 {channel} 未启用上游模型 {model}",
                            channel=channel.name,
                            model=binding.upstream_model,
                        )
                    )
            if binding_key in binding_keys:
                errors.append(_("逻辑模型 {id} 存在重复绑定", id=model.id))
            binding_keys.add(binding_key)
    labels = {"text": _("文本"), "image": _("图片"), "video": _("视频"), "audio": _("音频")}
    for capability, attr in CAPABILITY_DEFAULT_KEYS.items():
        model_id = getattr(defaults, attr, "") or ""
        if model_id and not is_logical_model_resolvable(logical_models, channels, capability, model_id):
            errors.append(_("默认{label}模型不可解析：{model}", label=labels[capability], model=model_id))
    return list(dict.fromkeys(errors))


def _find_stored_binding(
    models: list[LogicalModel],
    channel_id: str,
    upstream_model: str,
) -> LogicalModelBinding | None:
    key = normalize_model_name(upstream_model)
    for model in models:
        for binding in model.bindings:
            if binding.channel_id == channel_id and normalize_model_name(binding.upstream_model) == key:
                return binding
    return None


def _unique_logical_model_id(value: str, used_ids: set[str]) -> str:
    base = (value or "model").strip() or "model"
    candidate = base
    suffix = 2
    while candidate.lower() in used_ids:
        candidate = f"{base}-{suffix}"
        suffix += 1
    used_ids.add(candidate.lower())
    return candidate
