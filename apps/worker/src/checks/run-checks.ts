import type { CheckName, RepoSettings } from '@anchorly/db';
import type { PrData } from '../github/fetch-pr';
import { checkMissingTests } from './missing-tests';
import { checkDiffSize } from './diff-size';
import { checkMissingDescription } from './missing-description';

export interface CheckResultInput {
  checkName: CheckName;
  passed: boolean;
  message: string;
}

export function runChecks(prData: PrData, settings: RepoSettings): CheckResultInput[] {
  const results: CheckResultInput[] = [];

  if (settings.testsCheckEnabled) {
    results.push({
      checkName: 'TESTS',
      ...checkMissingTests(prData.files),
    });
  }

  if (settings.sizeCheckEnabled) {
    results.push({
      checkName: 'SIZE',
      ...checkDiffSize(prData.files, settings.maxDiffLines),
    });
  }

  if (settings.descriptionCheckEnabled) {
    results.push({
      checkName: 'DESCRIPTION',
      ...checkMissingDescription(prData.body),
    });
  }

  return results;
}
