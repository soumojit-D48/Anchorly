import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { prisma } from '@anchorly/db';
import { logger } from '@anchorly/shared/logger';
import { createPrReviewQueue } from '@anchorly/shared/queue';
import { hmacVerify } from '../middleware/hmac-verify';

const router: RouterType = Router();

const queue = createPrReviewQueue(process.env.REDIS_URL!);

router.post('/github', hmacVerify, async (req, res) => {
  logger.info({ deliveryId: req.headers['x-github-delivery'] }, 'Webhook hit received');
  const rawBody = req.body as Buffer;
  const deliveryId = req.headers['x-github-delivery'] as string;
  const eventType = req.headers['x-github-event'] as string;

  const payloadText = rawBody.toString('utf8');
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }

  // Idempotency check — skip if already processed
  const existing = await prisma.webhookDelivery.findUnique({
    where: { deliveryId },
  });

  if (existing) {
    logger.info({ deliveryId, eventType }, 'Duplicate webhook, skipping');
    res.status(200).send('OK');
    return;
  }

  // Record the delivery as processed
  await prisma.webhookDelivery.create({
    data: { deliveryId, eventType },
  });

  logger.info({ deliveryId, eventType }, 'Processing webhook');

  try {
    switch (eventType) {
      case 'installation':
        await handleInstallation(payload);
        break;

      case 'installation_repositories':
        await handleInstallationRepositories(payload);
        break;

      case 'pull_request':
        await handlePullRequest(payload, deliveryId);
        break;

      default:
        logger.info({ eventType }, 'Unhandled event type');
    }
  } catch (err) {
    logger.error({ err, deliveryId, eventType }, 'Error processing webhook');
  }

  res.status(200).send('OK');
});

async function getOrCreateMaintainer(sender: Record<string, unknown>): Promise<string> {
  const githubId = sender.id as number;
  const username = sender.login as string;

  const maintainer = await prisma.maintainer.upsert({
    where: { githubId },
    update: { username },
    create: {
      githubId,
      username,
      avatarUrl: (sender.avatar_url as string) ?? null,
    },
  });

  return maintainer.id;
}

async function handleInstallation(payload: Record<string, unknown>): Promise<void> {
  const installation = payload.installation as Record<string, unknown>;
  const sender = payload.sender as Record<string, unknown>;

  const maintainerId = await getOrCreateMaintainer(sender);
  const githubInstallationId = installation.id as number;

  const inst = await prisma.installation.upsert({
    where: { githubInstallationId },
    update: { maintainerId },
    create: {
      githubInstallationId,
      maintainerId,
    },
  });

  const repos = payload.repositories as Array<Record<string, unknown>> | undefined;
  if (repos) {
    for (const repo of repos) {
      const fullName = repo.full_name as string;
      const owner = fullName.split('/')[0];
      const repoRecord = await prisma.repo.upsert({
        where: { githubRepoId: repo.id as number },
        update: {
          installationId: inst.id,
          owner,
          name: repo.name as string,
          fullName,
        },
        create: {
          githubRepoId: repo.id as number,
          installationId: inst.id,
          owner,
          name: repo.name as string,
          fullName,
        },
      });

      await prisma.repoSettings.upsert({
        where: { repoId: repoRecord.id },
        update: {},
        create: { repoId: repoRecord.id },
      });
    }
  }

  logger.info({ githubInstallationId, action: payload.action }, 'Installation processed');
}

async function handleInstallationRepositories(payload: Record<string, unknown>): Promise<void> {
  const installation = payload.installation as Record<string, unknown>;
  const githubInstallationId = installation.id as number;

  const inst = await prisma.installation.findUnique({
    where: { githubInstallationId },
  });

  if (!inst) {
    logger.warn({ githubInstallationId }, 'Installation not found for repositories event');
    return;
  }

  const added = payload.repositories_added as Array<Record<string, unknown>> | undefined;
  if (added) {
    for (const repo of added) {
      const fullName = repo.full_name as string;
      const owner = fullName.split('/')[0];
      const repoRecord = await prisma.repo.upsert({
        where: { githubRepoId: repo.id as number },
        update: {
          installationId: inst.id,
          owner,
          name: repo.name as string,
          fullName,
        },
        create: {
          githubRepoId: repo.id as number,
          installationId: inst.id,
          owner,
          name: repo.name as string,
          fullName,
        },
      });

      await prisma.repoSettings.upsert({
        where: { repoId: repoRecord.id },
        update: {},
        create: { repoId: repoRecord.id },
      });
    }
  }

  logger.info(
    { githubInstallationId, action: payload.action },
    'Installation repositories processed',
  );
}

async function handlePullRequest(
  payload: Record<string, unknown>,
  deliveryId: string,
): Promise<void> {
  const action = payload.action as string;
  const pr = payload.pull_request as Record<string, unknown>;
  const repo = payload.repository as Record<string, unknown>;
  const sender = payload.sender as Record<string, unknown>;
  const installation = payload.installation as Record<string, unknown>;

  logger.info(
    { deliveryId, action, prNumber: pr.number, repo: repo.full_name, sender: sender.login },
    'Pull request event received, enqueueing job',
  );

  await queue.add(
    'review',
    {
      prNumber: pr.number as number,
      repoFullName: repo.full_name as string,
      senderLogin: sender.login as string,
      senderId: sender.id as number,
      action,
      installationId: installation.id as number,
    },
    { jobId: deliveryId },
  );

  logger.info({ deliveryId, prNumber: pr.number }, 'Job enqueued');
}

export { router, queue };
