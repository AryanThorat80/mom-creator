from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from app.services.supabase import (
    create_user_supabase_client,
)


security = HTTPBearer(
    auto_error=True,
)


def get_access_token(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    ),
) -> str:
    return credentials.credentials


def get_supabase(
    access_token: str = Depends(
        get_access_token
    ),
) -> Client:
    try:
        return create_user_supabase_client(
            access_token
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize Supabase client: {exc}",
        )