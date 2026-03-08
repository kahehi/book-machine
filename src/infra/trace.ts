/**
 * Infra: Tracing
 * Distributed tracing for observability
 */

import logger from './logger';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export function createTraceContext(traceId?: string): TraceContext {
  return {
    traceId: traceId || crypto.randomUUID(),
    spanId: crypto.randomUUID(),
  };
}

export function withTrace<T>(
  context: TraceContext,
  name: string,
  fn: () => Promise<T> | T
): Promise<T> {
  const startTime = Date.now();

  return Promise.resolve(fn())
    .then((result) => {
      const duration = Date.now() - startTime;
      logger.info(`[${context.traceId}] ${name} completed`, {
        spanId: context.spanId,
        duration,
      });
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      logger.error(`[${context.traceId}] ${name} failed`, {
        spanId: context.spanId,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
}
