import { prisma } from '@anchorly/db';
import { logger } from '@anchorly/shared/logger';
import type { PrReviewJobData } from '@anchorly/shared/queue';
import type { Job } from 'bullmq';
import { createGitHubClient } from './github/client';
import { fetchPrData } from './github/fetch-pr';
import { runChecks } from './checks/run-checks';
import { generateComment } from './ai/generate-comment';

export async function processPrReviewJob(job: Job<PrReviewJobData>): Promise<void> {
  const { prNumber, repoFullName, senderLogin, senderId, action, installationId } = job.data;

  logger.info(
    { jobId: job.id, prNumber, repoFullName, senderLogin, action },
    'Processing PR review job',
  );

  const repo = await prisma.repo.findUnique({
    where: { fullName: repoFullName },
    include: { settings: true },
  });

  if (!repo) {
    logger.error({ repoFullName }, 'Repo not found — was the installation event processed?');
    throw new Error(`Repo not found: ${repoFullName}`);
  }

  if (!repo.settings) {
    logger.error({ repoFullName }, 'RepoSettings not found for repo');
    throw new Error(`RepoSettings not found for repo: ${repoFullName}`);
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

  const review = await prisma.review.create({
    data: {
      pullRequestId: pullRequest.id,
      contributorId: contributor.id,
      triggerEvent: action,
    },
  });

  logger.info({ reviewId: review.id }, 'Review record created');

  const octokit = await createGitHubClient(installationId);
  const prData = await fetchPrData(octokit, repo.owner, repo.name, prNumber);

  logger.info(
    {
      reviewId: review.id,
      files: prData.files.length,
      additions: prData.totalAdditions,
      deletions: prData.totalDeletions,
    },
    'PR data fetched',
  );

  const checkResults = runChecks(prData, repo.settings);

  for (const result of checkResults) {
    await prisma.checkResult.create({
      data: {
        reviewId: review.id,
        checkName: result.checkName,
        passed: result.passed,
        message: result.message,
      },
    });
  }

  const failedChecks = checkResults.filter((r) => !r.passed);
  logger.info(
    {
      reviewId: review.id,
      totalChecks: checkResults.length,
      passed: checkResults.filter((r) => r.passed).length,
      failed: failedChecks.length,
      failedChecks: failedChecks.map((r) => r.checkName),
    },
    'Checks completed and persisted',
  );

  const commentBody = await generateComment({
    checkResults: checkResults.map((r) => ({
      checkName: r.checkName,
      passed: r.passed,
      message: r.message,
    })),
    prTitle: prData.title,
    prBody: prData.body,
    filesChanged: prData.changedFiles,
    totalAdditions: prData.totalAdditions,
    totalDeletions: prData.totalDeletions,
    contributor: {
      totalPrs: contributor.totalPrs,
      username: contributor.username,
    },
  });

  const aiUsed = commentBody !== null;

  await prisma.review.update({
    where: { id: review.id },
    data: {
      aiUsed,
      commentBody,
    },
  });

  logger.info(
    { reviewId: review.id, aiUsed, commentLength: commentBody?.length ?? 0 },
    'AI comment generated and stored',
  );

  logger.info({ jobId: job.id, prNumber, reviewId: review.id, action }, 'PR review job completed');
}
