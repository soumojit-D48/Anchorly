import type { PrFile } from '../github/fetch-pr';

export interface CheckOutput {
  passed: boolean;
  message: string;
}

export function checkDiffSize(files: PrFile[], maxDiffLines: number): CheckOutput {
  const totalLines = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);

  if (totalLines <= maxDiffLines) {
    return {
      passed: true,
      message: `Diff is ${totalLines} lines (threshold: ${maxDiffLines})`,
    };
  }

  return {
    passed: false,
    message: `Diff is ${totalLines} lines, exceeding threshold of ${maxDiffLines}. Consider breaking this PR into smaller changes.`,
  };
}
