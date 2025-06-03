import { useQuery } from '@tanstack/react-query';
import { fetchDirectories, fetchTestRuns } from '../services/api';
import { Directory, TestRun } from '../types';
import { format, isValid, differenceInDays } from 'date-fns';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as jdenticon from 'jdenticon';
import TestResultGroup from './TestResultGroup';
import TestResultsTable from './TestResultsTable';
import Header from './Header';
import Footer from './Footer';
import { useTheme } from '../contexts/useTheme';
import Breadcrumb from './Breadcrumb';

type GroupBy = 'test' | 'client';
type SortBy = 'name' | 'coverage' | 'time';

const GroupDetail = () => {
  const { isDarkMode } = useTheme();
  const { name } = useParams<{ name: string }>();
  const [dirIcons, setDirIcons] = useState<Record<string, string>>({});
  const [groupBy, setGroupBy] = useState<GroupBy>('test');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [testNameFilter, setTestNameFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [directoryAddresses, setDirectoryAddresses] = useState<Record<string, string>>({});
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
  }, [directories]);

  // Generate SVG icons for the directory
  useEffect(() => {
    if (name) {
      const icons: Record<string, string> = {};
      icons[name] = jdenticon.toSvg(name, 32);
      setDirIcons(icons);
    }
  }, [name]);

  // Find the specific directory and fetch its test runs
  const directory = directories?.find(dir => dir.name === name);

  const { data: testRuns = [], isLoading: isLoadingRuns } = useQuery({
    queryKey: ['testRuns', name],
    queryFn: async () => {
      if (!directory) return [];
      try {
        return await fetchTestRuns(directory);
      } catch (error) {
        console.error(`Failed to fetch test runs for directory ${name}:`, error);
        return [];
      }
    },
    enabled: !!directory,
  });

  // Main container style to match TestDetail
  const containerStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
    color: isDarkMode ? '#f8fafc' : '#1e293b',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  };

  if (isLoadingDirs || isLoadingRuns) {
    return (
      <div style={containerStyle}>
        <Header />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', flex: 1 }}>
          <div style={{
            border: `4px solid ${isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            width: '2.5rem',
            height: '2.5rem',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!directory || !name) {
    return (
      <div style={containerStyle}>
        <Header />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', flex: 1 }}>
          <div className="text-center">
            <div style={{ fontSize: '4rem', color: '#9ca3af' }}>❌</div>
            <div style={{ color: '#6b7280', fontSize: '1.125rem', marginBottom: '1rem' }}>Group "{name}" not found</div>
            <Link
              to="/"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontSize: '0.875rem'
              }}
            >
              ← Back to all groups
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (testRuns.length === 0) {
    return (
      <div style={containerStyle}>
        <Header />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', flex: 1 }}>
          <div className="text-center">
            <div style={{ fontSize: '4rem', color: '#9ca3af' }}>📊</div>
            <div style={{ color: '#6b7280', fontSize: '1.125rem', marginBottom: '1rem' }}>No test results found for "{name}"</div>
            <Link
              to="/"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontSize: '0.875rem'
              }}
            >
              ← Back to all groups
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Get the most recent test run for the directory
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

  // Sort test runs based on the selected criteria
  const sortTestRuns = (runs: TestRun[]): TestRun[] => {
    return [...runs].sort((a, b) => {
      if (sortBy === 'name') {
        if (groupBy === 'test') {
          // Sort by client name when grouped by test
          return a.clients.join(',').localeCompare(b.clients.join(','));
        } else {
          // Sort by test name when grouped by client
          return a.name.localeCompare(b.name);
        }
      } else if (sortBy === 'coverage') {
        // Sort by pass ratio (descending)
        const passRatioA = a.passes / a.ntests;
        const passRatioB = b.passes / b.ntests;
        return passRatioB - passRatioA;
      } else if (sortBy === 'time') {
        // Sort by start time (newest first)
        return new Date(b.start).getTime() - new Date(a.start).getTime();
      }
      return 0;
    });
  };

  // Group runs by test or client
  const getGroupedRuns = (runs: TestRun[], groupBy: GroupBy) => {
    if (groupBy === 'test') {
      // Group by test name, showing only the most recent run for each client combination
      const testGroups: Record<string, TestRun[]> = {};

      // First, organize runs by test name
      runs.forEach(run => {
        const testName = run.name;
        if (!testGroups[testName]) {
          testGroups[testName] = [];
        }
        testGroups[testName].push(run);
      });

      // Then filter each test group to keep only the most recent run for each client combination
      const filteredGroups: Record<string, TestRun[]> = {};

      Object.entries(testGroups).forEach(([testName, testRuns]) => {
        const latestByClient: Record<string, TestRun> = {};

        // Find the most recent run for each unique client combination
        testRuns.forEach(run => {
          const clientKey = run.clients.sort().join('+');

          if (!latestByClient[clientKey] ||
              new Date(run.start) > new Date(latestByClient[clientKey].start)) {
            latestByClient[clientKey] = run;
          }
        });

        // Add the filtered and sorted runs to the result
        filteredGroups[testName] = sortTestRuns(Object.values(latestByClient));
      });

      return filteredGroups;
    } else {
      // Group by client combination, showing only the most recent run for each test
      const clientGroups: Record<string, TestRun[]> = {};

      // First, organize runs by client combination
      runs.forEach(run => {
        const clientKey = run.clients.sort().join('+');
        if (!clientGroups[clientKey]) {
          clientGroups[clientKey] = [];
        }
        clientGroups[clientKey].push(run);
      });

      // Then filter each client group to keep only the most recent run for each test
      const filteredGroups: Record<string, TestRun[]> = {};

      Object.entries(clientGroups).forEach(([clientKey, clientRuns]) => {
        const latestByTest: Record<string, TestRun> = {};

        // Find the most recent run for each unique test
        clientRuns.forEach(run => {
          const testName = run.name;

          if (!latestByTest[testName] ||
              new Date(run.start) > new Date(latestByTest[testName].start)) {
            latestByTest[testName] = run;
          }
        });

        // Add the filtered and sorted runs to the result
        filteredGroups[clientKey] = sortTestRuns(Object.values(latestByTest));
      });

      return filteredGroups;
    }
  };

  const mostRecentRun = getMostRecentRun(testRuns);
  const recentRuns = getRecentRuns(testRuns, 50);

  // Check if directory is inactive (latest run > 7 days ago)
  const isInactive = mostRecentRun ?
    differenceInDays(new Date(), new Date(mostRecentRun.start)) > 7 :
    false;

  return (
    <div style={containerStyle}>
      <Header />

      <div style={{ margin: '0 0.5rem', flex: 1 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Breadcrumb navigation */}
          <Breadcrumb
            items={[
              { label: 'Home', link: '/' },
              { label: name }
            ]}
          />

          <div style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
            color: isDarkMode ? '#f8fafc' : '#1e293b',
            borderRadius: '0.75rem',
            boxShadow: isDarkMode ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
            border: isInactive ?
              `1px dashed ${isDarkMode ? 'rgba(245, 158, 11, 0.8)' : 'rgba(245, 158, 11, 0.8)'}` :
              `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
            opacity: isInactive ? 0.8 : 1,
            maxWidth: '1400px',
            margin: '20px auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '0.75rem 1.25rem',
              borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: isMobile ? 'flex-start' : 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: isMobile ? '0.75rem' : '0',
              backgroundColor: isInactive ?
                (isDarkMode ? 'rgba(245, 158, 11, 0.1)' : 'var(--warning-bg, #fffbeb)') :
                'transparent',
              position: 'relative'
            }}>
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
                {dirIcons[name] && (
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
                        : `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
                      overflow: 'hidden',
                      width: '28px',
                      height: '28px',
                      flexShrink: 0
                    }}
                    dangerouslySetInnerHTML={{ __html: dirIcons[name] }}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    color: isInactive
                      ? 'var(--warning-text, #b45309)'
                      : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
                    margin: 0
                  }}>{name}</h1>
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
                        gap: '0.25rem'
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
                        gap: '0.25rem'
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
                        gap: '0.25rem'
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
            </div>

            {/* Summary Section */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
              backgroundColor: isInactive
                ? (isDarkMode ? 'rgba(245, 158, 11, 0.05)' : 'var(--summary-bg, rgba(254, 252, 232, 0.5))')
                : (isDarkMode ? 'rgba(30, 41, 59, 0.3)' : 'var(--summary-bg, rgba(249, 250, 251, 0.5))')
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: isInactive
                    ? 'var(--warning-text, #b45309)'
                    : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
                  margin: 0,
                  display: isMobile ? 'none' : 'block'
                }}>Latest Test Results</h3>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {/* Sort By Selector */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: isInactive
                      ? (isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'var(--warning-bg, rgba(255, 251, 235, 0.8))')
                      : (isDarkMode ? '#334155' : 'var(--badge-bg, #f3f4f6)'),
                    borderRadius: '0.375rem',
                    padding: '0.25rem',
                    border: isInactive
                      ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
                      : `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
                  }}>
                    <button
                      onClick={() => setSortBy('name')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: sortBy === 'name' ? '600' : '400',
                        backgroundColor: sortBy === 'name'
                          ? isInactive
                              ? 'var(--warning-bg-light, rgba(255, 251, 235, 1))'
                              : (isDarkMode ? '#475569' : 'var(--card-bg, white)')
                          : 'transparent',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        color: isInactive
                          ? 'var(--warning-text, #b45309)'
                          : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
                        boxShadow: sortBy === 'name'
                          ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                          : 'none',
                      }}
                    >
                      Sort by Name
                    </button>
                    <button
                      onClick={() => setSortBy('coverage')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: sortBy === 'coverage' ? '600' : '400',
                        backgroundColor: sortBy === 'coverage'
                          ? isInactive
                              ? 'var(--warning-bg-light, rgba(255, 251, 235, 1))'
                              : (isDarkMode ? '#475569' : 'var(--card-bg, white)')
                          : 'transparent',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        color: isInactive
                          ? 'var(--warning-text, #b45309)'
                          : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
                        boxShadow: sortBy === 'coverage'
                          ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                          : 'none',
                      }}
                    >
                      Sort by Coverage
                    </button>
                    <button
                      onClick={() => setSortBy('time')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: sortBy === 'time' ? '600' : '400',
                        backgroundColor: sortBy === 'time'
                          ? isInactive
                              ? 'var(--warning-bg-light, rgba(255, 251, 235, 1))'
                              : (isDarkMode ? '#475569' : 'var(--card-bg, white)')
                          : 'transparent',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        color: isInactive
                          ? 'var(--warning-text, #b45309)'
                          : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
                        boxShadow: sortBy === 'time'
                          ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                          : 'none',
                      }}
                    >
                      Sort by Time
                    </button>
                  </div>

                  {/* Group By Selector */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: isInactive
                      ? (isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'var(--warning-bg, rgba(255, 251, 235, 0.8))')
                      : (isDarkMode ? '#334155' : 'var(--badge-bg, #f3f4f6)'),
                    borderRadius: '0.375rem',
                    padding: '0.25rem',
                    border: isInactive
                      ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
                      : `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
                  }}>
                    <button
                      onClick={() => setGroupBy('test')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: groupBy === 'test' ? '600' : '400',
                        backgroundColor: groupBy === 'test'
                          ? isInactive
                              ? 'var(--warning-bg-light, rgba(255, 251, 235, 1))'
                              : (isDarkMode ? '#475569' : 'var(--card-bg, white)')
                          : 'transparent',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        color: isInactive
                          ? 'var(--warning-text, #b45309)'
                          : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
                        marginRight: '0.25rem',
                        boxShadow: groupBy === 'test'
                          ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                          : 'none',
                      }}
                    >
                      Group by Test
                    </button>
                    <button
                      onClick={() => setGroupBy('client')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: groupBy === 'client' ? '600' : '400',
                        backgroundColor: groupBy === 'client'
                          ? isInactive
                              ? 'var(--warning-bg-light, rgba(255, 251, 235, 1))'
                              : (isDarkMode ? '#475569' : 'var(--card-bg, white)')
                          : 'transparent',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        color: isInactive
                          ? 'var(--warning-text, #b45309)'
                          : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
                        boxShadow: groupBy === 'client'
                          ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                          : 'none',
                      }}
                    >
                      Group by Client
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(getGroupedRuns(testRuns, groupBy)).map(([groupKey, groupRuns]) => (
                  <TestResultGroup
                    key={groupKey}
                    groupKey={groupKey}
                    groupRuns={groupRuns}
                    groupBy={groupBy}
                    directory={name}
                    directoryAddress={directoryAddresses[name]}
                  />
                ))}
              </div>
            </div>

            {/* Table Section */}
            <TestResultsTable
              runs={testRuns}
              directory={name}
              directoryAddress={directoryAddresses[name]}
              testNameFilter={testNameFilter}
              clientFilter={clientFilter}
              setTestNameFilter={setTestNameFilter}
              setClientFilter={setClientFilter}
            />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default GroupDetail;
