import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '@anchorly/shared/logger';
import { callOpenRouter, type ChatMessage } from './client';

export interface CheckResultForPrompt {
  checkName: string;
  passed: boolean;
  message: string;
}

export interface ContributorHistory {
  totalPrs: number;
  username: string;
}

export interface GenerateCommentInput {
  checkResults: CheckResultForPrompt[];
  prTitle: string;
  prBody: string;
  filesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
  contributor: ContributorHistory;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, 'prompts', 'v1.md');

function loadPrompt(): string {
  return readFileSync(PROMPT_PATH, 'utf-8');
}

function buildUserMessage(input: GenerateCommentInput): string {
  const checks = input.checkResults
    .map((r) => `- ${r.passed ? '[x]' : '[ ]'} ${r.checkName}: ${r.message}`)
    .join('\n');

  const contributorLine =
    input.contributor.totalPrs === 1
      ? 'This is their first PR on this repo.'
      : `This is PR #${input.contributor.totalPrs} from this contributor on this repo.`;

  return `## Check Results
${checks}

## PR Context
- Title: ${input.prTitle}
- Files changed: ${input.filesChanged}
- Additions: +${input.totalAdditions}
- Deletions: -${input.totalDeletions}

## Contributor History
- Username: ${input.contributor.username}
- ${contributorLine}

Write the PR comment now.`;
}

export async function generateComment(input: GenerateCommentInput): Promise<string | null> {
  const systemPrompt = loadPrompt();
  const userMessage = buildUserMessage(input);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await callOpenRouter(messages);

    logger.info(
      {
        model: response.model,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
      },
      'AI comment generated',
    );

    return response.content;
  } catch (err) {
    logger.error({ err }, 'Failed to generate AI comment');
    return null;
  }
}
