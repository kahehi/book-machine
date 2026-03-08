import chalk from 'chalk';
import { config } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelRank: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
    .join(' ');
}

function log(level: LogLevel, ...args: unknown[]): void {
  if (levelRank[level] < levelRank[config.logLevel]) return;

  const ts = new Date().toISOString();
  const msg = formatArgs(args);

  const line = {
    debug: chalk.gray(`[${ts}] DEBUG ${msg}`),
    info: chalk.cyan(`[${ts}] INFO  ${msg}`),
    warn: chalk.yellow(`[${ts}] WARN  ${msg}`),
    error: chalk.red(`[${ts}] ERROR ${msg}`),
  }[level];

  console.log(line);
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};
