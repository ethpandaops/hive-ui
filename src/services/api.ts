import { Directory, TestRun, TestDetail } from '../types';

const getTimestamp = () => new Date().getTime();

export const fetchDirectories = async (): Promise<Directory[]> => {
  const response = await fetch(`/discovery.json?ts=${getTimestamp()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch directories');
  }

  const data = await response.json();
  // Remove all trailing slashes from the addresses
  return data.map((directory: Directory) => ({
    ...directory,
    address: directory.address.replace(/\/$/, '')
  }));
};

export const fetchTestRuns = async (directory: Directory): Promise<TestRun[]> => {
  const response = await fetch(`${directory.address}/listing.jsonl?ts=${getTimestamp()}`);
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

export const fetchTestDetail = async (discoveryAddr: string, fileName: string): Promise<TestDetail> => {
  const response = await fetch(`${discoveryAddr}/results/${fileName}?ts=${getTimestamp()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch test details');
  }
  return await response.json();
};
