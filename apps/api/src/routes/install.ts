import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { prisma } from '@anchorly/db';
import { logger } from '@anchorly/shared/logger';

const router: RouterType = Router();

router.get('/install/callback', async (req, res) => {
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

  logger.info({ githubInstallationId, setupAction }, 'Install callback processed');

  const maintainerId = req.session?.maintainerId;

  if (maintainerId) {
    const installation = await prisma.installation.findUnique({
      where: { githubInstallationId },
    });

    if (installation && installation.maintainerId !== maintainerId) {
      await prisma.installation.update({
        where: { id: installation.id },
        data: { maintainerId },
      });

      logger.info(
        { githubInstallationId, maintainerId },
        'Installation associated with logged-in maintainer',
      );
    }
  }

  const dashboardUrl = process.env.DASHBOARD_URL || '/';
  res.redirect(dashboardUrl);
});

export { router };
