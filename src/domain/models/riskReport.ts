/**
 * Domain: Risk Report Model
 * Output of reality checks on generated content
 */

export interface RiskReport {
  id: string;
  targetId: string; // book or page id
  timestamp: Date;
  issues: RiskIssue[];
  approved: boolean;
  notes?: string;
}

export interface RiskIssue {
  severity: 'low' | 'medium' | 'high';
  category: string; // e.g., 'inappropriate-content', 'factual-error', 'reading-level'
  description: string;
  recommendation?: string;
}

export function createRiskReport(data: Omit<RiskReport, 'id' | 'timestamp'>): RiskReport {
  return {
    ...data,
    id: crypto.randomUUID(),
    timestamp: new Date(),
  };
}
