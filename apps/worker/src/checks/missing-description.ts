export interface CheckOutput {
  passed: boolean;
  message: string;
}

const MIN_DESCRIPTION_LENGTH = 10;

export function checkMissingDescription(body: string): CheckOutput {
  const trimmed = body.trim();

  if (trimmed.length >= MIN_DESCRIPTION_LENGTH) {
    return { passed: true, message: 'PR description provided' };
  }

  if (trimmed.length === 0) {
    return {
      passed: false,
      message:
        'PR description is empty. Adding a description helps reviewers understand your changes.',
    };
  }

  return {
    passed: false,
    message: `PR description is very short (${trimmed.length} chars). Consider adding more context about your changes.`,
  };
}
