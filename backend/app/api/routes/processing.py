from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
)
from supabase import Client

from app.core.security import (
    get_access_token,
    get_supabase,
)
from app.schemas.processing import (
    ProcessingJobCreate,
    ProcessingJobResponse,
    ProcessingJobType,
)
from app.services.processing import (
    process_job,
)
from app.services.supabase import (
    create_admin_supabase_client,
)


router = APIRouter(
    prefix="/api/v1/processing",
    tags=["Processing"],
)


# ============================================================
# CONSTANTS
# ============================================================

JOB_SELECT_FIELDS = """
    id,
    meeting_id,
    created_by,
    job_type,
    status,
    error_message,
    input_file_path,
    output_data,
    source_attachment_id,
    output_mom_id,
    started_at,
    completed_at,
    created_at,
    updated_at
"""


# ============================================================
# AUTHENTICATION HELPER
# ============================================================

def get_authenticated_user(
    supabase: Client,
    access_token: str,
):
    """
    Validate the supplied Supabase access token and return
    the authenticated user.
    """

    try:
        auth_response = supabase.auth.get_user(
            access_token
        )
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication token: {exc}",
        )

    user = auth_response.user

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )

    return user


# ============================================================
# MEETING VALIDATION
# ============================================================

def get_meeting_for_processing(
    supabase: Client,
    meeting_id: str,
) -> dict:
    """
    Load a meeting using the authenticated Supabase client.

    RLS ensures the authenticated user can only see meetings
    they are authorized to access.
    """

    response = (
        supabase
        .table("meetings")
        .select(
            "id,workspace_id"
        )
        .eq(
            "id",
            meeting_id,
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    return response.data[0]


# ============================================================
# SOURCE ATTACHMENT VALIDATION
# ============================================================

def validate_source_attachment(
    supabase: Client,
    attachment_id: str,
    meeting_id: str,
) -> None:
    """
    Verify that a supplied source attachment exists and belongs
    to the same meeting.

    This does NOT mean the attachment is the primary meeting
    recording. It simply validates the relationship supplied
    with the processing job.
    """

    response = (
        supabase
        .table("attachments")
        .select(
            "id,meeting_id"
        )
        .eq(
            "id",
            attachment_id,
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Source attachment not found",
        )

    attachment = response.data[0]

    if attachment["meeting_id"] != meeting_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Source attachment does not belong "
                "to this meeting"
            ),
        )


# ============================================================
# STORAGE PATH VALIDATION
# ============================================================

def validate_input_file_path(
    path: str,
    meeting: dict,
) -> None:
    """
    Ensure the supplied input path belongs to the current
    meeting's workspace/meeting directory.

    Expected format:

        workspace_id/meeting_id/filename
    """

    path = path.strip()

    if not path:
        raise HTTPException(
            status_code=400,
            detail="input_file_path cannot be empty",
        )

    expected_prefix = (
        f"{meeting['workspace_id']}/"
        f"{meeting['id']}/"
    )

    if not path.startswith(
        expected_prefix
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid input file path",
        )

    # Prevent the path from ending directly at the directory.
    relative_part = path[
        len(expected_prefix):
    ]

    if not relative_part:
        raise HTTPException(
            status_code=400,
            detail="Input file name is missing",
        )

    # Prevent obvious path traversal.
    if (
        ".." in relative_part.split("/")
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid input file path",
        )


# ============================================================
# CREATE PROCESSING JOB
# ============================================================

@router.post(
    "",
    response_model=ProcessingJobResponse,
    status_code=201,
)
async def create_processing_job(
    payload: ProcessingJobCreate,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    """
    Create a queued processing job.

    Job types:

    transcription
        Primary audio/video meeting input.

    mom_generation
        Generate a MOM from an existing transcript or
        direct text input.

    export_generation
        Generate an export from an existing MOM.
    """

    # --------------------------------------------------------
    # Authenticate user
    # --------------------------------------------------------

    user = get_authenticated_user(
        supabase,
        access_token,
    )

    # --------------------------------------------------------
    # Validate meeting
    # --------------------------------------------------------

    meeting = get_meeting_for_processing(
        supabase,
        payload.meeting_id,
    )

    # --------------------------------------------------------
    # Validate input path when supplied
    # --------------------------------------------------------

    if payload.input_file_path:
        validate_input_file_path(
            payload.input_file_path,
            meeting,
        )

    # --------------------------------------------------------
    # Validate source attachment when supplied
    # --------------------------------------------------------

    if payload.source_attachment_id:
        validate_source_attachment(
            supabase,
            payload.source_attachment_id,
            payload.meeting_id,
        )

    # --------------------------------------------------------
    # Job-type-specific validation
    # --------------------------------------------------------

    if (
        payload.job_type
        == ProcessingJobType.TRANSCRIPTION
    ):
        if not payload.input_file_path:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Transcription jobs require "
                    "input_file_path"
                ),
            )

    elif (
        payload.job_type
        == ProcessingJobType.MOM_GENERATION
    ):
        # A MOM-generation job may obtain its transcript
        # from a previously completed transcription job.
        #
        # input_file_path is therefore optional.
        #
        # If present, the current worker treats it as direct
        # text input for now.

        pass

    elif (
        payload.job_type
        == ProcessingJobType.EXPORT_GENERATION
    ):
        # Export generation is not implemented yet.
        # We still allow the database job to be created so
        # the API contract remains aligned with the enum.

        pass

    # --------------------------------------------------------
    # Create processing job
    # --------------------------------------------------------

    try:

        response = (
            supabase
            .table("processing_jobs")
            .insert({
                "meeting_id": payload.meeting_id,
                "created_by": user.id,
                "job_type": payload.job_type.value,
                "input_file_path": (
                    payload.input_file_path
                ),
                "source_attachment_id": (
                    payload.source_attachment_id
                ),
                "status": "queued",
            })
            .select(
                JOB_SELECT_FIELDS
            )
            .execute()
        )

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                "Failed to create processing job: "
                f"{exc}"
            ),
        )

    if not response.data:
        raise HTTPException(
            status_code=500,
            detail=(
                "Processing job was created "
                "but no data was returned"
            ),
        )

    return response.data[0]


