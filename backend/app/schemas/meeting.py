from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

class MeetingMode(str, Enum):
    GOOGLE_MEET = "google_meet"
    ZOOM = "zoom"
    MIC_RECORDING = "mic_recording"
    UPLOAD = "upload"
    IMPORT = "import"

class MeetingStatus(str, Enum):
    DRAFT = "draft"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class MeetingCreate(BaseModel):
    workspace_id: str
    title: str = Field(
        min_length=1,
        max_length=250,
    )
    description: Optional[str] = None
    mode: MeetingMode
    meeting_date: Optional[datetime] = None

class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=250,
    )
    description: Optional[str] = None
    meeting_date: Optional[datetime] = None

class MeetingResponse(BaseModel):
    id: str
    workspace_id: str
    created_by: str
    title: str
    description: Optional[str]
    mode: MeetingMode
    status: MeetingStatus
    meeting_date: Optional[datetime]
    source_file_path: Optional[str]
    audio_file_path: Optional[str]
    video_file_path: Optional[str]
    duration_seconds: Optional[int]
    created_at: datetime
    updated_at: datetime