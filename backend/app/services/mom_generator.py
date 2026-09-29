import json
import asyncio
from datetime import datetime
from typing import Any

import httpx

from app.core.config import get_settings


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


# ============================================================
# MOM RESPONSE SCHEMA
# ============================================================

MOM_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "title": {
            "type": "STRING",
            "description": "Concise title for the meeting.",
        },
        "summary": {
            "type": "STRING",
            "description": "Concise summary of the current meeting.",
        },
        "key_discussion_points": {
            "type": "ARRAY",
            "items": {
                "type": "STRING",
            },
            "description": "Important topics discussed in the current meeting.",
        },
        "decisions": {
            "type": "ARRAY",
            "items": {
                "type": "STRING",
            },
            "description": "Decisions made during the current meeting.",
        },
        "next_steps": {
            "type": "ARRAY",
            "items": {
                "type": "STRING",
            },
            "description": "Concrete follow-up steps from the current meeting.",
        },
        "abbreviations_used": {
            "type": "OBJECT",
            "additionalProperties": {
                "type": "STRING",
            },
            "description": "Abbreviation to meaning mapping.",
        },
        "action_items": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "task": {
                        "type": "STRING",
                    },
                    "assigned_to": {
                        "anyOf": [
                            {
                                "type": "STRING",
                            },
                            {
                                "type": "NULL",
                            },
                        ],
                    },
                    "assigned_name": {
                        "anyOf": [
                            {
                                "type": "STRING",
                            },
                            {
                                "type": "NULL",
                            },
                        ],
                    },
                    "due_date": {
                        "anyOf": [
                            {
                                "type": "STRING",
                                "description": (
                                    "Due date as ISO-8601 datetime, "
                                    "for example 2026-09-30T00:00:00+05:30."
                                ),
                            },
                            {
                                "type": "NULL",
                            },
                        ],
                    },
                    "status": {
                        "type": "STRING",
                        "enum": [
                            "pending",
                            "in_progress",
                            "completed",
                            "cancelled",
                        ],
                    },
                    "priority": {
                        "type": "STRING",
                        "enum": [
                            "low",
                            "medium",
                            "high",
                            "urgent",
                        ],
                    },
                },
                "required": [
                    "task",
                    "assigned_to",
                    "assigned_name",
                    "due_date",
                    "status",
                    "priority",
                ],
            },
        },
    },
    "required": [
        "title",
        "summary",
        "key_discussion_points",
        "decisions",
        "next_steps",
        "abbreviations_used",
        "action_items",
    ],
}


# ============================================================
# MOM GENERATION
# ============================================================

async def generate_mom(
    transcript: str,
    context: str = "",
    target_language: str = "English",
) -> dict[str, Any]:
    """
    Generate a structured MOM from the current meeting
    transcript plus optional supporting context.

    transcript:
        The current meeting's transcript.

    context:
        Information extracted from related attachments,
        previous MOMs, notes, documents, etc.

    target_language:
        Language for the generated MOM.
    """

    # --------------------------------------------------------
    # Validate transcript
    # --------------------------------------------------------

    if not isinstance(
        transcript,
        str,
    ):
        raise ValueError(
            "Transcript must be a string"
        )

    transcript = transcript.strip()

    if not transcript:
        raise ValueError(
            "Transcript is empty"
        )

    # --------------------------------------------------------
    # Validate context
    # --------------------------------------------------------

    if context is None:
        context = ""

    if not isinstance(
        context,
        str,
    ):
        raise ValueError(
            "Context must be a string"
        )

    context = context.strip()

    # --------------------------------------------------------
    # Validate language
    # --------------------------------------------------------

    if not isinstance(
        target_language,
        str,
    ):
        raise ValueError(
            "Target language must be a string"
        )

    target_language = target_language.strip()

    if not target_language:
        raise ValueError(
            "Target language cannot be empty"
        )

    # --------------------------------------------------------
    # Call Gemini
    # --------------------------------------------------------

    result = await call_llm(
        transcript=transcript,
        context=context,
        target_language=target_language,
    )

    # --------------------------------------------------------
    # Validate generated MOM
    # --------------------------------------------------------

    return validate_mom_result(
        result
    )


