import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export type {
  CheckName,
  BadgeType,
  ReactionType,
  Maintainer,
  Installation,
  Repo,
  RepoSettings,
  Contributor,
  PullRequest,
  Review,
  CheckResult,
  Badge,
  Reaction,
  WebhookDelivery,
} from '@prisma/client';
