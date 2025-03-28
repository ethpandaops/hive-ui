import { useQuery } from '@tanstack/react-query';
import { fetchDirectories, fetchTestRuns } from '../services/api';
import { Directory, TestRun } from '../types';
import { format, isValid, differenceInDays } from 'date-fns';
import { useState, useEffect } from 'react';
import * as jdenticon from 'jdenticon';
import TestResultGroup from './TestResultGroup';
import TestResultsTable from './TestResultsTable';
import { useSearchParams } from 'react-router-dom';

type GroupBy = 'test' | 'client';

interface TestResultsProps {
  showTables: boolean;
}

const TestResults = ({ showTables }: TestResultsProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(searchParams.get('group'));
  const [dirIcons, setDirIcons] = useState<Record<string, string>>({});
  const [groupBy, setGroupBy] = useState<GroupBy>('test');
  const [testNameFilter, setTestNameFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [directoryAddresses, setDirectoryAddresses] = useState<Record<string, string>>({});

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
      const results = await Promise.all(
        directories?.map(dir => fetchTestRuns(dir)) || []
      );
      return Object.fromEntries(
        directories?.map((dir, i) => [dir.name, results[i]]) || []
      );
    },
    enabled: !!directories,
  });

  // Check if the expanded group from URL exists in the data
  useEffect(() => {
    if (testRunsByDir && expandedGroup) {
      if (!testRunsByDir[expandedGroup]) {
        // If the group from URL doesn't exist, clear it
        setExpandedGroup(null);
        setSearchParams({});
      }
    }
  }, [testRunsByDir, expandedGroup, setSearchParams]);

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

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return isValid(date) ? format(date, 'MMM d, yyyy HH:mm:ss') : 'Invalid date';
  };

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

  const toggleDirectory = (directory: string) => {
    if (expandedGroup === directory) {
      // If clicked on already expanded group, collapse it
      setExpandedGroup(null);
      setSearchParams({});
    } else {
      // Otherwise expand the clicked group and collapse others
      setExpandedGroup(directory);
      setSearchParams({ group: directory });
    }
  };

  // Get the latest runs by test name or by client depending on grouping preference
  const getGroupedRuns = (runs: TestRun[], groupBy: GroupBy) => {
    if (groupBy === 'test') {
      // Group by test name, showing only the most recent run for each client combination
      const testGroups: Record<string, TestRun[]> = {};

      // First, organize runs by test name
      runs.forEach(run => {
        const testName = run.name.split('/').slice(1).join('/');
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

        // Add the filtered runs to the result
        filteredGroups[testName] = Object.values(latestByClient);
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
          const testName = run.name.split('/').slice(1).join('/');

          if (!latestByTest[testName] ||
              new Date(run.start) > new Date(latestByTest[testName].start)) {
            latestByTest[testName] = run;
          }
        });

        // Add the filtered runs to the result
        filteredGroups[clientKey] = Object.values(latestByTest);
      });

      return filteredGroups;
    }
  };

  return (
    <div className="space-y-8" style={{
      margin: '1.5rem',
      minHeight: 'calc(100vh - 100px)',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-primary)'
    }}>
      {Object.entries(testRunsByDir).sort((a, b) => {
        // Sort by inactive status (inactive directories at the end)
        const [dirA, runsA] = a;
        const [dirB, runsB] = b;

        const mostRecentRunA = getMostRecentRun(runsA);
        const mostRecentRunB = getMostRecentRun(runsB);

        const isInactiveA = mostRecentRunA ?
          differenceInDays(new Date(), new Date(mostRecentRunA.start)) > 7 : false;
        const isInactiveB = mostRecentRunB ?
          differenceInDays(new Date(), new Date(mostRecentRunB.start)) > 7 : false;

        // Put inactive directories at the end
        if (isInactiveA && !isInactiveB) return 1;
        if (!isInactiveA && isInactiveB) return -1;

        // If both have same inactive status, sort alphabetically
        return dirA.localeCompare(dirB);
      }).map(([directory, runs]) => {
        const mostRecentRun = getMostRecentRun(runs);
        const isCollapsed = directory !== expandedGroup;
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
            <div
              onClick={() => toggleDirectory(directory)}
              style={{
                padding: '0.75rem 1.25rem',
                borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: isInactive ? 'var(--warning-bg, #fffbeb)' : 'transparent',
                position: 'relative'
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
                <div style={{
                  marginRight: '0.75rem',
                  transition: 'transform 0.2s ease',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                       style={{
                         width: '1.25rem',
                         height: '1.25rem',
                         color: isInactive
                           ? 'var(--warning-text, #b45309)'
                           : 'var(--text-secondary, #6b7280)'
                       }}>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
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
                      height: '28px'
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {recentRuns.length > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: '1.5rem',
                      backgroundColor: 'var(--badge-bg, #f3f4f6)',
                      borderRadius: '0.375rem',
                      padding: '0 0.5rem',
                      overflow: 'hidden',
                      width: '220px',
                      flexShrink: 0
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
                              title={`${run.name}: ${
                                run.fails === 0
                                  ? 'Success'
                                  : (run.passes / run.ntests > 0.5 ? 'Partial Success' : 'Failed')
                              } (${formatDate(run.start)})`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Latest Test Stats */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      color: isInactive
                        ? 'var(--warning-text, #b45309)'
                        : 'var(--text-secondary, #4b5563)',
                      backgroundColor: isInactive
                        ? 'var(--warning-bg, #fffbeb)'
                        : 'var(--badge-bg, #f3f4f6)',
                      borderRadius: '0.375rem',
                      padding: '0.25rem 0.5rem',
                      width: '110px',
                      justifyContent: 'center',
                      flexShrink: 0,
                      border: isInactive
                        ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
                        : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                             style={{ width: '0.9rem', height: '0.9rem', color: 'var(--success-border, #10b981)' }}>
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span style={{ fontWeight: '500' }}>{runs.filter(r => r.fails === 0).length}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                             style={{ width: '0.9rem', height: '0.9rem', color: 'var(--warning-border, #f59e0b)' }}>
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span style={{ fontWeight: '500' }}>{runs.filter(r => r.fails > 0 && r.passes / r.ntests > 0.5).length}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                             style={{ width: '0.9rem', height: '0.9rem', color: 'var(--error-border, #ef4444)' }}>
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
                  width: '100px',
                  justifyContent: 'center',
                  flexShrink: 0,
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
                    width: '180px',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: isInactive
                      ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
                      : 'none'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                         style={{ width: '0.9rem', height: '0.9rem', marginRight: '0.4rem' }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                    </svg>
                    <span style={{ fontWeight: '500' }}>
                      {isInactive
                        ? `Last: ${differenceInDays(new Date(), new Date(mostRecentRun.start))} days ago`
                        : `Last: ${format(new Date(mostRecentRun.start), 'MMM d, yyyy HH:mm')}`
                      }
                    </span>
                  </div>
                )}


              </div>
            </div>

            {!isCollapsed && (
              <>
                {/* Summary Section */}
                <div style={{
                  padding: '1rem 1.5rem',
                  borderBottom: showTables ? '1px solid var(--border-color, rgba(229, 231, 235, 0.8))' : 'none',
                  backgroundColor: isInactive
                    ? 'var(--summary-bg, rgba(254, 252, 232, 0.5))'
                    : 'var(--summary-bg, rgba(249, 250, 251, 0.5))'
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
                        : 'var(--text-primary, #111827)',
                      margin: 0
                    }}>Latest Test Results</h3>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: isInactive
                        ? 'var(--warning-bg, rgba(255, 251, 235, 0.8))'
                        : 'var(--badge-bg, #f3f4f6)',
                      borderRadius: '0.375rem',
                      padding: '0.25rem',
                      border: isInactive
                        ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
                        : '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
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
                                : 'var(--card-bg, white)'
                            : 'transparent',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          color: isInactive
                            ? 'var(--warning-text, #b45309)'
                            : 'var(--text-primary, #111827)',
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
                                : 'var(--card-bg, white)'
                            : 'transparent',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          color: isInactive
                            ? 'var(--warning-text, #b45309)'
                            : 'var(--text-primary, #111827)',
                          boxShadow: groupBy === 'client'
                            ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                            : 'none',
                        }}
                      >
                        Group by Client
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Object.entries(getGroupedRuns(runs, groupBy)).map(([groupKey, groupRuns]) => (
                      <TestResultGroup
                        key={groupKey}
                        groupKey={groupKey}
                        groupRuns={groupRuns}
                        groupBy={groupBy}
                        directory={directory}
                        directoryAddress={directoryAddresses[directory]}
                      />
                    ))}
                  </div>
                </div>

                {/* Table Section */}
                {showTables && (
                  <TestResultsTable
                    runs={runs}
                    directory={directory}
                    directoryAddress={directoryAddresses[directory]}
                    testNameFilter={testNameFilter}
                    clientFilter={clientFilter}
                    setTestNameFilter={setTestNameFilter}
                    setClientFilter={setClientFilter}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TestResults;
