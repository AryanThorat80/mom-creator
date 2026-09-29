from typing import Any
from urllib.parse import quote

import httpx
from supabase import Client


GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3"
PRIMARY_CALENDAR_ID = "primary"


class GoogleCalendarAPIError(RuntimeError):
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
    url = f"{GOOGLE_CALENDAR_BASE_URL}/{path.lstrip('/')}"

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
        raise GoogleCalendarAPIError(
            f"Google Calendar API request failed: {message}",
            status_code=response.status_code,
        )

    if not response.content:
        return {}

    return response.json()


def _calendar_event_path(action_item_id: str) -> str:
    # Action item id is not a Google resource id. This helper only exists
    # to keep URL construction centralized if the service grows later.
    return quote(action_item_id, safe="")


async def create_action_item_event(
    access_token: str,
    action_item_id: str,
    *,
    title: str,
    description: str,
    start_datetime: str,
    end_datetime: str,
    time_zone: str,
) -> dict[str, Any]:
    event = {
        "summary": title,
        "description": description,
        "start": {
            "dateTime": start_datetime,
            "timeZone": time_zone,
        },
        "end": {
            "dateTime": end_datetime,
            "timeZone": time_zone,
        },
        "extendedProperties": {
            "private": {
                "mom_creator_action_item_id": action_item_id,
            }
        },
    }

    return await _request(
        access_token,
        "POST",
        f"calendars/{quote(PRIMARY_CALENDAR_ID, safe='')}/events",
        json_body=event,
    )


async def get_primary_calendar_event(
    access_token: str,
    event_id: str,
) -> dict[str, Any]:
    return await _request(
        access_token,
        "GET",
        f"calendars/{quote(PRIMARY_CALENDAR_ID, safe='')}/events/{quote(event_id, safe='')}",
    )


async def delete_primary_calendar_event(
    access_token: str,
    event_id: str,
) -> None:
    await _request(
        access_token,
        "DELETE",
        f"calendars/{quote(PRIMARY_CALENDAR_ID, safe='')}/events/{quote(event_id, safe='')}",
    )


def build_default_event_description(
    task: str,
    meeting_title: str | None,
    action_item_id: str,
) -> str:
    lines = [
        f"MOM Creator action item: {task}",
    ]

    if meeting_title:
        lines.append(f"Source meeting: {meeting_title}")

    lines.append(f"Action item ID: {action_item_id}")

    return "\n".join(lines)
