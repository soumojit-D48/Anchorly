import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { prisma } from '@anchorly/db';
import { logger } from '@anchorly/shared/logger';
import { requireAuth } from '../middleware/session';

const router: RouterType = Router();

// Verify the maintainer owns this repo (through installation chain)
async function verifyRepoOwnership(maintainerId: string, repoId: string) {
  const repo = await prisma.repo.findUnique({
    where: { id: repoId },
    include: {
      installation: true,
    },
  });

  if (!repo) return null;
  if (repo.installation.maintainerId !== maintainerId) return null;
  return repo;
}

// GET /api/dashboard/repos/:repoId/settings
router.get('/repos/:repoId/settings', requireAuth, async (req, res) => {
  const { repoId } = req.params;
  const maintainerId = req.session!.maintainerId!;

  const repo = await verifyRepoOwnership(maintainerId, repoId);
  if (!repo) {
    res.status(404).json({ error: 'Repo not found or not owned by you' });
    return;
  }

  // Upsert settings — create default if none exist yet
  const settings = await prisma.repoSettings.upsert({
    where: { repoId },
    create: { repoId },
    update: {},
  });

  res.json(settings);
});

// PATCH /api/dashboard/repos/:repoId/settings
router.patch('/repos/:repoId/settings', requireAuth, async (req, res) => {
  const { repoId } = req.params;
  const maintainerId = req.session!.maintainerId!;

  const repo = await verifyRepoOwnership(maintainerId, repoId);
  if (!repo) {
    res.status(404).json({ error: 'Repo not found or not owned by you' });
    return;
  }

  // Only allow updating known fields
  const allowedFields = [
    'testsCheckEnabled',
    'sizeCheckEnabled',
    'styleCheckEnabled',
    'descriptionCheckEnabled',
    'maxDiffLines',
    'goodFirstIssueLabel',
    'veteranPrThreshold',
  ] as const;

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  const settings = await prisma.repoSettings.upsert({
    where: { repoId },
    create: { repoId, ...updateData },
    update: updateData,
  });

  logger.info({ repoId, updatedFields: Object.keys(updateData) }, 'Settings updated');

  res.json(settings);
});

export { router };
