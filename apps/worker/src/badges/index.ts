import { determineBadgesToAward } from './award-badges';
import { persistBadges } from './persist-badges';

export async function awardBadges(contributorId: string, totalPrs: number): Promise<void> {
  const badges = determineBadgesToAward(totalPrs);

  if (badges.length === 0) {
    return;
  }

  await persistBadges(contributorId, badges);
}
