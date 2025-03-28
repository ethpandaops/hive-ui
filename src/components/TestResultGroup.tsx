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
  return (
    <div style={{
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
          alignItems: 'center'
        }}>
          {groupBy === 'test' ? (
            <>
              <span style={{ marginRight: '0.5rem' }}>🧪</span>
              {groupKey}
            </>
          ) : (
            <>
              <span style={{ marginRight: '0.5rem' }}>👥</span>
              {groupKey.replace(/\+/g, ', ')}
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
