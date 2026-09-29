import base64
import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet
from supabase import Client

from app.core.config import get_settings
from app.services.google_oauth import create_oauth_state, verify_oauth_state

settings = get_settings()

ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize"
ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"
ZOOM_SCOPES = [
    "meeting:write:meeting",
    "meeting:read:meeting",
    "cloud_recording:read:list_recording_files",
    "cloud_recording:read:meeting_transcript",
]


def _fernet() -> Fernet:
    key = settings.google_token_encryption_key.strip()
    if not key:
        raise RuntimeError("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured")
    try:
        return Fernet(key.encode("ascii"))
    except Exception as exc:
        raise RuntimeError("GOOGLE_TOKEN_ENCRYPTION_KEY is not a valid Fernet key") from exc


def encrypt_refresh_token(refresh_token: str) -> str:
    if not refresh_token:
        raise ValueError("Zoom refresh token cannot be empty")
    return _fernet().encrypt(refresh_token.encode("utf-8")).decode("utf-8")


def decrypt_refresh_token(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        raise RuntimeError("Unable to decrypt Zoom refresh token") from exc

def _urlsafe_b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _state_secret() -> bytes:
    secret = settings.google_oauth_state_secret.strip()

    if not secret:
        raise RuntimeError("GOOGLE_OAUTH_STATE_SECRET is not configured")

    return secret.encode("utf-8")

def create_zoom_oauth_state(
    user_id: str,
    meeting_id: str | None = None,
) -> str:
    payload = {
        "user_id": user_id,
        "meeting_id": meeting_id,
        "issued_at": int(time.time()),
        "nonce": _urlsafe_b64encode(
            hashlib.sha256(
                f"{user_id}:{meeting_id}:{time.time_ns()}".encode()
            ).digest()
        ),
    }

    payload_bytes = json.dumps(
        payload,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")

    payload_encoded = _urlsafe_b64encode(payload_bytes)

    signature = hmac.new(
        _state_secret(),
        payload_encoded.encode("ascii"),
        hashlib.sha256,
    ).digest()

    return f"{payload_encoded}.{_urlsafe_b64encode(signature)}"


def build_zoom_authorization_url(
    user_id: str,
    meeting_id: str | None = None,
) -> str:
    if not settings.zoom_oauth_client_id:
        raise RuntimeError("ZOOM_OAUTH_CLIENT_ID is not configured")
    if not settings.zoom_oauth_redirect_uri:
        raise RuntimeError("ZOOM_OAUTH_REDIRECT_URI is not configured")

    state = create_zoom_oauth_state(user_id, meeting_id)

    params = {
        "response_type": "code",
        "client_id": settings.zoom_oauth_client_id,
        "redirect_uri": settings.zoom_oauth_redirect_uri,
        "state": state,
    }

    return f"{ZOOM_AUTH_URL}?{urlencode(params)}"

def verify_zoom_oauth_state(state: str) -> dict[str, Any]:
    return verify_oauth_state(state)


async def exchange_zoom_authorization_code(code: str) -> dict[str, Any]:
    if not code:
        raise ValueError("Zoom authorization code is missing")
    if not settings.zoom_oauth_client_secret:
        raise RuntimeError("ZOOM_OAUTH_CLIENT_SECRET is not configured")

    basic = base64.b64encode(
        f"{settings.zoom_oauth_client_id}:{settings.zoom_oauth_client_secret}".encode()
    ).decode()

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            ZOOM_TOKEN_URL,
            params={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.zoom_oauth_redirect_uri,
            },
            headers={"Authorization": f"Basic {basic}"},
        )

    if response.status_code >= 400:
        try:
            data = response.json()
        except ValueError:
            data = {}
        message = data.get("reason") or data.get("error") or response.text
        raise RuntimeError(f"Zoom OAuth token exchange failed: {message}")

    data = response.json()
    if not data.get("access_token"):
        raise RuntimeError("Zoom OAuth response did not include an access token")
    return data


async def refresh_access_token(admin: Client, user_id: str) -> str:
    response = (
        admin.table("zoom_connections")
        .select("refresh_token_encrypted")
        .eq("user_id", user_id)
        .execute()
    )

    if not response.data:
        raise LookupError("Zoom account is not connected")

    refresh_token = decrypt_refresh_token(response.data[0]["refresh_token_encrypted"])

    basic = base64.b64encode(
        f"{settings.zoom_oauth_client_id}:{settings.zoom_oauth_client_secret}".encode()
    ).decode()

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            ZOOM_TOKEN_URL,
            params={"grant_type": "refresh_token", "refresh_token": refresh_token},
            headers={"Authorization": f"Basic {basic}"},
        )

    if response.status_code >= 400:
        try:
            data = response.json()
        except ValueError:
            data = {}
        message = data.get("reason") or data.get("error") or response.text
        raise RuntimeError(f"Zoom access-token refresh failed: {message}")

    data = response.json()
    access_token = data.get("access_token")
    new_refresh_token = data.get("refresh_token")

    if not access_token:
        raise RuntimeError("Zoom token refresh response did not include an access token")

    if new_refresh_token and new_refresh_token != refresh_token:
        admin.table("zoom_connections").update({
            "refresh_token_encrypted": encrypt_refresh_token(new_refresh_token),
        }).eq("user_id", user_id).execute()

    return access_token


def save_zoom_connection(admin: Client, user_id: str, token_data: dict[str, Any]) -> None:
    refresh_token = token_data.get("refresh_token")

    existing = (
        admin.table("zoom_connections")
        .select("refresh_token_encrypted")
        .eq("user_id", user_id)
        .execute()
    )

    if not refresh_token and not existing.data:
        raise RuntimeError("Zoom did not return a refresh token. Re-authorize the account.")

    row: dict[str, Any] = {
        "user_id": user_id,
        "granted_scopes": token_data.get("scope", "").split() or ZOOM_SCOPES,
    }

    if refresh_token:
        row["refresh_token_encrypted"] = encrypt_refresh_token(refresh_token)

    if existing.data:
        admin.table("zoom_connections").update(row).eq("user_id", user_id).execute()
    else:
        admin.table("zoom_connections").insert(row).execute()
