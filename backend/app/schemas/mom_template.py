from datetime import datetime

from pydantic import BaseModel, Field


class MOMTemplateCreate(BaseModel):
    name: str = Field(
        default="MOM Template",
        min_length=1,
        max_length=250,
    )
    file_name: str
    file_path: str
    file_type: str | None = None
    file_size: int | None = None
    source_type: str = "template"


class MOMTemplateUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=250,
    )
    file_name: str | None = None
    file_path: str | None = None
    file_type: str | None = None
    file_size: int | None = None
    source_type: str | None = None


class MOMTemplateResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    file_name: str | None
    file_path: str | None
    file_type: str | None
    file_size: int | None
    source_type: str
    created_by: str
    created_at: datetime
    updated_at: datetime