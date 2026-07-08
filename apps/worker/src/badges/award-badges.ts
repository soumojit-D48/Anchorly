import type { BadgeType } from '@anchorly/db';

const BADGE_THRESHOLDS: { type: BadgeType; minPrs: number }[] = [
  { type: 'FIRST_PR', minPrs: 1 },
  { type: 'TEN_PRS', minPrs: 10 },
  { type: 'FIFTY_PRS', minPrs: 50 },
];

export function determineBadgesToAward(totalPrs: number): BadgeType[] {
  return BADGE_THRESHOLDS.filter((threshold) => totalPrs >= threshold.minPrs).map(
    (threshold) => threshold.type,
  );
}
