import { TestLogOffsets } from '../types';

// Route to the log viewer for a result log file, optionally anchored on a
// byte range [begin, end) (hive TestLogOffsets): the viewer then loads a
// window around the range, highlights it and scrolls to it. Single source
// of truth for the path shape and the begin/end query params it parses.
export function logViewerUrl(
  discoveryName: string,
  suiteId: string,
  logFile: string,
  offsets?: TestLogOffsets
): string {
  const base = `/logs/${discoveryName}/${suiteId}/${encodeURIComponent(logFile)}`;
  return offsets ? `${base}?begin=${offsets.begin}&end=${offsets.end}` : base;
}
