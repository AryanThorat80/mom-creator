from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from supabase import Client

from app.core.config import get_settings
from app.core.security import get_access_token, get_supabase
from app.schemas.calendar import CalendarEventCreate
from app.services.google_calendar import (
    GoogleCalendarAPIError,
    create_action_item_event,
    delete_primary_calendar_event,
    get_primary_calendar_event,
    build_default_event_description,
)
from app.services.google_oauth import (
    GOOGLE_CALENDAR_SCOPES,
    GOOGLE_MEET_SCOPES,
    build_google_authorization_url,
    refresh_access_token,
)
from app.services.supabase import create_admin_supabase_client


settings = get_settings()

router = APIRouter(
    prefix="/api/v1/integrations/google/calendar",
    tags=["Google Calendar"],
)


def get_authenticated_user(
    supabase: Client,
    access_token: str,
):
    try:
        response = supabase.auth.get_user(access_token)
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication token: {exc}",
        ) from exc

    user = response.user
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )

    return user


def frontend_redirect(status: str) -> RedirectResponse:
    base = settings.frontend_url.rstrip("/")
    return RedirectResponse(
        url=(
            f"{base}/google-integration?provider=google_calendar"
            f"&status={status}"
        ),
        status_code=302,
    )


async def get_action_item_or_404(
    supabase: Client,
    action_item_id: str,
) -> dict[str, Any]:
    response = (
        supabase
        .table("action_items")
        .select(
            "id,mom_id,meeting_id,created_by,assigned_to,"
            "assigned_name,task,due_date,google_event_id"
        )
        .eq("id", action_item_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Action item not found or inaccessible",
        )

    return response.data[0]


async def get_meeting_for_action_item(
    supabase_admin: Client,
    meeting_id: str,
) -> dict[str, Any]:
    response = (
        supabase_admin
        .table("meetings")
        .select("id,workspace_id,created_by,title")
        .eq("id", meeting_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Meeting for action item was not found",
        )

    return response.data[0]


async def user_can_sync_action_item(
    supabase_admin: Client,
    user_id: str,
    meeting: dict[str, Any],
    action_item: dict[str, Any],
) -> bool:
    if action_item.get("created_by") == user_id:
        return True

    if action_item.get("assigned_to") == user_id:
        return True

    membership = (
        supabase_admin
        .table("workspace_members")
        .select("role")
        .eq("workspace_id", meeting["workspace_id"])
        .eq("user_id", user_id)
        .execute()
    )

    if not membership.data:
        return False

    return membership.data[0].get("role") in {"owner", "admin"}


@router.get("/connect")
async def connect_google_calendar(
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(supabase, access_token)

    scopes = []
    for scope in [*GOOGLE_MEET_SCOPES, *GOOGLE_CALENDAR_SCOPES]:
        if scope not in scopes:
            scopes.append(scope)

    try:
        authorization_url = build_google_authorization_url(
            user.id,
            scopes=scopes,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "provider": "google_calendar",
        "authorization_url": authorization_url,
        "requested_scopes": scopes,
    }


@router.get("/status")
async def google_calendar_status(
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(supabase, access_token)
    admin = create_admin_supabase_client()

    response = (
        admin
        .table("google_connections")
        .select("granted_scopes,updated_at")
        .eq("user_id", user.id)
        .execute()
    )

    if not response.data:
        return {
            "connected": False,
            "calendar_scope_granted": False,
        }

    granted_scopes = set(response.data[0].get("granted_scopes") or [])
    calendar_scope_granted = any(
        scope in granted_scopes for scope in GOOGLE_CALENDAR_SCOPES
    )

    return {
        "connected": True,
        "calendar_scope_granted": calendar_scope_granted,
        "calendar_scope": GOOGLE_CALENDAR_SCOPES[0],
        "updated_at": response.data[0].get("updated_at"),
    }


@router.post("/action-items/{action_item_id}/event")
async def create_calendar_event_for_action_item(
    action_item_id: str,
    payload: CalendarEventCreate,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(supabase, access_token)
    action_item = await get_action_item_or_404(supabase, action_item_id)

    admin = create_admin_supabase_client()
    meeting = await get_meeting_for_action_item(
        admin,
        action_item["meeting_id"],
    )

    if not await user_can_sync_action_item(
        admin,
        user.id,
        meeting,
        action_item,
    ):
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to sync this action item to Google Calendar",
        )

    if action_item.get("google_event_id"):
        try:
            google_access_token = await refresh_access_token(
                admin,
                user.id,
            )
            existing_event = await get_primary_calendar_event(
                google_access_token,
                action_item["google_event_id"],
            )
            return {
                "action_item_id": action_item_id,
                "google_event_id": action_item["google_event_id"],
                "calendar_id": "primary",
                "html_link": existing_event.get("htmlLink"),
                "already_synced": True,
            }
        except GoogleCalendarAPIError as exc:
            if exc.status_code != 404:
                raise HTTPException(
                    status_code=502,
                    detail=str(exc),
                ) from exc

    try:
        google_access_token = await refresh_access_token(
            admin,
            user.id,
        )

        description = payload.description.strip()
        if not description:
            description = build_default_event_description(
                task=action_item["task"],
                meeting_title=meeting.get("title"),
                action_item_id=action_item_id,
            )

        event = await create_action_item_event(
            google_access_token,
            action_item_id,
            title=payload.title.strip(),
            description=description,
            start_datetime=payload.start_datetime.isoformat(),
            end_datetime=payload.end_datetime.isoformat(),
            time_zone=payload.time_zone.strip(),
        )

    except GoogleCalendarAPIError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create Google Calendar event: {exc}",
        ) from exc

    google_event_id = event.get("id")
    if not google_event_id:
        raise HTTPException(
            status_code=502,
            detail="Google Calendar did not return an event ID",
        )

    update = (
        admin
        .table("action_items")
        .update({"google_event_id": google_event_id})
        .eq("id", action_item_id)
        .execute()
    )

    if update.data is None:
        raise HTTPException(
            status_code=500,
            detail="Calendar event was created but action item could not be updated",
        )

    return {
        "action_item_id": action_item_id,
        "google_event_id": google_event_id,
        "calendar_id": "primary",
        "html_link": event.get("htmlLink"),
        "event_status": event.get("status"),
        "already_synced": False,
    }


@router.get("/action-items/{action_item_id}/event")
async def get_calendar_event_for_action_item(
    action_item_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(supabase, access_token)
    action_item = await get_action_item_or_404(supabase, action_item_id)

    if not action_item.get("google_event_id"):
        raise HTTPException(
            status_code=404,
            detail="Action item has not been synced to Google Calendar",
        )

    admin = create_admin_supabase_client()
    meeting = await get_meeting_for_action_item(
        admin,
        action_item["meeting_id"],
    )

    if not await user_can_sync_action_item(
        admin,
        user.id,
        meeting,
        action_item,
    ):
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        google_access_token = await refresh_access_token(
            admin,
            user.id,
        )
        event = await get_primary_calendar_event(
            google_access_token,
            action_item["google_event_id"],
        )
    except GoogleCalendarAPIError as exc:
        if exc.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail="The Google Calendar event no longer exists",
            ) from exc
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve Google Calendar event: {exc}",
        ) from exc

    return {
        "action_item_id": action_item_id,
        "google_event_id": action_item["google_event_id"],
        "calendar_id": "primary",
        "event": event,
    }


@router.delete("/action-items/{action_item_id}/event")
async def delete_calendar_event_for_action_item(
    action_item_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(supabase, access_token)
    action_item = await get_action_item_or_404(supabase, action_item_id)

    if not action_item.get("google_event_id"):
        raise HTTPException(
            status_code=404,
            detail="Action item has not been synced to Google Calendar",
        )

    admin = create_admin_supabase_client()
    meeting = await get_meeting_for_action_item(
        admin,
        action_item["meeting_id"],
    )

    if not await user_can_sync_action_item(
        admin,
        user.id,
        meeting,
        action_item,
    ):
        raise HTTPException(status_code=403, detail="Forbidden")

    event_id = action_item["google_event_id"]

    try:
        google_access_token = await refresh_access_token(
            admin,
            user.id,
        )
        await delete_primary_calendar_event(
            google_access_token,
            event_id,
        )
    except GoogleCalendarAPIError as exc:
        if exc.status_code != 404:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete Google Calendar event: {exc}",
        ) from exc

    admin.table("action_items").update({
        "google_event_id": None,
    }).eq("id", action_item_id).execute()

    return {
        "action_item_id": action_item_id,
        "google_event_id": event_id,
        "calendar_id": "primary",
        "deleted": True,
    }
