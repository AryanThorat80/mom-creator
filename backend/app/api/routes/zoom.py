from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from supabase import Client

from app.core.config import get_settings
from app.core.security import get_access_token, get_supabase
from app.services.supabase import create_admin_supabase_client
from app.services.zoom import (
    ZoomAPIError,
    create_zoom_meeting,
    get_zoom_transcript,
    download_zoom_transcript,
    parse_zoom_transcript,
)
from app.services.zoom_oauth import (
    build_zoom_authorization_url,
    exchange_zoom_authorization_code,
    refresh_access_token,
    save_zoom_connection,
    verify_zoom_oauth_state,
)

settings = get_settings()

router = APIRouter(
    prefix="/api/v1/integrations/zoom",
    tags=["Zoom"],
)


def get_authenticated_user(supabase: Client, access_token: str):
    try:
        response = supabase.auth.get_user(access_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid authentication token: {exc}")

    if response.user is None:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return response.user


@router.get("/connect")
async def connect_zoom(
    meeting_id: str | None = None,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(supabase, access_token)

    try:
        return {
            "authorization_url": build_zoom_authorization_url(
                user.id,
                meeting_id=meeting_id,
            )
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/callback")
async def zoom_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    base = settings.frontend_url.rstrip("/")

    if error:
        return RedirectResponse(
            url=f"{base}/zoom-integration?status=denied&error={error}",
            status_code=302,
        )

    if not code or not state:
        return RedirectResponse(
            url=f"{base}/zoom-integration?status=failed&error=missing_oauth_parameters",
            status_code=302,
        )

    try:
        state_data = verify_zoom_oauth_state(state)
        user_id = state_data["user_id"]
        token_data = await exchange_zoom_authorization_code(code)
        admin = create_admin_supabase_client()
        save_zoom_connection(admin, user_id, token_data)
    except Exception as exc:
        return RedirectResponse(
            url=f"{base}/zoom-integration?status=failed&error=oauth_failed",
            status_code=302,
        )

    meeting_id = state_data.get("meeting_id")

    if meeting_id:
        redirect_url = (
            f"{base}/zoom-integration"
            f"?status=connected"
            f"&meeting_id={meeting_id}"
        )
    else:
        redirect_url = f"{base}/zoom-integration?status=connected"

    return RedirectResponse(
        url=redirect_url,
        status_code=302,
    )


@router.post("/meetings/{meeting_id}/zoom")
async def create_zoom_for_meeting(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
) -> dict[str, Any]:
    user = get_authenticated_user(supabase, access_token)

    meeting_response = (
        supabase.table("meetings")
        .select("id,created_by,mode,title,meeting_date")
        .eq("id", meeting_id)
        .execute()
    )

    if not meeting_response.data:
        raise HTTPException(status_code=404, detail="Meeting not found")

    meeting = meeting_response.data[0]

    if meeting.get("created_by") != user.id:
        raise HTTPException(status_code=403, detail="Only the meeting creator can create its Zoom meeting")

    if meeting.get("mode") != "zoom":
        raise HTTPException(status_code=400, detail="Meeting mode must be zoom")

    admin = create_admin_supabase_client()

    existing = (
        admin.table("online_meeting_integrations")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("provider", "zoom")
        .execute()
    )

    if existing.data:
        source = existing.data[0]
        return {
            "provider": "zoom",
            "meeting_id": meeting_id,
            "meeting_uri": source.get("meeting_uri"),
            "meeting_code": source.get("meeting_code"),
            "external_space_name": source.get("external_space_name"),
            "already_exists": True,
        }

    try:
        zoom_access_token = await refresh_access_token(admin, user.id)
        meeting_date = meeting.get("meeting_date")

        if isinstance(meeting_date, str):
            meeting_date = datetime.fromisoformat(
                meeting_date.replace("Z", "+00:00")
            )

        zoom_meeting = await create_zoom_meeting(
            zoom_access_token,
            meeting_date,
            meeting.get("title") or "MOM Creator Meeting",
        )
    except LookupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ZoomAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create Zoom meeting: {exc}") from exc

    zoom_id = str(zoom_meeting.get("id")) if zoom_meeting.get("id") is not None else None
    join_url = zoom_meeting.get("join_url")

    if not zoom_id or not join_url:
        raise HTTPException(status_code=502, detail="Zoom did not return a usable meeting")

    insert = (
        admin.table("online_meeting_integrations")
        .insert({
            "meeting_id": meeting_id,
            "provider": "zoom",
            "external_space_name": zoom_id,
            "meeting_uri": join_url,
            "meeting_code": zoom_id,
        })
        .execute()
    )

    if not insert.data:
        raise HTTPException(status_code=500, detail="Zoom meeting was created but integration record could not be stored")

    return {
        "provider": "zoom",
        "meeting_id": meeting_id,
        "meeting_uri": join_url,
        "meeting_code": zoom_id,
        "external_space_name": zoom_id,
        "start_url": zoom_meeting.get("start_url"),
        "already_exists": False,
    }

@router.post("/meetings/{meeting_id}/zoom/sync-transcript")
async def sync_zoom_transcript(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
) -> dict[str, Any]:
    user = get_authenticated_user(supabase, access_token)

    # ---------------------------------------------------------
    # Verify meeting
    # ---------------------------------------------------------

    meeting_response = (
        supabase
        .table("meetings")
        .select("id,created_by,mode")
        .eq("id", meeting_id)
        .execute()
    )

    if not meeting_response.data:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    meeting = meeting_response.data[0]

    if meeting.get("created_by") != user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the meeting creator can sync its Zoom transcript",
        )

    if meeting.get("mode") != "zoom":
        raise HTTPException(
            status_code=400,
            detail="Meeting mode must be zoom",
        )

    # ---------------------------------------------------------
    # Get stored Zoom meeting
    # ---------------------------------------------------------

    admin = create_admin_supabase_client()

    integration_response = (
        admin
        .table("online_meeting_integrations")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("provider", "zoom")
        .execute()
    )

    if not integration_response.data:
        raise HTTPException(
            status_code=404,
            detail="Zoom meeting has not been created",
        )

    integration = integration_response.data[0]

    zoom_meeting_id = integration.get("external_space_name")

    if not zoom_meeting_id:
        raise HTTPException(
            status_code=500,
            detail="Zoom meeting ID is missing",
        )

    # ---------------------------------------------------------
    # Refresh Zoom token
    # ---------------------------------------------------------

    try:
        zoom_access_token = await refresh_access_token(
            admin,
            user.id,
        )

        transcript_info = await get_zoom_transcript(
            zoom_access_token,
            str(zoom_meeting_id),
        )

    except LookupError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except ZoomAPIError as exc:
        message = str(exc)

        if "NOT_READY" in message.upper():
            raise HTTPException(
                status_code=409,
                detail="Zoom transcript is still being processed. Please try again in a few minutes.",
            ) from exc

        raise HTTPException(
            status_code=502,
            detail=message,
        ) from exc

    # ---------------------------------------------------------
    # Check transcript readiness
    # ---------------------------------------------------------

    if not transcript_info.get("can_download"):
        reason = (
            transcript_info.get("download_restriction_reason")
            or "NOT_READY"
        )

        if reason == "NOT_READY":
            raise HTTPException(
                status_code=409,
                detail="Zoom transcript is still being processed. Please try again in a few minutes.",
            )

        if reason == "NO_TRANSCRIPT_DATA":
            raise HTTPException(
                status_code=409,
                detail="No Zoom transcript is available for this meeting.",
            )

        raise HTTPException(
            status_code=409,
            detail=f"Zoom transcript is not available: {reason}",
        )

    download_url = transcript_info.get("download_url")

    if not download_url:
        raise HTTPException(
            status_code=502,
            detail="Zoom did not return a transcript download URL",
        )

    # ---------------------------------------------------------
    # Download transcript
    # ---------------------------------------------------------

    try:
        raw_transcript = await download_zoom_transcript(
            zoom_access_token,
            download_url,
        )
    except ZoomAPIError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    transcript = parse_zoom_transcript(
        raw_transcript
    )

    if not transcript:
        raise HTTPException(
            status_code=502,
            detail="Zoom returned an empty transcript",
        )

    # ---------------------------------------------------------
    # Store as completed transcription job
    #
    # This intentionally uses the existing processing pipeline.
    # MOM generation already looks for the latest completed
    # transcription job.
    # ---------------------------------------------------------

    job_response = (
        admin
        .table("processing_jobs")
        .insert({
            "meeting_id": meeting_id,
            "created_by": user.id,
            "job_type": "transcription",
            "input_file_path": None,
            "status": "completed",
            "output_data": {
                "transcript": transcript,
                "source": "zoom",
                "zoom_meeting_id": str(zoom_meeting_id),
                "transcript_created_time": transcript_info.get(
                    "transcript_created_time"
                ),
            },
        })
        .select("id")
        .execute()
    )

    if not job_response.data:
        raise HTTPException(
            status_code=500,
            detail="Transcript was retrieved but could not be stored",
        )

    # Keep meeting in processing state until MOM generation finishes.
    (
        admin
        .table("meetings")
        .update({
            "status": "processing",
        })
        .eq("id", meeting_id)
        .execute()
    )

    return {
        "meeting_id": meeting_id,
        "provider": "zoom",
        "transcript": transcript,
        "transcription_job_id": job_response.data[0]["id"],
        "entries_count": len(
            [line for line in transcript.splitlines() if line.strip()]
        ),
        "transcript_created_time": transcript_info.get(
            "transcript_created_time"
        ),
    }

@router.get("/meetings/{meeting_id}/zoom")
async def get_zoom_for_meeting(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(supabase, access_token)

    meeting_response = (
        supabase.table("meetings")
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
        admin.table("online_meeting_integrations")
        .select("*")
        .eq("meeting_id", meeting_id)
        .eq("provider", "zoom")
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Zoom meeting has not been created")

    return response.data[0]
