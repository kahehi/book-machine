export type ApprovalType = 'PLAN_OK' | 'TEXT_OK';

export interface ApprovalRecord {
  type: ApprovalType;
  jobId: string;
  approved: boolean;
  response: string;
  timestamp: string;
}
