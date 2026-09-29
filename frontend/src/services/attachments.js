import { apiRequest } from '../lib/api.js';
import { getSupabase } from '../lib/supabase.js';

export async function uploadToStorage({
  file,
  bucket,
  workspaceId,
  meetingId,
  customFileName,
}) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client is not configured for storage upload.');
  }

  const originalName = file?.name || 'recording.webm';
  const fileName =
    customFileName ||
    `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = `${workspaceId}/${meetingId}/${fileName}`;


  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload to storage: ${error.message}`);
  }

  return {
    path: data.path || filePath,
    fileName,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
  };
}

export async function confirmAttachmentUpload({
  meeting_id,
  bucket,
  path,
  file_name,
  file_type,
  file_size,
  attachment_type = 'meeting_attachment',
}) {
  return await apiRequest('/api/v1/attachments/confirm', {
    method: 'POST',
    body: JSON.stringify({
      meeting_id,
      bucket,
      path,
      file_name,
      file_type,
      file_size,
      attachment_type,
    }),
  });
}
