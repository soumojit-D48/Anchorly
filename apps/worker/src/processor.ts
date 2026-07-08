import { prisma } from '@anchorly/db';
import { logger } from '@anchorly/shared/logger';
import type { PrReviewJobData } from '@anchorly/shared/queue';
import type { Job } from 'bullmq';
import { createGitHubClient } from './github/client';
import { fetchPrData } from './github/fetch-pr';
import { postComment } from './github/post-comment';
import { runChecks } from './checks/run-checks';
import { generateComment } from './ai/generate-comment';
import { makeAdaptiveDecision } from './adaptive';
import { awardBadges } from './badges';

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

  const updatedTotalPrs = action === 'opened' ? contributor.totalPrs + 1 : contributor.totalPrs;
  await awardBadges(contributor.id, updatedTotalPrs);

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

  const decision = makeAdaptiveDecision({
    totalPrs: action === 'opened' ? contributor.totalPrs + 1 : contributor.totalPrs,
    veteranPrThreshold: repo.settings.veteranPrThreshold,
    failedCheckNames: failedChecks.map((r) => r.checkName),
  });

  let commentBody: string | null = null;
  let aiUsed = false;

  if (decision.shouldUseAI) {
    commentBody = await generateComment({
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
        totalPrs: action === 'opened' ? contributor.totalPrs + 1 : contributor.totalPrs,
        username: contributor.username,
      },
    });
    aiUsed = commentBody !== null;
  }

  await prisma.review.update({
    where: { id: review.id },
    data: {
      aiUsed,
      commentBody,
      isMilestone: decision.isMilestone,
    },
  });

  logger.info(
    {
      reviewId: review.id,
      shouldComment: decision.shouldComment,
      shouldUseAI: decision.shouldUseAI,
      isMilestone: decision.isMilestone,
      aiUsed,
      commentLength: commentBody?.length ?? 0,
    },
    'Adaptive decision applied and review updated',
  );

  if (decision.shouldComment && commentBody) {
    const commentId = await postComment({
      octokit,
      owner: repo.owner,
      repo: repo.name,
      prNumber,
      body: commentBody,
    });

    if (commentId !== null) {
      await prisma.review.update({
        where: { id: review.id },
        data: { commented: true },
      });
      logger.info(
        { reviewId: review.id, commentId },
        'Comment posted and review marked as commented',
      );
    }
  } else {
    logger.info(
      { reviewId: review.id, shouldComment: decision.shouldComment },
      'No comment posted',
    );
  }

  logger.info({ jobId: job.id, prNumber, reviewId: review.id, action }, 'PR review job completed');
}
