import { prisma } from '@anchorly/db';
import { logger } from '@anchorly/shared/logger';
import type { PrReviewJobData } from '@anchorly/shared/queue';

export async function processPrReviewJob(job: { data: PrReviewJobData }): Promise<void> {
  const { prNumber, repoFullName, senderLogin, senderId, action } = job.data;

  logger.info(
    { jobId: job.id, prNumber, repoFullName, senderLogin, action },
    'Processing PR review job',
  );

  const repo = await prisma.repo.findUnique({
    where: { fullName: repoFullName },
  });

  if (!repo) {
    logger.error({ repoFullName }, 'Repo not found — was the installation event processed?');
    throw new Error(`Repo not found: ${repoFullName}`);
  }

  const contributor = await prisma.contributor.upsert({
    where: {
      repoId_githubUserId: {
        repoId: repo.id,
        githubUserId: senderId,
      },
    },
    update: {
      username: senderLogin,
      lastSeenAt: new Date(),
    },
    create: {
      repoId: repo.id,
      githubUserId: senderId,
      username: senderLogin,
    },
  });

  const pullRequest = await prisma.pullRequest.upsert({
    where: {
      repoId_githubPrNumber: {
        repoId: repo.id,
        githubPrNumber: prNumber,
      },
    },
    update: {
      updatedAt: new Date(),
    },
    create: {
      repoId: repo.id,
      contributorId: contributor.id,
      githubPrNumber: prNumber,
      title: `PR #${prNumber}`,
      state: 'open',
    },
  });

  if (action === 'opened') {
    await prisma.contributor.update({
      where: { id: contributor.id },
      data: { totalPrs: { increment: 1 } },
    });
    logger.info(
      { contributorId: contributor.id, totalPrs: contributor.totalPrs + 1 },
      'Contributor PR count incremented',
    );
  }

  logger.info(
    {
      jobId: job.id,
      prNumber,
      repoId: repo.id,
      contributorId: contributor.id,
      pullRequestId: pullRequest.id,
      action,
    },
    'PR review job completed',
  );
}
