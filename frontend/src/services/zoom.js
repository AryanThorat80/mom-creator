import { apiRequest } from '../lib/api.js';

export async function connectZoom() {
  return await apiRequest('/api/v1/integrations/zoom/connect', {
    method: 'GET',
  });
}

export async function createZoomMeeting(meetingId) {
  return await apiRequest(`/api/v1/integrations/zoom/meetings/${meetingId}/zoom`, {
    method: 'POST',
  });
}

export async function getZoomMeeting(meetingId) {
  return await apiRequest(`/api/v1/integrations/zoom/meetings/${meetingId}/zoom`, {
    method: 'GET',
  });
}

export async function syncZoomTranscript(meetingId) {
  return await apiRequest(
    `/api/v1/integrations/zoom/meetings/${meetingId}/zoom/sync-transcript`,
    {
      method: 'POST',
    }
  );
}