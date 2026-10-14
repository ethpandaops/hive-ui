// Pull the short commit hash out of a client's self-reported version string
// (the `versions` map in listing.jsonl). Every client embeds one, but each
// in its own format:
//   besu/v26.8-develop-eea3174/linux-x86_64/openjdk-java-25
//   Geth/v1.17.6-unstable-aa1f2fcf-20260813/linux-amd64/go1.24.13
//   Reth Version: 2.5.0+3d270d93
//   1.40.0-unstable+3e3bd4bf                       (nethermind)
//   3.7.0-dev-a0758f07                             (erigon)
//   Nimbus/v0.4.0-15232136/linux-amd64/Nim-2.2.10  (all-digit hash)
//   ethrex/v22.0.0-...-db2e9b403a3fb1b1a0481123ed4d289ce4b3680a/...
// Only the first line is considered: nimbus appends its --help text, whose
// Nim compiler hash would otherwise be mistaken for the client's. Candidates
// are runs of 7-40 hex chars not embedded in a longer word. Runs containing
// a letter are preferred so an all-digit date such as 20260813 does not
// shadow a real hash; if none contain a letter (nimbus), the first wins.
// Short hashes are kept as the client reports them; full SHAs are cut to 7.
export function extractCommitHash(version: string | undefined): string | null {
  const firstLine = version?.split('\n')[0];
  if (!firstLine) return null;
  const candidates = firstLine.match(/(?<![0-9a-fA-F])[0-9a-fA-F]{7,40}(?![0-9a-fA-F])/g);
  if (!candidates) return null;
  const hash = candidates.find(c => /[a-fA-F]/.test(c)) ?? candidates[0];
  return (hash.length > 12 ? hash.slice(0, 7) : hash).toLowerCase();
}
