from fastapi import APIRouter, Depends, HTTPException
from uuid import uuid4
from datetime import datetime, timezone, timedelta
import hashlib
import secrets
from supabase import Client

from app.core.security import (
    get_access_token,
    get_supabase,
)

from app.services.supabase import (
    create_admin_supabase_client,
)

from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceMemberResponse,
    WorkspaceInvitationResponse,
    WorkspaceInvitationCreate,
    WorkspaceInvitationAcceptResponse,
)


router = APIRouter(
    prefix="/workspaces",
    tags=["Workspaces"],
)


# ============================================================
# AUTHENTICATION HELPER
# ============================================================

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

# ============================================================
# INVITATION HELPERS
# ============================================================

INVITATION_EXPIRY_DAYS = 7


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_invitation_token(token: str) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def create_invitation_token() -> str:
    return secrets.token_urlsafe(32)


# ============================================================
# GET /workspaces
# ============================================================

@router.get(
    "",
    response_model=list[WorkspaceResponse],
)
async def list_workspaces(
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    user = get_authenticated_user(
        supabase,
        access_token,
    )

    response = (
        supabase
        .table("workspace_members")
        .select(
            """
            workspace_id,
            role,
            joined_at,
            workspaces (
                id,
                name,
                created_by,
                terminology,
                created_at,
                updated_at
            )
            """
        )
        .eq(
            "user_id",
            user.id,
        )
        .execute()
    )

    if not response.data:
        return []

    workspaces = []

    for row in response.data:
        workspace = row.get("workspaces")

        if workspace:
            workspaces.append(workspace)

    return workspaces


# ============================================================
# POST /workspaces
# ============================================================

@router.post(
    "",
    response_model=WorkspaceResponse,
    status_code=201,
)
async def create_workspace(
    payload: WorkspaceCreate,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    # --------------------------------------------------------
    # 1. Authenticate the request
    # --------------------------------------------------------

    user = get_authenticated_user(
        supabase,
        access_token,
    )

    # --------------------------------------------------------
    # 2. Validate workspace name
    # --------------------------------------------------------

    name = payload.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Workspace name cannot be empty",
        )

    workspace_id = str(uuid4())

    # --------------------------------------------------------
    # 3. Use trusted admin client for INSERT
    # --------------------------------------------------------

    admin_supabase = create_admin_supabase_client()

    try:
        admin_supabase.table("workspaces").insert(
            {
                "id": workspace_id,
                "name": name,
                "created_by": user.id,
                "terminology": payload.terminology,
            }
        ).execute()

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create workspace: {exc}",
        )

    # --------------------------------------------------------
    # 4. Read created workspace
    # --------------------------------------------------------

    try:
        response = (
            admin_supabase
            .table("workspaces")
            .select(
                """
                id,
                name,
                created_by,
                terminology,
                created_at,
                updated_at
                """
            )
            .eq(
                "id",
                workspace_id,
            )
            .single()
            .execute()
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Workspace created but could not be loaded: "
                f"{exc}"
            ),
        )

    if not response.data:
        raise HTTPException(
            status_code=500,
            detail="Workspace created but could not be retrieved",
        )

    return response.data


# ============================================================
# POST /workspaces/{workspace_id}/invitations
# ============================================================

