from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from supabase import Client

from app.core.security import (
    get_access_token,
    get_supabase,
)
from app.services.supabase import (
    create_admin_supabase_client,
)
from app.services.document_export import (
    build_export_payload,
    safe_filename,
)
from app.schemas.meeting_participant import (
    MeetingParticipantCreate,
    MeetingParticipantUpdate,
)
from app.services.template_pdf_export import (
    _render_fallback_pdf,
)


router = APIRouter(
    prefix="/api/v1/meetings",
    tags=["Exports"],
)


# ============================================================
# AUTH
# ============================================================

def _get_current_user(
    supabase: Client,
    access_token: str,
):
    response = supabase.auth.get_user(
        access_token
    )

    if response.user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )

    return response.user


# ============================================================
# LOAD EXPORT DATA
# ============================================================

def _load_export_data(
    supabase: Client,
    meeting_id: str,
):

    # --------------------------------------------------------
    # Meeting
    # --------------------------------------------------------

    meeting_response = (
        supabase.table("meetings")
        .select(
            "id,"
            "workspace_id,"
            "created_by,"
            "title,"
            "description,"
            "mode,"
            "status,"
            "meeting_date,"
            "created_at,"
            "updated_at"
        )
        .eq(
            "id",
            meeting_id,
        )
        .limit(1)
        .execute()
    )

    if not meeting_response.data:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    meeting = meeting_response.data[0]

    # --------------------------------------------------------
    # MOM
    # --------------------------------------------------------

    mom_response = (
        supabase.table("moms")
        .select(
            "id,"
            "meeting_id,"
            "created_by,"
            "title,"
            "summary,"
            "transcript,"
            "key_discussion_points,"
            "decisions,"
            "next_steps,"
            "abbreviations_used,"
            "status,"
            "generated_at,"
            "created_at,"
            "updated_at"
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .limit(1)
        .execute()
    )

    if not mom_response.data:
        raise HTTPException(
            status_code=404,
            detail="No MOM exists for this meeting",
        )

    mom = mom_response.data[0]

    # --------------------------------------------------------
    # Action items
    # --------------------------------------------------------

    action_response = (
        supabase.table("action_items")
        .select(
            "id,"
            "mom_id,"
            "meeting_id,"
            "created_by,"
            "assigned_to,"
            "assigned_name,"
            "task,"
            "due_date,"
            "status,"
            "priority,"
            "completed_at,"
            "google_event_id,"
            "created_at,"
            "updated_at"
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .order(
            "created_at",
            desc=False,
        )
        .execute()
    )

    action_items = (
        action_response.data
        or []
    )

    # --------------------------------------------------------
    # Participants
    # --------------------------------------------------------

    admin = create_admin_supabase_client()

    participant_response = (
        admin.table(
            "meeting_participants"
        )
        .select(
            "id,"
            "meeting_id,"
            "name,"
            "email,"
            "role,"
            "sort_order,"
            "created_by,"
            "created_at,"
            "updated_at"
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .order(
            "sort_order",
            desc=False,
        )
        .order(
            "created_at",
            desc=False,
        )
        .execute()
    )

    participants = (
        participant_response.data
        or []
    )

    # Keep participants outside the MOM table.
    meeting["participants"] = participants

    return build_export_payload(
        meeting=meeting,
        mom=mom,
        action_items=action_items,
    )


# ============================================================
# PDF EXPORT
# ============================================================

@router.get(
    "/{meeting_id}/export/pdf"
)
async def export_pdf(
    meeting_id: str,
    supabase: Client = Depends(
        get_supabase
    ),
    access_token: str = Depends(
        get_access_token
    ),
):

    _get_current_user(
        supabase,
        access_token,
    )

    payload = _load_export_data(
        supabase,
        meeting_id,
    )

    try:

        # IMPORTANT:
        # Always render the CURRENT payload.
        #
        # No workspace template is used as report content.
        # No AI reference analysis is performed.
        #
        content = _render_fallback_pdf(
            payload
        )

    except Exception as exc:

        raise HTTPException(
            status_code=502,
            detail=(
                "PDF export generation failed: "
                f"{exc}"
            ),
        ) from exc

    filename = (
        safe_filename(
            payload["mom"].get("title")
            or payload["meeting"].get(
                "title"
            )
        )
        + ".pdf"
    )

    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            ),
            "Cache-Control": "no-store",
        },
    )


# ============================================================
# PARTICIPANTS
# ============================================================

