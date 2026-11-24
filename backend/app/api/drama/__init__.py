"""Drama API package: /api/drama/*."""

from fastapi import APIRouter

from app.api.drama import agents, assets, canvas, drafts, episodes, generation, imports, projects, scripts, skills, voices

router = APIRouter(prefix="/drama", tags=["drama"])
# imports 在 projects 之前注册，避免 /projects/import 被路径参数路由吞掉
router.include_router(imports.router)
router.include_router(projects.router)
router.include_router(scripts.router)
router.include_router(agents.router)
router.include_router(assets.router)
router.include_router(episodes.router)
router.include_router(drafts.router)
router.include_router(generation.router)
router.include_router(canvas.router)
router.include_router(skills.router)
router.include_router(voices.router)
