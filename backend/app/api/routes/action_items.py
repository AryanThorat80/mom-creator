from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.security import get_access_token, get_supabase
from app.schemas.action_item import (
    ActionItemCreate,
    ActionItemResponse,
    ActionItemUpdate,
)


router = APIRouter(
    prefix="/api/v1/meetings",
    tags=["Action Items"],
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
        ) from exc

    user = response.user
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )

    return user


async def get_meeting(
    supabase: Client,
    meeting_id: str,
) -> dict[str, Any]:
    response = (
        supabase
        .table("meetings")
        .select("id,workspace_id,created_by")
        .eq("id", meeting_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found or inaccessible",
        )

    return response.data[0]


async def get_action_item(
    supabase: Client,
    meeting_id: str,
    action_item_id: str,
) -> dict[str, Any]:
    response = (
        supabase
        .table("action_items")
        .select(
            "id,mom_id,meeting_id,created_by,assigned_to,"
            "assigned_name,task,due_date,status,priority,"
            "completed_at,google_event_id,created_at,updated_at"
        )
        .eq("id", action_item_id)
        .eq("meeting_id", meeting_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Action item not found or inaccessible",
        )

    return response.data[0]


@router.get(
    "/{meeting_id}/actions",
    response_model=list[ActionItemResponse],
)
async def list_action_items(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    get_authenticated_user(supabase, access_token)
    await get_meeting(supabase, meeting_id)

    response = (
        supabase
        .table("action_items")
        .select(
            "id,mom_id,meeting_id,created_by,assigned_to,"
            "assigned_name,task,due_date,status,priority,"
            "completed_at,google_event_id,created_at,updated_at"
        )
        .eq("meeting_id", meeting_id)
        .order("due_date", desc=False)
        .order("created_at", desc=False)
        .execute()
    )

    return response.data or []


@router.post(
    "/{meeting_id}/actions",
    response_model=ActionItemResponse,
    status_code=201,
)
async def create_action_item(
    meeting_id: str,
    payload: ActionItemCreate,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(supabase, access_token)
    meeting = await get_meeting(supabase, meeting_id)

    mom_response = (
        supabase
        .table("moms")
        .select("id")
        .eq("meeting_id", meeting_id)
        .execute()
    )

    if not mom_response.data:
        raise HTTPException(
            status_code=409,
            detail="A MOM must exist before creating an action item",
        )

    mom_id = mom_response.data[0]["id"]

    if payload.assigned_to:
        membership = (
            supabase
            .table("workspace_members")
            .select("user_id")
            .eq("workspace_id", meeting["workspace_id"])
            .eq("user_id", payload.assigned_to)
            .execute()
        )
        if not membership.data:
            raise HTTPException(
                status_code=400,
                detail="assigned_to must be a member of the meeting workspace",
            )

    response = (
        supabase
        .table("action_items")
        .insert({
            "mom_id": mom_id,
            "meeting_id": meeting_id,
            "created_by": user.id,
            "task": payload.task,
            "assigned_to": payload.assigned_to,
            "assigned_name": payload.assigned_name,
            "due_date": (
                payload.due_date.isoformat()
                if payload.due_date
                else None
            ),
            "status": payload.status,
            "priority": payload.priority,
        })
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=500,
            detail="Failed to create action item",
        )

    return response.data[0]


@router.put(
    "/{meeting_id}/actions/{action_item_id}",
    response_model=ActionItemResponse,
)
async def update_action_item(
    meeting_id: str,
    action_item_id: str,
    payload: ActionItemUpdate,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(supabase, access_token)
    meeting = await get_meeting(supabase, meeting_id)
    action_item = await get_action_item(
        supabase,
        meeting_id,
        action_item_id,
    )

    if (
        action_item.get("created_by") != user.id
        and action_item.get("assigned_to") != user.id
    ):
        membership = (
            supabase
            .table("workspace_members")
            .select("role")
            .eq("workspace_id", meeting["workspace_id"])
            .eq("user_id", user.id)
            .execute()
        )

        if not membership.data or membership.data[0].get("role") not in {
            "owner",
            "admin",
        }:
            raise HTTPException(status_code=403, detail="Forbidden")

    updates = payload.model_dump(exclude_unset=True)

    if "task" in updates and updates["task"] is not None:
        updates["task"] = updates["task"].strip()

    if "due_date" in updates and updates["due_date"] is not None:
        updates["due_date"] = updates["due_date"].isoformat()

    if "status" in updates:
        if updates["status"] == "completed":
            updates["completed_at"] = "now()"
        else:
            updates["completed_at"] = None

    if "assigned_to" in updates and updates["assigned_to"]:
        membership = (
            supabase
            .table("workspace_members")
            .select("user_id")
            .eq("workspace_id", meeting["workspace_id"])
            .eq("user_id", updates["assigned_to"])
            .execute()
        )
        if not membership.data:
            raise HTTPException(
                status_code=400,
                detail="assigned_to must be a member of the meeting workspace",
            )

    if not updates:
        return action_item

    # Let the DB trigger manage immutable identity and assignee integrity.
    # `completed_at` is handled separately below because PostgREST does not
    # interpret a literal 'now()' string as a SQL expression.
    if updates.get("completed_at") == "now()":
        updates["completed_at"] = None

    response = (
        supabase
        .table("action_items")
        .update(updates)
        .eq("id", action_item_id)
        .eq("meeting_id", meeting_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=400,
            detail="Failed to update action item",
        )

    # Explicitly set completed_at only through a timestamp generated in the app.
    if payload.status == "completed":
        from datetime import datetime, timezone

        completed_update = (
            supabase
            .table("action_items")
            .update({
                "completed_at": datetime.now(timezone.utc).isoformat()
            })
            .eq("id", action_item_id)
            .eq("meeting_id", meeting_id)
            .execute()
        )
        if completed_update.data:
            response_data = completed_update.data[0]
        else:
            response_data = response.data[0]
    else:
        response_data = response.data[0]

    return response_data


@router.delete(
    "/{meeting_id}/actions/{action_item_id}",
)
async def delete_action_item(
    meeting_id: str,
    action_item_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(supabase, access_token)
    meeting = await get_meeting(supabase, meeting_id)
    action_item = await get_action_item(
        supabase,
        meeting_id,
        action_item_id,
    )

    if action_item.get("created_by") != user.id:
        membership = (
            supabase
            .table("workspace_members")
            .select("role")
            .eq("workspace_id", meeting["workspace_id"])
            .eq("user_id", user.id)
            .execute()
        )

        if not membership.data or membership.data[0].get("role") not in {
            "owner",
            "admin",
        }:
            raise HTTPException(status_code=403, detail="Forbidden")

    response = (
        supabase
        .table("action_items")
        .delete()
        .eq("id", action_item_id)
        .eq("meeting_id", meeting_id)
        .execute()
    )

    if response.data is None:
        raise HTTPException(
            status_code=400,
            detail="Failed to delete action item",
        )

    return {
        "message": "Action item deleted",
        "action_item_id": action_item_id,
    }