@router.post(
    "/{workspace_id}/invitations",
    response_model=WorkspaceInvitationResponse,
    status_code=201,
)
async def create_workspace_invitation(
    workspace_id: str,
    payload: WorkspaceInvitationCreate,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    # --------------------------------------------------------
    # 1. Authenticate caller
    # --------------------------------------------------------

    user = get_authenticated_user(
        supabase,
        access_token,
    )

    # --------------------------------------------------------
    # 2. Verify caller is workspace owner
    # --------------------------------------------------------

    membership = (
        supabase
        .table("workspace_members")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )

    if not membership or not membership.data:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this workspace",
        )

    if membership.data["role"] != "owner":
        raise HTTPException(
            status_code=403,
            detail="Only the workspace owner can invite members",
        )

    # --------------------------------------------------------
    # 3. Normalize email
    # --------------------------------------------------------

    email = normalize_email(payload.email)

    # --------------------------------------------------------
    # 4. Create admin client and check existing user/member
    # --------------------------------------------------------

    admin_supabase = create_admin_supabase_client()

    try:
        existing_users_response = admin_supabase.auth.admin.list_users()

        # Supabase Python client versions can return either a response
        # object containing .users or the users list directly.
        existing_users = getattr(
            existing_users_response,
            "users",
            existing_users_response,
        ) or []

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not check existing users: {exc}",
        )

    for existing in existing_users:
        existing_email = getattr(existing, "email", None)

        if existing_email and existing_email.lower() == email:
            existing_membership = (
                admin_supabase
                .table("workspace_members")
                .select("user_id")
                .eq("workspace_id", workspace_id)
                .eq("user_id", existing.id)
                .execute()
            )

            if existing_membership and existing_membership.data:
                raise HTTPException(
                    status_code=409,
                    detail="This user is already a member of the workspace",
                )

            break

    # --------------------------------------------------------
    # 5. Check for existing pending invitation
    # --------------------------------------------------------

    existing_invitation = (
        admin_supabase
        .table("workspace_invitations")
        .select(
            """
            id,
            email,
            status,
            expires_at
            """
        )
        .eq("workspace_id", workspace_id)
        .eq("email", email)
        .eq("status", "pending")
        .maybe_single()
        .execute()
    )

    if existing_invitation and existing_invitation.data:
        raise HTTPException(
            status_code=409,
            detail="A pending invitation already exists for this email",
        )

    # --------------------------------------------------------
    # 6. Generate secure invitation token
    # --------------------------------------------------------

    raw_token = create_invitation_token()
    token_hash = hash_invitation_token(raw_token)

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(days=INVITATION_EXPIRY_DAYS)
    )

    # --------------------------------------------------------
    # 7. Store only token hash
    # --------------------------------------------------------

    try:
        response = (
            admin_supabase
            .table("workspace_invitations")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "email": email,
                    "invited_by": user.id,
                    "token_hash": token_hash,
                    "status": "pending",
                    "expires_at": expires_at.isoformat(),
                }
            )
            .select(
                """
                id,
                workspace_id,
                email,
                status,
                expires_at
                """
            )
            .execute()
        )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create invitation: {exc}",
        )

    if not response or not response.data:
        raise HTTPException(
            status_code=500,
            detail="Invitation was not created",
        )

    # --------------------------------------------------------
    # 8. Build frontend acceptance URL
    # --------------------------------------------------------

    invitation_url = (
        f"http://localhost:5173/invitations/{raw_token}"
    )

    return {
        "id": response.data["id"],
        "workspace_id": response.data["workspace_id"],
        "email": response.data["email"],
        "status": response.data["status"],
        "expires_at": response.data["expires_at"],
        "invitation_url": invitation_url,
    }


# ============================================================
# POST /workspaces/invitations/{token}/accept
# ============================================================

@router.post(
    "/invitations/{token}/accept",
    response_model=WorkspaceInvitationAcceptResponse,
)
async def accept_workspace_invitation(
    token: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    # --------------------------------------------------------
    # 1. Authenticate the invited user
    # --------------------------------------------------------

    user = get_authenticated_user(
        supabase,
        access_token,
    )

    if not user.email:
        raise HTTPException(
            status_code=400,
            detail="Your account does not have an email address",
        )

    user_email = normalize_email(user.email)

    # --------------------------------------------------------
    # 2. Hash supplied token
    # --------------------------------------------------------

    token_hash = hash_invitation_token(token)

    admin_supabase = create_admin_supabase_client()

    # --------------------------------------------------------
    # 3. Find invitation
    # --------------------------------------------------------

    response = (
        admin_supabase
        .table("workspace_invitations")
        .select(
            """
            id,
            workspace_id,
            email,
            status,
            expires_at
            """
        )
        .eq(
            "token_hash",
            token_hash,
        )
        .maybe_single()
        .execute()
    )

    invitation = response.data

    if not invitation:
        raise HTTPException(
            status_code=404,
            detail="Invitation not found or invalid",
        )

    # --------------------------------------------------------
    # 4. Validate invitation status
    # --------------------------------------------------------

    if invitation["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail="This invitation is no longer active",
        )

    # --------------------------------------------------------
    # 5. Validate expiration
    # --------------------------------------------------------

    expires_at = datetime.fromisoformat(
        invitation["expires_at"].replace("Z", "+00:00")
    )

    if expires_at <= datetime.now(timezone.utc):
        admin_supabase.table(
            "workspace_invitations"
        ).update(
            {
                "status": "expired",
            }
        ).eq(
            "id",
            invitation["id"],
        ).execute()

        raise HTTPException(
            status_code=400,
            detail="This invitation has expired",
        )

    # --------------------------------------------------------
    # 6. Make sure email matches
    # --------------------------------------------------------

    invited_email = normalize_email(
        invitation["email"]
    )

    if user_email != invited_email:
        raise HTTPException(
            status_code=403,
            detail=(
                "This invitation was sent to a different email address"
            ),
        )

    # --------------------------------------------------------
    # 7. Prevent duplicate membership
    # --------------------------------------------------------

    existing_membership = (
        admin_supabase
        .table("workspace_members")
        .select("user_id, role")
        .eq(
            "workspace_id",
            invitation["workspace_id"],
        )
        .eq(
            "user_id",
            user.id,
        )
        .maybe_single()
        .execute()
    )

    if existing_membership.data:
        # Mark invitation accepted even though membership already exists
        admin_supabase.table(
            "workspace_invitations"
        ).update(
            {
                "status": "accepted",
                "accepted_at": datetime.now(
                    timezone.utc
                ).isoformat(),
                "accepted_by": user.id,
            }
        ).eq(
            "id",
            invitation["id"],
        ).execute()

        return {
            "workspace_id": invitation["workspace_id"],
            "user_id": user.id,
            "role": existing_membership.data["role"],
            "message": "You are already a member of this workspace",
        }

    # --------------------------------------------------------
    # 8. Add user as member
    # --------------------------------------------------------

    try:
        admin_supabase.table(
            "workspace_members"
        ).insert(
            {
                "workspace_id": invitation["workspace_id"],
                "user_id": user.id,
                "role": "member",
            }
        ).execute()

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to add workspace member: {exc}",
        )

    # --------------------------------------------------------
    # 9. Mark invitation accepted
    # --------------------------------------------------------

    try:
        admin_supabase.table(
            "workspace_invitations"
        ).update(
            {
                "status": "accepted",
                "accepted_at": datetime.now(
                    timezone.utc
                ).isoformat(),
                "accepted_by": user.id,
            }
        ).eq(
            "id",
            invitation["id"],
        ).execute()

    except Exception as exc:
        # Membership already exists.
        # Report failure so it can be investigated.
        raise HTTPException(
            status_code=500,
            detail=(
                "Member was added, but invitation could not be "
                f"marked as accepted: {exc}"
            ),
        )

    return {
        "workspace_id": invitation["workspace_id"],
        "user_id": user.id,
        "role": "member",
        "message": "Invitation accepted successfully",
    }


