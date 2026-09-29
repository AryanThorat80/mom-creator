from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.security import (
    get_access_token,
    get_supabase,
)
from app.schemas.meeting import (
    MeetingCreate,
    MeetingResponse,
    MeetingUpdate,
)


router = APIRouter(
    prefix="/api/v1/meetings",
    tags=["Meetings"],
)


def get_authenticated_user(
    supabase: Client,
    access_token: str,
):
    try:
        response = supabase.auth.get_user(
            access_token
        )
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


# ============================================================
# CREATE MEETING
# ============================================================

@router.post(
    "",
    response_model=MeetingResponse,
    status_code=201,
)
async def create_meeting(
    payload: MeetingCreate,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(
        supabase,
        access_token,
    )

    title = payload.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Meeting title cannot be empty",
        )

    try:
        # Create meeting without .select().single()
        insert_response = (
            supabase
            .table("meetings")
            .insert(
                {
                    "workspace_id": payload.workspace_id,
                    "created_by": user.id,
                    "title": title,
                    "description": payload.description,
                    "mode": payload.mode.value,
                    "meeting_date": (
                        payload.meeting_date.isoformat()
                        if payload.meeting_date
                        else None
                    ),
                }
            )
            .execute()
        )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create meeting: {exc}",
        )

    if not insert_response.data:
        raise HTTPException(
            status_code=500,
            detail="Meeting was created but no data was returned",
        )

    # The insert returned the generated meeting ID.
    meeting_id = insert_response.data[0]["id"]

    # Read the meeting back using a separate SELECT.
    try:
        response = (
            supabase
            .table("meetings")
            .select(
                """
                id,
                workspace_id,
                created_by,
                title,
                description,
                mode,
                status,
                meeting_date,
                source_file_path,
                audio_file_path,
                video_file_path,
                duration_seconds,
                created_at,
                updated_at
                """
            )
            .eq("id", meeting_id)
            .execute()
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Meeting created but could not be loaded: {exc}",
        )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Meeting created but could not be retrieved",
        )

    return response.data[0]

# ============================================================
# LIST MEETINGS
# ============================================================

@router.get(
    "",
    response_model=list[MeetingResponse],
)
async def list_meetings(
    workspace_id: str,
    supabase: Client = Depends(get_supabase),
):
    response = (
        supabase
        .table("meetings")
        .select(
            """
            id,
            workspace_id,
            created_by,
            title,
            description,
            mode,
            status,
            meeting_date,
            source_file_path,
            audio_file_path,
            video_file_path,
            duration_seconds,
            created_at,
            updated_at
            """
        )
        .eq(
            "workspace_id",
            workspace_id,
        )
        .order(
            "created_at",
            desc=True,
        )
        .execute()
    )

    return response.data or []


# ============================================================
# GET MEETING
# ============================================================

@router.get(
    "/{meeting_id}",
    response_model=MeetingResponse,
)
async def get_meeting(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
):
    response = (
        supabase
        .table("meetings")
        .select(
            """
            id,
            workspace_id,
            created_by,
            title,
            description,
            mode,
            status,
            meeting_date,
            source_file_path,
            audio_file_path,
            video_file_path,
            duration_seconds,
            created_at,
            updated_at
            """
        )
        .eq(
            "id",
            meeting_id,
        )
        .single()
        .execute()
    )

    if response.data is None:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    return response.data


# ============================================================
# UPDATE MEETING
# ============================================================

@router.patch(
    "/{meeting_id}",
    response_model=MeetingResponse,
)
async def update_meeting(
    meeting_id: str,
    payload: MeetingUpdate,
    supabase: Client = Depends(get_supabase),
):
    updates = {}

    if payload.title is not None:
        title = payload.title.strip()

        if not title:
            raise HTTPException(
                status_code=400,
                detail="Meeting title cannot be empty",
            )

        updates["title"] = title

    if payload.description is not None:
        updates["description"] = payload.description

    if payload.meeting_date is not None:
        updates["meeting_date"] = (
            payload.meeting_date.isoformat()
        )

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No fields supplied for update",
        )

    response = (
        supabase
        .table("meetings")
        .update(updates)
        .eq(
            "id",
            meeting_id,
        )
        .select(
            """
            id,
            workspace_id,
            created_by,
            title,
            description,
            mode,
            status,
            meeting_date,
            source_file_path,
            audio_file_path,
            video_file_path,
            duration_seconds,
            created_at,
            updated_at
            """
        )
        .single()
        .execute()
    )

    if response.data is None:
        raise HTTPException(
            status_code=400,
            detail="Failed to update meeting",
        )

    return response.data


# ============================================================
# DELETE MEETING
# ============================================================

@router.delete(
    "/{meeting_id}",
)
async def delete_meeting(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
):
    response = (
        supabase
        .table("meetings")
        .delete()
        .eq(
            "id",
            meeting_id,
        )
        .execute()
    )

    if response.data is None:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    return {
        "message": "Meeting deleted",
        "meeting_id": meeting_id,
    }