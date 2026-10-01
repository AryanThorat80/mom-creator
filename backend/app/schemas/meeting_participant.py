from datetime import datetime

from pydantic import BaseModel, Field


class MeetingParticipantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    role: str | None = Field(default=None, max_length=200)


class MeetingParticipantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    role: str | None = Field(default=None, max_length=200)


class MeetingParticipantResponse(BaseModel):
    id: str
    meeting_id: str
    name: str
    email: str | None
    role: str | None
    sort_order: int
    created_by: str
    created_at: datetime
    updated_at: datetime