# ============================================================
# GEMINI LLM CALL
# ============================================================

async def call_llm(
    transcript: str,
    context: str = "",
    target_language: str = "English",
) -> dict[str, Any]:
    """
    Call Gemini through the native Gemini generateContent API.

    Supports AI_BASE_URL values such as:

        https://generativelanguage.googleapis.com
        https://generativelanguage.googleapis.com/v1beta
        https://generativelanguage.googleapis.com/v1beta/
        https://generativelanguage.googleapis.com/v1beta/openai/

    The native Gemini REST endpoint is used regardless of whether
    the configured base URL contains an OpenAI-compatible path.

    Retries transient Gemini failures such as:
        429 Too Many Requests
        500 Internal Server Error
        502 Bad Gateway
        503 Service Unavailable
        504 Gateway Timeout
    """

    if not settings.ai_api_key:
        raise RuntimeError(
            "AI_API_KEY is not configured"
        )

    if not settings.ai_base_url:
        raise RuntimeError(
            "AI_BASE_URL is not configured"
        )

    if not settings.ai_model:
        raise RuntimeError(
            "AI_MODEL is not configured"
        )

    # --------------------------------------------------------
    # Build prompt
    # --------------------------------------------------------

    prompt = build_mom_prompt(
        transcript=transcript,
        context=context,
        target_language=target_language,
    )

    # --------------------------------------------------------
    # Normalize Gemini base URL
    # --------------------------------------------------------

    base_url = (
        settings.ai_base_url
        .strip()
        .rstrip("/")
    )

    model = settings.ai_model.strip()

    # Remove OpenAI-compatible suffixes if present.
    base_url = base_url.replace(
        "/v1beta/openai",
        "",
    )

    base_url = base_url.replace(
        "/v1/openai",
        "",
    )

    base_url = base_url.rstrip("/")

    # Remove existing API version.
    if base_url.endswith("/v1beta"):
        base_url = base_url[:-len("/v1beta")]

    elif base_url.endswith("/v1"):
        base_url = base_url[:-len("/v1")]

    base_url = base_url.rstrip("/")

    # --------------------------------------------------------
    # Correct native Gemini endpoint
    # --------------------------------------------------------

    endpoint = (
        f"{base_url}/v1beta/models/"
        f"{model}:generateContent"
    )

    # --------------------------------------------------------
    # Request body
    # --------------------------------------------------------

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": prompt,
                    }
                ],
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseJsonSchema": MOM_RESPONSE_SCHEMA,
            "temperature": 0.2,
            "maxOutputTokens": 4096,
        },
    }

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.ai_api_key,
    }

    # --------------------------------------------------------
    # Debug URL without exposing API key
    # --------------------------------------------------------

    print(
        "Gemini endpoint:",
        endpoint,
    )

    # --------------------------------------------------------
    # Retry configuration
    # --------------------------------------------------------

    max_attempts = 4

    # Retry only transient server/rate-limit errors.
    retryable_statuses = {
        429,
        500,
        502,
        503,
        504,
    }

    response = None

    # --------------------------------------------------------
    # Call Gemini
    # --------------------------------------------------------

    try:

        async with httpx.AsyncClient(
            timeout=120.0
        ) as client:

            for attempt in range(
                1,
                max_attempts + 1,
            ):

                try:

                    response = await client.post(
                        endpoint,
                        headers=headers,
                        json=payload,
                    )

                except httpx.TimeoutException as exc:

                    if attempt == max_attempts:
                        raise RuntimeError(
                            "Gemini API request timed out "
                            f"after {max_attempts} attempts"
                        ) from exc

                    delay = min(
                        2 ** (attempt - 1),
                        8,
                    )

                    print(
                        "Gemini request timed out. "
                        f"Retrying in {delay}s "
                        f"(attempt {attempt + 1}/"
                        f"{max_attempts})..."
                    )

                    await asyncio.sleep(
                        delay
                    )
                    continue

                except httpx.HTTPError as exc:

                    if attempt == max_attempts:
                        raise RuntimeError(
                            "Gemini API request failed "
                            f"after {max_attempts} attempts: "
                            f"{exc}"
                        ) from exc

                    delay = min(
                        2 ** (attempt - 1),
                        8,
                    )

                    print(
                        "Gemini network error. "
                        f"Retrying in {delay}s "
                        f"(attempt {attempt + 1}/"
                        f"{max_attempts})..."
                    )

                    await asyncio.sleep(
                        delay
                    )
                    continue

                # ------------------------------------------------
                # Success
                # ------------------------------------------------

                if response.status_code < 400:
                    break

                # ------------------------------------------------
                # Retry transient errors
                # ------------------------------------------------

                if (
                    response.status_code
                    in retryable_statuses
                    and attempt < max_attempts
                ):

                    # Prefer Retry-After when supplied.
                    retry_after = response.headers.get(
                        "Retry-After"
                    )

                    if retry_after:
                        try:
                            delay = float(
                                retry_after
                            )
                        except ValueError:
                            delay = min(
                                2 ** (attempt - 1),
                                8,
                            )
                    else:
                        # Exponential backoff:
                        # 1s → 2s → 4s
                        delay = min(
                            2 ** (attempt - 1),
                            8,
                        )

                    print(
                        f"Gemini returned HTTP "
                        f"{response.status_code}. "
                        f"Retrying in {delay}s "
                        f"(attempt {attempt + 1}/"
                        f"{max_attempts})..."
                    )

                    await asyncio.sleep(
                        delay
                    )
                    continue

                # ------------------------------------------------
                # Permanent / non-retryable error
                # ------------------------------------------------

                break

    except RuntimeError:
        raise

    # --------------------------------------------------------
    # Safety check
    # --------------------------------------------------------

    if response is None:
        raise RuntimeError(
            "Gemini API did not return a response"
        )

    # --------------------------------------------------------
    # Handle API error
    # --------------------------------------------------------

    if response.status_code >= 400:

        try:

            error_data = response.json()

            error_message = (
                error_data
                .get("error", {})
                .get("message")
            )

        except ValueError:

            error_message = None

        if not error_message:
            error_message = response.text.strip()

        raise RuntimeError(
            "Gemini API returned "
            f"HTTP {response.status_code}: "
            f"{error_message or 'No error details returned'}"
        )

    # --------------------------------------------------------
    # Parse response
    # --------------------------------------------------------

    try:

        response_data = response.json()

    except ValueError as exc:

        raise RuntimeError(
            "Gemini API returned invalid JSON"
        ) from exc

    # --------------------------------------------------------
    # Extract generated text
    # --------------------------------------------------------

    candidates = response_data.get(
        "candidates",
        [],
    )

    if not candidates:

        raise RuntimeError(
            "Gemini returned no candidates"
        )

    content = candidates[0].get(
        "content",
        {}
    )

    parts = content.get(
        "parts",
        []
    )

    generated_text = ""

    for part in parts:

        text = part.get(
            "text"
        )

        if text:
            generated_text += text

    generated_text = generated_text.strip()

    if not generated_text:

        raise RuntimeError(
            "Gemini returned an empty response"
        )

    # --------------------------------------------------------
    # Parse JSON
    # --------------------------------------------------------

    try:

        result = json.loads(
            generated_text
        )

    except json.JSONDecodeError as exc:

        raise RuntimeError(
            "Gemini returned invalid MOM JSON: "
            + generated_text[:2000]
        ) from exc

    if not isinstance(
        result,
        dict,
    ):

        raise RuntimeError(
            "Gemini MOM response must be a JSON object"
        )

    return result
