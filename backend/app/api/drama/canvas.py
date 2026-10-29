"""Drama canvas persistence (nodes stored as project content + none-type assets)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import _

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.models_drama import DramaAsset
from app.schemas_drama import DramaCanvasSaveRequest
from app.services.drama.access import get_owned_drama_project

router = APIRouter()


def _node_with_asset_media(raw: dict, asset: DramaAsset, *, asset_details: bool = False) -> dict:
    """布局中的媒体快照取当前资产；个人节点的名称和提示词仍可编辑。"""
    node = dict(raw)
    data = dict(node["data"]) if isinstance(node.get("data"), dict) else {}
    data.update(mediaUrl=asset.url, url=asset.url, cover=asset.cover)
    if asset_details:
        data.update(label=asset.name, name=asset.name, kind=asset.type, asset_type=asset.asset_type)
    node["data"] = data
    return node


def _canvas_nodes(nodes: list, assets: list[DramaAsset], *, asset_details: bool = False) -> list:
    """已有资产的媒体始终由服务器生成，旧画布不能回写资产。"""
    by_id = {asset.id: asset for asset in assets}
    out = []
    for raw in nodes:
        node = dict(raw)
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        try:
            asset = by_id.get(int(data.get("assetId") or 0))
        except (TypeError, ValueError):
            asset = None
        if asset:
            node = _node_with_asset_media(node, asset, asset_details=asset_details)
        out.append(node)
    return out


@router.get("/canvas/{project_id}")
async def get_canvas(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    project = await get_owned_drama_project(db, project_id, user, with_assets=True)
    content = project.content if isinstance(project.content, dict) else {}
    return {
        "project_id": project_id,
        "nodes": _canvas_nodes(content.get("canvas_nodes") or [], project.assets or []),
        "edges": content.get("canvas_edges") or [],
    }


@router.post("/canvas")
async def save_canvas(
    body: DramaCanvasSaveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    project = await get_owned_drama_project(db, body.project_id, user, with_assets=True)
    content = dict(project.content) if isinstance(project.content, dict) else {}
    content["canvas_nodes"] = body.nodes
    content["canvas_edges"] = body.edges
    project.content = content

    # Generation may finish after the initial project read. Refresh under row
    # locks before merging params so a stale ORM snapshot cannot undo delivery.
    # Avoid autoflushing the project layout before acquiring these locks.
    with db.no_autoflush:
        assets = list((await db.scalars(
            select(DramaAsset).where(DramaAsset.project_id == project.id)
            .order_by(DramaAsset.id).with_for_update()
            .execution_options(populate_existing=True)
        )).all())
    nodes = [dict(node) for node in body.nodes]

    # Upsert canvas nodes as type=none assets keyed by node id in params
    existing = {
        str((a.params or {}).get("canvas_node_id")): a
        for a in assets
        if a.type == "none" and (a.params or {}).get("canvas_node_id")
    }
    seen: set[str] = set()
    for index, node in enumerate(nodes):
        nid = str(node.get("id") or "")
        if not nid:
            continue
        seen.add(nid)
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        name = str(data.get("label") or data.get("name") or _("节点 {id}", id=nid))
        url = data.get("mediaUrl") or data.get("url") or data.get("cover")
        kind = str(data.get("kind") or "none")
        asset_type = str(
            data.get("asset_type")
            or ("video" if kind == "video" else "audio" if kind == "audio" else "image")
        )
        # Prefer matching by explicit assetId, then by canvas_node_id
        asset_id_raw = data.get("assetId")
        matched = None
        if asset_id_raw is not None:
            try:
                aid = int(asset_id_raw)
            except (TypeError, ValueError):
                aid = None
            if aid is not None:
                matched = next((a for a in assets if a.id == aid), None)
        if matched is None:
            matched = existing.get(nid)

        if matched is not None:
            asset = matched
            asset.name = name
            if kind and kind != "none":
                asset.type = kind
            asset.asset_type = asset_type
            node = _node_with_asset_media(node, asset)
            nodes[index] = node
            params = dict(asset.params or {})
            params["canvas"] = node
            params["canvas_node_id"] = nid
            asset.params = params
            existing[nid] = asset
        else:
            is_audio_node = asset_type in {"audio", "voice"} or kind in {"audio", "voice"}
            db.add(
                DramaAsset(
                    project_id=project.id,
                    type=kind if kind else "none",
                    asset_type=asset_type,
                    name=name,
                    cover=None if is_audio_node else (str(url) if url else None),
                    url=str(url) if url else None,
                    params={"canvas_node_id": nid, "canvas": node},
                )
            )
    content["canvas_nodes"] = nodes
    project.content = content
    await db.commit()
    return {"ok": True, "nodes": len(body.nodes), "edges": len(body.edges)}
