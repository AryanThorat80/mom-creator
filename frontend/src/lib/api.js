import { getApiBaseUrl } from './config.js';
import { getSupabase } from './supabase.js';

export class ApiError extends Error {
  constructor(message, status = 500, data = null, endpoint = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.endpoint = endpoint;
  }
}

function parseErrorMessage(status, data, defaultMsg) {
  if (data) {
    if (typeof data === 'string' && data.trim()) {
      return data;
    }
    if (data.detail) {
      if (typeof data.detail === 'string') {
        return data.detail;
      }
      if (Array.isArray(data.detail)) {
        // FastAPI validation errors
        return data.detail
          .map((err) => (err.loc ? `${err.loc.slice(1).join('.')}: ${err.msg}` : err.msg))
          .join('; ');
      }
    }
    if (data.message) {
      return data.message;
    }
  }

  switch (status) {
    case 400:
      return 'Invalid request. Please verify your input.';
    case 401:
      return 'Session expired or unauthenticated. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'Conflict or action not ready yet. Please try again shortly.';
    case 500:
      return 'Internal backend error. Please try again or check server logs.';
    case 502:
      return 'Upstream Google service error. Please verify Google permissions.';
    default:
      return defaultMsg || `Request failed with status ${status}`;
  }
}

export async function apiRequest(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});

  // Retrieve current Supabase access token if Supabase is initialized
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      }
    } catch (e) {
      console.warn('Could not retrieve Supabase session for API request:', e);
    }
  }

  // Set default Content-Type to JSON if not sending FormData and method has a body
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const responseType = options.responseType || 'json';

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError) {
    throw new ApiError(
      `Network error connecting to backend at ${baseUrl}. Ensure FastAPI is running.`,
      0,
      null,
      cleanEndpoint
    );
  }

  if (!response.ok) {
    let errorData = null;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = await response.text();
      }
    } catch {
      // ignore
    }

    const message = parseErrorMessage(response.status, errorData, response.statusText);
    throw new ApiError(message, response.status, errorData, cleanEndpoint);
  }

  if (response.status === 204) {
    return null;
  }

  if (responseType === 'blob') {
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition');
    let filename = '';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    }
    return { blob, filename };
  }

  if (responseType === 'text') {
    return await response.text();
  }

  // Default: json
  try {
    return await response.json();
  } catch {
    return null;
  }
}
