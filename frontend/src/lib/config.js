// Centralized configuration for API base URL and Supabase credentials.
// Purely environment-driven using import.meta.env variables.
// No credentials or secrets are stored in browser localStorage.

export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

export function getSupabaseCredentials() {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  return {
    url,
    key,
  };
}
