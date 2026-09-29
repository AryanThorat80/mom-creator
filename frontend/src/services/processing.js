import { apiRequest } from '../lib/api.js';

export async function createProcessingJob({
  meeting_id,
  job_type,
  input_file_path,
  source_attachment_id,
}) {
  const payload = {
    meeting_id,
    job_type,
  };
  if (input_file_path) payload.input_file_path = input_file_path;
  if (source_attachment_id) payload.source_attachment_id = source_attachment_id;

  return await apiRequest('/api/v1/processing', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getProcessingJob(jobId) {
  return await apiRequest(`/api/v1/processing/${jobId}`, {
    method: 'GET',
  });
}

export async function runProcessingJob(jobId) {
  return await apiRequest(`/api/v1/processing/${jobId}/run`, {
    method: 'POST',
  });
}

export async function pollProcessingJob(jobId, { onUpdate, intervalMs = 2000, maxAttempts = 150 } = {}) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const job = await getProcessingJob(jobId);
    if (onUpdate) {
      onUpdate(job);
    }

    if (job.status === 'completed') {
      return job;
    }

    if (job.status === 'failed') {
      throw new Error(job.error_message || 'Processing job failed.');
    }

    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Processing job timed out. You can check back shortly.');
}
