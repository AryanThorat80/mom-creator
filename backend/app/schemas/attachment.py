from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AttachmentResponse(BaseModel):
    id: str
    meeting_id: str
    uploaded_by: str
    file_name: str
    file_path: str
    file_type: Optional[str]
    file_size: Optional[int]
    attachment_type: str
    created_at: datetime