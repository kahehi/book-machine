import dotenv from 'dotenv';

dotenv.config();

export const config = {
  llmProvider: process.env['LLM_PROVIDER'] ?? 'mock',
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
  openaiApiKey: process.env['OPENAI_API_KEY'],
  dataDir: process.env['DATA_DIR'] ?? './data',
  logLevel: (process.env['LOG_LEVEL'] ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  targetScore: parseInt(process.env['TARGET_SCORE'] ?? '85', 10),
  maxIterations: parseInt(process.env['MAX_ITERATIONS'] ?? '3', 10),
} as const;
