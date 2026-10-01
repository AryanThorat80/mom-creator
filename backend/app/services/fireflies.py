import logging
import secrets
from datetime import datetime, timezone
from typing import Any

import httpx
from cryptography.fernet import Fernet
from supabase import Client

from app.core.config import get_settings
from app.services.processing import process_job


logger = logging.getLogger(__name__)

settings = get_settings()

FIREFLIES_GRAPHQL_URL = (
    "https://api.fireflies.ai/graphql"
)


# ============================================================
# ENCRYPTION
# ============================================================

def _fernet() -> Fernet:
    key = settings.fireflies_encryption_key.strip()

    if not key:
        raise RuntimeError(
            "FIREFLIES_ENCRYPTION_KEY is required"
        )

    try:
        return Fernet(key.encode("ascii"))
    except Exception as exc:
        raise RuntimeError(
            "FIREFLIES_ENCRYPTION_KEY is not a valid Fernet key"
        ) from exc


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(
        value.encode("utf-8")
    ).decode("utf-8")


def decrypt_secret(value: str) -> str:
    return _fernet().decrypt(
        value.encode("utf-8")
    ).decode("utf-8")


# ============================================================
# FIRELIES GRAPHQL
# ============================================================

async def fireflies_graphql(
    api_key: str,
    query: str,
    variables: dict[str, Any] | None = None,
) -> dict[str, Any]:

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "query": query,
        "variables": variables or {},
    }

    async with httpx.AsyncClient(
        timeout=30
    ) as client:

        response = await client.post(
            FIREFLIES_GRAPHQL_URL,
            headers=headers,
            json=payload,
        )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Fireflies API HTTP "
            f"{response.status_code}: "
            f"{response.text[:1000]}"
        )

    data = response.json()

    errors = data.get("errors") or []

    if errors:
        messages = []

        for error in errors:
            if isinstance(error, dict):
                messages.append(
                    str(
                        error.get("message")
                        or error
                    )
                )
            else:
                messages.append(str(error))

        raise RuntimeError(
            "Fireflies API error: "
            + "; ".join(messages)
        )

    return data.get("data") or {}


# ============================================================
# VALIDATE API KEY
# ============================================================

async def validate_api_key(
    api_key: str,
) -> str:

    data = await fireflies_graphql(
        api_key,
        """
        query {
            user {
                email
            }
        }
        """,
    )

    user = data.get("user") or {}

    email = user.get("email")

    if not email:
        raise RuntimeError(
            "Fireflies did not return a user email"
        )

    return email


# ============================================================
# TRANSCRIPT LIST
# ============================================================

async def list_recent_transcripts(
    api_key: str,
    limit: int = 10,
) -> list[dict[str, Any]]:

    data = await fireflies_graphql(
        api_key,
        """
        query Transcripts(
            $limit: Int
            $skip: Int
            $mine: Boolean
        ) {
            transcripts(
                limit: $limit
                skip: $skip
                mine: $mine
            ) {
                id
                title
                date
                duration
                organizer_email
                participants
                transcript_url
            }
        }
        """,
        {
            "limit": limit,
            "skip": 0,
            "mine": True,
        },
    )

    return data.get("transcripts") or []


# ============================================================
# FULL TRANSCRIPT
# ============================================================

async def fetch_transcript(
    api_key: str,
    transcript_id: str,
) -> dict[str, Any]:

    data = await fireflies_graphql(
        api_key,
        """
        query GetTranscript($id: ID!) {
            transcript(id: $id) {
                id
                title
                organizer_email
                transcript_url
                participants
                duration
                dateString
                meeting_link

                speakers {
                    id
                    name
                }

                sentences {
                    index
                    text
                    raw_text
                    start_time
                    end_time
                    speaker_id
                    speaker_name
                }
            }
        }
        """,
        {"id": transcript_id},
    )

    transcript = data.get("transcript")

    if not transcript:
        raise RuntimeError(
            f"Transcript {transcript_id} was not found"
        )

    return transcript


# ============================================================
# TRANSCRIPT TEXT
# ============================================================

def build_transcript_text(
    transcript: dict[str, Any],
) -> str:

    lines = []

    for sentence in (
        transcript.get("sentences") or []
    ):

        if not isinstance(sentence, dict):
            continue

        speaker = (
            sentence.get("speaker_name")
            or "Speaker"
        )

        text = (
            sentence.get("text")
            or sentence.get("raw_text")
            or ""
        ).strip()

        if text:
            lines.append(
                f"{speaker}: {text}"
            )

    return "\n".join(lines).strip()


