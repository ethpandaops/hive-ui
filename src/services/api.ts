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
    .flatMap(line => {
      // The listing is regenerated in S3 as test jobs finish; skip a line
      // caught mid-rewrite instead of dropping the whole directory.
      try {
        return [JSON.parse(line)];
      } catch {
        console.warn(`Skipping malformed listing line in ${directory.name}`);
        return [];
      }
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
};

export interface FixtureRelease {
  version: string;
  releaseUrl: string;
  // Execute-mode sims build from an EELS branch instead of consuming a
  // fixtures release; version/releaseUrl then point at the branch. An
  // image channel (latest, bogota-devnet-1, nightly) follows a release
  // line rather than naming one; version/releaseUrl then point at the image.
  kind: 'release' | 'branch' | 'image';
}

const EELS_REPO = 'https://github.com/ethereum/execution-specs';

// Map a published EELS simulator image tag to the fixtures release it
// carries: v21.0.1 is tests@v21.0.1 and bogota-devnet-v1.1.0 is
// tests-bogota-devnet@v1.1.0. Any other tag is a channel.
const imageRelease = (tag: string, simulator: string | undefined): FixtureRelease => {
  const name = tag.split('@')[0];
  const devnet = name.match(/^(.+-devnet)-(v\d+\.\d+\.\d+.*)$/);
  const release = /^v\d+\.\d+\.\d+/.test(name)
    ? `tests@${name}`
    : devnet && `tests-${devnet[1]}@${devnet[2]}`;
  if (release) {
    return {
      version: release.replace(/^tests-/, ''),
      releaseUrl: `${EELS_REPO}/releases/tag/${release}`,
      kind: 'release',
    };
  }
  const image = encodeURIComponent(`execution-specs/hive/${simulator}`);
  return {
    version: name,
    releaseUrl: simulator
      ? `https://github.com/orgs/ethereum/packages/container/package/${image}`
      : EELS_REPO,
    kind: 'image',
  };
};

// Extract the EELS source a run used from the suite JSON's
// runMetadata.hiveCommand: the simulator image tag (`tag=`) of the
// published images, or for runs that built from source the fixtures
// release (e.g. "glamsterdam-devnet@v8.0.0" and its GitHub release page)
// for consume sims, or the EELS branch for execute sims. Suite files are
// ~16MB, but runMetadata sits at the head of the file, so only the first
// 8KB is fetched via a Range request (single byte ranges are
// CORS-safelisted, no preflight).
export const fetchFixtureRelease = async (discoveryAddr: string, fileName: string): Promise<FixtureRelease | null> => {
  const response = await fetch(`${discoveryAddr}/results/${fileName}`, {
    headers: { Range: 'bytes=0-8191' },
  });
  // Only accept partial content; a 200 here would mean the server ignored the
  // Range header and response.text() would pull the entire multi-MB file.
  if (response.status !== 206) return null;
  const text = await response.text();
  const tag = text.match(/"tag=([^"]+)"/)?.[1];
  if (tag) {
    const simulator = text.match(/"--sim",\s*"ethereum\/eels\/([^"]+)"/)?.[1];
    return imageRelease(tag, simulator);
  }
  const fixturesUrl = text.match(/"fixtures=([^"]+)"/)?.[1];
  const match = fixturesUrl?.match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\/download\/([^/]+)\//);
  if (match) {
    return {
      version: decodeURIComponent(match[2]).replace(/^tests-/, ''),
      releaseUrl: `${match[1]}/releases/tag/${match[2]}`,
      kind: 'release',
    };
  }
  const branch = text.match(/"branch=([^"]+)"/)?.[1];
  if (!branch) return null;
  return {
    version: branch,
    releaseUrl: `https://github.com/ethereum/execution-specs/tree/${branch}`,
    kind: 'branch',
  };
};

export const fetchTestDetail = async (discoveryAddr: string, fileName: string): Promise<TestDetail> => {
  const response = await fetch(`${discoveryAddr}/results/${fileName}`);
  if (!response.ok) {
    throw new Error('Failed to fetch test details');
  }
  return await response.json();
};
