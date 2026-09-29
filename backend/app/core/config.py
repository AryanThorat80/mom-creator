from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    # ============================================================
    # SUPABASE
    # ============================================================

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str


    # ============================================================
    # GEMINI
    # ============================================================

    ai_api_key: str
    ai_base_url: str
    ai_model: str


    # ============================================================
    # TRANSCRIPTION
    # ============================================================

    # Gemini transcription model.
    # This is kept separate from the MOM generation model.
    transcription_model: str = "gemini-3.5-transcribe"


    # ============================================================
    # APPLICATION
    # ============================================================

    mom_default_language: str = "English"

    frontend_url: str = "http://localhost:5173"
    app_name: str = "MOM Creator API"
    app_version: str = "0.1.0"


    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8000/api/v1/integrations/google/meet/callback"
    google_oauth_state_secret: str = ""
    google_token_encryption_key: str = ""

    zoom_oauth_client_id: str = ""
    zoom_oauth_client_secret: str = ""
    zoom_oauth_redirect_uri: str = "http://localhost:8000/api/v1/integrations/zoom/callback"


    # ============================================================
    # PYDANTIC SETTINGS
    # ============================================================

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()