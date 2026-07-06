import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isValid } from 'date-fns';
import { TestDetail, isRealTestCase } from '../types';
import { useTheme } from '../contexts/useTheme';
import { formatByteSize } from '../utils/byteRange';
import { logViewerUrl } from '../utils/urls';

interface SharedClientsPanelProps {
  testDetail: TestDetail;
  discoveryName: string;
  suiteid: string;
}

const COLLAPSED_ROW_COUNT = 8;

// Suite-level summary of client containers that were shared across multiple
// tests (hive multi-test mode). Replaces the hidden multiTestContext pseudo
// test case in the results table: one row per client instance, with the
// number of tests it served and its full log.
const SharedClientsPanel: React.FC<SharedClientsPanelProps> = ({
  testDetail,
  discoveryName,
  suiteid,
}) => {
  const { isDarkMode } = useTheme();
  const [showAll, setShowAll] = useState(false);

  const contextCases = useMemo(
    () => Object.values(testDetail.testCases).filter((testCase) => !isRealTestCase(testCase)),
    [testDetail]
  );

  // Number of tests served per client log file.
  const testsPerLog = useMemo(() => {
    const counts = new Map<string, number>();
    for (const testCase of Object.values(testDetail.testCases)) {
      if (!isRealTestCase(testCase) || !testCase.clientInfo) continue;
      for (const client of Object.values(testCase.clientInfo)) {
        if (client.logFile) {
          counts.set(client.logFile, (counts.get(client.logFile) || 0) + 1);
        }
      }
    }
    return counts;
  }, [testDetail]);

  if (contextCases.length === 0) {
    return null;
  }

  const clients = contextCases
    .flatMap((testCase) => Object.values(testCase.clientInfo || {}))
    .sort((a, b) => new Date(a.instantiatedAt).getTime() - new Date(b.instantiatedAt).getTime());
  const totalTests = clients.reduce((sum, c) => sum + (testsPerLog.get(c.logFile) || 0), 0);
  const lifecycleClean = contextCases.every((testCase) => testCase.summaryResult.pass);
  const shownClients = showAll ? clients : clients.slice(0, COLLAPSED_ROW_COUNT);

  const border = '1px solid var(--border-color)';
  const secondaryText = { color: 'var(--text-secondary)' };
  const cellStyle: React.CSSProperties = {
    padding: '0.4rem 0.75rem',
    fontSize: '0.75rem',
    borderBottom: border,
    whiteSpace: 'nowrap',
  };
  const headStyle: React.CSSProperties = {
    ...cellStyle,
    ...secondaryText,
    textAlign: 'left',
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: '0.675rem',
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return isValid(date) ? format(date, 'HH:mm:ss') : '—';
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--card-bg)',
        border,
        borderRadius: '0.5rem',
        marginBottom: '1.5rem',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.75rem 1rem',
          borderBottom: border,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Shared Client Sessions</h3>
          <span style={{ fontSize: '0.75rem', ...secondaryText }}>
            {clients.length.toLocaleString()} client instance{clients.length === 1 ? '' : 's'} served{' '}
            {totalTests.toLocaleString()} test{totalTests === 1 ? '' : 's'}
          </span>
        </div>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '0.15rem 0.6rem',
            borderRadius: '9999px',
            backgroundColor: lifecycleClean
              ? isDarkMode
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(16, 185, 129, 0.12)'
              : isDarkMode
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(239, 68, 68, 0.12)',
            color: lifecycleClean ? '#10b981' : '#ef4444',
          }}
          title="Result of the shared-client lifecycle (multi-test context) entries"
        >
          {lifecycleClean ? '✓ lifecycle clean' : '✕ lifecycle issues'}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={headStyle}>Client</th>
              <th style={headStyle}>Instance</th>
              <th style={headStyle}>Started</th>
              <th style={{ ...headStyle, textAlign: 'right' }}>Tests</th>
              <th style={{ ...headStyle, textAlign: 'right' }}>Log size</th>
              <th style={headStyle}></th>
            </tr>
          </thead>
          <tbody>
            {shownClients.map((client) => (
              <tr key={client.id}>
                <td style={cellStyle}>{client.name}</td>
                <td style={{ ...cellStyle, fontFamily: 'monospace' }}>{client.id}</td>
                <td style={cellStyle}>{formatTime(client.instantiatedAt)}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  {(testsPerLog.get(client.logFile) || 0).toLocaleString()}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  {client.logOffsets ? formatByteSize(client.logOffsets.end) : '—'}
                </td>
                <td style={cellStyle}>
                  <Link
                    to={logViewerUrl(discoveryName, suiteid, client.logFile)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#6366f1', textDecoration: 'none' }}
                  >
                    View log
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {clients.length > COLLAPSED_ROW_COUNT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{
            display: 'block',
            width: '100%',
            padding: '0.5rem',
            border: 'none',
            background: 'transparent',
            color: '#6366f1',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          {showAll ? 'Show fewer' : `Show all ${clients.length.toLocaleString()} client instances`}
        </button>
      )}
    </div>
  );
};

export default SharedClientsPanel;
