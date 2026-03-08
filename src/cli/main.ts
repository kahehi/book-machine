import { generateSeries } from '../app/workflows/generateSeries.js';

export async function main(): Promise<void> {
  const idea = process.argv[2];

  if (!idea || idea.trim() === '') {
    console.error('');
    console.error('  Usage:  npm run dev -- "<your book idea>"');
    console.error('  Example: npm run dev -- "Eine Geschichte über einen mutigen kleinen Drachen"');
    console.error('');
    process.exit(1);
  }

  await generateSeries(idea.trim());
}
