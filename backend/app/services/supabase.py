from supabase import Client, create_client

from app.core.config import settings


def get_clean_supabase_url() -> str:
    """
    Return the base Supabase project URL.

    Protects against accidentally having REST/Auth paths
    included in SUPABASE_URL.
    """

    url = settings.supabase_url.strip().rstrip("/")

    if url.endswith("/rest/v1"):
        url = url[:-len("/rest/v1")]

    if url.endswith("/auth/v1"):
        url = url[:-len("/auth/v1")]

    return url.rstrip("/")


def create_user_supabase_client(
    access_token: str,
) -> Client:
    """
    Create a Supabase client for an authenticated user.

    Uses the anon/publishable key for API access while attaching
    the user's JWT directly to PostgREST so Supabase RLS can
    evaluate auth.uid() correctly.
    """

    if not access_token:
        raise ValueError(
            "Access token is required"
        )

    supabase_url = get_clean_supabase_url()

    client = create_client(
        supabase_url,
        settings.supabase_anon_key,
    )

    # IMPORTANT:
    # Attach the user's JWT to PostgREST itself.
    client.postgrest.auth(access_token)

    return client

def create_admin_supabase_client() -> Client:
    """
    Create a trusted backend Supabase client.

    Uses the service-role key and therefore bypasses normal
    Supabase RLS protections.

    Never expose this client or key to the frontend.
    """

    if not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not configured"
        )

    supabase_url = get_clean_supabase_url()

    return create_client(
        supabase_url,
        settings.supabase_service_role_key,
    )