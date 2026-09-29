from datetime import datetime

from pydantic import BaseModel, Field


class MOMUpdate(BaseModel):
    """
    Fields that can be edited on an existing MOM.
    All fields are optional so PATCH requests can update
    only the fields that changed.
    """

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=250,
    )

    summary: str | None = None

    key_discussion_points: list[str] | None = None

    decisions: list[str] | None = None

    next_steps: list[str] | None = None

    abbreviations_used: dict[str, str] | None = None


class MOMResponse(BaseModel):
    """
    MOM returned by the API.
    """

    id: str
    meeting_id: str
    created_by: str

    title: str
    summary: str | None

    transcript: str | None

    key_discussion_points: list[str]
    decisions: list[str]
    next_steps: list[str]

    abbreviations_used: dict[str, str]

    status: str

    generated_at: datetime | None
    created_at: datetime
    updated_at: datetime