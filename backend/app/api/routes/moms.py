from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.security import get_supabase
from app.schemas.mom import (
    MOMResponse,
    MOMUpdate,
)


router = APIRouter(
    prefix="/api/v1/moms",
    tags=["MOMs"],
)

# ============================================================
# GET MOM BY MEETING
# ============================================================

@router.get(
    "/meeting/{meeting_id}",
    response_model=MOMResponse,
)
async def get_mom_by_meeting(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
):
    """
    Get the MOM associated with a meeting.
    """

    response = (
        supabase
        .table("moms")
        .select(
            """
            id,
            meeting_id,
            created_by,
            title,
            summary,
            transcript,
            key_discussion_points,
            decisions,
            next_steps,
            abbreviations_used,
            status,
            generated_at,
            created_at,
            updated_at
            """
        )
        .eq("meeting_id", meeting_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="MOM not found for this meeting",
        )

    return response.data[0]
# ============================================================
# GET MOM
# ============================================================

@router.get(
    "/{mom_id}",
    response_model=MOMResponse,
)
async def get_mom(
    mom_id: str,
    supabase: Client = Depends(get_supabase),
):
    """
    Get a single MOM by ID.

    RLS is enforced through the user-scoped Supabase client.
    """

    response = (
        supabase
        .table("moms")
        .select(
            """
            id,
            meeting_id,
            created_by,
            title,
            summary,
            transcript,
            key_discussion_points,
            decisions,
            next_steps,
            abbreviations_used,
            status,
            generated_at,
            created_at,
            updated_at
            """
        )
        .eq("id", mom_id)
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="MOM not found",
        )

    return response.data


# ============================================================
# UPDATE MOM
# ============================================================

@router.patch(
    "/{mom_id}",
    response_model=MOMResponse,
)
async def update_mom(
    mom_id: str,
    payload: MOMUpdate,
    supabase: Client = Depends(get_supabase),
):
    """
    Update an existing MOM.

    Draft and reviewed MOMs can be edited.
    Finalized MOMs are locked.
    """

    # --------------------------------------------------------
    # Get existing MOM
    # --------------------------------------------------------

    existing_response = (
        supabase
        .table("moms")
        .select(
            """
            id,
            meeting_id,
            created_by,
            title,
            summary,
            transcript,
            key_discussion_points,
            decisions,
            next_steps,
            abbreviations_used,
            status,
            generated_at,
            created_at,
            updated_at
            """
        )
        .eq("id", mom_id)
        .single()
        .execute()
    )

    if not existing_response.data:
        raise HTTPException(
            status_code=404,
            detail="MOM not found",
        )

    existing_mom = existing_response.data

    # --------------------------------------------------------
    # Prevent editing finalized MOM
    # --------------------------------------------------------

    if existing_mom["status"] == "finalized":
        raise HTTPException(
            status_code=409,
            detail="Finalized MOM cannot be edited",
        )

    # --------------------------------------------------------
    # Build update payload
    # --------------------------------------------------------

    update_data = payload.model_dump(
        exclude_unset=True
    )

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No fields provided for update",
        )

    # --------------------------------------------------------
    # Validate title
    # --------------------------------------------------------

    if "title" in update_data:

        title = update_data["title"]

        if not isinstance(title, str):
            raise HTTPException(
                status_code=400,
                detail="MOM title must be a string",
            )

        title = title.strip()

        if not title:
            raise HTTPException(
                status_code=400,
                detail="MOM title cannot be empty",
            )

        update_data["title"] = title

    # --------------------------------------------------------
    # Validate summary
    # --------------------------------------------------------

    if "summary" in update_data:

        summary = update_data["summary"]

        if summary is not None:

            if not isinstance(summary, str):
                raise HTTPException(
                    status_code=400,
                    detail="MOM summary must be a string",
                )

            update_data["summary"] = summary.strip()

    # --------------------------------------------------------
    # Validate list fields
    # --------------------------------------------------------

    for field in (
        "key_discussion_points",
        "decisions",
        "next_steps",
    ):

        if field not in update_data:
            continue

        value = update_data[field]

        if not isinstance(value, list):
            raise HTTPException(
                status_code=400,
                detail=f"{field} must be a list",
            )

        for index, item in enumerate(value):

            if not isinstance(item, str):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{field}[{index}] "
                        "must be a string"
                    ),
                )

            if not item.strip():
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{field}[{index}] "
                        "cannot be empty"
                    ),
                )

        update_data[field] = [
            item.strip()
            for item in value
        ]

    # --------------------------------------------------------
    # Validate abbreviations
    # --------------------------------------------------------

    if "abbreviations_used" in update_data:

        abbreviations = update_data[
            "abbreviations_used"
        ]

        if not isinstance(
            abbreviations,
            dict,
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "abbreviations_used "
                    "must be an object"
                ),
            )

        cleaned_abbreviations = {}

        for abbreviation, meaning in (
            abbreviations.items()
        ):

            if not isinstance(
                abbreviation,
                str,
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Abbreviation keys "
                        "must be strings"
                    ),
                )

            if not isinstance(
                meaning,
                str,
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Meaning for '{abbreviation}' "
                        "must be a string"
                    ),
                )

            abbreviation = abbreviation.strip()
            meaning = meaning.strip()

            if not abbreviation:
                raise HTTPException(
                    status_code=400,
                    detail="Abbreviation cannot be empty",
                )

            if not meaning:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Meaning for '{abbreviation}' "
                        "cannot be empty"
                    ),
                )

            cleaned_abbreviations[
                abbreviation
            ] = meaning

        update_data[
            "abbreviations_used"
        ] = cleaned_abbreviations

    # --------------------------------------------------------
    # Update database
    # --------------------------------------------------------

    updated_response = (
        supabase
        .table("moms")
        .update(update_data)
        .eq("id", mom_id)
        .execute()
    )

    if not updated_response.data:
        raise HTTPException(
            status_code=400,
            detail="Failed to update MOM",
        )

    return updated_response.data[0]


