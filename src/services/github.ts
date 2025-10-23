import { GitHubWorkflowRun, GitHubJob } from '../types';

// Get GitHub API headers with token if available
function getGitHubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  const token = localStorage.getItem('githubApiToken');
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  return headers;
}

// Handle rate limit errors
export class GitHubRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubRateLimitError';
  }
}

// Parse workflow URL to extract owner, repo, and workflow file
function parseWorkflowUrl(url: string): { owner: string; repo: string; workflow: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/.*\/workflows\/(.+)$/);
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2],
    workflow: match[3]
  };
}

// Fetch jobs for a specific workflow run
async function fetchJobsForRun(owner: string, repo: string, runId: number): Promise<GitHubJob[]> {
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100`;

    const response = await fetch(apiUrl, {
      headers: getGitHubHeaders()
    });

    if (!response.ok) {
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        // Check if it's a rate limit error (either header is '0' or response indicates rate limiting)
        if (rateLimitRemaining === '0' || response.headers.get('X-RateLimit-Limit')) {
          throw new GitHubRateLimitError('GitHub API rate limit exceeded. Please add a personal access token in settings.');
        }
      }
      console.error('Failed to fetch jobs for run:', runId, response.status);
      return [];
    }

    const data = await response.json();
    return data.jobs || [];
  } catch (error) {
    // Re-throw rate limit errors so they can be handled by the UI
    if (error instanceof GitHubRateLimitError) {
      throw error;
    }
    console.error('Error fetching jobs for run:', runId, error);
    return [];
  }
}

// Fetch workflow runs for a specific workflow
export async function fetchWorkflowRuns(workflowUrl: string, includeCompleted: boolean = false): Promise<GitHubWorkflowRun[]> {
  const parsed = parseWorkflowUrl(workflowUrl);
  if (!parsed) {
    console.error('Invalid workflow URL:', workflowUrl);
    return [];
  }

  const { owner, repo, workflow } = parsed;

  try {
    // GitHub API endpoint for workflow runs
    // If includeCompleted is true, fetch all recent runs (up to 20), otherwise only in_progress
    const apiUrl = includeCompleted
      ? `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?per_page=20`
      : `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?per_page=20&status=in_progress`;

    const response = await fetch(apiUrl, {
      headers: getGitHubHeaders()
    });

    if (!response.ok) {
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        // Check if it's a rate limit error (either header is '0' or response indicates rate limiting)
        if (rateLimitRemaining === '0' || response.headers.get('X-RateLimit-Limit')) {
          throw new GitHubRateLimitError('GitHub API rate limit exceeded. Please add a personal access token in settings.');
        }
      }
      console.error('Failed to fetch workflow runs:', response.status);
      return [];
    }

    const data = await response.json();
    const runs: GitHubWorkflowRun[] = data.workflow_runs || [];

    // Fetch jobs for each run in parallel
    const runsWithJobs = await Promise.all(
      runs.map(async (run) => {
        const jobs = await fetchJobsForRun(owner, repo, run.id);
        return { ...run, jobs };
      })
    );

    return runsWithJobs;
  } catch (error) {
    // Re-throw rate limit errors so they can be handled by the UI
    if (error instanceof GitHubRateLimitError) {
      throw error;
    }
    console.error('Error fetching workflow runs:', error);
    return [];
  }
}

// Fetch all running workflows for multiple workflow URLs
// Also includes workflows completed within the past 24 hours
export async function fetchAllRunningWorkflows(workflowUrls: string[]): Promise<GitHubWorkflowRun[]> {
  const promises = workflowUrls.map(url => fetchWorkflowRuns(url, true));
  const results = await Promise.allSettled(promises);

  const allRuns: GitHubWorkflowRun[] = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allRuns.push(...result.value);
    }
  });

  // Calculate timestamp for 24 hours ago
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  // Filter to include:
  // 1. All running or queued workflows
  // 2. Completed workflows from the past 24 hours
  const filteredRuns = allRuns.filter(run => {
    if (run.status === 'in_progress' || run.status === 'queued') {
      return true;
    }
    if (run.status === 'completed') {
      const updatedAt = new Date(run.updated_at);
      return updatedAt >= twentyFourHoursAgo;
    }
    return false;
  });

  // Sort by:
  // 1. Workflows with running/queued status first
  // 2. Then by created_at descending (newest first)
  return filteredRuns.sort((a, b) => {
    const aIsRunning = a.status === 'in_progress' || a.status === 'queued';
    const bIsRunning = b.status === 'in_progress' || b.status === 'queued';

    // Running workflows come first
    if (aIsRunning && !bIsRunning) return -1;
    if (!aIsRunning && bIsRunning) return 1;

    // If both running or both completed, sort by created_at (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// Fetch most recent workflow run (including completed ones)
export async function fetchMostRecentWorkflowRun(workflowUrls: string[]): Promise<GitHubWorkflowRun | null> {
  const promises = workflowUrls.map(url => fetchWorkflowRuns(url, true));
  const results = await Promise.allSettled(promises);

  const allRuns: GitHubWorkflowRun[] = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allRuns.push(...result.value);
    }
  });

  // Sort by created_at descending (newest first) and return the most recent
  const sorted = allRuns.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return sorted.length > 0 ? sorted[0] : null;
}
