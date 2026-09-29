from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, EmailStr, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=150
    )

    terminology: dict[str, Any] = Field(
        default_factory=dict
    )


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=150
    )

    terminology: Optional[dict[str, Any]] = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    created_by: str
    terminology: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class WorkspaceMemberResponse(BaseModel):
    workspace_id: str
    user_id: str
    role: str
    joined_at: datetime
    name: str | None = None

class WorkspaceInvitationCreate(BaseModel):
    email: EmailStr


class WorkspaceInvitationResponse(BaseModel):
    id: str
    workspace_id: str
    email: str
    status: str
    expires_at: str
    invitation_url: str


class WorkspaceInvitationAcceptResponse(BaseModel):
    workspace_id: str
    user_id: str
    role: str
    message: str