# ============================================================
# PROMPT BUILDER
# ============================================================

def build_mom_prompt(
    transcript: str,
    context: str = "",
    target_language: str = "English",
) -> str:
    """
    Build the MOM generation prompt.

    Current meeting transcript is authoritative for what
    happened in the current meeting.

    Supporting context is background information only.
    """

    context_section = (
        context
        if context
        else "No supporting context was provided."
    )

    example = {
        "title": "Example meeting title",
        "summary": "Example meeting summary",
        "key_discussion_points": [
            "Example discussion point"
        ],
        "decisions": [
            "Example decision"
        ],
        "next_steps": [
            "Example next step"
        ],
        "abbreviations_used": {
            "API": "Application Programming Interface"
        },
        "action_items": [
            {
                "task": "Complete the API integration",
                "assigned_to": None,
                "assigned_name": None,
                "due_date": "2026-09-30T00:00:00+05:30",
                "status": "pending",
                "priority": "medium",
            }
        ],
    }

    example_json = json.dumps(
        example,
        indent=2,
        ensure_ascii=False,
    )

    return f"""
You are the AI meeting intelligence engine for MOM Creator.

Your task is to generate EXACTLY ONE structured Minutes of Meeting
document from the CURRENT MEETING TRANSCRIPT.

Generate the MOM in {target_language}.

IMPORTANT OUTPUT CONTRACT:
- Return exactly ONE MOM.
- Return exactly ONE JSON object.
- Never return an array of MOMs.
- Never return multiple versions, alternatives, or drafts.
- Never split one meeting into multiple MOMs.
- All sections belong to the SAME current meeting.

============================================================
CURRENT MEETING TRANSCRIPT
============================================================

This section represents what was actually discussed in the
current meeting.

Treat this as the PRIMARY SOURCE OF TRUTH.

{transcript}


============================================================
SUPPORTING CONTEXT
============================================================

This section contains supporting information from related
attachments such as:

- Previous MOMs
- Previous meeting notes
- Project documentation
- Presentations
- PDFs
- DOCX files
- Spreadsheets
- Other supporting documents

Supporting context is BACKGROUND INFORMATION.

It is NOT the transcript of the current meeting.

Use it to:
- understand references
- resolve terminology
- understand historical decisions
- understand ongoing projects
- understand organization-specific abbreviations
- understand prior meeting context

IMPORTANT:

Do NOT treat historical context as something discussed in
the current meeting.

Do NOT create a new decision from an old decision.

Do NOT create a current action item from a historical action item
unless the current transcript confirms it.

Do NOT invent information that does not appear in either source.

{context_section}


============================================================
MOM REQUIREMENTS
============================================================

Generate:

1. title
   A concise title for this meeting.

2. summary
   A concise summary of what happened in the current meeting.

3. key_discussion_points
   Important topics actually discussed in the current meeting.

4. decisions
   Decisions actually made during the current meeting.

5. next_steps
   Follow-up actions identified from the current meeting.

6. abbreviations_used
   Map abbreviations to their meaning.

7. action_items
   Each action item must contain:

   task
   assigned_to
   assigned_name
   due_date
   status
   priority


============================================================
ACTION ITEM DETECTION
============================================================

Action items are OPERATIONAL FOLLOW-UP TASKS, not merely
important statements. Extract an action item whenever the
current meeting establishes a concrete task that someone needs
to perform after the meeting.

Typical signals include:
- "will" / "need to" / "should" / "must" followed by a task
- explicit requests to contact, send, review, prepare, confirm,
  schedule, investigate, obtain, update, submit, or discuss
- follow-up work assigned to a person, role, team, administration,
  council, or organization
- a next step that clearly requires work after the meeting

IMPORTANT:
- Do NOT leave action_items empty when the transcript contains
  concrete follow-up work.
- When a concrete next step is present, normally represent it
  in action_items as an operational task.
- next_steps is the human-readable follow-up summary.
- action_items is the structured task record used by the application.
- Do NOT create an action item for a statement that is purely
  informational, a completed task, a decision with no follow-up,
  or a hypothetical possibility.
- Do NOT create duplicate action items for the same task.

For every valid action item:
- task must be a concise, actionable description of the work.
- If the task is explicitly assigned to a named person, use that
  name in assigned_name.
- If no verified application user mapping exists, assigned_to
  MUST be null.
- If no owner is explicitly identified, assigned_name MUST be null.
- If no due date is explicitly stated, due_date MUST be null.
- When a due date exists, return it ONLY as an ISO-8601 datetime string.
- Required format: YYYY-MM-DDTHH:MM:SS+05:30
- If only a calendar date is stated and no time is given, use 00:00:00
  in the meeting's local timezone.
- Use the year established by the meeting/transcript when only month
  and day are stated.
- Never return natural-language dates such as "Wednesday, September 30",
  "September 30", "next Wednesday", or "tomorrow".
- Use status="pending" unless the meeting explicitly establishes
  a different status.
- Use priority="medium" unless urgency/priority is explicitly
  stated. Do not infer high or urgent priority from your own judgment.

Example from a meeting:
"Administration will contact the CEO before the next meeting."
becomes an action item even if no named person is available:

{{
  "task": "Contact the CEO before the next meeting",
  "assigned_to": null,
  "assigned_name": null,
  "due_date": null,
  "status": "pending",
  "priority": "medium"
}}

============================================================
ACTION ITEM RULES
============================================================

assigned_to:

- Must be null unless the application has a verified user
  mapping.
- Never invent a UUID.
- Never guess a user's UUID.

assigned_name:

- Use a person's name only when the meeting/context provides it.
- Otherwise use null.

due_date:
- Use an explicit date/deadline from the meeting.
- Do not invent deadlines.
- Otherwise use null.
- When a due date is present, return it ONLY as an ISO-8601
  datetime string.
- Required format:
  YYYY-MM-DDTHH:MM:SS+05:30
- If the meeting gives only a calendar date and no time,
  use 00:00:00 with the meeting's local timezone.
- Use the year established by the meeting/transcript when
  only month and day are stated.
- Never return natural-language dates such as:
  "Wednesday, September 30"
  "September 30"
  "next Wednesday"
  "tomorrow"

status:

Must be one of:

pending
in_progress
completed
cancelled

priority:

Must be one of:

low
medium
high
urgent


============================================================
ANTI-HALLUCINATION RULES
============================================================

Do NOT invent:

- participants
- decisions
- action items
- owners
- deadlines
- dates
- project facts
- user IDs
- abbreviations

Distinguish historical information from current meeting
information.

The current transcript determines what happened in the
current meeting.

Supporting context helps explain the current meeting but
does not override it.


============================================================
OUTPUT FORMAT
============================================================

Return ONLY the single JSON object for this one meeting.

The response must contain these top-level fields only as the
MOM structure requires:
title, summary, key_discussion_points, decisions,
next_steps, abbreviations_used, action_items.

Do not wrap the object in another object or array.
Do not include commentary, markdown, headings, or multiple MOMs.

Example structure:

{example_json}
"""


