import * as readline from 'readline';
import { join } from 'path';
import { logger } from '../../infra/logger.js';
import type { StorageProvider } from '../../providers/storage/storage.js';
import type { ApprovalType, ApprovalRecord } from './approvalTypes.js';

const DIVIDER = '─'.repeat(60);

// ─── Persistent line reader ────────────────────────────────────────────────────
// Uses a single long-lived readline interface and a FIFO queue so that
// multiple sequential question() calls all work correctly, even with piped input.

const lineQueue: string[] = [];
const waiters: Array<(line: string) => void> = [];

const _rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

_rl.on('line', (line) => {
  const waiter = waiters.shift();
  if (waiter) {
    waiter(line);
  } else {
    lineQueue.push(line);
  }
});

function readLine(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  if (lineQueue.length > 0) {
    return Promise.resolve(lineQueue.shift()!);
  }
  return new Promise((resolve) => waiters.push(resolve));
}

// ─── Approval Service ─────────────────────────────────────────────────────────

function printContext(ctx: Record<string, unknown>): void {
  const preview = JSON.stringify(ctx, null, 2);
  console.log(preview.length > 800 ? preview.slice(0, 800) + '\n  ... (truncated)' : preview);
}

export class ApprovalService {
  constructor(private readonly storage: StorageProvider) {}

  async requestApproval(
    type: ApprovalType,
    jobId: string,
    context: Record<string, unknown>,
  ): Promise<ApprovalRecord> {
    console.log(`\n${DIVIDER}`);
    console.log(`  HUMAN APPROVAL REQUIRED: ${type}`);
    console.log(DIVIDER);
    printContext(context);
    console.log(`\n  Type "${type}" to approve, or anything else to abort.\n`);

    const answer = await readLine('> ');

    const approved = answer.trim().toUpperCase() === type;

    const record: ApprovalRecord = {
      type,
      jobId,
      approved,
      response: answer.trim(),
      timestamp: new Date().toISOString(),
    };

    await this.storage.write(join('approvals', jobId, `${type}.json`), record);

    if (!approved) {
      throw new Error(
        `Workflow aborted: approval "${type}" was not granted (got: "${answer.trim()}").`,
      );
    }

    logger.info(`Approval granted: ${type}`);
    return record;
  }
}
