import { TestLogOffsets } from '../types';

// Utilities for working with hive TestLogOffsets: byte ranges [begin, end)
// into (potentially very large) log files shared across many test cases.

export interface RangeFetchResult {
  // The requested byte slice.
  bytes: Uint8Array;
  // Total size of the file, when known (Content-Range header or full body).
  totalSize: number | null;
  // Set when the server ignored the Range header and returned the whole
  // file; callers can use this to upgrade to a full view for free.
  fullBody: Uint8Array | null;
}

// Fetches the byte range [begin, end) of a URL. Defensive against servers
// that ignore Range headers (returns 200 + full body): the slice is then
// taken client-side so callers always get exactly the requested range.
// A range end past EOF is fine; servers clamp it (RFC 9110).
export async function fetchByteRange(url: string, range: TestLogOffsets): Promise<RangeFetchResult> {
  // Empty ranges occur in real data (a client that produced no output
  // during a test); requesting them can even yield 416 at EOF.
  if (range.end <= range.begin) {
    return { bytes: new Uint8Array(0), totalSize: null, fullBody: null };
  }
  // HTTP Range is inclusive on both ends; TestLogOffsets.end is exclusive.
  const lastByte = range.end - 1;
  const response = await fetch(url, {
    headers: { Range: `bytes=${range.begin}-${lastByte}` },
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  const buf = new Uint8Array(await response.arrayBuffer());
  if (response.status === 206) {
    const contentRange = response.headers.get('Content-Range');
    const total = contentRange?.match(/\/(\d+)\s*$/);
    return {
      bytes: buf,
      totalSize: total ? parseInt(total[1], 10) : null,
      fullBody: null,
    };
  }
  return {
    bytes: buf.slice(range.begin, range.end),
    totalSize: buf.length,
    fullBody: buf,
  };
}

const NEWLINE = 10;

export interface LineRange {
  // 1-based, inclusive.
  start: number;
  end: number;
}

// The 1-based line number at which byte `offset` of the buffer starts.
export function lineNumberAt(bytes: Uint8Array, offset: number): number {
  let newlines = 0;
  const stop = Math.min(offset, bytes.length);
  for (let i = 0; i < stop; i++) {
    if (bytes[i] === NEWLINE) newlines++;
  }
  return newlines + 1;
}

// Maps the byte range [begin, end) to the 1-based inclusive line numbers it
// covers in the buffer. A range ending right after a newline does not
// extend the highlight into the following line. Offsets are clamped to the
// buffer; they can exceed it if the file was truncated or still being
// written when the results were captured.
export function byteRangeToLineRange(bytes: Uint8Array, range: TestLogOffsets): LineRange {
  const begin = Math.min(Math.max(range.begin, 0), bytes.length);
  const stop = Math.min(Math.max(range.end, begin), bytes.length);
  const start = lineNumberAt(bytes, begin);
  let end = lineNumberAt(bytes, stop);
  if (stop > 0 && bytes[stop - 1] === NEWLINE) {
    end = Math.max(start, end - 1);
  }
  return { start, end };
}

export function countLines(bytes: Uint8Array): number {
  let lines = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === NEWLINE) lines++;
  }
  // A trailing chunk without a final newline still counts as a line.
  if (bytes.length > 0 && bytes[bytes.length - 1] !== NEWLINE) lines++;
  return lines;
}

// Whether a ranged fetch of [chunkStart, chunkEnd) reached the end of the
// file, given the number of bytes actually received.
export function chunkIsAtEof(
  received: number,
  chunkStart: number,
  chunkEnd: number,
  totalSize: number | null
): boolean {
  return totalSize !== null ? chunkStart + received >= totalSize : received < chunkEnd - chunkStart;
}