# ============================================================
# MOM RESULT VALIDATION
# ============================================================

def validate_mom_result(
    result: dict[str, Any],
) -> dict[str, Any]:

    if not isinstance(
        result,
        dict,
    ):
        raise ValueError(
            "LLM must return exactly one MOM as a JSON object"
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

    missing = (
        required_fields
        - result.keys()
    )

    if missing:

        raise ValueError(
            "Invalid MOM result. "
            f"Missing: {', '.join(sorted(missing))}"
        )

    # --------------------------------------------------------
    # Title
    # --------------------------------------------------------

    if not isinstance(
        result["title"],
        str,
    ):
        raise ValueError(
            "title must be a string"
        )

    if not result["title"].strip():

        raise ValueError(
            "title cannot be empty"
        )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    if not isinstance(
        result["summary"],
        str,
    ):
        raise ValueError(
            "summary must be a string"
        )

    if not result["summary"].strip():

        raise ValueError(
            "summary cannot be empty"
        )

    # --------------------------------------------------------
    # Discussion points
    # --------------------------------------------------------

    validate_string_list(
        result[
            "key_discussion_points"
        ],
        "key_discussion_points",
    )

    # --------------------------------------------------------
    # Decisions
    # --------------------------------------------------------

    validate_string_list(
        result["decisions"],
        "decisions",
    )

    # --------------------------------------------------------
    # Next steps
    # --------------------------------------------------------

    validate_string_list(
        result["next_steps"],
        "next_steps",
    )

    # --------------------------------------------------------
    # Abbreviations
    # --------------------------------------------------------

    if not isinstance(
        result["abbreviations_used"],
        dict,
    ):
        raise ValueError(
            "abbreviations_used must be an object"
        )

    validate_abbreviations(
        result[
            "abbreviations_used"
        ]
    )

    # --------------------------------------------------------
    # Action items
    # --------------------------------------------------------

    if not isinstance(
        result["action_items"],
        list,
    ):
        raise ValueError(
            "action_items must be a list"
        )

    validate_action_items(
        result["action_items"]
    )

    return result


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
                f"{field_name}[{index}] must be a string"
            )

        if not item.strip():

            raise ValueError(
                f"{field_name}[{index}] cannot be empty"
            )


