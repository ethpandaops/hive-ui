import { Directory, TestRun } from '../types';

const BASE_URL = 'https://hive.ethpandaops.io';

const getTimestamp = () => new Date().getTime();

export const fetchDirectories = async (): Promise<Directory[]> => {
  const response = await fetch(`${BASE_URL}/directories.json?ts=${getTimestamp()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch directories');
  }
  return response.json();
};

export const fetchTestRuns = async (directory: string): Promise<TestRun[]> => {
  const response = await fetch(`${BASE_URL}/${directory}/listing.jsonl?ts=${getTimestamp()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch test runs');
  }
  const text = await response.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
};
