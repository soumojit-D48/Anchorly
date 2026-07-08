import type { Octokit } from 'octokit';
import { logger } from '@anchorly/shared/logger';

export interface PostCommentInput {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
}

export async function postComment(input: PostCommentInput): Promise<number | null> {
  const { octokit, owner, repo, prNumber, body } = input;

  try {
    const { data } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });

    logger.info({ commentId: data.id, owner, repo, prNumber }, 'Comment posted to PR');

    return data.id;
  } catch (err) {
    logger.error({ err, owner, repo, prNumber }, 'Failed to post comment to PR');
    return null;
  }
}
