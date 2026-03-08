/**
 * Infra: Cost Guard
 * Tracks and limits API costs
 */

import { config } from './config';

export class CostGuard {
  private costs: Map<string, number> = new Map();

  // Rough estimation of costs (update with actual pricing)
  private tokenCost = {
    'gpt-4-turbo-preview': 0.01, // per 1000 tokens (input)
    'gpt-3.5-turbo': 0.002,
  };

  trackTokenUsage(jobId: string, model: string, tokens: number): void {
    const modelKey = model as keyof typeof this.tokenCost;
    const costPerToken = (this.tokenCost[modelKey] || 0.01) / 1000;
    const cost = tokens * costPerToken;

    const current = this.costs.get(jobId) || 0;
    this.costs.set(jobId, current + cost);

    const total = this.costs.get(jobId) || 0;
    if (total > config.maxCostPerJob) {
      throw new Error(
        `Cost limit exceeded for job ${jobId}: $${total.toFixed(2)} > $${config.maxCostPerJob}`
      );
    }
  }

  getCost(jobId: string): number {
    return this.costs.get(jobId) || 0;
  }

  resetCost(jobId: string): void {
    this.costs.delete(jobId);
  }
}
