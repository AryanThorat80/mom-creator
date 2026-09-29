from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


ActionItemStatus = Literal[
    "pending",
    "in_progress",
    "completed",
    "cancelled",
]

ActionItemPriority = Literal[
    "low",
    "medium",
    "high",
    "urgent",
]


class ActionItemCreate(BaseModel):
    task: str = Field(min_length=1, max_length=1000)
    assigned_to: str | None = None
    assigned_name: str | None = Field(default=None, max_length=255)
    due_date: datetime | None = None
    status: ActionItemStatus = "pending"
    priority: ActionItemPriority = "medium"

    @field_validator("task")
    @classmethod
    def validate_task(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("task cannot be empty")
        return value


class ActionItemUpdate(BaseModel):
    task: str | None = Field(default=None, min_length=1, max_length=1000)
    assigned_to: str | None = None
    assigned_name: str | None = Field(default=None, max_length=255)
    due_date: datetime | None = None
    status: ActionItemStatus | None = None
    priority: ActionItemPriority | None = None

    @field_validator("task")
    @classmethod
    def validate_task(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("task cannot be empty")
        return value


class ActionItemResponse(BaseModel):
    id: str
    mom_id: str
    meeting_id: str
    created_by: str
    assigned_to: str | None = None
    assigned_name: str | None = None
    task: str
    due_date: datetime | None = None
    status: ActionItemStatus
    priority: ActionItemPriority
    completed_at: datetime | None = None
    google_event_id: str | None = None
    created_at: datetime
    updated_at: datetime
