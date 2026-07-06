import express from 'express';
import { logger } from '@anchorly/shared/logger';
import { prisma } from '@anchorly/db';
import { validateEnv } from '@anchorly/config/env';
import { router as webhookRouter, queue } from './webhooks/github';
import { router as installRouter } from './routes/install';

validateEnv();

const app = express();
const port = parseInt(process.env.PORT ?? '3000', 10);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', installRouter);
app.use('/api/webhooks', webhookRouter);

app.listen(port, () => {
  logger.info({ port }, '@anchorly/api started');
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  await queue.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await queue.close();
  await prisma.$disconnect();
  process.exit(0);
});
