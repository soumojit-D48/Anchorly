import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { prisma } from '@anchorly/db';
import { requireAuth } from '../middleware/session';

const router: RouterType = Router();

// GET /api/dashboard/repos/:repoId/stats
// Returns contributor stats for charts: flags-per-PR over time, summary stats
router.get('/repos/:repoId/stats', requireAuth, async (req, res) => {
  const { repoId } = req.params;
  const maintainerId = req.session!.maintainerId!;

  // Verify ownership
  const repo = await prisma.repo.findUnique({
    where: { id: repoId },
    include: { installation: true },
  });

  if (!repo || repo.installation.maintainerId !== maintainerId) {
    res.status(404).json({ error: 'Repo not found or not owned by you' });
    return;
  }

  // Get all reviews for this repo with check results, ordered by time
  const reviews = await prisma.review.findMany({
    where: {
      pullRequest: { repoId },
    },
    include: {
      checkResults: true,
      contributor: {
        select: {
          username: true,
          totalPrs: true,
        },
      },
      pullRequest: {
        select: {
          githubPrNumber: true,
          title: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Compute flags-per-PR over time (each review -> count of failed checks)
  const flagsOverTime = reviews.map((r) => ({
    date: r.createdAt.toISOString(),
    prNumber: r.pullRequest.githubPrNumber,
    prTitle: r.pullRequest.title,
    contributor: r.contributor.username,
    totalFlags: r.checkResults.filter((c) => !c.passed).length,
    totalChecks: r.checkResults.length,
    commented: r.commented,
    aiUsed: r.aiUsed,
    isMilestone: r.isMilestone,
  }));

  // Summary stats
  const totalContributors = await prisma.contributor.count({ where: { repoId } });
  const totalPRs = await prisma.pullRequest.count({ where: { repoId } });
  const totalReviews = reviews.length;
  const commentedReviews = reviews.filter((r) => r.commented).length;
  const totalBadges = await prisma.badge.count({
    where: { contributor: { repoId } },
  });

  // Check failure rates per check type
  const allCheckResults = reviews.flatMap((r) => r.checkResults);
  const checkStats: Record<string, { total: number; failed: number }> = {};
  for (const cr of allCheckResults) {
    if (!checkStats[cr.checkName]) {
      checkStats[cr.checkName] = { total: 0, failed: 0 };
    }
    checkStats[cr.checkName].total++;
    if (!cr.passed) {
      checkStats[cr.checkName].failed++;
    }
  }

  // Top contributors by PR count
  const topContributors = await prisma.contributor.findMany({
    where: { repoId },
    orderBy: { totalPrs: 'desc' },
    take: 10,
    select: {
      username: true,
      avatarUrl: true,
      totalPrs: true,
      firstSeenAt: true,
      lastSeenAt: true,
      _count: { select: { badges: true } },
    },
  });

  res.json({
    summary: {
      totalContributors,
      totalPRs,
      totalReviews,
      commentedReviews,
      silentReviews: totalReviews - commentedReviews,
      totalBadges,
    },
    flagsOverTime,
    checkStats,
    topContributors,
  });
});

export { router };
