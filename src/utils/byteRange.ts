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
export async function fetchByteRange(url: string, range: TestLogOffsets): Promise<RangeFetchResult> {
  // HTTP Range is inclusive on both ends; TestLogOffsets.end is exclusive.
  const lastByte = Math.max(range.begin, range.end - 1);
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

// Fetches the total size of a file in bytes via a HEAD request, falling back
// to a 1-byte range request when HEAD is not supported.
export async function fetchFileSize(url: string): Promise<number | null> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) {
      const len = head.headers.get('Content-Length');
      if (len) return parseInt(len, 10);
    }
  } catch {
    // Fall through to range probe.
  }
  try {
    const probe = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    if (probe.status === 206) {
      const total = probe.headers.get('Content-Range')?.match(/\/(\d+)\s*$/);
      if (total) return parseInt(total[1], 10);
    }
    if (probe.ok) {
      const len = probe.headers.get('Content-Length');
      if (len) return parseInt(len, 10);
    }
  } catch {
    // Size unknown.
  }
  return null;
}

const NEWLINE = 10;

export interface LineRange {
  // 1-based, inclusive.
  start: number;
  end: number;
}

// Maps the byte range [begin, end) to the 1-based inclusive line numbers it
// covers in the buffer. A range ending right after a newline does not
// extend the highlight into the following line.
export function byteRangeToLineRange(bytes: Uint8Array, range: TestLogOffsets): LineRange {
  let line = 1;
  let start = 1;
  const stop = Math.min(range.end, bytes.length);
  for (let i = 0; i < stop; i++) {
    if (i === range.begin) start = line;
    if (bytes[i] === NEWLINE) line++;
  }
  if (range.begin >= stop) start = line;
  let end = line;
  if (range.end > 0 && range.end <= bytes.length && bytes[range.end - 1] === NEWLINE) {
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

// Streams the first `prefixLength` bytes of a URL and counts newlines,
// yielding the 1-based line number at which byte offset `prefixLength`
// starts. Used to turn window-relative line numbers into absolute ones
// without downloading beyond the window start. Abortable via `signal`.
export async function countLinesBefore(
  url: string,
  prefixLength: number,
  signal?: AbortSignal
): Promise<number> {
  if (prefixLength <= 0) return 1;
  const response = await fetch(url, {
    headers: { Range: `bytes=0-${prefixLength - 1}` },
    signal,
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return countNewlines(bytes, prefixLength) + 1;
  }
  const reader = response.body.getReader();
  let seen = 0;
  let newlines = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = prefixLength - seen;
    const chunk = value.length > remaining ? value.subarray(0, remaining) : value;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === NEWLINE) newlines++;
    }
    seen += chunk.length;
    if (seen >= prefixLength) {
      reader.cancel().catch(() => undefined);
      break;
    }
  }
  return newlines + 1;
}

function countNewlines(bytes: Uint8Array, limit: number): number {
  let newlines = 0;
  const stop = Math.min(limit, bytes.length);
  for (let i = 0; i < stop; i++) {
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
