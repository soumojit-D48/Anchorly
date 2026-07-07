import type { PrFile } from '../github/fetch-pr';

export interface CheckOutput {
  passed: boolean;
  message: string;
}

const TEST_FILE_PATTERNS = [
  /\.test\.[a-z]+$/i,
  /\.spec\.[a-z]+$/i,
  /__tests__\//i,
  /__test__\//i,
  /\.tests\.[a-z]+$/i,
  /\.specs\.[a-z]+$/i,
];

export function checkMissingTests(files: PrFile[]): CheckOutput {
  const hasTestFiles = files.some((file) =>
    TEST_FILE_PATTERNS.some((pattern) => pattern.test(file.filename)),
  );

  if (hasTestFiles) {
    return { passed: true, message: 'Test files found' };
  }

  const sourceFiles = files.filter(
    (f) =>
      !f.filename.includes('__tests__') &&
      !f.filename.includes('.test.') &&
      !f.filename.includes('.spec.') &&
      f.filename.match(/\.(ts|tsx|js|jsx)$/i),
  );

  if (sourceFiles.length === 0) {
    return { passed: true, message: 'No source files changed, test check skipped' };
  }

  return {
    passed: false,
    message: `No test files found. Changed source files: ${sourceFiles.map((f) => f.filename).join(', ')}`,
  };
}
