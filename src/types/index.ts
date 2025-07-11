export interface Directory {
  name: string;
  address: string;
  github_workflows?: string[];
}

export interface TestRun {
  name: string;
  ntests: number;
  passes: number;
  fails: number;
  timeout: boolean;
  clients: string[];
  versions: Record<string, string>;
  start: string;
  fileName: string;
  size: number;
  simLog: string;
}

export interface TestGroup {
  name: string;
  clients: string[];
  runs: TestRun[];
}

export interface TestClientInfo {
  id: string;
  ip: string;
  name: string;
  instantiatedAt: string;
  logFile: string;
}

export interface TestSummaryResult {
  pass: boolean;
  log: {
    begin: number;
    end: number;
  };
}

export interface TestCaseDetail {
  name: string;
  description: string;
  start: string;
  end: string;
  summaryResult: TestSummaryResult;
  clientInfo: Record<string, TestClientInfo>;
}

export interface RunMetadata {
  hiveCommand: string[];
  hiveVersion: {
    commit: string;
    commitDate: string;
    branch: string;
    dirty: boolean;
  };
  clientConfig?: {
    filePath: string;
    content: unknown;
  };
}

export interface TestDetail {
  id: number;
  name: string;
  description: string;
  clientVersions: Record<string, string>;
  testCases: Record<string, TestCaseDetail>;
  simLog: string;
  testDetailsLog: string;
  runMetadata?: RunMetadata;
}

export interface GitHubJob {
  id: number;
  run_id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
  steps?: GitHubJobStep[];
}

export interface GitHubJobStep {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_number: number;
  run_attempt: number;
  jobs?: GitHubJob[];
}

export interface GitHubWorkflowStatus {
  workflow_url: string;
  runs: GitHubWorkflowRun[];
}
