export type Directory = string;

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
