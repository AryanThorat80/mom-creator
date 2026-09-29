import { apiRequest } from '../lib/api.js';

export async function listActionItems(meetingId) {
  return await apiRequest(`/api/v1/meetings/${meetingId}/actions`, {
    method: 'GET',
  });
}

export async function createActionItem(meetingId, {
  task,
  assigned_to = null,
  assigned_name = null,
  due_date = null,
  status = 'pending',
  priority = 'medium',
}) {
  return await apiRequest(`/api/v1/meetings/${meetingId}/actions`, {
    method: 'POST',
    body: JSON.stringify({
      task,
      assigned_to,
      assigned_name,
      due_date,
      status,
      priority,
    }),
  });
}

export async function updateActionItem(meetingId, actionItemId, payload) {
  return await apiRequest(`/api/v1/meetings/${meetingId}/actions/${actionItemId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteActionItem(meetingId, actionItemId) {
  return await apiRequest(`/api/v1/meetings/${meetingId}/actions/${actionItemId}`, {
    method: 'DELETE',
  });
}
