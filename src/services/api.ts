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
  // fixtures release; version/releaseUrl then point at the branch.
  kind: 'release' | 'branch';
}

// Where a client under test was built from, per hive's client config file
// (runMetadata.clientConfig): either a git checkout (dockerfile: git with
// github/tag build args) or a prebuilt docker image (baseimage/tag).
export interface ClientSource {
  // Repo ("hyperledger/besu") for a git build, image ("ethpandaops/besu")
  // for an image build.
  origin: string;
  // Git ref or image tag, e.g. "main" / "master"; absent when the config
  // relies on hive's default.
  ref?: string;
  // GitHub "owner/repo" when known (git builds), used to link commit hashes.
  github?: string;
  kind: 'git' | 'image';
}

export interface SuiteHead {
  fixtureRelease: FixtureRelease | null;
  // Keyed by hive client name ("<client>_<nametag>"), matching TestRun.clients.
  clientSources: Record<string, ClientSource>;
}

// Extract run provenance from the head of a suite JSON: the EELS source
// (fixtures release, e.g. "glamsterdam-devnet@v8.0.0" and its GitHub
// release page, for consume sims; the EELS branch for execute sims) from
// runMetadata.hiveCommand, and each client's build source from
// runMetadata.clientConfig. Suite files are ~16MB, but runMetadata sits at
// the head of the file, so only the first 8KB is fetched via a Range
// request (single byte ranges are CORS-safelisted, no preflight).
export const fetchSuiteHead = async (discoveryAddr: string, fileName: string): Promise<SuiteHead | null> => {
  const response = await fetch(`${discoveryAddr}/results/${fileName}`, {
    headers: { Range: 'bytes=0-8191' },
  });
  // Only accept partial content; a 200 here would mean the server ignored the
  // Range header and response.text() would pull the entire multi-MB file.
  if (response.status !== 206) return null;
  const text = await response.text();
  return {
    fixtureRelease: parseFixtureRelease(text),
    clientSources: parseClientSources(text),
  };
};

const parseFixtureRelease = (text: string): FixtureRelease | null => {
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

interface ClientConfigEntry {
  client?: string;
  nametag?: string;
  dockerfile?: string;
  build_args?: Record<string, string>;
}

// ethpandaops CI pulls Docker Hub images through this mirror; the prefix is
// noise on a card, so it is dropped for display (the tooltip keeps it).
const DOCKERHUB_PROXY = /^docker\.ethquokkaops\.io\/dh\//;

// Upstream repos for the ethpandaops client images (built from these repos
// by ethpandaops/eth-client-docker-image-builder), so a commit hash from
// an image-sourced run can still link to GitHub. Devnet images built from
// forks will 404 on the link, but the hash itself is still correct.
const IMAGE_REPOS: Record<string, string> = {
  'ethpandaops/geth': 'ethereum/go-ethereum',
  'ethpandaops/besu': 'hyperledger/besu',
  'ethpandaops/reth': 'paradigmxyz/reth',
  'ethpandaops/nethermind': 'NethermindEth/nethermind',
  'ethpandaops/erigon': 'erigontech/erigon',
  'ethpandaops/nimbus-eth1': 'status-im/nimbus-eth1',
  'ethpandaops/ethrex': 'lambdaclass/ethrex',
  'lambdaclass/ethrex': 'lambdaclass/ethrex',
};

const upstreamRepoForImage = (image: string): string | undefined => {
  const path = image.replace(DOCKERHUB_PROXY, '').replace(/^ghcr\.io\//, '').replace(/^docker\.io\//, '');
  return IMAGE_REPOS[path];
};

// hive writes runMetadata before testCases, so everything up to the
// testCases key is a truncated-but-closable JSON prefix of the suite object.
// If the prefix is not in the fetched head (huge description, old hive
// layout) no sources are reported rather than guessing.
const parseClientSources = (text: string): Record<string, ClientSource> => {
  const end = text.indexOf(',"testCases"');
  if (end < 0) return {};
  let entries: ClientConfigEntry[];
  try {
    const head = JSON.parse(text.slice(0, end) + '}');
    entries = head?.runMetadata?.clientConfig?.content?.clients;
  } catch {
    return {};
  }
  if (!Array.isArray(entries)) return {};

  const sources: Record<string, ClientSource> = {};
  for (const entry of entries) {
    if (!entry?.client) continue;
    const name = `${entry.client}_${entry.nametag || 'default'}`;
    const args = entry.build_args ?? {};
    if (entry.dockerfile === 'git' && args.github) {
      sources[name] = { origin: args.github, ref: args.tag, github: args.github, kind: 'git' };
    } else if (args.baseimage) {
      sources[name] = {
        origin: args.baseimage.replace(DOCKERHUB_PROXY, ''),
        ref: args.tag,
        github: upstreamRepoForImage(args.baseimage),
        kind: 'image',
      };
    }
  }
  return sources;
};

export const fetchTestDetail = async (discoveryAddr: string, fileName: string): Promise<TestDetail> => {
  const response = await fetch(`${discoveryAddr}/results/${fileName}`);
  if (!response.ok) {
    throw new Error('Failed to fetch test details');
  }
  return await response.json();
};
