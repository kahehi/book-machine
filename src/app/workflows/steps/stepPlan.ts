import { join } from 'path';
import { logger } from '../../../infra/logger.js';
import { config } from '../../../infra/config.js';
import { MockLlmClient } from '../../../providers/llm/mockClient.js';
import { PlannerAgent } from '../../../agents/plannerAgent.js';
import { RealityCheckAgent } from '../../../agents/realityCheckAgent.js';
import { MarketEvalAgent } from '../../../agents/marketEvalAgent.js';
import { updateJobStatus } from '../../jobs/jobService.js';
import type { StorageProvider } from '../../../providers/storage/storage.js';
import type { LlmClient } from '../../../providers/llm/llmClient.js';

export interface PlanParams {
  targetAge?: string;
  tone?: string;
  bookCount?: number;
}

function createLlm(params?: PlanParams): LlmClient {
  if (config.llmProvider === 'mock') return new MockLlmClient({
    bookCount: params?.bookCount,
    targetAge: params?.targetAge,
  });
  throw new Error(`LLM provider "${config.llmProvider}" not implemented.`);
}

export async function stepPlan(
  jobId: string,
  idea: string,
  storage: StorageProvider,
  params?: PlanParams,
): Promise<void> {
  try {
    const llm = createLlm(params);
    const plannerAgent = new PlannerAgent(llm);
    const realityCheckAgent = new RealityCheckAgent(llm);
    const marketEvalAgent = new MarketEvalAgent(llm);

    logger.info(`[stepPlan:${jobId}] Planning...`);
    const plan = await plannerAgent.run(idea, params);
    await storage.write(join('jobs', jobId, 'plan.json'), plan);
    logger.info(`[stepPlan:${jobId}] Plan done: "${plan.seriesTitle}"`);

    logger.info(`[stepPlan:${jobId}] Reality check (internal)...`);
    const realityCheck = await realityCheckAgent.run(plan);
    await storage.write(join('jobs', jobId, 'reality_check.json'), realityCheck);
    const high = realityCheck.risks.filter((r) => r.severity === 'high').length;
    logger.info(`[stepPlan:${jobId}] Reality check done — high risks: ${high}`);

    logger.info(`[stepPlan:${jobId}] Market evaluation...`);
    const marketEval = await marketEvalAgent.run(plan);
    await storage.write(join('jobs', jobId, 'market_eval.json'), marketEval);
    logger.info(`[stepPlan:${jobId}] Market eval done — probability: ${marketEval.successProbability}/5`);

    await updateJobStatus(storage, jobId, 'WAIT_PLAN_APPROVAL');
    logger.info(`[stepPlan:${jobId}] → WAIT_PLAN_APPROVAL`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[stepPlan:${jobId}] Error: ${msg}`);
    await updateJobStatus(storage, jobId, 'ERROR', msg).catch(() => undefined);
  }
}
