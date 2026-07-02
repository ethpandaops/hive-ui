import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDirectories } from '../services/api';
import Prism from 'prismjs';
import 'prismjs/components/prism-log';
import { usePrismTheme } from './PrismTheme';
import {
  countLines,
  decodeBytes,
  fetchByteRange,
  formatByteSize,
  lineNumberAt,
  resolveLineNumber,
} from '../utils/byteRange';
import { logViewerUrl } from '../utils/urls';

interface LogExcerptProps {
  discoveryName: string;
  logFile: string;
  beginByte: number;
  endByte: number;
  isDarkMode: boolean;
  suiteid?: string;
  // Cap on how many bytes of the range are fetched/rendered inline.
  // Ranges larger than this are truncated with a notice; the full range
  // stays reachable through the "View full log" link.
  maxBytes?: number;
}

// Fetch at most this much of an excerpt by default; shared client logs can
// have per-test ranges spanning megabytes.
const DEFAULT_MAX_EXCERPT_BYTES = 128 * 1024;

const LogExcerpt: React.FC<LogExcerptProps> = ({
  discoveryName,
  logFile,
  beginByte,
  endByte,
  isDarkMode,
  suiteid = '',
  maxBytes = DEFAULT_MAX_EXCERPT_BYTES
}) => {
  const [logContent, setLogContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Absolute line range of the displayed excerpt, once counted.
  const [lineRange, setLineRange] = useState<{ start: number; end: number } | null>(null);
  const { codeClassName } = usePrismTheme(isDarkMode);
  const truncated = endByte - beginByte > maxBytes;

  // Fetch directories to get the discovery address
  const { data: directories } = useQuery({
    queryKey: ['directories'],
    queryFn: fetchDirectories,
  });

  // Get directory address for the group
  const discoveryAddress = directories?.find(dir => dir.name === discoveryName)?.address || '';

  useEffect(() => {
    const abort = new AbortController();

    const fetchLogExcerpt = async () => {
      if (!discoveryAddress || !logFile) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setLineRange(null);

        // Construct the URL to fetch the log file
        const logFilePath = `${discoveryAddress}/results/${encodeURIComponent(logFile)}`;

        // Fetch only the excerpt's byte range, capped so that huge
        // per-test ranges do not stall the expanded row.
        const cappedEnd = Math.min(endByte, beginByte + maxBytes);
        const result = await fetchByteRange(logFilePath, { begin: beginByte, end: cappedEnd });

        setLogContent(decodeBytes(result.bytes));
        setLoading(false);

        // Resolve the absolute line numbers of the excerpt by counting the
        // newlines before it: directly when the server already returned the
        // whole file, otherwise in the background (bounded and cached per
        // file; null means the excerpt is too deep to count affordably).
        const excerptLines = countLines(result.bytes);
        const applyStart = (start: number | null) => {
          if (start !== null) {
            setLineRange({ start, end: start + Math.max(excerptLines, 1) - 1 });
          }
        };
        if (result.fullBody) {
          applyStart(lineNumberAt(result.fullBody, beginByte));
        } else {
          resolveLineNumber(logFilePath, beginByte, abort.signal)
            .then(applyStart)
            .catch(() => undefined);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setLoading(false);
      }
    };

    fetchLogExcerpt();
    return () => abort.abort();
  }, [discoveryAddress, logFile, beginByte, endByte, maxBytes]);

  // Apply syntax highlighting after content loads
  useEffect(() => {
    if (logContent && !loading) {
      // Disable Prism's line numbers plugin if it exists
      if (Prism.plugins && Prism.plugins.lineNumbers) {
        Prism.plugins.lineNumbers = { disable: true };
      }

      // Short delay to ensure DOM is ready
      setTimeout(() => {
        Prism.highlightAll();
      }, 100);
    }
  }, [logContent, loading]);

  return (
    <div style={{
      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
      padding: '0.75rem',
      borderRadius: '0.375rem',
      fontFamily: 'monospace',
      fontSize: '0.75rem',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      lineHeight: '1.5'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
        flexWrap: 'wrap'
      }}>
        <Link
          to={logViewerUrl(discoveryName, suiteid, logFile, { begin: beginByte, end: endByte })}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            color: '#6366f1',
            fontSize: '0.75rem',
            textDecoration: 'none'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}>
            <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
            <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
          View full log
        </Link>
        <div style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '0.75rem' }}>
          {lineRange && `Lines ${lineRange.start.toLocaleString()}–${lineRange.end.toLocaleString()} · `}
          Bytes {beginByte.toLocaleString()}–{endByte.toLocaleString()} ({formatByteSize(endByte - beginByte)})
        </div>
      </div>

      {truncated && !loading && !error && (
        <div style={{
          marginBottom: '0.5rem',
          padding: '0.375rem 0.5rem',
          borderRadius: '0.25rem',
          fontSize: '0.75rem',
          backgroundColor: isDarkMode ? 'rgba(234, 179, 8, 0.15)' : 'rgba(234, 179, 8, 0.12)',
          color: isDarkMode ? '#facc15' : '#a16207'
        }}>
          Excerpt truncated to the first {formatByteSize(maxBytes)} of this {formatByteSize(endByte - beginByte)} range — use “View full log” for the rest.
        </div>
      )}

      {loading ? (
        <div style={{ padding: '0.5rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
          Loading log excerpt...
        </div>
      ) : error ? (
        <div style={{ padding: '0.5rem', color: isDarkMode ? '#ef4444' : '#dc2626' }}>
          Error: {error}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%' }}>
          <pre style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            wordWrap: 'break-word',
            backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
            padding: '0.75rem',
            borderRadius: '0.25rem',
            maxHeight: '450px',
            overflow: 'auto'
          }}>
            <code className={`language-log ${codeClassName}`} style={{
              display: 'block',
              maxWidth: '100%',
              wordBreak: 'break-all',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap'
            }}>
              {logContent}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default LogExcerpt;
