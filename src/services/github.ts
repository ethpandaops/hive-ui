import { GitHubWorkflowRun, GitHubJob } from '../types';

// Parse workflow URL to extract owner, repo, and workflow file
function parseWorkflowUrl(url: string): { owner: string; repo: string; workflow: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/.*\/workflows\/(.+)$/);
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
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch jobs for run:', runId, response.status);
      return [];
    }

    const data = await response.json();
    return data.jobs || [];
  } catch (error) {
    console.error('Error fetching jobs for run:', runId, error);
    return [];
  }
}

// Fetch workflow runs for a specific workflow
export async function fetchWorkflowRuns(workflowUrl: string): Promise<GitHubWorkflowRun[]> {
  const parsed = parseWorkflowUrl(workflowUrl);
  if (!parsed) {
    console.error('Invalid workflow URL:', workflowUrl);
    return [];
  }

  const { owner, repo, workflow } = parsed;
  
  try {
    // GitHub API endpoint for workflow runs
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?per_page=10&status=in_progress`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      }
    });

    if (!response.ok) {
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
    console.error('Error fetching workflow runs:', error);
    return [];
  }
}

// Fetch all running workflows for multiple workflow URLs
export async function fetchAllRunningWorkflows(workflowUrls: string[]): Promise<GitHubWorkflowRun[]> {
  const promises = workflowUrls.map(url => fetchWorkflowRuns(url));
  const results = await Promise.allSettled(promises);
  
  const allRuns: GitHubWorkflowRun[] = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allRuns.push(...result.value);
    }
  });
  
  // Sort by created_at descending (newest first)
  return allRuns.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}