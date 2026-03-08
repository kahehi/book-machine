import { main } from './cli/main.js';

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${message}\n`);
  process.exit(1);
});
