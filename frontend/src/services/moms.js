import { apiRequest } from '../lib/api.js';

export async function getMOM(momId) {
  return await apiRequest(`/api/v1/moms/${momId}`, {
    method: 'GET',
  });
}
export async function getMOMByMeeting(meetingId) {
  return await apiRequest(`/api/v1/moms/meeting/${meetingId}`, {
    method: 'GET',
  });
}

export async function updateMOM(momId, {
  title,
  summary,
  key_discussion_points,
  decisions,
  next_steps,
  abbreviations_used,
}) {
  const payload = {};
  if (title !== undefined) payload.title = title;
  if (summary !== undefined) payload.summary = summary;
  if (key_discussion_points !== undefined) payload.key_discussion_points = key_discussion_points;
  if (decisions !== undefined) payload.decisions = decisions;
  if (next_steps !== undefined) payload.next_steps = next_steps;
  if (abbreviations_used !== undefined) payload.abbreviations_used = abbreviations_used;

  return await apiRequest(`/api/v1/moms/${momId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function reviewMOM(momId) {
  return await apiRequest(`/api/v1/moms/${momId}/review`, {
    method: 'POST',
  });
}

export async function finalizeMOM(momId) {
  return await apiRequest(`/api/v1/moms/${momId}/finalize`, {
    method: 'POST',
  });
}
