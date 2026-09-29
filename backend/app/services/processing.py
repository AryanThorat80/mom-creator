import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any
import re

from supabase import Client

from app.core.config import get_settings
from app.services.mom_generator import generate_mom
from app.services.transcription import transcribe_audio


logger = logging.getLogger(__name__)
settings = get_settings()


# ============================================================
# CONSTANTS
# ============================================================

VALID_ACTION_ITEM_STATUSES = {
    "pending",
    "in_progress",
    "completed",
    "cancelled",
}

VALID_ACTION_ITEM_PRIORITIES = {
    "low",
    "medium",
    "high",
    "urgent",
}


AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".ogg",
    ".flac",
    ".webm",
}

VIDEO_EXTENSIONS = {
    ".mp4",
    ".mov",
    ".avi",
    ".mkv",
    ".m4v",
}

TEXT_EXTENSIONS = {
    ".txt",
    ".md",
    ".srt",
    ".vtt",
    ".json",
}


# ============================================================
# MAIN PROCESSOR
# ============================================================

async def process_job(
    supabase: Client,
    job_id: str,
):
    """
    Execute one processing job.

    Supported job types:

    1. transcription
       Primary meeting audio/video
       -> transcript

    2. mom_generation
       Existing transcript or direct text input
       -> structured MOM + action items

    3. export_generation
       Reserved for DOCX/XLSX export generation
    """

    logger.info(
        "Starting processing job: %s",
        job_id,
    )

    # --------------------------------------------------------
    # Load processing job
    # --------------------------------------------------------

    job_response = (
        supabase
        .table("processing_jobs")
        .select("*")
        .eq("id", job_id)
        .execute()
    )

    if not job_response.data:
        raise ValueError(
            "Processing job not found"
        )

    job = job_response.data[0]

    meeting_id = job["meeting_id"]
    job_type = job["job_type"]

    logger.info(
        "Processing job type: %s",
        job_type,
    )

    # --------------------------------------------------------
    # Process according to job type
    # --------------------------------------------------------

    try:

        # ----------------------------------------------------
        # Mark processing job as processing
        # ----------------------------------------------------

        supabase.rpc(
            "complete_processing_job",
            {
                "target_job_id": job_id,
                "target_status": "processing",
                "target_output_data": {},
                "target_error_message": None,
            },
        ).execute()

        # ----------------------------------------------------
        # Mark meeting as processing
        # ----------------------------------------------------

        supabase.table(
            "meetings"
        ).update(
            {
                "status": "processing",
            }
        ).eq(
            "id",
            meeting_id,
        ).execute()

        # ====================================================
        # TRANSCRIPTION
        # ====================================================

        if job_type == "transcription":

            return await process_transcription_job(
                supabase=supabase,
                job=job,
                job_id=job_id,
            )

        # ====================================================
        # MOM GENERATION
        # ====================================================

        if job_type == "mom_generation":

            return await process_mom_generation_job(
                supabase=supabase,
                job=job,
                job_id=job_id,
            )

        # ====================================================
        # EXPORT GENERATION
        # ====================================================

        if job_type == "export_generation":

            raise NotImplementedError(
                "Export generation is not implemented yet"
            )

        # ====================================================
        # UNKNOWN JOB TYPE
        # ====================================================

        raise ValueError(
            f"Unsupported processing job type: {job_type}"
        )

    except Exception as exc:

        logger.exception(
            "Processing job failed: %s",
            job_id,
        )

        # ----------------------------------------------------
        # Mark processing job as failed
        # ----------------------------------------------------

        try:

            supabase.rpc(
                "complete_processing_job",
                {
                    "target_job_id": job_id,
                    "target_status": "failed",
                    "target_output_data": {},
                    "target_error_message": str(exc),
                },
            ).execute()

        except Exception:

            logger.exception(
                "Failed to mark processing job as failed: %s",
                job_id,
            )

        # ----------------------------------------------------
        # Mark meeting as failed
        # ----------------------------------------------------

        try:

            supabase.table(
                "meetings"
            ).update(
                {
                    "status": "failed",
                }
            ).eq(
                "id",
                meeting_id,
            ).execute()

        except Exception:

            logger.exception(
                "Failed to mark meeting as failed: %s",
                meeting_id,
            )

        raise


