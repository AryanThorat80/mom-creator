import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials } from './config.js';

let supabaseClient = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getSupabase() {
  const { url, key } = getSupabaseCredentials();

  if (!url || !key) {
    return null;
  }

  if (!supabaseClient || url !== lastUsedUrl || key !== lastUsedKey) {
    lastUsedUrl = url;
    lastUsedKey = key;
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key);
}
