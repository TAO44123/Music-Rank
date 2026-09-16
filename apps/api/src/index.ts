import { config } from '@music-rank/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { closeDatabase } from '@music-rank/database';
import { createApp } from './app.js';

const port = config.server.port;
const app = createApp();

if (config.nodeEnv === 'production') {
  const webDist = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  app.use(express.static(webDist));
  app.get('/{*path}', (_request, response) => response.sendFile('index.html', { root: webDist }));
}

const server = app.listen(port, () => console.log(JSON.stringify({ level: 'info', message: 'API server started', port })));

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: 'info', message: 'Graceful shutdown started', signal }));
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
