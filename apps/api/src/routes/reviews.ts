import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { prisma } from '@anchorly/db';
import { requireAuth } from '../middleware/session';

const router: RouterType = Router();

// GET /api/dashboard/repos/:repoId/reviews
// Returns reviews for this repo with PR info, check results, and contributor
router.get('/repos/:repoId/reviews', requireAuth, async (req, res) => {
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

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: {
        pullRequest: { repoId },
      },
      include: {
        pullRequest: {
          select: {
            githubPrNumber: true,
            title: true,
            state: true,
          },
        },
        contributor: {
          select: {
            username: true,
            avatarUrl: true,
            totalPrs: true,
          },
        },
        checkResults: {
          select: {
            checkName: true,
            passed: true,
            message: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({
      where: {
        pullRequest: { repoId },
      },
    }),
  ]);

  res.json({
    reviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export { router };
