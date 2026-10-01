import { apiRequest } from '../lib/api.js';


export async function getFirefliesStatus(
  workspaceId
) {
  return await apiRequest(
    `/api/v1/integrations/fireflies/status?workspace_id=${encodeURIComponent(
      workspaceId
    )}`,
    {
      method: 'GET',
    }
  );
}


export async function connectFireflies({
  workspace_id,
  api_key,
}) {
  return await apiRequest(
    '/api/v1/integrations/fireflies/connect',
    {
      method: 'POST',
      body: JSON.stringify({
        workspace_id,
        api_key,
      }),
    }
  );
}


export async function disconnectFireflies(
  workspaceId
) {
  return await apiRequest(
    `/api/v1/integrations/fireflies/disconnect?workspace_id=${encodeURIComponent(
      workspaceId
    )}`,
    {
      method: 'DELETE',
    }
  );
}


export async function refreshFireflies(
  workspaceId
) {
  return await apiRequest(
    `/api/v1/integrations/fireflies/refresh?workspace_id=${encodeURIComponent(
      workspaceId
    )}`,
    {
      method: 'POST',
    }
  );
}