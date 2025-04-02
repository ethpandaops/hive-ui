import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDirectories } from '../services/api';
import Prism from 'prismjs';
import 'prismjs/components/prism-log';
import { usePrismTheme } from './PrismTheme';

interface LogExcerptProps {
  discoveryName: string;
  logFile: string;
  beginByte: number;
  endByte: number;
  isDarkMode: boolean;
  suiteid?: string;
}

const LogExcerpt: React.FC<LogExcerptProps> = ({
  discoveryName,
  logFile,
  beginByte,
  endByte,
  isDarkMode,
  suiteid = ''
}) => {
  const [logContent, setLogContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { codeClassName } = usePrismTheme(isDarkMode);

  // Fetch directories to get the discovery address
  const { data: directories } = useQuery({
    queryKey: ['directories'],
    queryFn: fetchDirectories,
  });

  // Get directory address for the group
  const discoveryAddress = directories?.find(dir => dir.name === discoveryName)?.address || '';

  useEffect(() => {
    const fetchLogExcerpt = async () => {
      if (!discoveryAddress || !logFile) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Construct the URL to fetch the log file
        const logFilePath = `${discoveryAddress}/results/${encodeURIComponent(logFile)}`;

        // Use range request for the specified byte range
        const headers: HeadersInit = {
          'Range': `bytes=${beginByte}-${endByte}`
        };

        const response = await fetch(logFilePath, { headers });

        if (!response.ok && response.status !== 206) {
          throw new Error(`Failed to fetch log excerpt: ${response.statusText}`);
        }

        const text = await response.text();
        setLogContent(text);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setLoading(false);
      }
    };

    fetchLogExcerpt();
  }, [discoveryAddress, logFile, beginByte, endByte]);

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
      overflowX: 'auto',
      lineHeight: '1.5'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem'
      }}>
        <Link
          to={`/logs/${discoveryName}/${suiteid || ''}/${encodeURIComponent(logFile)}?begin=${beginByte}&end=${endByte}`}
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
          Bytes {beginByte} to {endByte}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '0.5rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
          Loading log excerpt...
        </div>
      ) : error ? (
        <div style={{ padding: '0.5rem', color: isDarkMode ? '#ef4444' : '#dc2626' }}>
          Error: {error}
        </div>
      ) : (
        <pre style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
          padding: '0.75rem',
          borderRadius: '0.25rem',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          <code className={`language-log ${codeClassName}`}>
            {logContent}
          </code>
        </pre>
      )}
    </div>
  );
};

export default LogExcerpt;
