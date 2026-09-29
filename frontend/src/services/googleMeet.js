import { apiRequest } from '../lib/api.js';

export async function connectGoogleMeet() {
  return await apiRequest('/api/v1/integrations/google/meet/connect', {
    method: 'GET',
  });
}

export async function createGoogleMeet(meetingId) {
  return await apiRequest(`/api/v1/integrations/google/meetings/${meetingId}/meet`, {
    method: 'POST',
  });
}

export async function getGoogleMeet(meetingId) {
  return await apiRequest(`/api/v1/integrations/google/meetings/${meetingId}/meet`, {
    method: 'GET',
  });
}

export async function syncGoogleMeetTranscript(meetingId) {
  return await apiRequest(`/api/v1/integrations/google/meetings/${meetingId}/meet/sync-transcript`, {
    method: 'POST',
  });
}
