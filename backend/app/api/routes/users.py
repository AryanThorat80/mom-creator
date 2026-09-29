from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.security import (
    get_access_token,
    get_supabase,
)
from app.schemas.user import MeResponse


router = APIRouter(
    prefix="/me",
    tags=["Users"],
)


@router.get(
    "",
    response_model=MeResponse,
)
async def get_current_user(
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    """
    Return the currently authenticated user and their profile.
    """

    try:
        auth_response = supabase.auth.get_user(
            access_token
        )
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication token: {exc}",
        )

    user = auth_response.user

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )

    try:
        response = (
            supabase
            .table("profiles")
            .select(
                "id,name,created_at,updated_at"
            )
            .eq("id", user.id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load profile: {exc}",
        )

    if response.data is None:
        raise HTTPException(
            status_code=404,
            detail="Profile not found",
        )

    return {
        "user": {
            "id": user.id,
            "email": user.email,
        },
        "profile": response.data,
    }