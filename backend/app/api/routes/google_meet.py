from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from supabase import Client

from app.core.security import get_access_token, get_supabase
from app.core.config import get_settings
from app.services.google_meet import (
    GoogleMeetAPIError,
    create_meeting_space,
    sync_transcript_for_meeting,
)
from app.services.google_oauth import (
    build_google_authorization_url,
    exchange_authorization_code,
    save_google_connection,
    verify_oauth_state,
)
from app.services.supabase import create_admin_supabase_client


settings = get_settings()

router = APIRouter(
    prefix="/api/v1/integrations/google",
    tags=["Google Meet"],
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
        )

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
        url=f"{base}/google-integration?provider=google_meet&status={status}",
        status_code=302,
    )


@router.get("/meet/connect")
async def connect_google_meet(
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(
        supabase,
        access_token,
    )

    try:
        authorization_url = build_google_authorization_url(user.id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    return {
        "authorization_url": authorization_url,
    }


@router.get("/meet/callback")
async def google_meet_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
):
    if error:
        return frontend_redirect("denied")

    if not code or not state:
        return frontend_redirect("missing_code_or_state")

    try:
        payload = verify_oauth_state(state)
        user_id = payload["user_id"]
        token_data = await exchange_authorization_code(code)

        supabase_admin = create_admin_supabase_client()

        save_google_connection(
            supabase_admin,
            user_id,
            token_data,
        )

    except Exception:
        return frontend_redirect("failed")

    return frontend_redirect("connected")


@router.post("/meetings/{meeting_id}/meet")
async def create_google_meet_for_meeting(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
) -> dict[str, Any]:
    user = get_authenticated_user(
        supabase,
        access_token,
    )

    meeting_response = (
        supabase
        .table("meetings")
        .select("id,workspace_id,created_by,mode,title")
        .eq("id", meeting_id)
        .execute()
    )

    if not meeting_response.data:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found or inaccessible",
        )

    meeting = meeting_response.data[0]

    if meeting.get("created_by") != user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the meeting creator can create its Google Meet space",
        )

    if meeting.get("mode") != "google_meet":
        raise HTTPException(
            status_code=400,
            detail="Meeting mode must be google_meet",
        )

    admin = create_admin_supabase_client()

    existing = (
        admin
        .table("online_meeting_integrations")
        .select("*")
        .eq("meeting_id", meeting_id)
        .execute()
    )

    if existing.data:
        source = existing.data[0]
        return {
            "provider": source["provider"],
            "meeting_id": meeting_id,
            "meeting_uri": source.get("meeting_uri"),
            "meeting_code": source.get("meeting_code"),
            "external_space_name": source.get("external_space_name"),
            "already_exists": True,
        }

    # Verify the Google account is connected before calling Meet.
    connection = (
        admin
        .table("google_connections")
        .select("user_id")
        .eq("user_id", user.id)
        .execute()
    )

    if not connection.data:
        raise HTTPException(
            status_code=400,
            detail="Google account is not connected. Connect Google Meet first.",
        )

    try:
        # Use the same stored refresh token to obtain a short-lived access token.
        from app.services.google_oauth import refresh_access_token
        google_access_token = await refresh_access_token(
            admin,
            user.id,
        )

        space = await create_meeting_space(
            google_access_token,
        )

    except GoogleMeetAPIError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create Google Meet space: {exc}",
        ) from exc

    space_name = space.get("name")
    meeting_uri = space.get("meetingUri")
    meeting_code = space.get("meetingCode")

    if not space_name or not meeting_uri:
        raise HTTPException(
            status_code=502,
            detail="Google Meet did not return a usable meeting space",
        )

    insert = (
        admin
        .table("online_meeting_integrations")
        .insert({
            "meeting_id": meeting_id,
            "provider": "google_meet",
            "external_space_name": space_name,
            "meeting_uri": meeting_uri,
            "meeting_code": meeting_code,
        })
        .execute()
    )

    if not insert.data:
        raise HTTPException(
            status_code=500,
            detail="Google Meet was created but integration record could not be stored",
        )

    return {
        "provider": "google_meet",
        "meeting_id": meeting_id,
        "meeting_uri": meeting_uri,
        "meeting_code": meeting_code,
        "external_space_name": space_name,
        "already_exists": False,
    }


@router.get("/meetings/{meeting_id}/meet")
async def get_google_meet_for_meeting(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
) -> dict[str, Any]:
    user = get_authenticated_user(
        supabase,
        access_token,
    )

    meeting_response = (
        supabase
        .table("meetings")
        .select("id,created_by")
        .eq("id", meeting_id)
        .execute()
    )

    if not meeting_response.data:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting_response.data[0].get("created_by") != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    admin = create_admin_supabase_client()
    response = (
        admin
        .table("online_meeting_integrations")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("provider", "google_meet")
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Google Meet has not been created for this meeting",
        )

    return response.data[0]


@router.post("/meetings/{meeting_id}/meet/sync-transcript")
async def sync_google_meet_transcript(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
) -> dict[str, Any]:
    user = get_authenticated_user(
        supabase,
        access_token,
    )

    meeting_response = (
        supabase
        .table("meetings")
        .select("id,created_by")
        .eq("id", meeting_id)
        .execute()
    )

    if not meeting_response.data:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting_response.data[0].get("created_by") != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    admin = create_admin_supabase_client()

    integration_response = (
        admin
        .table("online_meeting_integrations")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("provider", "google_meet")
        .execute()
    )

    if not integration_response.data:
        raise HTTPException(
            status_code=404,
            detail="Google Meet has not been created for this meeting",
        )

    integration = integration_response.data[0]
    space_name = integration.get("external_space_name")

    if not space_name:
        raise HTTPException(
            status_code=500,
            detail="Google Meet integration is missing its space name",
        )

    try:
        synced = await sync_transcript_for_meeting(
            admin,
            user.id,
            meeting_id,
            space_name,
        )
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except GoogleMeetAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync Google Meet transcript: {exc}",
        ) from exc

    now = datetime.now(timezone.utc).isoformat()

    admin.table("online_meeting_integrations").update({
        "conference_record_name": synced["conference_record_name"],
        "transcript_resource_name": synced["transcript_resource_name"],
        "transcript_state": synced["transcript_state"],
        "last_synced_at": now,
    }).eq("meeting_id", meeting_id).execute()

    # Reuse the existing processing pipeline: store a completed
    # transcription job whose output_data contains the normalized transcript.
    job_insert = admin.table("processing_jobs").insert({
        "meeting_id": meeting_id,
        "created_by": user.id,
        "job_type": "transcription",
        "status": "completed",
        "output_data": {
            "source": "google_meet",
            "transcript": synced["transcript"],
            "conference_record_name": synced["conference_record_name"],
            "transcript_resource_name": synced["transcript_resource_name"],
            "entries": synced["entries"],
            "participants": synced["participants"],
        },
        "started_at": now,
        "completed_at": now,
    }).execute()

    transcription_job_id = (
        job_insert.data[0]["id"]
        if job_insert.data
        else None
    )

    return {
        "meeting_id": meeting_id,
        "provider": "google_meet",
        "conference_record_name": synced["conference_record_name"],
        "transcript_resource_name": synced["transcript_resource_name"],
        "transcript": synced["transcript"],
        "entries_count": len(synced["entries"]),
        "participants_count": len(synced["participants"]),
        "transcription_job_id": transcription_job_id,
    }
