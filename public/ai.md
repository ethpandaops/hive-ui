# Accessing Hive test data programmatically

This page documents how to read Ethereum Hive test results directly as machine-readable
data from `https://hive.ethpandaops.io`, without scraping the UI.

The website is a static React single-page app. Everything it renders is fetched from
plain **JSON** and **JSONL** files served at predictable URLs. All files are public,
require no authentication, and are served with permissive CORS, so any HTTP client or
AI agent can fetch them directly.

> Quick index for agents: [/llms.txt](https://hive.ethpandaops.io/llms.txt)

## Overview of the data flow

```
discovery.json            ── list of test groups (with base addresses)
   └─ {address}/listing.jsonl        ── one line per test run (summary)
        └─ {address}/results/{fileName}   ── full detail for a single run
             └─ {address}/results/{simLog}   ── raw simulator/client log (text)
```

## 1. Discover test groups

`GET https://hive.ethpandaops.io/discovery.json`

Returns a JSON array of test groups:

```json
[
  {
    "name": "generic",
    "address": "https://hive.ethpandaops.io/generic/",
    "github_workflows": [
      "https://github.com/ethpandaops/hive-tests/actions/workflows/generic.yaml"
    ]
  }
]
```

| Field              | Type       | Description                                              |
| ------------------ | ---------- | -------------------------------------------------------- |
| `name`             | string     | Human-readable group name.                               |
| `address`          | string     | Base URL for the group's data (may have a trailing `/`). |
| `github_workflows` | string[]?  | Optional GitHub Actions workflow URLs that produce it.   |

Use `address` as the base for the next steps. Trailing slashes are optional —
normalize as needed.

## 2. List the runs in a group

`GET {address}/listing.jsonl`

This is **JSONL**: newline-delimited JSON, one test run per line. Parse it by splitting
on `\n` and `JSON.parse`-ing each non-empty line.

Each line (a `TestRun`):

```json
{
  "name": "engine-withdrawals",
  "ntests": 35,
  "passes": 34,
  "fails": 1,
  "timeout": false,
  "clients": ["reth_default"],
  "versions": { "reth_default": "Reth Version: 2.3.0+1c462acf" },
  "start": "2026-06-24T08:59:51Z",
  "fileName": "1782291920-04666365c80770ba706c712fff723fe2.json",
  "size": 29088,
  "simLog": "1782291150-simulator-df8b...400.log"
}
```

| Field      | Type                   | Description                                                |
| ---------- | ---------------------- | ---------------------------------------------------------- |
| `name`     | string                 | Test suite name.                                           |
| `ntests`   | number                 | Total number of test cases in the run.                     |
| `passes`   | number                 | Number of passing cases.                                   |
| `fails`    | number                 | Number of failing cases. **Filter `fails > 0` for failures.** |
| `timeout`  | boolean                | Whether the run timed out.                                 |
| `clients`  | string[]               | Clients under test.                                        |
| `versions` | object<string,string>  | Map of client name → version string.                       |
| `start`    | string (ISO 8601)      | Run start time.                                            |
| `fileName` | string                 | File to fetch for full detail (see step 3).                |
| `size`     | number                 | Size of the detail file in bytes.                          |
| `simLog`   | string                 | Filename of the raw simulator log (see step 4).            |

## 3. Fetch full detail for a run

`GET {address}/results/{fileName}`

Where `{fileName}` is the `fileName` from a listing line. Returns a `TestDetail`:

```json
{
  "id": 0,
  "name": "engine-withdrawals",
  "description": "...",
  "clientVersions": { "reth_default": "Reth Version: 2.3.0+1c462acf" },
  "testCases": {
    "1": {
      "name": "Withdrawals fork on Block 1 ...",
      "description": "",
      "start": "2026-06-24T08:59:51Z",
      "end": "2026-06-24T09:00:10Z",
      "summaryResult": {
        "pass": false,
        "log": { "begin": 10240, "end": 20480 }
      },
      "clientInfo": {
        "reth_default": {
          "id": "reth_default",
          "ip": "172.17.0.3",
          "name": "reth_default",
          "instantiatedAt": "2026-06-24T08:59:51Z",
          "logFile": "reth_default.log"
        }
      }
    }
  },
  "simLog": "1782291150-simulator-...log",
  "testDetailsLog": "",
  "runMetadata": {
    "hiveCommand": ["hive", "--sim", "ethereum/engine"],
    "hiveVersion": { "commit": "...", "commitDate": "...", "branch": "...", "dirty": false }
  }
}
```

Key fields:

| Field             | Type                          | Description                                              |
| ----------------- | ----------------------------- | -------------------------------------------------------- |
| `name`            | string                        | Suite name.                                              |
| `clientVersions`  | object<string,string>         | Client → version under test.                             |
| `testCases`       | object<string, TestCase>      | Map of case id → case detail.                            |
| `simLog`          | string                        | Raw simulator log filename (see step 4).                 |
| `runMetadata`     | object?                       | Hive command/version metadata for the run.               |

Each `TestCase`:

| Field                 | Type                       | Description                                              |
| --------------------- | -------------------------- | -------------------------------------------------------- |
| `name`                | string                     | Test case name.                                          |
| `description`         | string                     | Test case description.                                   |
| `start` / `end`       | string (ISO 8601)          | Case timing.                                             |
| `summaryResult.pass`  | boolean                    | Pass/fail for this case.                                 |
| `summaryResult.log`   | `{ begin, end }`           | **Byte offsets** into `simLog` for this case's output.   |
| `clientInfo`          | object<string, ClientInfo> | Per-client runtime info (id, ip, name, logFile, etc.).   |

## 4. Read raw logs

`GET {address}/results/{simLog}`

Returns the raw simulator log as **plain text**. To read only one test case's slice,
use the `summaryResult.log.{begin,end}` byte offsets with an HTTP Range request:

```
Range: bytes={begin}-{end}
```

## End-to-end recipe: find and explain failing tests

```bash
BASE="https://hive.ethpandaops.io"

# 1. Pick a group's address from discovery.json
ADDR=$(curl -s "$BASE/discovery.json" | jq -r '.[0].address' | sed 's:/*$::')

# 2. Find runs with failures
curl -s "$ADDR/listing.jsonl" \
  | while read -r line; do echo "$line"; done \
  | jq -c 'select(.fails > 0) | {name, fails, clients, fileName}'

# 3. For one failing run, list the failing cases
curl -s "$ADDR/results/<fileName>" \
  | jq -r '.testCases | to_entries[] | select(.value.summaryResult.pass == false)
           | "\(.value.name)  bytes \(.value.summaryResult.log.begin)-\(.value.summaryResult.log.end)"'

# 4. Read just the failing case's log slice
curl -s -r 10240-20480 "$ADDR/results/<simLog>"
```

## Notes for agents

- Prefer these data files over parsing the HTML UI; the HTML is just a renderer.
- The UI appends a `?ts=<epoch-ms>` cache-buster to `discovery.json` and `listing.jsonl`.
  You can do the same to avoid stale CDN responses, but it is not required.
- `discovery.json` is the single source of truth for which groups currently exist —
  read it live rather than hardcoding group names.
- GitHub workflow status (when present in `github_workflows`) is fetched separately from
  the GitHub REST API (`api.github.com/repos/{owner}/{repo}/actions/...`) and is subject
  to GitHub rate limits.
