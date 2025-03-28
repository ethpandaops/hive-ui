import { format, isValid } from 'date-fns';
import { TestRun } from '../types';
import { getStatusStyles } from '../utils/statusHelpers';

type GroupBy = 'test' | 'client';

interface TestResultCardProps {
  run: TestRun;
  groupBy: GroupBy;
  directory: string;
  directoryAddress: string;
  index: number;
}

const TestResultCard = ({ run, groupBy, directory, directoryAddress }: TestResultCardProps) => {
  const statusStyles = getStatusStyles(run);
  const displayName = groupBy === 'test'
    ? run.clients.join(', ')  // When grouped by test, show clients
    : run.name.split('/').slice(1).join('/'); // When grouped by client, show test name

  return (
    <a
      href={`${directoryAddress}/suite.html?suiteid=${run.fileName}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        backgroundColor: 'var(--card-bg, #ffffff)',
        borderRadius: '0.375rem',
        overflow: 'hidden',
        border: '1px solid var(--border-color, rgba(229, 231, 235, 0.4))',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        background: statusStyles.pattern,
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
      }}
    >
      {/* Status strip */}
      <div style={{
        height: '3px',
        backgroundColor: statusStyles.border,
        width: '100%'
      }}></div>

      {/* Card content */}
      <div style={{ padding: '0.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header with status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.25rem'
        }}>
          <div style={{
            fontSize: '0.8rem',
            fontWeight: '500',
            color: 'var(--text-primary, #111827)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1
          }}>
            {displayName}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.15rem 0.35rem',
            borderRadius: '9999px',
            fontSize: '0.65rem',
            fontWeight: '500',
            backgroundColor: statusStyles.bg,
            color: statusStyles.text,
            border: `1px solid ${statusStyles.border}20`,
            whiteSpace: 'nowrap',
            marginLeft: '0.5rem'
          }}>
            <span style={{ marginRight: '0.25rem' }}>{statusStyles.icon}</span>
            {statusStyles.label}
          </div>
        </div>

        {/* Test stats */}
        <div style={{
          display: 'flex',
          gap: '0.35rem',
          margin: '0.25rem 0',
          fontSize: '0.7rem'
        }}>
          {run.passes > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.2rem 0.4rem',
              borderRadius: '0.25rem',
              color: 'var(--success-text, #047857)',
              fontWeight: '600',
              border: '1px solid var(--success-border, #10b981)20',
              background: 'var(--success-bg, #ecfdf5)'
            }}>
              <span style={{ marginRight: '0.2rem' }}>✓</span>
              {run.passes}
            </div>
          )}
          {run.fails > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.2rem 0.4rem',
              borderRadius: '0.25rem',
              color: 'var(--error-text, #b91c1c)',
              fontWeight: '600',
              border: run.passes / run.ntests > 0.5
                ? '1px solid var(--warning-border, #f59e0b)20'
                : '1px solid var(--error-border, #ef4444)20',
              background: run.passes / run.ntests > 0.5
                ? 'var(--warning-bg, #fffbeb)'
                : 'var(--error-bg, #fef2f2)'
            }}>
              <span style={{ marginRight: '0.2rem' }}>✕</span>
              {run.fails}
            </div>
          )}
        </div>

        {/* Date */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '0.25rem',
          borderTop: '1px solid var(--border-color, rgba(229, 231, 235, 0.4))',
          fontSize: '0.7rem',
          color: 'var(--text-secondary, #6b7280)',
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{ marginRight: '0.25rem' }}>🕒</span>
          {formatDate(run.start)}
        </div>
      </div>
    </a>
  );
}

// Helper function to format date
const formatDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return isValid(date) ? format(date, 'MMM d, yyyy HH:mm:ss') : 'Invalid date';
};

export default TestResultCard;
