import { TestRun } from '../types';
import TestResultCard from './TestResultCard';

type GroupBy = 'test' | 'client';

interface TestResultGroupProps {
  groupKey: string;
  groupRuns: TestRun[];
  groupBy: GroupBy;
  directory: string;
  directoryAddress: string;
}

const TestResultGroup = ({ groupKey, groupRuns, groupBy, directory, directoryAddress }: TestResultGroupProps) => {
  // Create a sanitized class name from the groupKey.
  // - Replace non-alphanumeric chars with hyphens
  // - Replace multiple hyphens with single
  // - Remove leading/trailing hyphens
  const sanitizedClassName = groupKey
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const uniqueClassName = groupBy === 'client'
    ? `client-box-${sanitizedClassName}`
    : `test-box-${sanitizedClassName}`;

  return (
    <div
      className={uniqueClassName}
      style={{
      backgroundColor: 'var(--card-bg, #ffffff)',
      borderRadius: '0.5rem',
      overflow: 'hidden',
      border: '1px solid var(--border-color, rgba(229, 231, 235, 0.6))',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    }}>
      {/* Group Header */}
      <div style={{
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
      }}>
        <h4 style={{
          fontSize: '0.9rem',
          fontWeight: '600',
          color: 'var(--text-primary, #111827)',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          {groupBy === 'test' ? (
            <>
              <span>🧪</span>
              {groupKey}
            </>
          ) : (
            <>
              {groupKey.split('+').map((client, idx) => {
                const clientName = client.trim().split('_')[0].toLowerCase();
                const logoPath = `/img/clients/${clientName}.jpg`;
                return (
                  <div
                    key={client}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem'
                    }}
                  >
                    <img
                      src={logoPath}
                      alt={`${client} logo`}
                      style={{
                        width: '16px',
                        height: '16px',
                        minWidth: '16px',
                        minHeight: '16px',
                        borderRadius: '2px',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = '/img/clients/default.jpg';
                      }}
                    />
                    <span>{client.trim()}</span>
                    {idx < groupKey.split('+').length - 1 && <span>,</span>}
                  </div>
                );
              })}
            </>
          )}
        </h4>
      </div>

      {/* Group Items */}
      <div style={{
        padding: '0.75rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '0.75rem'
      }}>
        {groupRuns.map((run, index) => (
          <TestResultCard
            key={`${run.name}-${index}`}
            run={run}
            groupBy={groupBy}
            directory={directory}
            directoryAddress={directoryAddress}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

export default TestResultGroup;
