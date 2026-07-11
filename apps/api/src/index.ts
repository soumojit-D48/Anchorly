import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { logger } from '@anchorly/shared/logger';
import { prisma } from '@anchorly/db';
import { validateEnv } from '@anchorly/config/env';
import { createSessionMiddleware } from './middleware/session';
import { dashboardRateLimit } from './middleware/rate-limit';
import { router as webhookRouter, queue } from './webhooks/github';
import { router as authRouter } from './routes/auth';
import { router as settingsRouter } from './routes/settings';
import { router as reviewsRouter } from './routes/reviews';
import { router as statsRouter } from './routes/stats';

validateEnv();

const app = express();
const port = parseInt(process.env.PORT ?? '3000', 10);

// Trust proxy (ngrok, reverse proxy, etc.)
app.set('trust proxy', 1);

// CORS for the web frontend
app.use(
  cors({
    origin: process.env.DASHBOARD_URL || true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(createSessionMiddleware());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', authRouter);
app.use('/api/dashboard', dashboardRateLimit);
app.use('/api/dashboard', settingsRouter);
app.use('/api/dashboard', reviewsRouter);
app.use('/api/dashboard', statsRouter);
app.use('/api/webhooks', webhookRouter);

// Serve built frontend (AFTER API routes)
const distPath = path.resolve(import.meta.dirname, '../../web/dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

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