# ============================================================
# DELETE /workspaces/{workspace_id}/members/{member_user_id}
# ============================================================

@router.delete(
    "/{workspace_id}/members/{member_user_id}",
)
async def remove_workspace_member(
    workspace_id: str,
    member_user_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    # --------------------------------------------------------
    # 1. Authenticate caller
    # --------------------------------------------------------

    user = get_authenticated_user(
        supabase,
        access_token,
    )

    # --------------------------------------------------------
    # 2. Verify caller is the workspace owner
    # --------------------------------------------------------

    membership = (
        supabase
        .table("workspace_members")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )

    if not membership.data:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this workspace",
        )

    if membership.data["role"] != "owner":
        raise HTTPException(
            status_code=403,
            detail="Only the workspace owner can remove members",
        )

    if member_user_id == user.id:
        raise HTTPException(
            status_code=400,
            detail="The workspace owner cannot remove themselves",
        )

    # --------------------------------------------------------
    # 3. Verify target member exists and is not an owner
    # --------------------------------------------------------

    admin_supabase = create_admin_supabase_client()

    target = (
        admin_supabase
        .table("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", member_user_id)
        .maybe_single()
        .execute()
    )

    if not target.data:
        raise HTTPException(
            status_code=404,
            detail="Workspace member not found",
        )

    if target.data["role"] == "owner":
        raise HTTPException(
            status_code=400,
            detail="The workspace owner cannot be removed",
        )

    # --------------------------------------------------------
    # 4. Remove member
    # --------------------------------------------------------

    response = (
        admin_supabase
        .table("workspace_members")
        .delete()
        .eq("workspace_id", workspace_id)
        .eq("user_id", member_user_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=400,
            detail="Failed to remove workspace member",
        )

    return {
        "workspace_id": workspace_id,
        "user_id": member_user_id,
        "message": "Workspace member removed successfully",
    }

# ============================================================
# DELETE /workspaces/{workspace_id}/invitations/{invitation_id}
# ============================================================

@router.delete(
    "/{workspace_id}/invitations/{invitation_id}",
)
async def revoke_workspace_invitation(
    workspace_id: str,
    invitation_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    # --------------------------------------------------------
    # 1. Authenticate caller
    # --------------------------------------------------------

    user = get_authenticated_user(
        supabase,
        access_token,
    )

    # --------------------------------------------------------
    # 2. Verify owner
    # --------------------------------------------------------

    membership = (
        supabase
        .table("workspace_members")
        .select("role")
        .eq(
            "workspace_id",
            workspace_id,
        )
        .eq(
            "user_id",
            user.id,
        )
        .maybe_single()
        .execute()
    )

    if not membership.data:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this workspace",
        )

    if membership.data["role"] != "owner":
        raise HTTPException(
            status_code=403,
            detail="Only the workspace owner can revoke invitations",
        )

    # --------------------------------------------------------
    # 3. Revoke invitation
    # --------------------------------------------------------

    admin_supabase = create_admin_supabase_client()

    response = (
        admin_supabase
        .table("workspace_invitations")
        .update(
            {
                "status": "revoked",
            }
        )
        .eq(
            "id",
            invitation_id,
        )
        .eq(
            "workspace_id",
            workspace_id,
        )
        .eq(
            "status",
            "pending",
        )
        .select(
            "id, status"
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Pending invitation not found",
        )

    return {
        "message": "Invitation revoked successfully",
        "invitation_id": invitation_id,
    }
# ============================================================
# GET /workspaces/{workspace_id}
# ============================================================

@router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
)
async def get_workspace(
    workspace_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    # --------------------------------------------------------
    # 1. Authenticate caller
    # --------------------------------------------------------

    user = get_authenticated_user(
        supabase,
        access_token,
    )

    # --------------------------------------------------------
    # 2. Verify workspace membership
    # --------------------------------------------------------

    membership = (
        supabase
        .table("workspace_members")
        .select("role")
        .eq(
            "workspace_id",
            workspace_id,
        )
        .eq(
            "user_id",
            user.id,
        )
        .maybe_single()
        .execute()
    )

    if not membership.data:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this workspace",
        )

    # --------------------------------------------------------
    # 3. Load workspace
    # --------------------------------------------------------

    response = (
        supabase
        .table("workspaces")
        .select(
            """
            id,
            name,
            created_by,
            terminology,
            created_at,
            updated_at
            """
        )
        .eq(
            "id",
            workspace_id,
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Workspace not found",
        )

    return response.data[0]


# ============================================================
# PATCH /workspaces/{workspace_id}
# ============================================================

@router.patch(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
)
async def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdate,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    # --------------------------------------------------------
    # 1. Authenticate caller
    # --------------------------------------------------------

    user = get_authenticated_user(
        supabase,
        access_token,
    )

    # --------------------------------------------------------
    # 2. Verify workspace membership + owner role
    # --------------------------------------------------------

    membership = (
        supabase
        .table("workspace_members")
        .select("role")
        .eq(
            "workspace_id",
            workspace_id,
        )
        .eq(
            "user_id",
            user.id,
        )
        .maybe_single()
        .execute()
    )

    if not membership.data:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this workspace",
        )

    if membership.data["role"] != "owner":
        raise HTTPException(
            status_code=403,
            detail="Only the workspace owner can modify workspace settings",
        )

    # --------------------------------------------------------
    # 3. Build update payload
    # --------------------------------------------------------

    updates = {}

    if payload.name is not None:
        name = payload.name.strip()

        if not name:
            raise HTTPException(
                status_code=400,
                detail="Workspace name cannot be empty",
            )

        updates["name"] = name

    if payload.terminology is not None:
        updates["terminology"] = payload.terminology

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No fields supplied for update",
        )

    # --------------------------------------------------------
    # 4. Update workspace
    # --------------------------------------------------------

    response = (
        supabase
        .table("workspaces")
        .update(updates)
        .eq(
            "id",
            workspace_id,
        )
        .select(
            """
            id,
            name,
            created_by,
            terminology,
            created_at,
            updated_at
            """
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=400,
            detail="Failed to update workspace",
        )

    return response.data[0]


# ============================================================
# GET /workspaces/{workspace_id}/members
# ============================================================

@router.get(
    "/{workspace_id}/members",
    response_model=list[WorkspaceMemberResponse],
)
async def get_workspace_members(
    workspace_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    # --------------------------------------------------------
    # 1. Authenticate caller
    # --------------------------------------------------------

    user = get_authenticated_user(
        supabase,
        access_token,
    )

    # --------------------------------------------------------
    # 2. Verify caller belongs to workspace
    # --------------------------------------------------------

    membership = (
        supabase
        .table("workspace_members")
        .select("role")
        .eq(
            "workspace_id",
            workspace_id,
        )
        .eq(
            "user_id",
            user.id,
        )
        .maybe_single()
        .execute()
    )

    if not membership.data:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this workspace",
        )

    # --------------------------------------------------------
    # 3. Load workspace members + profiles
    # --------------------------------------------------------

    response = (
        supabase
        .table("workspace_members")
        .select(
            """
            workspace_id,
            user_id,
            role,
            joined_at,
            profiles (
                id,
                name
            )
            """
        )
        .eq(
            "workspace_id",
            workspace_id,
        )
        .order(
            "joined_at",
            desc=False,
        )
        .execute()
    )

    # --------------------------------------------------------
    # 4. Format response
    # --------------------------------------------------------

    members = []

    for row in response.data or []:
        profile = row.get("profiles") or {}

        members.append(
            {
                "workspace_id": row["workspace_id"],
                "user_id": row["user_id"],
                "role": row["role"],
                "joined_at": row["joined_at"],
                "name": profile.get("name"),
            }
        )

    return members