# ============================================================
# GET PROCESSING JOB
# ============================================================

@router.get(
    "/{job_id}",
    response_model=ProcessingJobResponse,
)
async def get_processing_job(
    job_id: str,
    supabase: Client = Depends(get_supabase),
):
    """
    Return a processing job visible to the authenticated user.

    RLS controls which processing jobs can be read.
    """

    response = (
        supabase
        .table("processing_jobs")
        .select(
            JOB_SELECT_FIELDS
        )
        .eq(
            "id",
            job_id,
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Processing job not found",
        )

    return response.data[0]


# ============================================================
# RUN PROCESSING JOB
# ============================================================

@router.post(
    "/{job_id}/run",
)
async def run_processing_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    """
    Start a queued processing job.

    The request itself is authenticated and ownership checked
    using the user's Supabase session.

    Actual processing runs in the trusted backend using the
    service-role client.
    """

    # --------------------------------------------------------
    # Authenticate user
    # --------------------------------------------------------

    user = get_authenticated_user(
        supabase,
        access_token,
    )

    # --------------------------------------------------------
    # Load processing job
    # --------------------------------------------------------

    response = (
        supabase
        .table("processing_jobs")
        .select(
            """
            id,
            meeting_id,
            created_by,
            job_type,
            status
            """
        )
        .eq(
            "id",
            job_id,
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Processing job not found",
        )

    job = response.data[0]

    # --------------------------------------------------------
    # Validate ownership
    # --------------------------------------------------------

    if job["created_by"] != user.id:
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not own this processing job"
            ),
        )

    # --------------------------------------------------------
    # Validate status
    # --------------------------------------------------------

    if job["status"] != "queued":
        raise HTTPException(
            status_code=409,
            detail=(
                "Processing job is already "
                f"{job['status']}"
            ),
        )

    # --------------------------------------------------------
    # Create trusted backend client
    # --------------------------------------------------------

    admin_supabase = (
        create_admin_supabase_client()
    )

    # --------------------------------------------------------
    # Start background processing
    # --------------------------------------------------------

    background_tasks.add_task(
        process_job,
        admin_supabase,
        job_id,
    )

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Processing started",
    }