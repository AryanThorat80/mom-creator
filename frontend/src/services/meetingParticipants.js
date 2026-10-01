import { apiRequest } from '../lib/api.js';

export async function listMeetingParticipants(meetingId) {
  return await apiRequest(`/api/v1/meetings/${meetingId}/participants`, {
    method: 'GET',
  });
}

export async function createMeetingParticipant(meetingId, payload) {
  return await apiRequest(`/api/v1/meetings/${meetingId}/participants`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateMeetingParticipant(meetingId, participantId, payload) {
  return await apiRequest(
    `/api/v1/meetings/${meetingId}/participants/${participantId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteMeetingParticipant(meetingId, participantId) {
  return await apiRequest(
    `/api/v1/meetings/${meetingId}/participants/${participantId}`,
    {
      method: 'DELETE',
    }
  );
}
