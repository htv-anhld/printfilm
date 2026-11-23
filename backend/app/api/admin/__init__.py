# Admin API router aggregation
from fastapi import APIRouter

from app.api.admin import (
    commerce,
    dashboard,
    finance,
    drama_assets,
    drama_episodes,
    drama_fragments,
    drama_projects,
    error_reports,
    ledger,
    orders,
    partners,
    projects,
    queues,
    settings,
    tasks,
    templates,
    usage,
    users,
    works,
)

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(dashboard.router)
router.include_router(finance.router)
router.include_router(queues.router)
router.include_router(tasks.router)
router.include_router(settings.router)
router.include_router(users.router)
router.include_router(orders.router)
router.include_router(ledger.router)
router.include_router(usage.router)
router.include_router(projects.router)
router.include_router(works.router)
router.include_router(templates.router)
router.include_router(drama_projects.router)
router.include_router(drama_assets.router)
router.include_router(drama_episodes.router)
router.include_router(drama_fragments.router)
router.include_router(error_reports.router)
router.include_router(commerce.router)
router.include_router(partners.router)
