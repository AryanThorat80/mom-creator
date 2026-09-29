import { apiRequest } from '../lib/api.js';

export async function createMeeting({ workspace_id, title, description = '', mode, meeting_date }) {
  return await apiRequest('/api/v1/meetings', {
    method: 'POST',
    body: JSON.stringify({
      workspace_id,
      title,
      description,
      mode,
      meeting_date,
    }),
  });
}

export async function listMeetings(workspaceId) {
  return await apiRequest(`/api/v1/meetings?workspace_id=${encodeURIComponent(workspaceId)}`, {
    method: 'GET',
  });
}

export async function getMeeting(meetingId) {
  return await apiRequest(`/api/v1/meetings/${meetingId}`, {
    method: 'GET',
  });
}

export async function updateMeeting(meetingId, { title, description, meeting_date }) {
  const payload = {};
  if (title !== undefined) payload.title = title;
  if (description !== undefined) payload.description = description;
  if (meeting_date !== undefined) payload.meeting_date = meeting_date;

  return await apiRequest(`/api/v1/meetings/${meetingId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteMeeting(meetingId) {
  return await apiRequest(`/api/v1/meetings/${meetingId}`, {
    method: 'DELETE',
  });
}
