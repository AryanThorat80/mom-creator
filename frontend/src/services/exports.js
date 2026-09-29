import { apiRequest } from '../lib/api.js';

export async function downloadDocx(meetingId) {
  const result = await apiRequest(`/api/v1/meetings/${meetingId}/export/docx`, {
    method: 'GET',
    responseType: 'blob',
  });

  const blob = result.blob;
  const filename = result.filename || `meeting_${meetingId}_mom.docx`;

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);

  return { success: true, filename };
}

export async function downloadExcel(meetingId) {
  const result = await apiRequest(`/api/v1/meetings/${meetingId}/export/excel`, {
    method: 'GET',
    responseType: 'blob',
  });

  const blob = result.blob;
  const filename = result.filename || `meeting_${meetingId}_mom.xlsx`;

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);

  return { success: true, filename };
}

export async function getPrintableMOM(meetingId) {
  return await apiRequest(`/api/v1/meetings/${meetingId}/export/printable`, {
    method: 'GET',
    responseType: 'text',
  });
}
