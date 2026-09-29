from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client
from app.services.supabase import create_admin_supabase_client

from app.core.security import (
    get_access_token,
    get_supabase,
)


router = APIRouter(
    prefix="/api/v1/attachments",
    tags=["Attachments"],
)


ALLOWED_BUCKETS = {
    "meeting-files",
    "meeting-audio",
    "meeting-video",
}


class UploadConfirmRequest(BaseModel):
    meeting_id: str
    bucket: str
    path: str
    file_name: str
    file_type: str | None = None
    file_size: int | None = None
    attachment_type: str = "meeting_attachment"


@router.post("/confirm")
async def confirm_upload(
    payload: UploadConfirmRequest,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    # --------------------------------------------------------
    # Authenticate user
    # --------------------------------------------------------

    try:
        auth_response = supabase.auth.get_user(access_token)
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication token: {exc}",
        )

    if not auth_response.user:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    user_id = auth_response.user.id

    # --------------------------------------------------------
    # Validate bucket
    # --------------------------------------------------------

    if payload.bucket not in ALLOWED_BUCKETS:
        raise HTTPException(
            status_code=400,
            detail="Invalid storage bucket",
        )

    # --------------------------------------------------------
    # Validate attachment type
    # --------------------------------------------------------

    if payload.attachment_type not in {
        "meeting_attachment",
        "imported_mom",
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid attachment type",
        )

    # --------------------------------------------------------
    # Get meeting
    # --------------------------------------------------------

    meeting_response = (
        supabase
        .table("meetings")
        .select("id,workspace_id")
        .eq("id", payload.meeting_id)
        .execute()
    )

    if not meeting_response.data:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    meeting = meeting_response.data[0]

    # --------------------------------------------------------
    # Validate storage path
    # --------------------------------------------------------

    expected_prefix = (
        f"{meeting['workspace_id']}/"
        f"{meeting['id']}/"
    )

    if not payload.path.startswith(expected_prefix):
        raise HTTPException(
            status_code=400,
            detail="Invalid storage path",
        )

    # --------------------------------------------------------
    # Verify object actually exists
    # --------------------------------------------------------

    admin_supabase = create_admin_supabase_client()

    directory = "/".join(
        payload.path.split("/")[:-1]
    )

    filename = payload.path.split("/")[-1]

    storage_response = (
        admin_supabase.storage
        .from_(payload.bucket)
        .list(directory)
    )

    if storage_response is None:
        raise HTTPException(
            status_code=404,
            detail="Uploaded file not found",
        )

    file_exists = any(
        item.get("name") == filename
        for item in storage_response
    )

    if not file_exists:
        raise HTTPException(
            status_code=404,
            detail="Uploaded file does not exist in storage",
        )

    # --------------------------------------------------------
    # Create attachment record
    # --------------------------------------------------------

    response = (
        supabase
        .table("attachments")
        .insert({
            "meeting_id": payload.meeting_id,
            "uploaded_by": user_id,
            "file_name": payload.file_name,
            "file_path": payload.path,
            "file_type": payload.file_type,
            "file_size": payload.file_size,
            "attachment_type": payload.attachment_type,
        })
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=400,
            detail="Failed to create attachment",
        )

    return {
        "attachment": response.data[0],
        "message": "Upload confirmed",
    }