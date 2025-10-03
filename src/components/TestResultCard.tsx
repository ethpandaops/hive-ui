import { format, isValid } from 'date-fns';
import { TestRun } from '../types';
import { getStatusStyles } from '../utils/statusHelpers';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTestRuns } from '../services/api';
import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';

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
  const [openPopover, setOpenPopover] = useState<number | null>(null);

  // Remove .json extension for the URL
  const suiteid = run.fileName.replace(/\.json$/, '');

  // Fetch all test runs for the current directory
  const { data: allTestRuns } = useQuery({
    queryKey: ['testRuns', directoryAddress],
    queryFn: () => fetchTestRuns({ name: directory, address: directoryAddress }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get past 10 runs for this test/client combination
  const pastRuns = getPastRuns(allTestRuns || [], run, 13);

  return (
    <Link
      to={`/test/${directory}/${suiteid}`}
      style={{
        backgroundColor: statusStyles.bg,
        borderRadius: '0.375rem',
        overflow: 'hidden',
        border: '1px solid var(--border-color, rgba(229, 231, 235, 0.6))',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.border = '1px solid var(--border-color, rgba(229, 231, 235, 0.8))';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.border = '1px solid var(--border-color, rgba(229, 231, 235, 0.6))';
        // Close popover when mouse leaves the card
        setOpenPopover(null);
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
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            flexWrap: 'wrap'
          }}>
            {groupBy === 'test' ? (
              // When grouped by test, show clients with logos
              run.clients.map((client, idx) => {
                const clientName = client.split('_')[0].toLowerCase();
                const logoPath = `/img/clients/${clientName}.jpg`;
                return (
                  <div
                    key={client}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
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
                    <span>{client}</span>
                    {idx < run.clients.length - 1 && <span>,</span>}
                  </div>
                );
              })
            ) : (
              // When grouped by client, show test name
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {run.name}
              </span>
            )}
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

        {/* Past runs visualization */}
        {pastRuns.length > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            margin: '0.25rem 0',
            height: '20px',
            backgroundColor: 'var(--badge-bg, #f3f4f6)',
            borderRadius: '0.25rem',
            padding: '0.35rem 0.5rem',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {pastRuns.map((pastRun, index) => {
              const isCurrentRun = index === 0;
              const prevRun = index < pastRuns.length - 1 ? pastRuns[index + 1] : null;
              const passRatio = pastRun.passes / pastRun.ntests;
              const prevPassRatio = prevRun ? prevRun.passes / prevRun.ntests : -1;

              // Determine trend arrow
              let trendIndicator = '';
              let trendColor = 'transparent';

              if (prevRun && !isCurrentRun) {
                // Only show arrows when there's a meaningful change (>1% difference)
                const percentDiff = Math.abs(passRatio - prevPassRatio) * 100;

                if (percentDiff >= 1) {
                  if (passRatio > prevPassRatio) {
                    trendIndicator = '↑';
                    trendColor = 'var(--success-text, #047857)';
                  } else if (passRatio < prevPassRatio) {
                    trendIndicator = '↓';
                    trendColor = 'var(--error-text, #b91c1c)';
                  }
                  // No arrow shown if exactly equal or minimal difference
                }
              }

              let barColor;
              let barGradient;
              if (pastRun.fails === 0) {
                barColor = 'var(--success-border, #10b981)';
                barGradient = 'linear-gradient(180deg, #34d399 0%, #10b981 100%)';
              } else if (passRatio > 0.5) {
                barColor = 'var(--warning-border, #f59e0b)';
                barGradient = 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)';
              } else {
                barColor = 'var(--error-border, #ef4444)';
                barGradient = 'linear-gradient(180deg, #f87171 0%, #ef4444 100%)';
              }

              return (
                <Popover.Root key={`${pastRun.fileName}-${index}`} open={openPopover === index} onOpenChange={(open) => setOpenPopover(open ? index : null)}>
                  <Popover.Trigger asChild>
                    <div
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        height: '100%',
                        width: '14px',
                        opacity: isCurrentRun ? 1 : 0.65,
                        backgroundColor: 'rgba(229, 231, 235, 0.3)',
                        borderRadius: '3px',
                        boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.05)',
                        overflow: 'hidden',
                        padding: 0,
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        // This prevents the click from navigating
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        setOpenPopover(index);
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        // Only clear if this is the current open popover
                        if (openPopover === index) {
                          setOpenPopover(null);
                        }
                      }}
                    >
                      {trendIndicator && (
                        <div style={{
                          position: 'absolute',
                          top: '-3px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          color: trendColor,
                          lineHeight: 1,
                          textShadow: '0 0 1px var(--card-bg, white)',
                          zIndex: 2
                        }}>
                          {trendIndicator}
                        </div>
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          width: '100%',
                          height: `${Math.max(passRatio * 100, 5)}%`,
                          background: barGradient,
                          borderTopLeftRadius: '2px',
                          borderTopRightRadius: '2px',
                          boxShadow: `0 -1px 2px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                          border: `1px solid ${barColor}`,
                          borderBottom: 'none'
                        }}
                      />
                      {/* Small highlight at top of bar for 3D effect */}
                      {passRatio > 0.1 && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: `calc(${Math.max(passRatio * 100, 5)}% - 2px)`,
                            width: '80%',
                            height: '1px',
                            backgroundColor: 'rgba(255, 255, 255, 0.5)',
                            borderRadius: '1px'
                          }}
                        />
                      )}
                    </div>
                  </Popover.Trigger>

                  <Popover.Portal>
                    <Popover.Content
                      side="top"
                      align={index === 0 ? "start" : index === pastRuns.length - 1 ? "end" : "center"}
                      sideOffset={5}
                      alignOffset={index === 0 ? 5 : index === pastRuns.length - 1 ? -5 : 0}
                      style={{
                        backgroundColor: 'var(--card-bg, #ffffff)',
                        border: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        boxShadow: '0 6px 16px -2px rgba(0, 0, 0, 0.15), 0 4px 8px -2px rgba(0, 0, 0, 0.1)',
                        zIndex: 100,
                        minWidth: '200px',
                        fontSize: '0.75rem',
                        color: 'var(--text-primary, #111827)',
                        maxWidth: '250px'
                      }}
                      onInteractOutside={(e: Event) => {
                        // Prevent closing when clicking on the card elements
                        if (e.target instanceof Element) {
                          const card = e.target.closest('a');
                          if (card && card.tagName === 'A') {
                            e.preventDefault();
                          }
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        // Keep this popover open while hovering over content
                        setOpenPopover(index);
                      }}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                        {format(new Date(pastRun.start), 'MMM d, yyyy HH:mm:ss')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--success-text, #047857)' }}>Passed:</span>
                          <span style={{ fontWeight: '500' }}>{pastRun.passes}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--error-text, #b91c1c)' }}>Failed:</span>
                          <span style={{ fontWeight: '500' }}>{pastRun.fails}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color, rgba(229, 231, 235, 0.4))', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                          <span>Success rate:</span>
                          <span style={{ fontWeight: '600' }}>
                            {((pastRun.passes / pastRun.ntests) * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <Popover.Arrow
                        style={{
                          fill: 'var(--card-bg, #ffffff)',
                          filter: 'drop-shadow(0 -1px 1px rgba(0, 0, 0, 0.05))',
                          stroke: 'var(--border-color, rgba(229, 231, 235, 0.8))',
                          strokeWidth: '1px'
                        }}
                      />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              );
            })}
          </div>
        )}

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
    </Link>
  );
}

// Helper function to format date
const formatDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return isValid(date) ? format(date, 'MMM d, yyyy HH:mm:ss') : 'Invalid date';
};

// Helper function to get past runs for a specific test/client combination
const getPastRuns = (runs: TestRun[], currentRun: TestRun, count: number): TestRun[] => {
  if (!runs || runs.length === 0) return [currentRun];

  // Get the current test identity
  const testName = currentRun.name.split('+')[0]; // Get base test name
  const clientKey = currentRun.clients.sort().join(',');

  // Filter runs for the same test and client combination
  const filteredRuns = runs.filter(run => {
    const runTestName = run.name.split('+')[0];
    const runClientKey = run.clients.sort().join(',');
    return runTestName === testName && runClientKey === clientKey;
  });

  // Sort by date (newest first)
  const sortedRuns = filteredRuns.sort((a, b) =>
    new Date(b.start).getTime() - new Date(a.start).getTime()
  );

  // Return at most 'count' entries
  return sortedRuns.slice(0, count);
};

export default TestResultCard;
