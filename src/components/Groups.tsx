import { useQuery } from '@tanstack/react-query';
import { fetchDirectories, fetchTestRuns } from '../services/api';
import { Directory, TestRun } from '../types';
import { format, differenceInDays } from 'date-fns';
import { useState, useEffect } from 'react';
import * as jdenticon from 'jdenticon';
import { Link } from 'react-router-dom';

const Groups = () => {
  const [dirIcons, setDirIcons] = useState<Record<string, string>>({});
  const [, setDirectoryAddresses] = useState<Record<string, string>>({});
  const [failedDirectories, setFailedDirectories] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Use effect for responsive design
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkIsMobile();

    // Add resize listener
    window.addEventListener('resize', checkIsMobile);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  const { data: directories, isLoading: isLoadingDirs } = useQuery<Directory[]>({
    queryKey: ['directories'],
    queryFn: fetchDirectories,
  });

  // Store directory addresses
  useEffect(() => {
    if (directories) {
      const addresses: Record<string, string> = {};
      directories.forEach(dir => {
        addresses[dir.name] = dir.address;
      });
      setDirectoryAddresses(addresses);
    }
  }, [directories, setDirectoryAddresses]);

  // Generate SVG icons for each directory
  useEffect(() => {
    if (directories) {
      const icons: Record<string, string> = {};
      directories.forEach(dir => {
        icons[dir.name] = jdenticon.toSvg(dir.name, 32);
      });
      setDirIcons(icons);
    }
  }, [directories]);

  const { data: testRunsByDir, isLoading: isLoadingRuns } = useQuery({
    queryKey: ['testRunsByDir'],
    queryFn: async () => {
      if (!directories || directories.length === 0) return {};

      const failed: string[] = [];

      const results = await Promise.all(
        directories.map(async (dir) => {
          try {
            return await fetchTestRuns(dir);
          } catch (error) {
            console.error(`Failed to fetch test runs for directory ${dir.name}:`, error);
            failed.push(dir.name);
            return [];
          }
        })
      );

      setFailedDirectories(failed);

      return Object.fromEntries(
        directories.map((dir, i) => [dir.name, results[i]])
      );
    },
    enabled: !!directories && directories.length > 0,
  });

  if (isLoadingDirs || isLoadingRuns) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#3b82f6' }}></div>
      </div>
    );
  }

  if (!testRunsByDir || Object.keys(testRunsByDir).length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div style={{ fontSize: '4rem', color: '#9ca3af' }}>📊</div>
          <div style={{ color: '#6b7280', fontSize: '1.125rem' }}>No test results found</div>
        </div>
      </div>
    );
  }

  // Get the most recent test run for a directory
  const getMostRecentRun = (runs: TestRun[]) => {
    if (runs.length === 0) return null;
    return runs.reduce((latest, run) =>
      new Date(run.start) > new Date(latest.start) ? run : latest, runs[0]);
  };

  // Get the most recent N test runs for visualization
  const getRecentRuns = (runs: TestRun[], count: number = 50) => {
    return [...runs]
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
      .slice(0, count);
  };

  return (
    <div className="space-y-8" style={{
      margin: '0.5rem',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-primary)'
    }}>
      {Object.entries(testRunsByDir)
        .filter(([directory]) => !failedDirectories.includes(directory))
        .sort((a, b) => {
          // Sort by inactive status (inactive directories at the end)
          const [, runsA] = a;
          const [, runsB] = b;

          const mostRecentRunA = getMostRecentRun(runsA);
          const mostRecentRunB = getMostRecentRun(runsB);

          const isInactiveA = mostRecentRunA ?
            differenceInDays(new Date(), new Date(mostRecentRunA.start)) > 7 : false;
          const isInactiveB = mostRecentRunB ?
            differenceInDays(new Date(), new Date(mostRecentRunB.start)) > 7 : false;

          // Put inactive directories at the end
          if (isInactiveA && !isInactiveB) return 1;
          if (!isInactiveA && isInactiveB) return -1;

          // If both have same inactive status, maintain original order
          return 0;
        })
        .map(([directory, runs]) => {
          const mostRecentRun = getMostRecentRun(runs);
          const recentRuns = getRecentRuns(runs, 50);

          // Check if directory is inactive (latest run > 7 days ago)
          const isInactive = mostRecentRun ?
            differenceInDays(new Date(), new Date(mostRecentRun.start)) > 7 :
            false;

          return (
            <div key={directory} style={{
              backgroundColor: 'var(--card-bg, #ffffff)',
              color: 'var(--text-primary, #111827)',
              borderRadius: '0.75rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              overflow: 'hidden',
              border: isInactive ?
                '1px dashed var(--warning-border, rgba(245, 158, 11, 0.8))' :
                '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
              opacity: isInactive ? 0.8 : 1,
              maxWidth: '1400px',
              margin: '20px auto'
            }}>
              <Link to={`/group/${directory}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: isMobile ? 'flex-start' : 'space-between',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  gap: isMobile ? '0.75rem' : '0',
                  cursor: 'pointer',
                  userSelect: 'none',
                  backgroundColor: isInactive ? 'var(--warning-bg, #fffbeb)' : 'transparent',
                  position: 'relative',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isInactive) {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(59, 130, 246, 0.05))';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isInactive ? 'var(--warning-bg, #fffbeb)' : 'transparent';
                }}
                >
                  {isInactive && (
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
                    {dirIcons[directory] && (
                      <div
                        style={{
                          marginRight: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'var(--badge-bg, #f3f4f6)',
                          borderRadius: '0.375rem',
                          padding: '0.25rem',
                          border: isInactive
                            ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
                            : '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                          overflow: 'hidden',
                          width: '28px',
                          height: '28px',
                          flexShrink: 0
                        }}
                        dangerouslySetInnerHTML={{ __html: dirIcons[directory] }}
                      />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <h2 style={{
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: isInactive
                          ? 'var(--warning-text, #b45309)'
                          : 'var(--text-primary, #111827)',
                        margin: 0
                      }}>{directory}</h2>
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
                          backgroundColor: 'var(--badge-bg, #f3f4f6)',
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
                            : 'var(--text-secondary, #6b7280)',
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--success-bg, #d1fae5)',
                            borderRadius: '0.375rem',
                            padding: '0.15rem 0.4rem',
                            gap: '0.25rem'
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                                 style={{ width: '0.75rem', height: '0.75rem', color: 'var(--success-border, #10b981)' }}>
                              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.236 4.53L8.53 10.53a.75.75 0 0 0-1.06 1.061l2.03 2.03a.75.75 0 0 0 1.137-.089l3.857-5.401z" clipRule="evenodd" />
                            </svg>
                            <span style={{ fontWeight: '500' }}>{runs.filter(r => r.fails === 0).length}</span>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--warning-bg, #fef3c7)',
                            borderRadius: '0.375rem',
                            padding: '0.15rem 0.4rem',
                            gap: '0.25rem'
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                                 style={{ width: '0.75rem', height: '0.75rem', color: 'var(--warning-border, #f59e0b)' }}>
                              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            <span style={{ fontWeight: '500' }}>{runs.filter(r => r.fails > 0 && r.passes > 0 && r.passes / r.ntests > 0.5).length}</span>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--error-bg, #fee2e2)',
                            borderRadius: '0.375rem',
                            padding: '0.15rem 0.4rem',
                            gap: '0.25rem'
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                                 style={{ width: '0.75rem', height: '0.75rem', color: 'var(--error-border, #ef4444)' }}>
                              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span style={{ fontWeight: '500' }}>{runs.filter(r => r.fails > 0 && r.passes / r.ntests <= 0.5).length}</span>
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
                        : 'var(--text-secondary, #4b5563)',
                      backgroundColor: isInactive
                        ? 'var(--warning-bg, #fffbeb)'
                        : 'var(--badge-bg, #f3f4f6)',
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
                      <span style={{ fontWeight: '500' }}>{runs.length} {runs.length === 1 ? 'Result' : 'Results'}</span>
                    </div>

                    {mostRecentRun && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                        color: isInactive
                          ? 'var(--warning-text, #b45309)'
                          : 'var(--text-secondary, #4b5563)',
                        backgroundColor: isInactive
                          ? 'var(--warning-bg, #fffbeb)'
                          : 'var(--badge-bg, #f3f4f6)',
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
                </div>
              </Link>
            </div>
          );
        })}
    </div>
  );
};

export default Groups;