# ============================================================
# ABBREVIATION VALIDATION
# ============================================================

def validate_abbreviations(
    abbreviations: dict[str, Any],
) -> None:

    for abbreviation, meaning in (
        abbreviations.items()
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


# ============================================================
# ACTION ITEM VALIDATION
# ============================================================

def validate_action_items(
    action_items: list[Any],
) -> None:

    for index, item in enumerate(
        action_items
    ):

        if not isinstance(
            item,
            dict,
        ):
            raise ValueError(
                f"action_items[{index}] must be an object"
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
                f"action_items[{index}].task "
                "must be a string"
            )

        if not task.strip():

            raise ValueError(
                f"action_items[{index}].task "
                "cannot be empty"
            )

        # ----------------------------------------------------
        # assigned_to
        # ----------------------------------------------------

        assigned_to = item.get(
            "assigned_to"
        )

        if (
            assigned_to is not None
            and not isinstance(
                assigned_to,
                str,
            )
        ):
            raise ValueError(
                f"action_items[{index}].assigned_to "
                "must be a string or null"
            )

        # ----------------------------------------------------
        # assigned_name
        # ----------------------------------------------------

        assigned_name = item.get(
            "assigned_name"
        )

        if (
            assigned_name is not None
            and not isinstance(
                assigned_name,
                str,
            )
        ):
            raise ValueError(
                f"action_items[{index}].assigned_name "
                "must be a string or null"
            )

        # ----------------------------------------------------
        # due_date
        # ----------------------------------------------------

        due_date = item.get(
            "due_date"
        )

        if (
            due_date is not None
            and not isinstance(
                due_date,
                str,
            )
        ):
            raise ValueError(
                f"action_items[{index}].due_date "
                "must be a string or null"
            )

        if isinstance(due_date, str) and due_date.strip():
            try:
                datetime.fromisoformat(
                    due_date.strip().replace(
                        "Z",
                        "+00:00",
                    )
                )
            except ValueError as exc:
                raise ValueError(
                    f"action_items[{index}].due_date "
                    "must be a valid ISO-8601 datetime string or null"
                ) from exc

        # ----------------------------------------------------
        # Status
        # ----------------------------------------------------

        status = item.get(
            "status",
            "pending",
        )

        if status not in VALID_ACTION_ITEM_STATUSES:

            raise ValueError(
                f"action_items[{index}].status "
                f"must be one of: "
                f"{', '.join(sorted(VALID_ACTION_ITEM_STATUSES))}"
            )

        # ----------------------------------------------------
        # Priority
        # ----------------------------------------------------

        priority = item.get(
            "priority",
            "medium",
        )

        if priority not in VALID_ACTION_ITEM_PRIORITIES:

            raise ValueError(
                f"action_items[{index}].priority "
                f"must be one of: "
                f"{', '.join(sorted(VALID_ACTION_ITEM_PRIORITIES))}"
            )