# ============================================================
# TRANSCRIPTION JOB
# ============================================================

async def process_transcription_job(
    supabase: Client,
    job: dict[str, Any],
    job_id: str,
):
    """
    Process the primary meeting recording.

    Input:
        processing_jobs.input_file_path

    Supported:
        audio/*
        video/*

    Output:
        processing_jobs.output_data.transcript
    """

    meeting_id = job["meeting_id"]
    input_file_path = job.get("input_file_path")

    # --------------------------------------------------------
    # Validate input path
    # --------------------------------------------------------

    if not input_file_path:
        raise ValueError(
            "Transcription job requires input_file_path"
        )

    # --------------------------------------------------------
    # Determine storage bucket
    # --------------------------------------------------------

    bucket = get_bucket_from_file_path(
        input_file_path
    )

    logger.info(
        "Transcribing meeting input: %s",
        input_file_path,
    )

    logger.info(
        "Using storage bucket: %s",
        bucket,
    )

    # --------------------------------------------------------
    # Transcription
    # --------------------------------------------------------

    transcript = await transcribe_audio(
        supabase=supabase,
        bucket=bucket,
        path=input_file_path,
    )

    # --------------------------------------------------------
    # Validate transcript
    # --------------------------------------------------------

    transcript = validate_transcript(
        transcript
    )

    logger.info(
        "Transcription completed for job: %s",
        job_id,
    )

    # --------------------------------------------------------
    # Store transcript in processing job
    # --------------------------------------------------------

    output_data = {
        "transcript": transcript,
        "source": "meeting_input",
        "input_file_path": input_file_path,
    }

    supabase.rpc(
        "complete_processing_job",
        {
            "target_job_id": job_id,
            "target_status": "completed",
            "target_output_data": output_data,
            "target_error_message": None,
        },
    ).execute()

    # --------------------------------------------------------
    # Do NOT mark meeting completed here
    #
    # The meeting still needs MOM generation.
    # --------------------------------------------------------

    logger.info(
        "Transcription job completed: %s",
        job_id,
    )

    return {
        "job_id": job_id,
        "meeting_id": meeting_id,
        "status": "completed",
        "transcript_length": len(transcript),
    }


# ============================================================
# MOM GENERATION JOB
# ============================================================

