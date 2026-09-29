from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: Optional[str] = None


class ProfileResponse(BaseModel):
    id: str
    name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MeResponse(BaseModel):
    user: UserResponse
    profile: ProfileResponse