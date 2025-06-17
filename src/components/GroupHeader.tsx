import { TestRun } from '../types';
import { format, differenceInDays } from 'date-fns';

interface GroupHeaderProps {
  name: string;
  icon?: string;
  testRuns: TestRun[];
  recentRuns: TestRun[];
  mostRecentRun: TestRun | null;
  isInactive: boolean;
  isMobile: boolean;
  isDarkMode?: boolean;
  titleSize?: 'large' | 'medium';
  showInactiveBadge?: boolean;
}

const GroupHeader: React.FC<GroupHeaderProps> = ({
  name,
  icon,
  testRuns,
  recentRuns,
  mostRecentRun,
  isInactive,
  isMobile,
  isDarkMode = false,
  titleSize = 'medium',
  showInactiveBadge = true
}) => {
  return (
    <>
      {isInactive && showInactiveBadge && (
        <div style={{
          position: 'absolute',
          top: '0',
          right: '0',
          backgroundColor: 'var(--warning-border, #f59e0b)',
          color: 'white',
          padding: '0.15rem 0.5rem',
          fontSize: '0.7rem',
          fontWeight: '500',
          borderBottomLeftRadius: '0.375rem'
        }}>
          INACTIVE
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {icon && (
          <div
            style={{
              marginRight: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDarkMode ? '#334155' : 'var(--badge-bg, #f3f4f6)',
              borderRadius: '0.375rem',
              padding: '0.25rem',
              border: isInactive
                ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
                : isDarkMode
                  ? '1px solid rgba(71, 85, 105, 0.5)'
                  : '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
              overflow: 'hidden',
              width: '28px',
              height: '28px',
              flexShrink: 0
            }}
            dangerouslySetInnerHTML={{ __html: icon }}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {titleSize === 'large' ? (
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: isInactive
                ? 'var(--warning-text, #b45309)'
                : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
              margin: 0
            }}>{name}</h1>
          ) : (
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: isInactive
                ? 'var(--warning-text, #b45309)'
                : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
              margin: 0
            }}>{name}</h2>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '0.5rem' : '1rem',
        flexDirection: isMobile ? 'column' : 'row',
        width: isMobile ? '100%' : 'auto'
      }}>
        {recentRuns.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '0.5rem' : '1rem',
            flexDirection: isMobile ? 'column' : 'row',
            width: isMobile ? '100%' : 'auto'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              height: '1.5rem',
              backgroundColor: isDarkMode ? '#334155' : 'var(--badge-bg, #f3f4f6)',
              borderRadius: '0.375rem',
              padding: '0 0.5rem',
              overflow: 'hidden',
              width: isMobile ? '100%' : '220px',
              flexGrow: 0,
              flexShrink: 0,
              border: isInactive
                ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
                : 'none'
            }}>
              <div
                style={{
                  display: 'flex',
                  height: '1rem',
                  gap: '2px',
                  alignItems: 'center',
                  width: '100%'
                }}
                title="Last 50 test runs"
              >
                {recentRuns.map((run, index) => {
                  let barColor;
                  if (run.fails === 0) {
                    barColor = 'var(--success-border, #10b981)';
                  } else if (run.passes > 0 && run.passes / run.ntests > 0.5) {
                    barColor = 'var(--warning-border, #f59e0b)';
                  } else {
                    barColor = 'var(--error-border, #ef4444)';
                  }

                  return (
                    <div
                      key={`${run.name}-${index}`}
                      style={{
                        width: '4px',
                        height: '8px',
                        backgroundColor: barColor,
                        borderRadius: '1px'
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Success/Warning/Error counts */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: isInactive
                ? 'var(--warning-text, #b45309)'
                : (isDarkMode ? '#94a3b8' : 'var(--text-secondary, #6b7280)'),
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'var(--success-bg, #d1fae5)',
                borderRadius: '0.375rem',
                padding: '0.15rem 0.4rem',
                gap: '0.25rem',
                width: '50px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                     style={{ width: '0.75rem', height: '0.75rem', color: 'var(--success-border, #10b981)' }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.236 4.53L8.53 10.53a.75.75 0 0 0-1.06 1.061l2.03 2.03a.75.75 0 0 0 1.137-.089l3.857-5.401z" clipRule="evenodd" />
                </svg>
                <span style={{ fontWeight: '500' }}>{testRuns.filter(r => r.fails === 0).length}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'var(--warning-bg, #fef3c7)',
                borderRadius: '0.375rem',
                padding: '0.15rem 0.4rem',
                gap: '0.25rem',
                width: '50px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                     style={{ width: '0.75rem', height: '0.75rem', color: 'var(--warning-border, #f59e0b)' }}>
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span style={{ fontWeight: '500' }}>{testRuns.filter(r => r.fails > 0 && r.passes > 0 && r.passes / r.ntests > 0.5).length}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'var(--error-bg, #fee2e2)',
                borderRadius: '0.375rem',
                padding: '0.15rem 0.4rem',
                gap: '0.25rem',
                width: '50px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                     style={{ width: '0.75rem', height: '0.75rem', color: 'var(--error-border, #ef4444)' }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span style={{ fontWeight: '500' }}>{testRuns.filter(r => r.fails > 0 && r.passes / r.ntests <= 0.5).length}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: '0.8rem',
          color: isInactive
            ? 'var(--warning-text, #b45309)'
            : (isDarkMode ? '#94a3b8' : 'var(--text-secondary, #4b5563)'),
          backgroundColor: isInactive
            ? (isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'var(--warning-bg, #fffbeb)')
            : (isDarkMode ? '#334155' : 'var(--badge-bg, #f3f4f6)'),
          borderRadius: '0.375rem',
          padding: '0.25rem 0.5rem',
          width: isMobile ? '100%' : '100px',
          justifyContent: 'center',
          flexShrink: 0,
          flexGrow: 0,
          marginBottom: isMobile ? '0.5rem' : 0,
          border: isInactive
            ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
            : 'none'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
               style={{ width: '0.9rem', height: '0.9rem', marginRight: '0.4rem' }}>
            <path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2a1.5 1.5 0 0 1 1.5 1.5V5h2V3.5A1.5 1.5 0 0 1 14 2h2a1.5 1.5 0 0 1 1.5 1.5v2A1.5 1.5 0 0 1 16 7h-2a1.5 1.5 0 0 1-1.5-1.5V5h-2v1.5A1.5 1.5 0 0 1 9 8H7a1.5 1.5 0 0 1-1.5-1.5V5h-2V3.5Z" />
            <path fillRule="evenodd" d="M4 10a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" clipRule="evenodd" />
            <path d="M5.5 13.5A1.5 1.5 0 0 1 7 12h2a1.5 1.5 0 0 1 1.5 1.5V15h2v-1.5A1.5 1.5 0 0 1 14 12h2a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5V15h-2v1.5A1.5 1.5 0 0 1 9 18H7a1.5 1.5 0 0 1-1.5-1.5v-2Z" />
          </svg>
          <span style={{ fontWeight: '500' }}>{testRuns.length} {testRuns.length === 1 ? 'Result' : 'Results'}</span>
        </div>

        {mostRecentRun && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '0.8rem',
            color: isInactive
              ? 'var(--warning-text, #b45309)'
              : (isDarkMode ? '#94a3b8' : 'var(--text-secondary, #4b5563)'),
            backgroundColor: isInactive
              ? (isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'var(--warning-bg, #fffbeb)')
              : (isDarkMode ? '#334155' : 'var(--badge-bg, #f3f4f6)'),
            borderRadius: '0.375rem',
            padding: '0.25rem 0.5rem',
            width: isMobile ? '100%' : '180px',
            justifyContent: 'center',
            flexShrink: 0,
            flexGrow: 0,
            border: isInactive
              ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
              : 'none'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                 style={{ width: '0.9rem', height: '0.9rem', marginRight: '0.4rem', flexShrink: 0 }}>
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
            </svg>
            <span style={{
              fontWeight: '500',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 'calc(100% - 20px)'
            }}>
              {isInactive
                ? `Last: ${differenceInDays(new Date(), new Date(mostRecentRun.start))} days ago`
                : `Last: ${format(new Date(mostRecentRun.start), 'MMM d, yyyy HH:mm')}`
              }
            </span>
          </div>
        )}
      </div>
    </>
  );
};

export default GroupHeader;