async def process_mom_generation_job(
    supabase: Client,
    job: dict[str, Any],
    job_id: str,
):
    """
    Generate a MOM from:

    1. The latest completed transcription job
       OR
    2. A direct text input_file_path

    Related attachments are contextual information.
    They are NOT treated as the primary meeting recording.
    """

    meeting_id = job["meeting_id"]

        # --------------------------------------------------------
    # Load meeting date for action-item date resolution
    # --------------------------------------------------------

    meeting_response = (
        supabase
        .table("meetings")
        .select("meeting_date")
        .eq("id", meeting_id)
        .execute()
    )

    if not meeting_response.data:
        raise ValueError(
            "Meeting not found while generating MOM"
        )

    meeting_date = meeting_response.data[0].get(
        "meeting_date"
    )

    logger.info(
        "Meeting date used for action-item due dates: %s",
        meeting_date,
    )

    # --------------------------------------------------------
    # Prevent duplicate MOM generation
    # --------------------------------------------------------
    # One meeting is allowed to have one MOM.
    # The database also enforces UNIQUE(meeting_id), but this
    # check prevents unnecessary LLM calls when a MOM already
    # exists for the meeting.

    existing_mom_response = (
        supabase
        .table("moms")
        .select("id,status")
        .eq("meeting_id", meeting_id)
        .execute()
    )

    if existing_mom_response.data:

        existing_mom = existing_mom_response.data[0]
        existing_mom_id = existing_mom["id"]

        logger.info(
            "MOM already exists for meeting %s: %s. "
            "Skipping LLM generation.",
            meeting_id,
            existing_mom_id,
        )

        # The requested job is still completed because there is
        # already a valid MOM for this meeting.
        supabase.rpc(
            "complete_processing_job",
            {
                "target_job_id": job_id,
                "target_status": "completed",
                "target_output_data": {
                    "mom_id": existing_mom_id,
                    "already_exists": True,
                },
                "target_error_message": None,
            },
        ).execute()

        supabase.table(
            "meetings"
        ).update({
            "status": "completed",
        }).eq(
            "id",
            meeting_id,
        ).execute()

        return {
            "job_id": job_id,
            "meeting_id": meeting_id,
            "mom_id": existing_mom_id,
            "status": "completed",
            "already_exists": True,
        }

    # --------------------------------------------------------
    # Find transcript
    # --------------------------------------------------------

    transcript = None
    transcript_source = None

    # --------------------------------------------------------
    # First preference:
    # latest completed transcription job
    # --------------------------------------------------------

    transcription_response = (
        supabase
        .table("processing_jobs")
        .select(
            """
            id,
            output_data,
            created_at
            """
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .eq(
            "job_type",
            "transcription",
        )
        .eq(
            "status",
            "completed",
        )
        .order(
            "created_at",
            desc=True,
        )
        .limit(1)
        .execute()
    )

    if transcription_response.data:

        transcription_job = (
            transcription_response.data[0]
        )

        output_data = (
            transcription_job.get(
                "output_data"
            )
            or {}
        )

        stored_transcript = output_data.get(
            "transcript"
        )

        if stored_transcript:

            transcript = validate_transcript(
                stored_transcript
            )

            transcript_source = (
                "transcription_job"
            )

    # --------------------------------------------------------
    # Second preference:
    # direct text input
    #
    # Useful for testing and future text/import flows.
    # --------------------------------------------------------

    if not transcript:

        input_file_path = job.get(
            "input_file_path"
        )

        if input_file_path:

            transcript = await load_text_input(
                supabase=supabase,
                path=input_file_path,
            )

            transcript = validate_transcript(
                transcript
            )

            transcript_source = (
                "text_file"
            )

    # --------------------------------------------------------
    # Nothing available
    # --------------------------------------------------------

    if not transcript:

        raise ValueError(
            "No transcript available for MOM generation"
        )

    logger.info(
        "MOM generation using transcript source: %s",
        transcript_source,
    )

    # --------------------------------------------------------
    # Generate MOM
    # --------------------------------------------------------

    logger.info(
        "Generating MOM for job: %s",
        job_id,
    )

    mom_result = await generate_mom(
        transcript=transcript,
        target_language=(
            settings.mom_default_language
        ),
    )

    # --------------------------------------------------------
    # Validate AI output
    # --------------------------------------------------------

    validate_mom_result(
        mom_result
    )

    # --------------------------------------------------------
    # Validate action items
    # --------------------------------------------------------

    action_items = mom_result.get(
        "action_items",
        [],
    )

    validate_action_items(
        action_items
    )

    # Normalize AI-generated due dates before inserting into
    # PostgreSQL action_items.due_date (timestamptz).
    for item in action_items:
        item["due_date"] = normalize_due_date(
            item.get("due_date")
        )

    logger.info(
        "MOM generated and validated for job: %s",
        job_id,
    )

    # --------------------------------------------------------
    # Save MOM
    # --------------------------------------------------------

    try:

        mom_response = (
            supabase
            .table("moms")
            .insert({
                "meeting_id": meeting_id,
                "created_by": job["created_by"],
                "title": mom_result["title"].strip(),
                "summary": mom_result["summary"].strip(),
                "transcript": transcript,
                "key_discussion_points": (
                    mom_result[
                        "key_discussion_points"
                    ]
                ),
                "decisions": (
                    mom_result["decisions"]
                ),
                "next_steps": (
                    mom_result["next_steps"]
                ),
                "abbreviations_used": (
                    mom_result[
                        "abbreviations_used"
                    ]
                ),
                "status": "draft",
                "generated_at": (
                    datetime.now(
                        timezone.utc
                    ).isoformat()
                ),
            })
            .select("id")
            .execute()
        )

    except Exception as exc:

        # Two generation jobs can theoretically pass the
        # existence check at the same time. The database UNIQUE
        # constraint remains the final guard. If it rejects this
        # insert, reuse the MOM that won the race.
        error_code = getattr(exc, "code", None)
        error_text = str(exc).lower()
        is_duplicate_mom = (
            error_code == "23505"
            or "unique_mom_per_meeting" in error_text
            or "duplicate key value" in error_text
        )

        if not is_duplicate_mom:
            raise

        logger.warning(
            "A MOM already exists for meeting %s after a concurrent "
            "generation attempt. Reusing existing MOM.",
            meeting_id,
        )

        existing_mom_response = (
            supabase
            .table("moms")
            .select("id,status")
            .eq("meeting_id", meeting_id)
            .execute()
        )

        if not existing_mom_response.data:
            raise ValueError(
                "MOM creation hit a duplicate constraint, "
                "but the existing MOM could not be found"
            ) from exc

        mom_id = existing_mom_response.data[0]["id"]

        supabase.rpc(
            "complete_processing_job",
            {
                "target_job_id": job_id,
                "target_status": "completed",
                "target_output_data": {
                    "mom_id": mom_id,
                    "already_exists": True,
                    "concurrent_generation": True,
                },
                "target_error_message": None,
            },
        ).execute()

        supabase.table(
            "meetings"
        ).update({
            "status": "completed",
        }).eq(
            "id",
            meeting_id,
        ).execute()

        return {
            "job_id": job_id,
            "meeting_id": meeting_id,
            "mom_id": mom_id,
            "status": "completed",
            "already_exists": True,
            "concurrent_generation": True,
        }

    if not mom_response.data:

        raise ValueError(
            "Failed to create MOM"
        )

    mom_id = mom_response.data[0]["id"]

    # --------------------------------------------------------
    # Save action items
    # --------------------------------------------------------

    for item in action_items:

        normalized_due_date = normalize_due_date(
            item.get("due_date"),
            meeting_date=meeting_date,
        )

        logger.info(
            "Action item due date: raw=%r normalized=%r",
            item.get("due_date"),
            normalized_due_date,
        )

        supabase.table(
            "action_items"
        ).insert({
            "mom_id": mom_id,
            "meeting_id": meeting_id,
            "created_by": job["created_by"],
            "task": item["task"].strip(),
            "assigned_to": item.get(
                "assigned_to"
            ),
            "assigned_name": item.get(
                "assigned_name"
            ),
            "due_date": normalized_due_date,
            "status": item.get(
                "status",
                "pending",
            ),
            "priority": item.get(
                "priority",
                "medium",
            ),
        }).execute()

    logger.info(
        "Saved MOM and %s action items for job: %s",
        len(action_items),
        job_id,
    )

    # --------------------------------------------------------
    # Complete processing job
    # --------------------------------------------------------

    supabase.rpc(
        "complete_processing_job",
        {
            "target_job_id": job_id,
            "target_status": "completed",
            "target_output_data": {
                "mom_id": mom_id,
                "action_items_count": len(
                    action_items
                ),
                "transcript_source": (
                    transcript_source
                ),
            },
            "target_error_message": None,
        },
    ).execute()

    # --------------------------------------------------------
    # Mark meeting as completed
    # --------------------------------------------------------

    supabase.table(
        "meetings"
    ).update({
        "status": "completed",
    }).eq(
        "id",
        meeting_id,
    ).execute()

    logger.info(
        "MOM generation job completed: %s",
        job_id,
    )

    return {
        "job_id": job_id,
        "meeting_id": meeting_id,
        "mom_id": mom_id,
        "status": "completed",
        "action_items_count": len(
            action_items
        ),
    }


# ============================================================
# TEXT INPUT LOADER
# ============================================================

async def load_text_input(
    supabase: Client,
    path: str,
) -> str:
    """
    Load a text-based input from Supabase Storage.

    This currently supports plain text formats.

    Document extraction for PDF, DOCX, XLSX, PPTX, etc.
    will be added separately.
    """

    suffix = Path(path).suffix.lower()

    if suffix not in TEXT_EXTENSIONS:

        raise ValueError(
            "Direct text MOM input must be a supported "
            f"text file. Received: {suffix or 'unknown'}"
        )

    logger.info(
        "Downloading text input: %s",
        path,
    )

    file_bytes = (
        supabase.storage
        .from_("meeting-files")
        .download(path)
    )

    if not file_bytes:

        raise ValueError(
            "Unable to download text input"
        )

    try:

        text = file_bytes.decode(
            "utf-8-sig"
        )

    except UnicodeDecodeError as exc:

        raise ValueError(
            "Text input is not valid UTF-8"
        ) from exc

    text = text.strip()

    if not text:

        raise ValueError(
            "Text input is empty"
        )

    return text


# ============================================================
# STORAGE BUCKET HELPERS
# ============================================================

def get_bucket_from_file_path(
    path: str,
) -> str:
    """
    Determine the meeting recording bucket from
    the file extension.
    """

    suffix = Path(path).suffix.lower()

    if suffix in VIDEO_EXTENSIONS:

        return "meeting-video"

    if suffix in AUDIO_EXTENSIONS:

        return "meeting-audio"

    raise ValueError(
        "Unsupported meeting recording format: "
        f"{suffix or 'unknown'}"
    )


def get_bucket_from_file_type(
    file_type: str | None,
) -> str:
    """
    Determine a storage bucket from a MIME type.

    Kept available for future attachment/document
    processing.
    """

    if not file_type:

        return "meeting-files"

    if file_type.startswith(
        "audio/"
    ):

        return "meeting-audio"

    if file_type.startswith(
        "video/"
    ):

        return "meeting-video"

    return "meeting-files"


# ============================================================
# TRANSCRIPTION VALIDATION
# ============================================================

def validate_transcription_file_type(
    file_type: str | None,
) -> None:
    """
    Validate that a MIME type represents
    audio or video.

    Kept for attachment-based media validation.
    """

    if not file_type:

        raise ValueError(
            "Meeting recording file type is missing"
        )

    if not (
        file_type.startswith("audio/")
        or file_type.startswith("video/")
    ):

        raise ValueError(
            "Meeting recording must be an "
            "audio or video file"
        )


def validate_transcript(
    transcript: str | None,
) -> str:
    """
    Validate transcription/text before it reaches
    the MOM generator.
    """

    if transcript is None:

        raise ValueError(
            "Transcript returned no result"
        )

    if not isinstance(
        transcript,
        str,
    ):

        raise ValueError(
            "Transcript must be a string"
        )

    transcript = transcript.strip()

    if len(transcript) < 20:

        raise ValueError(
            "Transcript is too short"
        )

    return transcript

IST = timezone(
    timedelta(hours=5, minutes=30)
)


WEEKDAYS = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)