# ============================================================
# DATE
# ============================================================

def parse_fireflies_date(
    value: str | None,
) -> str | None:

    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )

        if parsed.tzinfo is None:
            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        return parsed.isoformat()

    except ValueError:
        logger.warning(
            "Unable to parse Fireflies date: %s",
            value,
        )

        return None


# ============================================================
# PARTICIPANTS
# ============================================================

def build_participant_rows(
    transcript: dict[str, Any],
    user_id: str,
) -> list[dict[str, Any]]:

    organizer = (
        transcript.get("organizer_email")
        or ""
    ).strip().lower()

    rows = []
    seen_emails = set()

    for raw_email in (
        transcript.get("participants") or []
    ):

        if not isinstance(raw_email, str):
            continue

        email = raw_email.strip().lower()

        if not email or email in seen_emails:
            continue

        seen_emails.add(email)

        rows.append(
            {
                "name": email,
                "email": email,
                "role": (
                    "Organizer"
                    if email == organizer
                    else None
                ),
                "sort_order": len(rows),
                "created_by": user_id,
            }
        )

    # Add speaker names only when no matching
    # participant email/name already exists.
    for speaker in (
        transcript.get("speakers") or []
    ):

        if not isinstance(speaker, dict):
            continue

        name = str(
            speaker.get("name") or ""
        ).strip()

        if not name:
            continue

        duplicate = any(
            row["name"].lower()
            == name.lower()
            for row in rows
        )

        if duplicate:
            continue

        rows.append(
            {
                "name": name,
                "email": None,
                "role": None,
                "sort_order": len(rows),
                "created_by": user_id,
            }
        )

    return rows


# ============================================================
# IMPORT ONE TRANSCRIPT
# ============================================================

