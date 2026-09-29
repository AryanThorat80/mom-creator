from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.google_meet import router as google_meet_router
from app.api.routes.zoom import router as zoom_router

from app.core.config import get_settings

from app.api.routes.health import router as health_router
from app.api.routes.users import router as users_router
from app.api.routes.meetings import router as meetings_router
from app.api.routes.attachments import router as attachments_router
from app.api.routes.processing import router as processing_router
from app.api.routes.workspaces import router as workspaces_router
from app.api.routes.moms import router as moms_router
from app.api.routes.action_items import router as action_items_router
from app.api.routes.google_calendar import router as google_calendar_router
from app.api.routes.documents import router as documents_router



settings = get_settings()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health_router)
app.include_router(users_router)
app.include_router(workspaces_router)
app.include_router(meetings_router)
app.include_router(attachments_router)
app.include_router(processing_router)
app.include_router(google_meet_router)
app.include_router(zoom_router)
app.include_router(moms_router)
app.include_router(action_items_router)
app.include_router(google_calendar_router)
app.include_router(documents_router)


@app.get("/")
async def root():
    return {
        "name": "MOM Creator API",
        "version": settings.app_version,
        "status": "running",
    }