def normalize_due_date(
    value: str | None,
    meeting_date: str | datetime | None = None,
) -> str | None:
    """
    Convert an AI-generated action-item due date into
    an ISO-8601 timestamp suitable for PostgreSQL timestamptz.

    Date-only / month-day values are resolved using the
    meeting year instead of the server's current year.
    """

    if value is None:
        return None

    if not isinstance(value, str):
        raise ValueError(
            f"Action item due_date must be a string or null, "
            f"got {type(value).__name__}"
        )

    value = value.strip()

    if not value:
        return None

    # --------------------------------------------------------
    # Determine the meeting year
    # --------------------------------------------------------

    base_year = datetime.now(timezone.utc).year

    if meeting_date:
        if isinstance(meeting_date, datetime):
            base_year = meeting_date.year
        elif isinstance(meeting_date, str):
            normalized_meeting_date = meeting_date.replace(
                "Z",
                "+00:00",
            )

            try:
                parsed_meeting_date = datetime.fromisoformat(
                    normalized_meeting_date
                )
                base_year = parsed_meeting_date.year
            except ValueError:
                pass

    # --------------------------------------------------------
    # 1. Already ISO-8601
    # --------------------------------------------------------

    normalized = value.replace("Z", "+00:00")

    try:
        parsed = datetime.fromisoformat(normalized)

        if parsed.tzinfo is None:
            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        return parsed.isoformat()

    except ValueError:
        pass

    # --------------------------------------------------------
    # 2. Remove weekday
    #
    # Example:
    # Wednesday, September 30
    # --------------------------------------------------------

    weekday_pattern = (
        r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"
        r"\s*,\s*"
    )

    cleaned = re.sub(
        weekday_pattern,
        "",
        value,
        flags=re.IGNORECASE,
    ).strip()

    # --------------------------------------------------------
    # 3. Full date with year
    # --------------------------------------------------------

    for fmt in (
        "%B %d, %Y",
        "%b %d, %Y",
        "%B %d %Y",
        "%b %d %Y",
    ):
        try:
            parsed = datetime.strptime(
                cleaned,
                fmt,
            )

            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

            return parsed.isoformat()

        except ValueError:
            continue

    # --------------------------------------------------------
    # 4. Month + day without year
    #
    # IMPORTANT:
    # Use meeting year, NOT current year.
    # --------------------------------------------------------

    for fmt in (
        "%B %d",
        "%b %d",
    ):
        try:
            parsed = datetime.strptime(
                cleaned,
                fmt,
            )

            parsed = parsed.replace(
                year=base_year,
                tzinfo=timezone.utc,
            )

            return parsed.isoformat()

        except ValueError:
            continue

    raise ValueError(
        f"Unsupported action item due_date format: {value!r}"
    )

