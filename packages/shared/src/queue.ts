import { Queue, Worker } from 'bullmq';

export const PR_REVIEW_QUEUE = 'pr-review';

export interface PrReviewJobData {
  prNumber: number;
  repoFullName: string;
  senderLogin: string;
  senderId: number;
  action: string;
  installationId: number;
}

export const QUEUE_OPTIONS = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
  },
};

export function createPrReviewQueue(redisUrl: string): Queue<PrReviewJobData> {
  return new Queue<PrReviewJobData>(PR_REVIEW_QUEUE, {
    connection: { url: redisUrl },
    ...QUEUE_OPTIONS,
  });
}

export function createPrReviewWorker(
  redisUrl: string,
  handler: (job: { data: PrReviewJobData }) => Promise<void>,
): Worker<PrReviewJobData> {
  return new Worker<PrReviewJobData>(PR_REVIEW_QUEUE, handler, {
    connection: { url: redisUrl },
  });
}
