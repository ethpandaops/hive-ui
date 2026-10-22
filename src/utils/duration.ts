// Formats a duration in at most two units, e.g. "350ms", "42s", "17m 5s",
// "4h 12m" or "2d 3h", so short tests and multi-day runs read alike.
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = Math.round(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Returns the milliseconds between two timestamps, or null when either is
// missing or invalid, or end precedes start (e.g. a listing entry written
// before hive recorded run end times).
export function timeSpanMs(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Number.isNaN(ms) || ms < 0 ? null : ms;
}

// Formats the time between two timestamps, or returns null when unknown.
export function formatTimeSpan(start?: string, end?: string): string | null {
  const ms = timeSpanMs(start, end);
  return ms === null ? null : formatDuration(ms);
}

// Formats a signed duration change, e.g. "+45s" or "−1h 1m".
export function formatDurationDelta(ms: number): string {
  return `${ms < 0 ? '−' : '+'}${formatDuration(Math.abs(ms))}`;
}
