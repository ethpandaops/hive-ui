export interface Directory {
  name: string;
  address: string;
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

export interface TestDetail {
  id: number;
  name: string;
  description: string;
  clientVersions: Record<string, string>;
  testCases: Record<string, TestCaseDetail>;
  simLog: string;
  testDetailsLog: string;
}