# ============================================================
# MOM VALIDATION
# ============================================================

def validate_mom_result(
    mom_result: dict,
) -> None:

    if not isinstance(
        mom_result,
        dict,
    ):

        raise ValueError(
            "MOM generator returned invalid output"
        )

    required_fields = {
        "title",
        "summary",
        "key_discussion_points",
        "decisions",
        "next_steps",
        "abbreviations_used",
        "action_items",
    }

    missing_fields = (
        required_fields
        - mom_result.keys()
    )

    if missing_fields:

        raise ValueError(
            "MOM output is missing required fields: "
            + ", ".join(
                sorted(missing_fields)
            )
        )

    # --------------------------------------------------------
    # Title
    # --------------------------------------------------------

    if not isinstance(
        mom_result["title"],
        str,
    ):

        raise ValueError(
            "MOM title must be a string"
        )

    if not mom_result["title"].strip():

        raise ValueError(
            "MOM title cannot be empty"
        )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    if not isinstance(
        mom_result["summary"],
        str,
    ):

        raise ValueError(
            "MOM summary must be a string"
        )

    if not mom_result["summary"].strip():

        raise ValueError(
            "MOM summary cannot be empty"
        )

    # --------------------------------------------------------
    # Discussion points
    # --------------------------------------------------------

    validate_string_list(
        mom_result[
            "key_discussion_points"
        ],
        "key_discussion_points",
    )

    # --------------------------------------------------------
    # Decisions
    # --------------------------------------------------------

    validate_string_list(
        mom_result[
            "decisions"
        ],
        "decisions",
    )

    # --------------------------------------------------------
    # Next steps
    # --------------------------------------------------------

    validate_string_list(
        mom_result[
            "next_steps"
        ],
        "next_steps",
    )

    # --------------------------------------------------------
    # Abbreviations
    # --------------------------------------------------------

    if not isinstance(
        mom_result[
            "abbreviations_used"
        ],
        dict,
    ):

        raise ValueError(
            "abbreviations_used must be an object"
        )

    for abbreviation, meaning in (
        mom_result[
            "abbreviations_used"
        ].items()
    ):

        if not isinstance(
            abbreviation,
            str,
        ):

            raise ValueError(
                "Abbreviation keys must be strings"
            )

        if not abbreviation.strip():

            raise ValueError(
                "Abbreviation key cannot be empty"
            )

        if not isinstance(
            meaning,
            str,
        ):

            raise ValueError(
                f"Meaning for '{abbreviation}' "
                "must be a string"
            )

        if not meaning.strip():

            raise ValueError(
                f"Meaning for '{abbreviation}' "
                "cannot be empty"
            )

    # --------------------------------------------------------
    # Action items
    # --------------------------------------------------------

    if not isinstance(
        mom_result["action_items"],
        list,
    ):

        raise ValueError(
            "action_items must be a list"
        )


