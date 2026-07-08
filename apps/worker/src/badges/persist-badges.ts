import { prisma, type BadgeType } from '@anchorly/db';
import { logger } from '@anchorly/shared/logger';

export async function persistBadges(contributorId: string, badgeTypes: BadgeType[]): Promise<void> {
  for (const type of badgeTypes) {
    await prisma.badge.upsert({
      where: {
        contributorId_type: {
          contributorId,
          type,
        },
      },
      update: {},
      create: {
        contributorId,
        type,
      },
    });

    logger.info({ contributorId, badgeType: type }, 'Badge awarded');
  }
}
