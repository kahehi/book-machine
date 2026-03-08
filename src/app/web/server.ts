import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startJob, getJob, submitApproval } from './jobRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ─── POST /api/jobs — start new job ──────────────────────────────────────────

app.post('/api/jobs', (req, res) => {
  const { idea } = req.body as { idea?: string };
  if (!idea?.trim()) {
    res.status(400).json({ error: 'idea is required' });
    return;
  }
  const jobId = startJob(idea.trim());
  res.json({ jobId });
});

// ─── GET /api/jobs/:id/stream — SSE ──────────────────────────────────────────

app.get('/api/jobs/:jobId/stream', (req, res) => {
  const job = getJob(req.params['jobId'] ?? '');
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Replay all past events so a late-connecting browser catches up
  for (const event of job.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  job.sseClients.add(res);

  // Keep alive
  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    job.sseClients.delete(res);
  });
});

// ─── POST /api/jobs/:id/approve — submit approval ────────────────────────────

app.post('/api/jobs/:jobId/approve', (req, res) => {
  const { answer } = req.body as { answer?: string };
  if (!answer) {
    res.status(400).json({ error: 'answer is required' });
    return;
  }
  const ok = submitApproval(req.params['jobId'] ?? '', answer);
  if (!ok) {
    res.status(409).json({ error: 'No pending approval for this job' });
    return;
  }
  res.json({ ok: true });
});

// ─── GET /api/jobs/:id/status ─────────────────────────────────────────────────

app.get('/api/jobs/:jobId/status', (req, res) => {
  const job = getJob(req.params['jobId'] ?? '');
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json({
    jobId: job.jobId,
    status: job.status,
    manuscriptPath: job.manuscriptPath ?? null,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
app.listen(PORT, () => {
  console.log(`\n  Book Machine UI  →  http://localhost:${PORT}\n`);
});
