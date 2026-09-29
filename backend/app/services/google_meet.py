import asyncio
from typing import Any
from urllib.parse import quote

import httpx
from supabase import Client

from app.services.google_oauth import refresh_access_token


GOOGLE_MEET_BASE_URL = "https://meet.googleapis.com/v2"


class GoogleMeetAPIError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


async def _request(
    access_token: str,
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    url = f"{GOOGLE_MEET_BASE_URL}/{path.lstrip('/')}"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    if json_body is not None:
        headers["Content-Type"] = "application/json"

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.request(
            method,
            url,
            headers=headers,
            params=params,
            json=json_body,
        )

    if response.status_code >= 400:
        try:
            payload = response.json()
        except ValueError:
            payload = {}

        error = payload.get("error", {})
        message = error.get("message") or response.text
        raise GoogleMeetAPIError(
            f"Google Meet API request failed: {message}",
            status_code=response.status_code,
        )

    if not response.content:
        return {}

    return response.json()


async def create_meeting_space(
    access_token: str,
) -> dict[str, Any]:
    payload = {
        "config": {
            "artifactConfig": {
                "transcriptionConfig": {
                    "autoTranscriptionGeneration": "ON",
                },
            },
        },
    }

    return await _request(
        access_token,
        "POST",
        "spaces",
        json_body=payload,
    )


async def find_conference_record(
    access_token: str,
    space_name: str,
) -> dict[str, Any] | None:
    page_token: str | None = None

    while True:
        params: dict[str, Any] = {
            "pageSize": 100,
            "filter": f'space.name = "{space_name}"',
        }
        if page_token:
            params["pageToken"] = page_token

        data = await _request(
            access_token,
            "GET",
            "conferenceRecords",
            params=params,
        )

        records = data.get("conferenceRecords", [])

        completed = [
            record
            for record in records
            if record.get("space") == space_name
            and record.get("endTime")
        ]

        if completed:
            completed.sort(
                key=lambda item: item.get("startTime", ""),
                reverse=True,
            )
            return completed[0]

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return None


async def list_transcripts(
    access_token: str,
    conference_record_name: str,
) -> list[dict[str, Any]]:
    encoded = quote(conference_record_name, safe="/")
    data = await _request(
        access_token,
        "GET",
        f"{encoded}/transcripts",
        params={"pageSize": 100},
    )

    return data.get("transcripts", [])


async def list_transcript_entries(
    access_token: str,
    transcript_name: str,
) -> list[dict[str, Any]]:
    encoded = quote(transcript_name, safe="/")
    entries: list[dict[str, Any]] = []
    page_token: str | None = None

    while True:
        params: dict[str, Any] = {
            "pageSize": 100,
        }
        if page_token:
            params["pageToken"] = page_token

        data = await _request(
            access_token,
            "GET",
            f"{encoded}/entries",
            params=params,
        )

        entries.extend(data.get("transcriptEntries", []))

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    entries.sort(
        key=lambda item: item.get("startTime", "")
    )

    return entries


async def list_participants(
    access_token: str,
    conference_record_name: str,
) -> list[dict[str, Any]]:
    encoded = quote(conference_record_name, safe="/")
    participants: list[dict[str, Any]] = []
    page_token: str | None = None

    while True:
        params: dict[str, Any] = {
            "pageSize": 250,
        }
        if page_token:
            params["pageToken"] = page_token

        data = await _request(
            access_token,
            "GET",
            f"{encoded}/participants",
            params=params,
        )

        participants.extend(data.get("participants", []))

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return participants


def participant_display_name(participant: dict[str, Any]) -> str:
    signed_in = participant.get("signedinUser") or {}
    if signed_in.get("displayName"):
        return signed_in["displayName"]

    anonymous = participant.get("anonymousUser") or {}
    if anonymous.get("displayName"):
        return anonymous["displayName"]

    phone = participant.get("phoneUser") or {}
    if phone.get("displayName"):
        return phone["displayName"]

    return "Unknown speaker"


def format_structured_transcript(
    entries: list[dict[str, Any]],
    participants: list[dict[str, Any]],
) -> str:
    participant_map = {
        participant.get("name"): participant_display_name(participant)
        for participant in participants
        if participant.get("name")
    }

    lines: list[str] = []

    for entry in entries:
        text = (entry.get("text") or "").strip()
        if not text:
            continue

        speaker = participant_map.get(
            entry.get("participant"),
            "Unknown speaker",
        )

        start_time = entry.get("startTime") or ""
        end_time = entry.get("endTime") or ""

        timestamp = start_time
        if end_time:
            timestamp = f"{start_time} → {end_time}"

        lines.append(
            f"[{timestamp}] {speaker}: {text}"
        )

    return "\n".join(lines).strip()


async def sync_transcript_for_meeting(
    supabase_admin: Client,
    user_id: str,
    meeting_id: str,
    space_name: str,
) -> dict[str, Any]:
    access_token = await refresh_access_token(
        supabase_admin,
        user_id,
    )

    conference = await find_conference_record(
        access_token,
        space_name,
    )

    if not conference:
        raise LookupError(
            "No completed Google Meet conference was found for this meeting"
        )

    conference_name = conference["name"]

    # Google Meet generates post-conference transcript files asynchronously.
    # A transcript can remain in ENDED for a while before becoming
    # FILE_GENERATED, so poll instead of failing immediately.
    max_attempts = 18
    poll_seconds = 10

    generated: list[dict[str, Any]] = []
    last_states: list[str] = []

    for attempt in range(1, max_attempts + 1):
        transcripts = await list_transcripts(
            access_token,
            conference_name,
        )

        generated = [
            item
            for item in transcripts
            if item.get("state") == "FILE_GENERATED"
        ]

        if generated:
            break

        last_states = sorted(
            {
                item.get("state", "UNKNOWN")
                for item in transcripts
            }
        )

        if attempt < max_attempts:
            state_text = ", ".join(last_states) if last_states else "none"
            print(
                "Google Meet transcript is not ready yet "
                f"(attempt {attempt}/{max_attempts}, states: {state_text}). "
                f"Retrying in {poll_seconds}s..."
            )
            await asyncio.sleep(poll_seconds)

    if not generated:
        state_text = ", ".join(last_states) if last_states else "none"
        raise RuntimeError(
            "Google Meet transcript is still not ready after "
            f"{max_attempts * poll_seconds}s. "
            f"Current transcript states: {state_text}. "
            "Retry the sync endpoint later."
        )

    generated.sort(
        key=lambda item: item.get("startTime", ""),
        reverse=True,
    )

    transcript = generated[0]
    transcript_name = transcript["name"]

    entries = await list_transcript_entries(
        access_token,
        transcript_name,
    )

    participants = await list_participants(
        access_token,
        conference_name,
    )

    normalized_text = format_structured_transcript(
        entries,
        participants,
    )

    if not normalized_text:
        raise RuntimeError(
            "Google Meet transcript contains no usable transcript entries"
        )

    return {
        "conference_record_name": conference_name,
        "transcript_resource_name": transcript_name,
        "transcript_state": transcript.get("state"),
        "entries": entries,
        "participants": participants,
        "transcript": normalized_text,
    }
