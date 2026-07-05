import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { prisma } from '@anchorly/db';
import { logger } from '@anchorly/shared/logger';

const router: RouterType = Router();

async function waitForInstallation(githubInstallationId: number, maxAttempts = 5, delayMs = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const installation = await prisma.installation.findUnique({
      where: { githubInstallationId },
      include: { repos: true },
    });
    if (installation) return installation;
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

router.get('/auth/github/callback', async (req, res) => {
  const installationId = req.query.installation_id as string | undefined;
  const setupAction = req.query.setup_action as string | undefined;

  if (!installationId) {
    res.status(400).json({ error: 'Missing installation_id parameter' });
    return;
  }

  const githubInstallationId = parseInt(installationId, 10);
  if (isNaN(githubInstallationId)) {
    res.status(400).json({ error: 'Invalid installation_id' });
    return;
  }

  logger.info({ githubInstallationId, setupAction }, 'Install callback received');

  const installation = await waitForInstallation(githubInstallationId);

  if (!installation) {
    logger.warn({ githubInstallationId }, 'Install callback: webhook did not arrive in time');
    res.status(200).json({
      message: 'GitHub App installation received. The webhook is still processing.',
      installationId: githubInstallationId,
    });
    return;
  }

  logger.info(
    { githubInstallationId, setupAction, repoCount: installation.repos.length },
    'Install callback processed',
  );

  res.status(200).json({
    message: 'GitHub App installed successfully',
    installationId: githubInstallationId,
    repos: installation.repos.map((r) => r.fullName),
  });
});

export { router };