async def import_transcript_into_workspace(
    admin_supabase: Client,
    connection: dict[str, Any],
    transcript_id: str,
) -> dict[str, Any]:

    workspace_id = connection["workspace_id"]
    created_by = connection["connected_by"]

    # --------------------------------------------------------
    # Check whether already imported
    # --------------------------------------------------------

    existing_response = (
        admin_supabase
        .table("fireflies_meetings")
        .select("id,meeting_id,status")
        .eq(
            "fireflies_transcript_id",
            transcript_id,
        )
        .maybe_single()
        .execute()
    )

    existing = (
        existing_response.data
        if existing_response
        else None
    )

    if (
        existing
        and existing.get("status") == "imported"
    ):
        return {
            "status": "already_imported",
            "meeting_id": existing.get(
                "meeting_id"
            ),
        }

    # --------------------------------------------------------
    # Reserve transcript ID
    # --------------------------------------------------------

    if not existing:

        try:
            (
                admin_supabase
                .table("fireflies_meetings")
                .insert(
                    {
                        "workspace_id": workspace_id,
                        "fireflies_transcript_id":
                            transcript_id,
                        "status": "pending",
                    }
                )
                .execute()
            )

        except Exception:
            # Another worker may have reserved it.
            pass

        existing_response = (
            admin_supabase
            .table("fireflies_meetings")
            .select(
                "id,meeting_id,status"
            )
            .eq(
                "fireflies_transcript_id",
                transcript_id,
            )
            .maybe_single()
            .execute()
        )

        existing = (
            existing_response.data
            if existing_response
            else None
        )

    if (
        existing
        and existing.get("status") == "imported"
    ):
        return {
            "status": "already_imported",
            "meeting_id": existing.get(
                "meeting_id"
            ),
        }

    # --------------------------------------------------------
    # Get API key
    # --------------------------------------------------------

    api_key = decrypt_secret(
        connection["api_key_encrypted"]
    )

    transcript = await fetch_transcript(
        api_key,
        transcript_id,
    )

    transcript_text = build_transcript_text(
        transcript
    )

    if len(transcript_text) < 20:
        raise RuntimeError(
            "Fireflies returned an empty or "
            "too-short transcript"
        )

    # --------------------------------------------------------
    # Create meeting
    # --------------------------------------------------------

    meeting_id = (
        existing.get("meeting_id")
        if existing
        else None
    )

    if not meeting_id:

        title = (
            "fireflies-"
            f"{secrets.randbelow(10**10):010d}"
        )

        duration_seconds = None

        if transcript.get("duration") is not None:
            duration_seconds = int(
                float(
                    transcript["duration"]
                ) * 60
            )

        meeting_response = (
            admin_supabase
            .table("meetings")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "created_by": created_by,
                    "title": title,
                    "description": None,
                    "mode": "fireflies",
                    "status": "processing",
                    "meeting_date":
                        parse_fireflies_date(
                            transcript.get(
                                "dateString"
                            )
                        ),
                    "duration_seconds":
                        duration_seconds,
                }
            )
            .select("id")
            .execute()
        )

        if not meeting_response.data:
            raise RuntimeError(
                "Could not create Fireflies meeting"
            )

        meeting_id = (
            meeting_response.data[0]["id"]
        )

    # --------------------------------------------------------
    # Save Fireflies metadata
    # --------------------------------------------------------

    metadata = {
        "speakers":
            transcript.get("speakers") or [],
        "sentences":
            transcript.get("sentences") or [],
        "meeting_link":
            transcript.get("meeting_link"),
        "duration":
            transcript.get("duration"),
        "dateString":
            transcript.get("dateString"),
    }

    (
        admin_supabase
        .table("fireflies_meetings")
        .update(
            {
                "workspace_id": workspace_id,
                "meeting_id": meeting_id,
                "original_title":
                    transcript.get("title"),
                "organizer_email":
                    transcript.get(
                        "organizer_email"
                    ),
                "transcript_url":
                    transcript.get(
                        "transcript_url"
                    ),
                "meeting_link":
                    transcript.get(
                        "meeting_link"
                    ),
                "participants":
                    transcript.get(
                        "participants"
                    ) or [],
                "fireflies_date":
                    parse_fireflies_date(
                        transcript.get(
                            "dateString"
                        )
                    ),
                "duration_minutes":
                    transcript.get(
                        "duration"
                    ),
                "raw_metadata": metadata,
                "status": "pending",
                "error_message": None,
            }
        )
        .eq(
            "fireflies_transcript_id",
            transcript_id,
        )
        .execute()
    )

    # --------------------------------------------------------
    # Participants
    # --------------------------------------------------------

    existing_participants = (
        admin_supabase
        .table("meeting_participants")
        .select("id")
        .eq(
            "meeting_id",
            meeting_id,
        )
        .limit(1)
        .execute()
    )

    if not existing_participants.data:

        rows = build_participant_rows(
            transcript,
            created_by,
        )

        if rows:
            (
                admin_supabase
                .table("meeting_participants")
                .insert(
                    [
                        {
                            **row,
                            "meeting_id":
                                meeting_id,
                        }
                        for row in rows
                    ]
                )
                .execute()
            )

    # --------------------------------------------------------
    # If MOM already exists, we're done
    # --------------------------------------------------------

    existing_mom = (
        admin_supabase
        .table("moms")
        .select("id")
        .eq(
            "meeting_id",
            meeting_id,
        )
        .maybe_single()
        .execute()
    )

    if existing_mom and existing_mom.data:

        (
            admin_supabase
            .table("fireflies_meetings")
            .update(
                {
                    "status": "imported",
                    "imported_at":
                        datetime.now(
                            timezone.utc
                        ).isoformat(),
                }
            )
            .eq(
                "fireflies_transcript_id",
                transcript_id,
            )
            .execute()
        )

        return {
            "status": "imported",
            "meeting_id": meeting_id,
            "mom_id": existing_mom.data["id"],
        }

    # --------------------------------------------------------
    # Create completed transcription job
    # --------------------------------------------------------

    transcription_jobs = (
        admin_supabase
        .table("processing_jobs")
        .select(
            "id,status,output_data,created_at"
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .eq(
            "job_type",
            "transcription",
        )
        .order(
            "created_at",
            desc=True,
        )
        .execute()
    )

    completed_transcription = next(
        (
            job
            for job in (
                transcription_jobs.data
                or []
            )
            if job.get("status")
            == "completed"
            and (
                job.get("output_data")
                or {}
            ).get("transcript")
        ),
        None,
    )

    if not completed_transcription:

        transcription_response = (
            admin_supabase
            .table("processing_jobs")
            .insert(
                {
                    "meeting_id":
                        meeting_id,
                    "created_by":
                        created_by,
                    "job_type":
                        "transcription",
                    "status":
                        "completed",
                    "output_data": {
                        "transcript":
                            transcript_text,
                        "source":
                            "fireflies",
                        "fireflies_transcript_id":
                            transcript_id,
                    },
                    "completed_at":
                        datetime.now(
                            timezone.utc
                        ).isoformat(),
                }
            )
            .select("id")
            .execute()
        )

        if not transcription_response.data:
            raise RuntimeError(
                "Could not create Fireflies "
                "transcription job"
            )

    # --------------------------------------------------------
    # Create MOM generation job
    # --------------------------------------------------------

    mom_jobs = (
        admin_supabase
        .table("processing_jobs")
        .select(
            "id,status,created_at"
        )
        .eq(
            "meeting_id",
            meeting_id,
        )
        .eq(
            "job_type",
            "mom_generation",
        )
        .order(
            "created_at",
            desc=True,
        )
        .execute()
    )

    active_job = next(
        (
            job
            for job in (
                mom_jobs.data
                or []
            )
            if job.get("status")
            in {
                "queued",
                "processing",
            }
        ),
        None,
    )

    if active_job:
        mom_job_id = active_job["id"]

        if active_job["status"] == "processing":
            return {
                "status": "processing",
                "meeting_id": meeting_id,
                "mom_job_id": mom_job_id,
            }

    else:

        mom_response = (
            admin_supabase
            .table("processing_jobs")
            .insert(
                {
                    "meeting_id":
                        meeting_id,
                    "created_by":
                        created_by,
                    "job_type":
                        "mom_generation",
                    "status":
                        "queued",
                    "input_file_path":
                        None,
                }
            )
            .select("id")
            .execute()
        )

        if not mom_response.data:
            raise RuntimeError(
                "Could not create MOM generation job"
            )

        mom_job_id = (
            mom_response.data[0]["id"]
        )

    # --------------------------------------------------------
    # Existing MOM engine
    # --------------------------------------------------------

    result = await process_job(
        admin_supabase,
        mom_job_id,
    )

    (
        admin_supabase
        .table("fireflies_meetings")
        .update(
            {
                "status": "imported",
                "imported_at":
                    datetime.now(
                        timezone.utc
                    ).isoformat(),
                "error_message": None,
            }
        )
        .eq(
            "fireflies_transcript_id",
            transcript_id,
        )
        .execute()
    )

    return {
        "status": "imported",
        "meeting_id": meeting_id,
        "mom_job_id": mom_job_id,
        "transcript_id": transcript_id,
        "processing_result": result,
    }


# ============================================================
# SYNC ONE WORKSPACE
# ============================================================

async def sync_fireflies_connection(
    admin_supabase: Client,
    connection: dict[str, Any],
) -> dict[str, Any]:

    api_key = decrypt_secret(
        connection["api_key_encrypted"]
    )

    transcripts = await list_recent_transcripts(
        api_key,
        limit=10,
    )

    imported = []
    skipped = []
    failed = []

    for item in transcripts:

        transcript_id = item.get("id")

        if not transcript_id:
            continue

        existing = (
            admin_supabase
            .table("fireflies_meetings")
            .select(
                "id,meeting_id,status"
            )
            .eq(
                "fireflies_transcript_id",
                transcript_id,
            )
            .maybe_single()
            .execute()
        )

        if (
            existing
            and existing.data
            and existing.data.get(
                "status"
            ) == "imported"
        ):
            skipped.append(transcript_id)
            continue

        try:

            result = (
                await import_transcript_into_workspace(
                    admin_supabase,
                    connection,
                    transcript_id,
                )
            )

            imported.append(result)

        except Exception as exc:

            logger.exception(
                "Fireflies import failed: %s",
                transcript_id,
            )

            (
                admin_supabase
                .table("fireflies_meetings")
                .update(
                    {
                        "status": "failed",
                        "error_message": str(exc),
                    }
                )
                .eq(
                    "fireflies_transcript_id",
                    transcript_id,
                )
                .execute()
            )

            failed.append(
                {
                    "transcript_id":
                        transcript_id,
                    "error":
                        str(exc),
                }
            )

    return {
        "workspace_id":
            connection["workspace_id"],
        "checked":
            len(transcripts),
        "imported":
            imported,
        "skipped":
            len(skipped),
        "failed":
            failed,
    }