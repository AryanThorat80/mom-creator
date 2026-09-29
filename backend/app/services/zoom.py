from datetime import datetime, timezone
from typing import Any

import httpx

ZOOM_API_BASE_URL = "https://api.zoom.us/v2"


class ZoomAPIError(RuntimeError):
    pass


async def create_zoom_meeting(access_token: str, meeting_date: datetime | None, title: str) -> dict[str, Any]:
    start_time = meeting_date
    if start_time is not None and start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)

    payload: dict[str, Any] = {
        "topic": title,
        "type": 2,
        "duration": 60,
        "settings": {
            "join_before_host": True,
            "waiting_room": False,
            "auto_recording": "cloud",
        },
    }

    if start_time:
        payload["start_time"] = start_time.isoformat()

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{ZOOM_API_BASE_URL}/users/me/meetings",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code >= 400:
        try:
            data = response.json()
        except ValueError:
            data = {}
        message = data.get("message") or data.get("reason") or response.text
        raise ZoomAPIError(f"Zoom API request failed ({response.status_code}): {message}")

    return response.json()

async def get_zoom_transcript(
    access_token: str,
    zoom_meeting_id: str,
) -> dict[str, Any]:
    """
    Retrieve the transcript for a Zoom meeting.

    Zoom may return NOT_READY while the transcript is still
    being processed after the meeting ends.
    """

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{ZOOM_API_BASE_URL}/meetings/{zoom_meeting_id}/transcript",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
        )

    if response.status_code >= 400:
        try:
            data = response.json()
        except ValueError:
            data = {}

        message = (
            data.get("message")
            or data.get("reason")
            or response.text
        )

        raise ZoomAPIError(
            f"Zoom transcript request failed "
            f"({response.status_code}): {message}"
        )

    return response.json()


async def download_zoom_transcript(
    access_token: str,
    download_url: str,
) -> str:
    """
    Download the Zoom transcript file.
    """

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            download_url,
            headers={
                "Authorization": f"Bearer {access_token}",
            },
        )

    if response.status_code >= 400:
        raise ZoomAPIError(
            f"Failed to download Zoom transcript "
            f"({response.status_code}): {response.text}"
        )

    return response.text


def parse_zoom_transcript(transcript_text: str) -> str:
    """
    Convert Zoom VTT transcript into plain transcript text.
    """

    lines = transcript_text.replace("\r\n", "\n").split("\n")

    output = []
    previous_text = None

    for line in lines:
        line = line.strip()

        if not line:
            continue

        if line == "WEBVTT":
            continue

        if "-->" in line:
            continue

        if line.isdigit():
            continue

        # Remove common VTT speaker formatting.
        if line.startswith("<v ") and ">" in line:
            line = line.split(">", 1)[1]

        line = line.replace("</v>", "")
        line = line.strip()

        if not line:
            continue

        # Avoid duplicate consecutive lines.
        if line == previous_text:
            continue

        output.append(line)
        previous_text = line

    return "\n".join(output).strip()