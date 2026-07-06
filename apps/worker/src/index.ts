import { logger } from '@anchorly/shared/logger';
import { prisma } from '@anchorly/db';
import { validateEnv } from '@anchorly/config/env';
import { createPrReviewWorker } from '@anchorly/shared/queue';
import { processPrReviewJob } from './processor';

validateEnv();

const worker = createPrReviewWorker(process.env.REDIS_URL!, async (job) => {
  logger.info({ jobId: job.id }, 'Worker received job');
  await processPrReviewJob(job);
});

worker.on('ready', () => {
  logger.info('Worker listening on pr-review queue');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Job failed');
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

async function shutdown() {
  logger.info('Worker shutting down');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