# ============================================================
# REVIEW MOM
# ============================================================

@router.post(
    "/{mom_id}/review",
    response_model=MOMResponse,
)
async def review_mom(
    mom_id: str,
    supabase: Client = Depends(get_supabase),
):
    """
    Mark a MOM as reviewed.

    draft -> reviewed

    Reviewed MOMs remain editable.
    Finalized MOMs cannot be reviewed.
    """

    # --------------------------------------------------------
    # Get existing MOM
    # --------------------------------------------------------

    existing_response = (
        supabase
        .table("moms")
        .select(
            """
            id,
            meeting_id,
            created_by,
            title,
            summary,
            transcript,
            key_discussion_points,
            decisions,
            next_steps,
            abbreviations_used,
            status,
            generated_at,
            created_at,
            updated_at
            """
        )
        .eq("id", mom_id)
        .single()
        .execute()
    )

    if not existing_response.data:
        raise HTTPException(
            status_code=404,
            detail="MOM not found",
        )

    existing_mom = existing_response.data

    # --------------------------------------------------------
    # Prevent reviewing finalized MOM
    # --------------------------------------------------------

    if existing_mom["status"] == "finalized":
        raise HTTPException(
            status_code=409,
            detail="Finalized MOM cannot be reviewed",
        )

    # --------------------------------------------------------
    # Mark as reviewed
    # --------------------------------------------------------

    response = (
        supabase
        .table("moms")
        .update(
            {
                "status": "reviewed",
            }
        )
        .eq("id", mom_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=400,
            detail="Failed to mark MOM as reviewed",
        )

    return response.data[0]


# ============================================================
# FINALIZE MOM
# ============================================================

@router.post(
    "/{mom_id}/finalize",
    response_model=MOMResponse,
)
async def finalize_mom(
    mom_id: str,
    supabase: Client = Depends(get_supabase),
):
    """
    Finalize a reviewed MOM.

    reviewed -> finalized

    Once finalized, the MOM becomes locked.
    """

    # --------------------------------------------------------
    # Get existing MOM
    # --------------------------------------------------------

    existing_response = (
        supabase
        .table("moms")
        .select(
            """
            id,
            meeting_id,
            created_by,
            title,
            summary,
            transcript,
            key_discussion_points,
            decisions,
            next_steps,
            abbreviations_used,
            status,
            generated_at,
            created_at,
            updated_at
            """
        )
        .eq("id", mom_id)
        .single()
        .execute()
    )

    if not existing_response.data:
        raise HTTPException(
            status_code=404,
            detail="MOM not found",
        )

    existing_mom = existing_response.data

    # --------------------------------------------------------
    # Validate current status
    # --------------------------------------------------------

    if existing_mom["status"] == "draft":
        raise HTTPException(
            status_code=409,
            detail=(
                "MOM must be reviewed before "
                "it can be finalized"
            ),
        )

    if existing_mom["status"] == "finalized":
        raise HTTPException(
            status_code=409,
            detail="MOM is already finalized",
        )

    if existing_mom["status"] != "reviewed":
        raise HTTPException(
            status_code=409,
            detail=(
                f"MOM cannot be finalized from "
                f"status '{existing_mom['status']}'"
            ),
        )

    # --------------------------------------------------------
    # Finalize MOM
    # --------------------------------------------------------

    response = (
        supabase
        .table("moms")
        .update(
            {
                "status": "finalized",
            }
        )
        .eq("id", mom_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=400,
            detail="Failed to finalize MOM",
        )

    return response.data[0]