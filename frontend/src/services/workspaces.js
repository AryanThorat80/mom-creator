import { apiRequest } from '../lib/api.js';

export async function listWorkspaces() {
  return await apiRequest('/workspaces', { method: 'GET' });
}

export async function createWorkspace({ name, terminology = {} }) {
  return await apiRequest('/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name, terminology }),
  });
}

export async function getWorkspace(workspaceId) {
  return await apiRequest(`/workspaces/${workspaceId}`, {
    method: 'GET',
  });
}

export async function updateWorkspace(workspaceId, payload) {
  return await apiRequest(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getWorkspaceMembers(workspaceId) {
  return await apiRequest(
    `/workspaces/${workspaceId}/members`,
    { method: 'GET' }
  );
}

export async function removeWorkspaceMember(
  workspaceId,
  userId
) {
  return await apiRequest(
    `/workspaces/${workspaceId}/members/${userId}`,
    {
      method: 'DELETE',
    }
  );
}

export async function createWorkspaceInvitation(
  workspaceId,
  email
) {
  return await apiRequest(
    `/workspaces/${workspaceId}/invitations`,
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    }
  );
}

export async function acceptWorkspaceInvitation(token) {
  return await apiRequest(
    `/workspaces/invitations/${token}/accept`,
    {
      method: 'POST',
    }
  );
}

export async function revokeWorkspaceInvitation(
  workspaceId,
  invitationId
) {
  return await apiRequest(
    `/workspaces/${workspaceId}/invitations/${invitationId}`,
    {
      method: 'DELETE',
    }
  );
}
