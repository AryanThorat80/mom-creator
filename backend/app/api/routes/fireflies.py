from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.security import get_access_token, get_supabase
from app.schemas.fireflies import (
    FirefliesConnectRequest,
    FirefliesConnectResponse,
    FirefliesDisconnectResponse,
    FirefliesRefreshResponse,
    FirefliesStatusResponse,
)
from app.services.fireflies import (
    encrypt_secret,
    sync_fireflies_connection,
    validate_api_key,
)
from app.services.supabase import create_admin_supabase_client


router = APIRouter(
    prefix="/api/v1/integrations/fireflies",
    tags=["Fireflies"],
)


def get_authenticated_user(
    supabase: Client,
    access_token: str,
):
    try:
        response = supabase.auth.get_user(access_token)
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication token: {exc}",
        )

    user = response.user

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )

    return user


def require_workspace_membership(
    supabase: Client,
    workspace_id: str,
    user_id: str,
) -> None:
    response = (
        supabase
        .table("workspace_members")
        .select("workspace_id,role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not response or not response.data:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this workspace",
        )


def get_connection(
    admin_supabase: Client,
    workspace_id: str,
):
    response = (
        admin_supabase
        .table("fireflies_connections")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )

    return response.data if response and response.data else None


def parse_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value

    return datetime.fromisoformat(
        str(value).replace("Z", "+00:00")
    )


@router.get(
    "/status",
    response_model=FirefliesStatusResponse,
)
async def get_fireflies_status(
    workspace_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(
        supabase,
        access_token,
    )

    require_workspace_membership(
        supabase,
        workspace_id,
        user.id,
    )

    admin = create_admin_supabase_client()

    row = get_connection(
        admin,
        workspace_id,
    )

    if not row:
        return {
            "workspace_id": workspace_id,
            "connected": False,
            "fireflies_user_email": None,
            "last_sync_at": None,
            "next_sync_at": None,
            "sync_available": False,
        }

    last_sync = parse_datetime(
        row.get("last_sync_at")
    )

    next_sync = None
    sync_available = True

    if last_sync:
        next_sync = (
            last_sync +
            timedelta(hours=1)
        )

        sync_available = (
            datetime.now(timezone.utc)
            >= next_sync
        )

    return {
        "workspace_id": workspace_id,
        "connected": True,
        "fireflies_user_email": row.get(
            "fireflies_user_email"
        ),
        "last_sync_at": last_sync,
        "next_sync_at": next_sync,
        "sync_available": sync_available,
    }


@router.post(
    "/connect",
    response_model=FirefliesConnectResponse,
)
async def connect_fireflies(
    payload: FirefliesConnectRequest,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(
        supabase,
        access_token,
    )

    require_workspace_membership(
        supabase,
        payload.workspace_id,
        user.id,
    )

    api_key = payload.api_key.strip()

    try:
        fireflies_user_email = await validate_api_key(
            api_key
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not validate Fireflies API key: {exc}",
        )

    admin = create_admin_supabase_client()

    existing_response = (
        admin
        .table("fireflies_connections")
        .select("id")
        .eq("workspace_id", payload.workspace_id)
        .maybe_single()
        .execute()
    )

    existing = (
        existing_response.data
        if existing_response
        else None
    )

    connection_data = {
        "workspace_id": payload.workspace_id,
        "connected_by": user.id,
        "fireflies_user_email": fireflies_user_email,
        "api_key_encrypted": encrypt_secret(api_key),
        "is_active": True,
        "last_sync_at": None,
    }

    try:
        if existing:
            (
                admin
                .table("fireflies_connections")
                .update(connection_data)
                .eq("id", existing["id"])
                .execute()
            )
        else:
            (
                admin
                .table("fireflies_connections")
                .insert(connection_data)
                .execute()
            )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to save Fireflies connection: {exc}",
        )

    return {
        "workspace_id": payload.workspace_id,
        "connected": True,
        "fireflies_user_email": fireflies_user_email,
        "message": (
            "Fireflies connected successfully. "
            "Meetings will sync hourly and can also "
            "be refreshed manually from the Dashboard."
        ),
    }


@router.delete(
    "/disconnect",
    response_model=FirefliesDisconnectResponse,
)
async def disconnect_fireflies(
    workspace_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(
        supabase,
        access_token,
    )

    require_workspace_membership(
        supabase,
        workspace_id,
        user.id,
    )

    admin = create_admin_supabase_client()

    (
        admin
        .table("fireflies_connections")
        .update({"is_active": False})
        .eq("workspace_id", workspace_id)
        .eq("is_active", True)
        .execute()
    )

    return {
        "workspace_id": workspace_id,
        "connected": False,
        "message": (
            "Fireflies disconnected. "
            "Existing meetings and MOMs were kept."
        ),
    }


@router.post(
    "/refresh",
    response_model=FirefliesRefreshResponse,
)
async def refresh_fireflies(
    workspace_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(
        supabase,
        access_token,
    )

    require_workspace_membership(
        supabase,
        workspace_id,
        user.id,
    )

    admin = create_admin_supabase_client()

    connection = get_connection(
        admin,
        workspace_id,
    )

    if not connection:
        raise HTTPException(
            status_code=404,
            detail=(
                "Fireflies is not connected "
                "to this workspace"
            ),
        )

    # PostgreSQL atomically enforces the
    # one-sync-per-hour rule.
    claim = (
        admin
        .rpc(
            "claim_fireflies_sync",
            {
                "target_workspace_id": workspace_id
            },
        )
        .execute()
    )

    if not claim.data:
        last_sync = parse_datetime(
            connection.get("last_sync_at")
        )

        retry_after = 3600

        if last_sync:
            retry_after = max(
                0,
                int(
                    (
                        last_sync
                        + timedelta(hours=1)
                        - datetime.now(timezone.utc)
                    ).total_seconds()
                ),
            )

        minutes = max(
            1,
            (retry_after + 59) // 60,
        )

        raise HTTPException(
            status_code=429,
            detail=(
                f"Fireflies was already synced recently. "
                f"Try again in {minutes} minutes."
            ),
        )

    result = await sync_fireflies_connection(
        admin_supabase=admin,
        connection=connection,
    )

    return {
        "workspace_id": workspace_id,
        "status": "completed",
        "checked": result["checked"],
        "imported": result["imported"],
        "skipped": result["skipped"],
        "failed": result["failed"],
    }