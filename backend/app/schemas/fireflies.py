from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class FirefliesConnectRequest(BaseModel):
    workspace_id: str
    api_key: str = Field(min_length=10, max_length=500)


class FirefliesStatusResponse(BaseModel):
    workspace_id: str
    connected: bool
    fireflies_user_email: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    next_sync_at: Optional[datetime] = None
    sync_available: bool = False


class FirefliesConnectResponse(BaseModel):
    workspace_id: str
    connected: bool
    fireflies_user_email: str
    message: str


class FirefliesDisconnectResponse(BaseModel):
    workspace_id: str
    connected: bool
    message: str


class FirefliesRefreshResponse(BaseModel):
    workspace_id: str
    status: str
    checked: int
    imported: list[dict[str, Any]]
    skipped: int
    failed: list[dict[str, Any]]