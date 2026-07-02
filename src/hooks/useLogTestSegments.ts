import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDirectories, fetchTestDetail } from '../services/api';
import { TestDetail } from '../types';

// A section of a shared client log belonging to one test case.
export interface LogTestSegment {
  testId: string;
  name: string;
  displayName: string;
  pass: boolean;
  begin: number;
  end: number;
}

// Strips redundant noise from a test name for the narrow sidebar: the
// client-name suffix hive appends, and the file path before '::' in
// pytest-style ids. Falls back to the full name.
function segmentDisplayName(name: string, clientName: string): string {
  let n = name;
  if (clientName && n.endsWith(`-${clientName}`)) {
    n = n.slice(0, -(clientName.length + 1));
  }
  const sep = n.indexOf('::');
  if (sep >= 0 && sep + 2 < n.length) {
    n = n.slice(sep + 2);
  }
  return n;
}

// Collects the test cases of a suite that reference `logFile` with byte
// offsets, ordered by position in the log. Loads the suite JSON through the
// same react-query key as the suite page, so navigation from there is free.
export function useLogTestSegments(
  discoveryName: string,
  suiteId: string,
  logFile: string
): LogTestSegment[] {
  const { data: directories } = useQuery({
    queryKey: ['directories'],
    queryFn: fetchDirectories,
  });
  const discoveryAddress = directories?.find((dir) => dir.name === discoveryName)?.address || '';
  const fileName = suiteId ? `${suiteId}.json` : '';

  const { data: testDetail } = useQuery<TestDetail>({
    queryKey: ['testDetail', discoveryAddress, fileName],
    queryFn: () => fetchTestDetail(discoveryAddress, fileName),
    enabled: !!discoveryAddress && !!suiteId,
  });

  return useMemo(() => {
    if (!testDetail) return [];
    const segments: LogTestSegment[] = [];
    for (const [testId, testCase] of Object.entries(testDetail.testCases)) {
      if (testCase.multiTestContext || !testCase.clientInfo) continue;
      for (const client of Object.values(testCase.clientInfo)) {
        if (client.logFile === logFile && client.logOffsets) {
          segments.push({
            testId,
            name: testCase.name,
            displayName: segmentDisplayName(testCase.name, client.name),
            pass: testCase.summaryResult.pass,
            begin: client.logOffsets.begin,
            end: client.logOffsets.end,
          });
        }
      }
    }
    segments.sort((a, b) => a.begin - b.begin || a.end - b.end);
    return segments;
  }, [testDetail, logFile]);
}
