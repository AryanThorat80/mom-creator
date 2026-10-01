import { apiRequest } from '../lib/api.js';

/**
 * Export a meeting MOM as PDF.
 *
 * Backend endpoint:
 * GET /api/v1/meetings/{meetingId}/export/pdf
 */
export async function exportMOMPdf(meetingId) {
  if (!meetingId) {
    throw new Error('Meeting ID is required');
  }

  const result = await apiRequest(
    `/api/v1/meetings/${meetingId}/export/pdf`,
    {
      method: 'GET',
      responseType: 'blob',
    }
  );

  if (!result?.blob) {
    throw new Error('PDF export returned no file');
  }

  const blobUrl = window.URL.createObjectURL(result.blob);

  try {
    const link = document.createElement('a');

    link.href = blobUrl;

    link.download =
      result.filename ||
      `MOM-${meetingId}.pdf`;

    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.URL.revokeObjectURL(blobUrl);
  }

  return result;
}

/*
 * Keep downloadPdf as an alias so MOMEditor.jsx
 * and any other existing component can use either name.
 */
export async function downloadPdf(meetingId) {
  return await exportMOMPdf(meetingId);
}