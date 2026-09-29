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


settings = get_settings()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

GOOGLE_MEET_SCOPES = [
    "https://www.googleapis.com/auth/meetings.space.created",
    "https://www.googleapis.com/auth/meetings.space.settings",
]

GOOGLE_CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events.owned",
]

STATE_MAX_AGE_SECONDS = 10 * 60


def _urlsafe_b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _urlsafe_b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _state_secret() -> bytes:
    value = settings.google_oauth_state_secret.strip()
    if not value:
        raise RuntimeError("GOOGLE_OAUTH_STATE_SECRET is not configured")
    return value.encode("utf-8")


def create_oauth_state(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "issued_at": int(time.time()),
        "nonce": _urlsafe_b64encode(hashlib.sha256(f"{user_id}:{time.time_ns()}".encode()).digest()),
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


def verify_oauth_state(state: str) -> dict[str, Any]:
    try:
        payload_encoded, signature_encoded = state.split(".", 1)
    except ValueError as exc:
        raise ValueError("Invalid OAuth state") from exc

    expected_signature = hmac.new(
        _state_secret(),
        payload_encoded.encode("ascii"),
        hashlib.sha256,
    ).digest()

    try:
        actual_signature = _urlsafe_b64decode(signature_encoded)
    except Exception as exc:
        raise ValueError("Invalid OAuth state signature") from exc

    if not hmac.compare_digest(actual_signature, expected_signature):
        raise ValueError("Invalid OAuth state signature")

    try:
        payload = json.loads(_urlsafe_b64decode(payload_encoded))
    except Exception as exc:
        raise ValueError("Invalid OAuth state payload") from exc

    issued_at = payload.get("issued_at")
    user_id = payload.get("user_id")

    if not isinstance(issued_at, int) or not isinstance(user_id, str):
        raise ValueError("Invalid OAuth state payload")

    if abs(int(time.time()) - issued_at) > STATE_MAX_AGE_SECONDS:
        raise ValueError("OAuth state has expired")

    return payload


def build_google_authorization_url(
    user_id: str,
    scopes: list[str] | None = None,
) -> str:
    missing = []

    if not settings.google_oauth_client_id:
        missing.append("GOOGLE_OAUTH_CLIENT_ID")

    if not settings.google_oauth_redirect_uri:
        missing.append("GOOGLE_OAUTH_REDIRECT_URI")

    if missing:
        raise RuntimeError(
            "Missing Google OAuth configuration: " + ", ".join(missing)
        )

    state = create_oauth_state(user_id)

    requested_scopes = scopes or GOOGLE_MEET_SCOPES

    params = {
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "response_type": "code",
        "scope": " ".join(requested_scopes),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }

    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def _fernet() -> Fernet:
    key = settings.google_token_encryption_key.strip()
    if not key:
        raise RuntimeError(
            "GOOGLE_TOKEN_ENCRYPTION_KEY is not configured"
        )

    try:
        return Fernet(key.encode("ascii"))
    except Exception as exc:
        raise RuntimeError(
            "GOOGLE_TOKEN_ENCRYPTION_KEY is not a valid Fernet key"
        ) from exc


def encrypt_refresh_token(refresh_token: str) -> str:
    if not refresh_token:
        raise ValueError("Google refresh token cannot be empty")

    return _fernet().encrypt(
        refresh_token.encode("utf-8")
    ).decode("utf-8")


def decrypt_refresh_token(encrypted_refresh_token: str) -> str:
    if not encrypted_refresh_token:
        raise ValueError("Encrypted Google refresh token cannot be empty")

    try:
        return _fernet().decrypt(
            encrypted_refresh_token.encode("utf-8")
        ).decode("utf-8")
    except Exception as exc:
        raise RuntimeError("Unable to decrypt Google refresh token") from exc


async def exchange_authorization_code(code: str) -> dict[str, Any]:
    if not code:
        raise ValueError("Google authorization code is missing")

    if not settings.google_oauth_client_secret:
        raise RuntimeError(
            "GOOGLE_OAUTH_CLIENT_SECRET is not configured"
        )

    payload = {
        "code": code,
        "client_id": settings.google_oauth_client_id,
        "client_secret": settings.google_oauth_client_secret,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data=payload,
        )

    if response.status_code >= 400:
        try:
            data = response.json()
        except ValueError:
            data = {}

        message = data.get("error_description") or data.get("error") or response.text
        raise RuntimeError(
            f"Google OAuth token exchange failed: {message}"
        )

    data = response.json()

    if not data.get("access_token"):
        raise RuntimeError("Google OAuth response did not include an access token")

    return data


async def refresh_access_token(
    supabase_admin: Client,
    user_id: str,
) -> str:
    response = (
        supabase_admin
        .table("google_connections")
        .select("refresh_token_encrypted")
        .eq("user_id", user_id)
        .execute()
    )

    if not response.data:
        raise LookupError("Google account is not connected")

    encrypted_refresh_token = response.data[0].get(
        "refresh_token_encrypted"
    )

    refresh_token = decrypt_refresh_token(encrypted_refresh_token)

    payload = {
        "client_id": settings.google_oauth_client_id,
        "client_secret": settings.google_oauth_client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data=payload,
        )

    if token_response.status_code >= 400:
        try:
            data = token_response.json()
        except ValueError:
            data = {}

        message = data.get("error_description") or data.get("error") or token_response.text
        raise RuntimeError(
            f"Google access-token refresh failed: {message}"
        )

    data = token_response.json()
    access_token = data.get("access_token")

    if not access_token:
        raise RuntimeError(
            "Google token refresh response did not include an access token"
        )

    new_refresh_token = data.get("refresh_token")
    if new_refresh_token and new_refresh_token != refresh_token:
        supabase_admin.table("google_connections").update({
            "refresh_token_encrypted": encrypt_refresh_token(new_refresh_token),
        }).eq("user_id", user_id).execute()

    return access_token


def save_google_connection(
    supabase_admin: Client,
    user_id: str,
    token_data: dict[str, Any],
) -> None:
    refresh_token = token_data.get("refresh_token")

    existing = (
        supabase_admin
        .table("google_connections")
        .select("refresh_token_encrypted")
        .eq("user_id", user_id)
        .execute()
    )

    if not refresh_token and not existing.data:
        raise RuntimeError(
            "Google did not return a refresh token. Re-authorize the account."
        )

    row: dict[str, Any] = {
        "user_id": user_id,
        "granted_scopes": (
            token_data.get("scope", "").split()
            if token_data.get("scope")
            else GOOGLE_MEET_SCOPES
        ),
    }

    if refresh_token:
        row["refresh_token_encrypted"] = encrypt_refresh_token(refresh_token)

    if existing.data:
        (
            supabase_admin
            .table("google_connections")
            .update(row)
            .eq("user_id", user_id)
            .execute()
        )
    else:
        (
            supabase_admin
            .table("google_connections")
            .insert(row)
            .execute()
        )