def _participant_meeting(
    admin: Client,
    meeting_id: str,
):

    response = (
        admin.table("meetings")
        .select(
            "id,workspace_id,created_by"
        )
        .eq(
            "id",
            meeting_id,
        )
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    return response.data[0]


def _participant_editor(
    admin: Client,
    meeting: dict,
    user_id: str,
) -> bool:

    if (
        str(meeting["created_by"])
        == str(user_id)
    ):
        return True

    owner = (
        admin.table(
            "workspace_members"
        )
        .select("role")
        .eq(
            "workspace_id",
            meeting["workspace_id"],
        )
        .eq(
            "user_id",
            user_id,
        )
        .limit(1)
        .execute()
    )

    return bool(
        owner.data
        and owner.data[0].get(
            "role"
        ) == "owner"
    )


def _participant_list(
    admin: Client,
    meeting_id: str,
):

    response = (
        admin.table(
            "meeting_participants"
        )
        .select(
            "id,"
            "meeting_id,"
            "name,"
            "email,"
            "role,"
            "sort_order,"
            "created_by,"
            "created_at,"
            "updated_at"
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .order(
            "sort_order",
            desc=False,
        )
        .order(
            "created_at",
            desc=False,
        )
        .execute()
    )

    return response.data or []


# ============================================================
# LIST PARTICIPANTS
# ============================================================

@router.get(
    "/{meeting_id}/participants"
)
async def list_meeting_participants(
    meeting_id: str,
    supabase: Client = Depends(
        get_supabase
    ),
    access_token: str = Depends(
        get_access_token
    ),
):

    user = _get_current_user(
        supabase,
        access_token,
    )

    admin = create_admin_supabase_client()

    meeting = _participant_meeting(
        admin,
        meeting_id,
    )

    membership = (
        admin.table(
            "workspace_members"
        )
        .select("user_id")
        .eq(
            "workspace_id",
            meeting["workspace_id"],
        )
        .eq(
            "user_id",
            user.id,
        )
        .limit(1)
        .execute()
    )

    if not membership.data:
        raise HTTPException(
            status_code=403,
            detail=(
                "You are not a member "
                "of this workspace"
            ),
        )

    return _participant_list(
        admin,
        meeting_id,
    )


# ============================================================
# CREATE PARTICIPANT
# ============================================================

@router.post(
    "/{meeting_id}/participants",
    status_code=status.HTTP_201_CREATED,
)
async def create_meeting_participant(
    meeting_id: str,
    payload: MeetingParticipantCreate,
    supabase: Client = Depends(
        get_supabase
    ),
    access_token: str = Depends(
        get_access_token
    ),
):

    user = _get_current_user(
        supabase,
        access_token,
    )

    admin = create_admin_supabase_client()

    meeting = _participant_meeting(
        admin,
        meeting_id,
    )

    if not _participant_editor(
        admin,
        meeting,
        user.id,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only the meeting creator "
                "or workspace owner can "
                "edit participants"
            ),
        )

    count_response = (
        admin.table(
            "meeting_participants"
        )
        .select(
            "id",
            count="exact",
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .execute()
    )

    response = (
        admin.table(
            "meeting_participants"
        )
        .insert(
            {
                "meeting_id": meeting_id,
                "name": payload.name.strip(),
                "email": (
                    payload.email.strip()
                    if payload.email
                    else None
                ),
                "role": (
                    payload.role.strip()
                    if payload.role
                    else None
                ),
                "sort_order": int(
                    count_response.count
                    or 0
                ),
                "created_by": user.id,
            }
        )
        .select(
            "id,"
            "meeting_id,"
            "name,"
            "email,"
            "role,"
            "sort_order,"
            "created_by,"
            "created_at,"
            "updated_at"
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to create participant"
            ),
        )

    return response.data[0]


# ============================================================
# UPDATE PARTICIPANT
# ============================================================

@router.patch(
    "/{meeting_id}/participants/{participant_id}"
)
async def update_meeting_participant(
    meeting_id: str,
    participant_id: str,
    payload: MeetingParticipantUpdate,
    supabase: Client = Depends(
        get_supabase
    ),
    access_token: str = Depends(
        get_access_token
    ),
):

    user = _get_current_user(
        supabase,
        access_token,
    )

    admin = create_admin_supabase_client()

    meeting = _participant_meeting(
        admin,
        meeting_id,
    )

    if not _participant_editor(
        admin,
        meeting,
        user.id,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only the meeting creator "
                "or workspace owner can "
                "edit participants"
            ),
        )

    exists = (
        admin.table(
            "meeting_participants"
        )
        .select("id")
        .eq(
            "id",
            participant_id,
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .limit(1)
        .execute()
    )

    if not exists.data:
        raise HTTPException(
            status_code=404,
            detail="Participant not found",
        )

    updates = payload.model_dump(
        exclude_unset=True
    )

    if "name" in updates:
        updates["name"] = (
            updates["name"].strip()
        )

    if "email" in updates:
        updates["email"] = (
            updates["email"].strip()
            if updates["email"]
            else None
        )

    if "role" in updates:
        updates["role"] = (
            updates["role"].strip()
            if updates["role"]
            else None
        )

    response = (
        admin.table(
            "meeting_participants"
        )
        .update(updates)
        .eq(
            "id",
            participant_id,
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .select(
            "id,"
            "meeting_id,"
            "name,"
            "email,"
            "role,"
            "sort_order,"
            "created_by,"
            "created_at,"
            "updated_at"
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to update participant"
            ),
        )

    return response.data[0]


# ============================================================
# DELETE PARTICIPANT
# ============================================================

@router.delete(
    "/{meeting_id}/participants/{participant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_meeting_participant(
    meeting_id: str,
    participant_id: str,
    supabase: Client = Depends(
        get_supabase
    ),
    access_token: str = Depends(
        get_access_token
    ),
):

    user = _get_current_user(
        supabase,
        access_token,
    )

    admin = create_admin_supabase_client()

    meeting = _participant_meeting(
        admin,
        meeting_id,
    )

    if not _participant_editor(
        admin,
        meeting,
        user.id,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only the meeting creator "
                "or workspace owner can "
                "edit participants"
            ),
        )

    exists = (
        admin.table(
            "meeting_participants"
        )
        .select("id")
        .eq(
            "id",
            participant_id,
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .limit(1)
        .execute()
    )

    if not exists.data:
        raise HTTPException(
            status_code=404,
            detail="Participant not found",
        )

    (
        admin.table(
            "meeting_participants"
        )
        .delete()
        .eq(
            "id",
            participant_id,
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .execute()
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )