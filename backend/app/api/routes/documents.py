from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from supabase import Client

from app.core.security import get_access_token, get_supabase
from app.services.document_export import (
    build_export_payload,
    generate_docx,
    generate_printable_html,
    generate_xlsx,
    safe_filename,
)


router = APIRouter(
    prefix="/api/v1/meetings",
    tags=["Exports"],
)


def _get_current_user(supabase: Client, access_token: str):
    response = supabase.auth.get_user(access_token)
    if response.user is None:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return response.user


def _load_export_data(supabase: Client, meeting_id: str):
    meeting_response = (
        supabase.table("meetings")
        .select("id,workspace_id,created_by,title,description,mode,status,meeting_date,created_at,updated_at")
        .eq("id", meeting_id)
        .execute()
    )
    if not meeting_response.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    meeting = meeting_response.data[0]

    mom_response = (
        supabase.table("moms")
        .select("id,meeting_id,created_by,title,summary,transcript,key_discussion_points,decisions,next_steps,abbreviations_used,status,generated_at,created_at,updated_at")
        .eq("meeting_id", meeting_id)
        .execute()
    )
    if not mom_response.data:
        raise HTTPException(status_code=404, detail="No MOM exists for this meeting")
    mom = mom_response.data[0]

    action_response = (
        supabase.table("action_items")
        .select("id,mom_id,meeting_id,created_by,assigned_to,assigned_name,task,due_date,status,priority,completed_at,google_event_id,created_at,updated_at")
        .eq("meeting_id", meeting_id)
        .order("created_at", desc=False)
        .execute()
    )

    return build_export_payload(
        meeting=meeting,
        mom=mom,
        action_items=action_response.data or [],
    )


@router.get("/{meeting_id}/export/docx")
async def export_docx(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    _get_current_user(supabase, access_token)
    payload = _load_export_data(supabase, meeting_id)
    content = generate_docx(payload["meeting"], payload["mom"], payload["action_items"])
    filename = safe_filename(payload["mom"].get("title") or payload["meeting"].get("title")) + ".docx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@router.get("/{meeting_id}/export/excel")
async def export_excel(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    _get_current_user(supabase, access_token)
    payload = _load_export_data(supabase, meeting_id)
    content = generate_xlsx(payload["meeting"], payload["mom"], payload["action_items"])
    filename = safe_filename(payload["mom"].get("title") or payload["meeting"].get("title")) + ".xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@router.get("/{meeting_id}/export/printable", response_class=HTMLResponse)
async def export_printable(
    meeting_id: str,
    supabase: Client = Depends(get_supabase),
    access_token: str = Depends(get_access_token),
):
    _get_current_user(supabase, access_token)
    payload = _load_export_data(supabase, meeting_id)
    return HTMLResponse(
        content=generate_printable_html(payload["meeting"], payload["mom"], payload["action_items"]),
        headers={"Cache-Control": "no-store"},
    )
