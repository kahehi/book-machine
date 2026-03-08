import express from 'express';
import { resolve } from 'path';
import { config } from '../infra/config.js';
import { router } from './routes.js';

const app = express();
app.use(express.json());

// Serve ./data at /data so the UI can link directly to output files
app.use('/data', express.static(resolve(config.dataDir)));

app.use(router);

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
app.listen(PORT, () => {
  console.log(`\n  Book Machine  ->  http://localhost:${PORT}\n`);
});
