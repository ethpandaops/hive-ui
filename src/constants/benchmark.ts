/**
 * Test case name prefixes to exclude from benchmark calculations.
 * Add entries here to ignore simulator/launcher or other non-benchmark tests.
 */
export const BENCHMARK_IGNORE_TEST_PREFIXES: readonly string[] = [
  'client launch', // rpc-compat
  // Add more prefixes as needed, e.g.:
  // 'simulator startup',
  // 'node startup',
];

const normalizedPrefixes = BENCHMARK_IGNORE_TEST_PREFIXES.map((p) => p.toLowerCase());

export function isBenchmarkIgnoredTest(testName: string): boolean {
  const name = testName.toLowerCase();
  return normalizedPrefixes.some((prefix) => name.startsWith(prefix));
}

export function calculateMedian(values: readonly number[]): number {
  if (values.length === 0) return 0;

  const middleIndex = Math.floor(values.length / 2);

  if (values.length % 2 === 1) {
    return values[middleIndex];
  }

  return (values[middleIndex - 1] + values[middleIndex]) / 2;
}
