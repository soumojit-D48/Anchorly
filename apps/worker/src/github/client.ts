import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';

export async function createGitHubClient(installationId: number): Promise<Octokit> {
  const appId = process.env.GITHUB_APP_ID!;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, '\n');

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
  });

  return octokit;
}
