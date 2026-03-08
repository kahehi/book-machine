import { join } from 'path';
import type { StorageProvider } from '../../providers/storage/storage.js';
import type { JobState, JobStatus } from './jobState.js';

function statePath(jobId: string): string {
  return join('jobs', jobId, 'state.json');
}

export async function createJobState(
  storage: StorageProvider,
  jobId: string,
  idea: string,
  status: JobStatus,
): Promise<JobState> {
  const now = new Date().toISOString();
  const state: JobState = { jobId, idea, status, createdAt: now, updatedAt: now };
  await storage.write(statePath(jobId), state);
  return state;
}

export async function updateJobStatus(
  storage: StorageProvider,
  jobId: string,
  status: JobStatus,
  errorMessage?: string,
): Promise<void> {
  const prev = await storage.readJson<JobState>(statePath(jobId));
  if (!prev) throw new Error(`Job state not found: ${jobId}`);
  const next: JobState = {
    ...prev,
    status,
    updatedAt: new Date().toISOString(),
    ...(errorMessage !== undefined ? { errorMessage } : {}),
  };
  await storage.write(statePath(jobId), next);
}

export async function getJobState(
  storage: StorageProvider,
  jobId: string,
): Promise<JobState | null> {
  return storage.readJson<JobState>(statePath(jobId));
}
