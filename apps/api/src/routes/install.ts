import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { logger } from '@anchorly/shared/logger';

const router: RouterType = Router();

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

  logger.info({ githubInstallationId, setupAction }, 'Install callback processed');

  res.status(200).json({
    message: 'GitHub App installed successfully. Repos are being synced in the background.',
    installationId: githubInstallationId,
  });
});

export { router };
