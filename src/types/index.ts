// `category` distinguishes Hive EL runs (default) from CL spec-test runs
// produced by ethpandaops/clive. Both share the same listing.jsonl + results/
// schema; only the routing/rendering hints differ. Defaulting to `'el'` when
// omitted keeps every existing Hive entry rendering unchanged.
export type DirectoryCategory = 'el' | 'cl';

export interface Directory {
  name: string;
  address: string;
  github_workflows?: string[];
  // -- Additive fields used by ethpandaops/clive entries. All optional;
  // a Hive EL directory leaves them undefined and renders as today.
  category?: DirectoryCategory;
  fork?: string;       // e.g. 'gloas' on a Glamsterdam devnet
  spec_ref?: string;   // e.g. 'v1.7.0-alpha.10' (consensus-spec-tests release)
}

// `SpecTestCategory` mirrors the categories declared by clive adapters in
// clive-meta.json. Kept as a string union so a misclassified or unknown
// value just renders as plain text without breaking the consumer.
export type SpecTestCategory =
  | 'sanity'
  | 'operations'
  | 'epoch_processing'
  | 'transition'
  | 'random'
  | 'finality'
  | 'fork_choice'
  | 'rewards'
  | 'shuffling'
  | 'ssz_generic'
  | 'ssz_static'
  | 'bls'
  | 'kzg'
  | 'light_client'
  | 'merkle_proof'
  | 'genesis';

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
  // -- Additive fields populated by clive. Hive EL rows leave these
  // undefined and the CL summary view treats them as missing.
  category?: SpecTestCategory | string;
  subcategory?: string;
  preset?: 'minimal' | 'mainnet' | 'general' | string;
  fork?: string;
  skipped?: number;
  consensus_spec_tests_ref?: string;
  source_ref?: string;
  source_sha?: string;
  network?: string;
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
  // Optional third state: a test that intentionally didn't execute (e.g.
  // a fork-choice fixture a CL client doesn't yet support). Populated by
  // clive; absent on legacy Hive runs (where every testcase is pass/fail).
  // Consumers should treat `skipped: true` as a distinct state, not as
  // pass-or-fail.
  skipped?: boolean;
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
  event: string;
  triggering_actor?: { login: string };
  inputs?: Record<string, string> | null;
  jobs?: GitHubJob[];
}

export interface GitHubWorkflowStatus {
  workflow_url: string;
  runs: GitHubWorkflowRun[];
}
