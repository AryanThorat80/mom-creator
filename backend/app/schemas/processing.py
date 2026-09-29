from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel


class ProcessingJobType(str, Enum):
    TRANSCRIPTION = "transcription"
    MOM_GENERATION = "mom_generation"
    EXPORT_GENERATION = "export_generation"


class ProcessingJobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ProcessingJobCreate(BaseModel):
    meeting_id: str
    job_type: ProcessingJobType
    input_file_path: Optional[str] = None
    source_attachment_id: Optional[str] = None


class ProcessingJobResponse(BaseModel):
    id: str
    meeting_id: str
    created_by: str
    job_type: ProcessingJobType
    status: ProcessingJobStatus
    error_message: Optional[str]
    input_file_path: Optional[str]
    output_data: dict[str, Any]
    source_attachment_id: Optional[str]
    output_mom_id: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime