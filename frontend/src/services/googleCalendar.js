import { apiRequest } from '../lib/api.js';

export async function connectGoogleCalendar() {
  return await apiRequest('/api/v1/integrations/google/calendar/connect', {
    method: 'GET',
  });
}

export async function getGoogleCalendarStatus() {
  return await apiRequest('/api/v1/integrations/google/calendar/status', {
    method: 'GET',
  });
}

export async function createCalendarEvent(actionItemId, {
  title,
  description,
  start_datetime,
  end_datetime,
  time_zone,
}) {
  return await apiRequest(`/api/v1/integrations/google/calendar/action-items/${actionItemId}/event`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      description,
      start_datetime,
      end_datetime,
      time_zone,
    }),
  });
}

export async function getCalendarEvent(actionItemId) {
  return await apiRequest(`/api/v1/integrations/google/calendar/action-items/${actionItemId}/event`, {
    method: 'GET',
  });
}

export async function deleteCalendarEvent(actionItemId) {
  return await apiRequest(`/api/v1/integrations/google/calendar/action-items/${actionItemId}/event`, {
    method: 'DELETE',
  });
}
