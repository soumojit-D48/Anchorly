import type { Octokit } from 'octokit';

export interface PrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
}

export interface PrData {
  number: number;
  title: string;
  body: string;
  state: string;
  files: PrFile[];
  diff: string;
  changedFiles: number;
  totalAdditions: number;
  totalDeletions: number;
}

export async function fetchPrData(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PrData> {
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  const diffRes = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    headers: { accept: 'application/vnd.github.v3.diff' },
  });

  const diff = typeof diffRes.data === 'string' ? diffRes.data : JSON.stringify(diffRes.data);

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    state: pr.state,
    files: files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
    })),
    diff,
    changedFiles: pr.changed_files,
    totalAdditions: pr.additions,
    totalDeletions: pr.deletions,
  };
}