// Drops the partial first line of a window that starts mid-line, returning
// the trimmed bytes and the file offset they start at.
export function trimLeadingPartialLine(
  bytes: Uint8Array,
  startByte: number
): { bytes: Uint8Array; startByte: number } {
  if (startByte === 0) return { bytes, startByte };
  const nl = bytes.indexOf(NEWLINE);
  if (nl < 0) return { bytes, startByte };
  return { bytes: bytes.subarray(nl + 1), startByte: startByte + nl + 1 };
}

// Drops the partial last line of a window that ends mid-line. Never trims
// below the absolute file offset `minKeepEnd` (e.g. the end of the anchored
// range); a chunk without any newline is kept as-is.
export function trimTrailingPartialLine(
  bytes: Uint8Array,
  startByte: number,
  minKeepEnd = 0
): Uint8Array {
  const lastNl = bytes.lastIndexOf(NEWLINE);
  if (lastNl < 0 || startByte + lastNl + 1 < minKeepEnd) return bytes;
  return bytes.subarray(0, lastNl + 1);
}

// Resolving an absolute line number for a byte offset requires counting the
// newlines before it. Cap how much is streamed for that per request; beyond
// this, callers show window-relative numbers or byte offsets only.
const LINE_COUNT_MAX_STREAM_BYTES = 8 * 1024 * 1024;

// Newline counts already computed per URL, as (offset, line) checkpoints in
// ascending offset order. Results files are immutable, so entries never go
// stale; navigating between tests in the same log only ever streams the gap
// since the nearest checkpoint.
const lineCheckpoints = new Map<string, { offset: number; line: number }[]>();

// Resolves the 1-based line number at which byte `offset` of the file at
// `url` starts, streaming at most LINE_COUNT_MAX_STREAM_BYTES beyond the
// nearest cached checkpoint. Returns null when the offset is too far from
// any checkpoint to count affordably. Abortable via `signal`.
export async function resolveLineNumber(
  url: string,
  offset: number,
  signal?: AbortSignal
): Promise<number | null> {
  if (offset <= 0) return 1;
  const checkpoints = lineCheckpoints.get(url) ?? [{ offset: 0, line: 1 }];
  let nearest = checkpoints[0];
  for (const checkpoint of checkpoints) {
    if (checkpoint.offset > offset) break;
    nearest = checkpoint;
  }
  if (nearest.offset === offset) return nearest.line;
  if (offset - nearest.offset > LINE_COUNT_MAX_STREAM_BYTES) return null;

  const newlines = await countNewlinesBetween(url, nearest.offset, offset, signal);
  const line = nearest.line + newlines;
  const updated = checkpoints.filter((c) => c.offset !== offset);
  updated.push({ offset, line });
  updated.sort((a, b) => a.offset - b.offset);
  lineCheckpoints.set(url, updated);
  return line;
}

// Streams the byte range [from, to) of a URL and counts the newlines in it.
async function countNewlinesBetween(
  url: string,
  from: number,
  to: number,
  signal?: AbortSignal
): Promise<number> {
  const length = to - from;
  const response = await fetch(url, {
    headers: { Range: `bytes=${from}-${to - 1}` },
    signal,
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  // A 200 response means the server ignored the Range header and is sending
  // the whole file; count within [from, to) of the full body.
  const rangeHonored = response.status === 206;
  const skip = rangeHonored ? 0 : from;
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return countNewlinesIn(bytes.subarray(skip, skip + length));
  }
  const reader = response.body.getReader();
  let position = 0;
  let newlines = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const start = Math.max(0, skip - position);
    const end = Math.min(value.length, skip + length - position);
    for (let i = start; i < end; i++) {
      if (value[i] === NEWLINE) newlines++;
    }
    position += value.length;
    if (position >= skip + length) {
      reader.cancel().catch(() => undefined);
      break;
    }
  }
  return newlines;
}

function countNewlinesIn(bytes: Uint8Array): number {
  let newlines = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === NEWLINE) newlines++;
  }
  return newlines;
}

const utf8Decoder = new TextDecoder();

export function decodeBytes(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes);
}

export function formatByteSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
