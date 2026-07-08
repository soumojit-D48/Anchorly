import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { prisma } from '@anchorly/db';
import { logger } from '@anchorly/shared/logger';
import { requireAuth } from '../middleware/session';

const router: RouterType = Router();

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

router.get('/auth/github', (req, res) => {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID!;
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI!;
  const state = Math.random().toString(36).substring(2);

  req.session!.oauthState = state;

  const url = `${GITHUB_AUTHORIZE_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;
  res.redirect(url);
});

router.get('/auth/github/callback', async (req, res) => {
  const { code, state, installation_id, setup_action } = req.query as {
    code?: string;
    state?: string;
    installation_id?: string;
    setup_action?: string;
  };

  if (installation_id) {
    const githubInstallationId = parseInt(installation_id, 10);
    if (isNaN(githubInstallationId)) {
      res.status(400).json({ error: 'Invalid installation_id' });
      return;
    }

    logger.info({ githubInstallationId, setup_action }, 'Install callback processed');

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
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state parameter' });
    return;
  }

  if (state !== req.session?.oauthState) {
    res.status(403).json({ error: 'Invalid OAuth state' });
    return;
  }

  delete req.session!.oauthState;

  try {
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      logger.error({ error: tokenData.error }, 'GitHub OAuth token exchange failed');
      res.status(500).json({ error: 'Failed to exchange OAuth code' });
      return;
    }

    const userResponse = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    });

    const userData = (await userResponse.json()) as {
      id: number;
      login: string;
      avatar_url?: string;
    };

    const maintainer = await prisma.maintainer.upsert({
      where: { githubId: userData.id },
      update: {
        username: userData.login,
        avatarUrl: userData.avatar_url ?? null,
      },
      create: {
        githubId: userData.id,
        username: userData.login,
        avatarUrl: userData.avatar_url ?? null,
      },
    });

    req.session!.maintainerId = maintainer.id;
    req.session!.githubUsername = maintainer.username;

    logger.info(
      { maintainerId: maintainer.id, username: maintainer.username },
      'Maintainer logged in via GitHub OAuth',
    );

    const dashboardUrl = process.env.DASHBOARD_URL || '/';
    res.redirect(dashboardUrl);
  } catch (err) {
    logger.error({ err }, 'GitHub OAuth callback error');
    res.status(500).json({ error: 'OAuth authentication failed' });
  }
});

router.get('/auth/me', requireAuth, async (req, res) => {
  const maintainer = await prisma.maintainer.findUnique({
    where: { id: req.session!.maintainerId! },
    include: { installations: { include: { repos: true } } },
  });

  if (!maintainer) {
    res.status(404).json({ error: 'Maintainer not found' });
    return;
  }

  res.json({
    id: maintainer.id,
    username: maintainer.username,
    avatarUrl: maintainer.avatarUrl,
    installations: maintainer.installations,
  });
});

router.post('/auth/logout', (req, res) => {
  req.session?.destroy((err) => {
    if (err) {
      logger.error({ err }, 'Session destroy error');
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
  }
}

export { router };
