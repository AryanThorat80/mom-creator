import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings

from app.api.routes.health import router as health_router
from app.api.routes.users import router as users_router
from app.api.routes.meetings import router as meetings_router
from app.api.routes.attachments import router as attachments_router
from app.api.routes.processing import router as processing_router
from app.api.routes.workspaces import router as workspaces_router
from app.api.routes.mom_templates import router as mom_templates_router
from app.api.routes.moms import router as moms_router
from app.api.routes.action_items import router as action_items_router
from app.api.routes.google_calendar import router as google_calendar_router
from app.api.routes.google_meet import router as google_meet_router
from app.api.routes.documents import router as documents_router
from app.api.routes.fireflies import router as fireflies_router


from app.services.fireflies import sync_fireflies_connection
from app.services.supabase import create_admin_supabase_client


logger = logging.getLogger(__name__)

settings = get_settings()


# ============================================================
# FIREFLIES HOURLY SYNC
# ============================================================

async def fireflies_scheduler():
    """
    Check active Fireflies workspaces every minute.

    The database function claim_fireflies_sync()
    guarantees that each workspace can actually sync
    only once every hour.
    """

    await asyncio.sleep(10)

    while True:

        try:

            admin = create_admin_supabase_client()

            response = (
                admin
                .table("fireflies_connections")
                .select("*")
                .eq("is_active", True)
                .execute()
            )

            for connection in (
                response.data or []
            ):

                workspace_id = connection[
                    "workspace_id"
                ]

                try:

                    claim = (
                        admin
                        .rpc(
                            "claim_fireflies_sync",
                            {
                                "target_workspace_id":
                                    workspace_id
                            },
                        )
                        .execute()
                    )

                    if not claim.data:
                        continue

                    await sync_fireflies_connection(
                        admin,
                        connection,
                    )

                except Exception:

                    logger.exception(
                        "Fireflies hourly sync failed "
                        "for workspace %s",
                        workspace_id,
                    )

        except asyncio.CancelledError:
            raise

        except Exception:

            logger.exception(
                "Fireflies scheduler failed"
            )

        await asyncio.sleep(60)


# ============================================================
# LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    task = asyncio.create_task(
        fireflies_scheduler()
    )

    try:
        yield

    finally:

        task.cancel()

        try:
            await task
        except asyncio.CancelledError:
            pass


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
    ],
    allow_origin_regex=(
        r"https://mom-creator-[a-z0-9]+-"
        r"thorataryan0-6927\.vercel\.app"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTES
# ============================================================

app.include_router(health_router)
app.include_router(users_router)
app.include_router(workspaces_router)
app.include_router(mom_templates_router)
app.include_router(meetings_router)
app.include_router(attachments_router)
app.include_router(processing_router)
app.include_router(google_meet_router)

# Fireflies
app.include_router(fireflies_router)

app.include_router(moms_router)
app.include_router(action_items_router)
app.include_router(google_calendar_router)
app.include_router(documents_router)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():

    return {
        "name": "MOM Creator API",
        "version": settings.app_version,
        "status": "running",
    }