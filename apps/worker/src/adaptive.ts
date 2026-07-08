import { logger } from '@anchorly/shared/logger';

export interface AdaptiveDecisionInput {
  totalPrs: number;
  veteranPrThreshold: number;
  failedCheckNames: string[];
}

export interface AdaptiveDecision {
  shouldComment: boolean;
  shouldUseAI: boolean;
  isMilestone: boolean;
}

const MILESTONE_VALUES = [10, 50];

export function makeAdaptiveDecision(input: AdaptiveDecisionInput): AdaptiveDecision {
  const { totalPrs, veteranPrThreshold, failedCheckNames } = input;
  const hasFailedChecks = failedCheckNames.length > 0;
  const isMilestone = MILESTONE_VALUES.includes(totalPrs);
  const isVeteran = totalPrs >= veteranPrThreshold;

  let shouldComment: boolean;
  let shouldUseAI: boolean;

  if (hasFailedChecks) {
    shouldComment = true;
    shouldUseAI = true;
  } else if (isMilestone) {
    shouldComment = true;
    shouldUseAI = true;
  } else if (isVeteran) {
    shouldComment = false;
    shouldUseAI = false;
  } else {
    shouldComment = true;
    shouldUseAI = true;
  }

  logger.info(
    {
      totalPrs,
      veteranPrThreshold,
      hasFailedChecks,
      isMilestone,
      isVeteran,
      shouldComment,
      shouldUseAI,
      failedCheckNames,
    },
    'Adaptive decision made',
  );

  return { shouldComment, shouldUseAI, isMilestone };
}