# ============================================================
# STRING LIST VALIDATION
# ============================================================

def validate_string_list(
    value: Any,
    field_name: str,
) -> None:

    if not isinstance(
        value,
        list,
    ):

        raise ValueError(
            f"{field_name} must be a list"
        )

    for index, item in enumerate(
        value
    ):

        if not isinstance(
            item,
            str,
        ):

            raise ValueError(
                f"{field_name}[{index}] "
                "must be a string"
            )

        if not item.strip():

            raise ValueError(
                f"{field_name}[{index}] "
                "cannot be empty"
            )


# ============================================================
# ACTION ITEM VALIDATION
# ============================================================

def validate_action_items(
    action_items: list,
) -> None:

    if not isinstance(
        action_items,
        list,
    ):

        raise ValueError(
            "action_items must be a list"
        )

    for index, item in enumerate(
        action_items
    ):

        # ----------------------------------------------------
        # Object
        # ----------------------------------------------------

        if not isinstance(
            item,
            dict,
        ):

            raise ValueError(
                f"Action item {index + 1} "
                "must be an object"
            )

        # ----------------------------------------------------
        # Task
        # ----------------------------------------------------

        task = item.get(
            "task"
        )

        if not isinstance(
            task,
            str,
        ):

            raise ValueError(
                f"Action item {index + 1} "
                "task must be a string"
            )

        if not task.strip():

            raise ValueError(
                f"Action item {index + 1} "
                "task cannot be empty"
            )

        # ----------------------------------------------------
        # Status
        # ----------------------------------------------------

        status = item.get(
            "status",
            "pending",
        )

        if status not in (
            VALID_ACTION_ITEM_STATUSES
        ):

            raise ValueError(
                f"Action item {index + 1} "
                f"has invalid status: {status}"
            )

        # ----------------------------------------------------
        # Priority
        # ----------------------------------------------------

        priority = item.get(
            "priority",
            "medium",
        )

        if priority not in (
            VALID_ACTION_ITEM_PRIORITIES
        ):

            raise ValueError(
                f"Action item {index + 1} "
                f"has invalid priority: {priority}"
            )

        # ----------------------------------------------------
        # assigned_to
        # ----------------------------------------------------

        assigned_to = item.get(
            "assigned_to"
        )

        if assigned_to is not None:

            if not isinstance(
                assigned_to,
                str,
            ):

                raise ValueError(
                    f"Action item {index + 1} "
                    "assigned_to must be a UUID string "
                    "or null"
                )

            if not assigned_to.strip():

                raise ValueError(
                    f"Action item {index + 1} "
                    "assigned_to cannot be empty"
                )

        # ----------------------------------------------------
        # assigned_name
        # ----------------------------------------------------

        assigned_name = item.get(
            "assigned_name"
        )

        if assigned_name is not None:

            if not isinstance(
                assigned_name,
                str,
            ):

                raise ValueError(
                    f"Action item {index + 1} "
                    "assigned_name must be a string "
                    "or null"
                )

            if not assigned_name.strip():

                raise ValueError(
                    f"Action item {index + 1} "
                    "assigned_name cannot be empty"
                )

        # ----------------------------------------------------
        # due_date
        # ----------------------------------------------------

        due_date = item.get(
            "due_date"
        )

        if due_date is not None:

            if not isinstance(
                due_date,
                str,
            ):

                raise ValueError(
                    f"Action item {index + 1} "
                    "due_date must be a string "
                    "or null"
                )

            if not due_date.strip():

                raise ValueError(
                    f"Action item {index + 1} "
                    "due_date cannot be empty"
                )