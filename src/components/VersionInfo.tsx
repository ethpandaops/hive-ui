import React from 'react';
import { formatCommitDate, formatCommitHash, getVersionDisplayText } from '../utils/metadata';
import { RunMetadata } from '../types';

interface VersionInfoProps {
  hiveVersion: RunMetadata['hiveVersion'];
  compact?: boolean;
  className?: string;
}

const VersionInfo: React.FC<VersionInfoProps> = ({
  hiveVersion,
  compact = false,
  className = ''
}) => {
  const shortCommit = formatCommitHash(hiveVersion.commit);
  const formattedDate = formatCommitDate(hiveVersion.commitDate);
  const versionText = getVersionDisplayText(hiveVersion);

  if (compact) {
    return (
      <div
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 0.75rem',
          backgroundColor: 'var(--badge-bg, #f3f4f6)',
          border: '1px solid var(--border-color, rgba(229, 231, 235, 0.4))',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        }}
        title={`Hive ${versionText}\nCommit: ${hiveVersion.commit}\nDate: ${formattedDate}`}
      >
        <span style={{ color: 'var(--text-secondary, #6b7280)' }}>🔧</span>
        <span style={{ color: 'var(--text-primary, #111827)', fontWeight: '500' }}>
          {versionText}
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '0.75rem',
        backgroundColor: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, rgba(229, 231, 235, 0.4))',
        borderRadius: '0.375rem'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
        fontSize: '0.875rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary, #6b7280)' }}>Branch:</span>
          <span style={{
            color: 'var(--text-primary, #111827)',
            fontWeight: '500',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
          }}>
            {hiveVersion.branch}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary, #6b7280)' }}>Commit:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              color: 'var(--text-primary, #111827)',
              fontWeight: '500',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            }}>
              {shortCommit}
            </span>
            {hiveVersion.dirty && (
              <span style={{
                padding: '0.125rem 0.375rem',
                backgroundColor: 'var(--warning-bg, #fffbeb)',
                color: 'var(--warning-text, #d97706)',
                border: '1px solid var(--warning-border, #f59e0b)20',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: '500'
              }}>
                dirty
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary, #6b7280)' }}>Date:</span>
          <span style={{
            color: 'var(--text-primary, #111827)',
            fontWeight: '400'
          }}>
            {formattedDate}
          </span>
        </div>
      </div>

      {/* Full commit hash in a collapsible/tooltip area */}
      <details style={{ marginTop: '0.25rem' }}>
        <summary style={{
          cursor: 'pointer',
          fontSize: '0.75rem',
          color: 'var(--text-secondary, #6b7280)',
          padding: '0.25rem 0',
          borderTop: '1px solid var(--border-color, rgba(229, 231, 235, 0.4))',
          marginTop: '0.25rem'
        }}>
          Full commit hash
        </summary>
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          backgroundColor: 'var(--stat-bg, #f9fafb)',
          border: '1px solid var(--border-color, rgba(229, 231, 235, 0.4))',
          borderRadius: '0.25rem',
          fontSize: '0.75rem',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          wordBreak: 'break-all',
          color: 'var(--text-primary, #111827)'
        }}>
          {hiveVersion.commit}
        </div>
      </details>
    </div>
  );
};

export default VersionInfo;
