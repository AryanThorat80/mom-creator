import { apiRequest } from '../lib/api.js';
import { getSupabase } from '../lib/supabase.js';

export async function getMe() {
  return await apiRequest('/me', { method: 'GET' });
}

export async function checkRoot() {
  return await apiRequest('/', { method: 'GET' });
}

export async function checkHealth() {
  return await apiRequest('/health', { method: 'GET' });
}

export async function signInWithPassword(email, password) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client is not configured. Please check your credentials in settings.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function signUpWithPassword(email, password, name) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client is not configured. Please check your credentials in settings.');
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || email.split('@')[0],
      },
    },
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function signOutUser() {
  const supabase = getSupabase();
  if (supabase) {
    await supabase.auth.signOut();
  }
}
