export type JobStatus =
  // Legacy single-story flow
  | 'PLANNING'
  | 'WAIT_PLAN_APPROVAL'
  | 'PLAN_APPROVED'
  | 'STORY_RUNNING'
  | 'WAIT_TEXT_APPROVAL'
  | 'TEXT_APPROVED'
  | 'EXPORTING'
  | 'CANVA_READY'
  // Multi-story review flow
  | 'STORIES_RUNNING'
  | 'WAIT_STORY_REVIEW'
  | 'STORIES_APPROVED'
  // Terminal
  | 'REJECTED'
  | 'ERROR';

export interface JobState {
  jobId: string;
  idea: string;
  status: JobStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
