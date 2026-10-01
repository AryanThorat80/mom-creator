import { getSupabase } from '../lib/supabase.js';
import { apiRequest } from '../lib/api.js';

const BUCKET = 'workspace-mom-template';

function sanitizeFileName(fileName) {
  return fileName
    .trim()
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-');
}

export async function getMOMTemplate(workspaceId) {
  return await apiRequest(
    `/api/v1/mom-templates/workspace/${workspaceId}`,
    {
      method: 'GET',
    }
  );
}

export async function uploadMOMTemplate(
  workspaceId,
  file,
  sourceType = 'template'
) {
  const supabase = getSupabase();

  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  if (!file) {
    throw new Error('Please select a file');
  }

  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only PDF, DOC, and DOCX files are supported');
  }

  const maxSize = 10 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error('File size must be 10 MB or less');
  }

  const safeName = sanitizeFileName(file.name);

  const filePath = `${workspaceId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload file');
  }

  try {
    return await apiRequest(
      `/api/v1/mom-templates/workspace/${workspaceId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: file.name,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type || null,
          file_size: file.size,
          source_type: sourceType,
        }),
      }
    );
  } catch (error) {
    await supabase.storage
      .from(BUCKET)
      .remove([filePath]);

    throw error;
  }
}

export async function replaceMOMTemplate(
  workspaceId,
  file,
  sourceType = 'template'
) {
  const existing = await getMOMTemplate(workspaceId);

  if (existing?.file_path) {
    const supabase = getSupabase();

    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([existing.file_path]);

    if (error) {
      throw new Error(
        error.message || 'Failed to remove previous file'
      );
    }
  }

  await deleteMOMTemplate(workspaceId);

  return await uploadMOMTemplate(
    workspaceId,
    file,
    sourceType
  );
}

export async function updateMOMTemplate(
  workspaceId,
  data
) {
  return await apiRequest(
    `/api/v1/mom-templates/workspace/${workspaceId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
}

export async function deleteMOMTemplate(workspaceId) {
  return await apiRequest(
    `/api/v1/mom-templates/workspace/${workspaceId}`,
    {
      method: 'DELETE',
    }
  );
}

async function supabaseRemove(filePath) {
  const supabase = getSupabase();

  if (!supabase || !filePath) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath]);

  if (error) {
    console.warn(
      'Failed to remove previous MOM template file:',
      error
    );
  }
}