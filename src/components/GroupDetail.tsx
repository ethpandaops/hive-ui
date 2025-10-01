import { useQuery } from '@tanstack/react-query';
import { fetchDirectories, fetchTestRuns } from '../services/api';
import { Directory, TestRun } from '../types';
import { differenceInDays } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import * as jdenticon from 'jdenticon';
import TestResultGroup from './TestResultGroup';
import TestResultsTable from './TestResultsTable';
import Header from './Header';
import Footer from './Footer';
import { useTheme } from '../contexts/useTheme';
import Breadcrumb from './Breadcrumb';
import GroupHeader from './GroupHeader';
import WorkflowStatus from './WorkflowStatus';

type GroupBy = 'test' | 'client';
type SortBy = 'name' | 'coverage' | 'time';

const GroupDetail = () => {
  const { isDarkMode } = useTheme();
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [dirIcons, setDirIcons] = useState<Record<string, string>>({});

  // Initialize from URL params or defaults
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    const urlGroupBy = searchParams.get('groupBy');
    return (urlGroupBy === 'test' || urlGroupBy === 'client') ? urlGroupBy : 'test';
  });

  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const urlSortBy = searchParams.get('sort');
    return (urlSortBy === 'name' || urlSortBy === 'coverage' || urlSortBy === 'time') ? urlSortBy : 'name';
  });

  const [testNameFilter, setTestNameFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>(() => {
    const urlClients = searchParams.get('clients');
    if (urlClients) {
      return urlClients.split(',').filter(c => c.length > 0);
    }
    // Load from localStorage if no URL param
    const favoriteClients = localStorage.getItem('favoriteClients');
    return favoriteClients ? JSON.parse(favoriteClients) : [];
  });
  const [favoriteClients, setFavoriteClients] = useState<string[]>(() => {
    const stored = localStorage.getItem('favoriteClients');
    return stored ? JSON.parse(stored) : [];
  });
  const [directoryAddresses, setDirectoryAddresses] = useState<Record<string, string>>({});
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const clientFilterRef = useRef<HTMLDetailsElement>(null);

  // Initialize collapsed state from URL
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState<boolean>(() => {
    return searchParams.get('collapsed') === 'true';
  });

  // Function to update URL with current state
  const updateURL = (newSortBy?: SortBy, newGroupBy?: GroupBy, newCollapsed?: boolean, newClients?: string[]) => {
    const params = new URLSearchParams(searchParams);

    if (newSortBy !== undefined) {
      params.set('sort', newSortBy);
    }
    if (newGroupBy !== undefined) {
      params.set('groupBy', newGroupBy);
    }
    if (newCollapsed !== undefined) {
      if (newCollapsed) {
        params.set('collapsed', 'true');
      } else {
        params.delete('collapsed');
      }
    }
    if (newClients !== undefined) {
      if (newClients.length > 0) {
        params.set('clients', newClients.join(','));
      } else {
        params.delete('clients');
      }
    }

    // Remove default values to keep URL clean
    if (params.get('sort') === 'name') {
      params.delete('sort');
    }
    if (params.get('groupBy') === 'test') {
      params.delete('groupBy');
    }

    const newSearch = params.toString();
    const newUrl = newSearch ? `?${newSearch}` : '';

    navigate(`/group/${name}${newUrl}`, { replace: true });
  };

  // Update sort by and URL
  const handleSortByChange = (newSortBy: SortBy) => {
    setSortBy(newSortBy);
    updateURL(newSortBy, groupBy);
  };

  // Update group by and URL
  const handleGroupByChange = (newGroupBy: GroupBy) => {
    setGroupBy(newGroupBy);
    updateURL(sortBy, newGroupBy);
  };

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

  // Update URL with favorites if they were loaded from localStorage
  useEffect(() => {
    const urlClients = searchParams.get('clients');
    if (!urlClients && selectedClients.length > 0) {
      // Favorites were loaded, update URL
      const newGroupBy = 'client'; // Auto-switch to group by client when favorites are loaded
      setGroupBy(newGroupBy);
      updateURL(sortBy, newGroupBy, isSummaryCollapsed, selectedClients);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Close client filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientFilterRef.current && !clientFilterRef.current.contains(event.target as Node)) {
        clientFilterRef.current.removeAttribute('open');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  // Extract all unique clients from test runs
  const getAllClients = (runs: TestRun[]): string[] => {
    const clientSet = new Set<string>();
    runs.forEach(run => {
      run.clients.forEach(client => clientSet.add(client));
    });
    return Array.from(clientSet).sort();
  };

  // Filter test runs by selected clients
  const filterByClients = (runs: TestRun[]): TestRun[] => {
    if (selectedClients.length === 0) return runs;
    return runs.filter(run =>
      run.clients.some(client => selectedClients.includes(client))
    );
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

  // Get all available clients
  const availableClients = getAllClients(testRuns);

  // Toggle client selection
  const toggleClient = (client: string) => {
    setSelectedClients(prev => {
      const newClients = prev.includes(client)
        ? prev.filter(c => c !== client)
        : [...prev, client];

      // Automatically switch to "Group by Client" when filtering by clients
      const newGroupBy = newClients.length > 0 ? 'client' : groupBy;
      if (newGroupBy !== groupBy) {
        setGroupBy(newGroupBy);
      }

      updateURL(sortBy, newGroupBy, isSummaryCollapsed, newClients);
      return newClients;
    });
  };

  // Clear all client filters
  const clearClientFilters = () => {
    setSelectedClients([]);
    updateURL(sortBy, groupBy, isSummaryCollapsed, []);
  };

  // Handle client selection change from table
  const handleClientSelectChange = (clients: string[]) => {
    setSelectedClients(clients);

    // Automatically switch to "Group by Client" when filtering by clients
    const newGroupBy = clients.length > 0 ? 'client' : groupBy;
    if (newGroupBy !== groupBy) {
      setGroupBy(newGroupBy);
    }

    updateURL(sortBy, newGroupBy, isSummaryCollapsed, clients);
  };

  // Save current selection as favorites
  const saveFavorites = () => {
    localStorage.setItem('favoriteClients', JSON.stringify(selectedClients));
    setFavoriteClients(selectedClients);
  };

  // Clear favorites
  const clearFavorites = () => {
    localStorage.removeItem('favoriteClients');
    setFavoriteClients([]);
  };

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
              <GroupHeader
                name={name!}
                icon={dirIcons[name!]}
                testRuns={testRuns}
                recentRuns={recentRuns}
                mostRecentRun={mostRecentRun}
                isInactive={isInactive}
                isMobile={isMobile}
                isDarkMode={isDarkMode}
                titleSize="large"
                showInactiveBadge={true}
              />
            </div>

            {/* Workflow Status Section */}
            <WorkflowStatus
              workflowUrls={directory.github_workflows}
              groupName={name}
            />

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
                marginBottom: isSummaryCollapsed ? '0' : '1rem',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <button
                    onClick={() => {
                      const newCollapsed = !isSummaryCollapsed;
                      setIsSummaryCollapsed(newCollapsed);
                      updateURL(sortBy, groupBy, newCollapsed);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isDarkMode ? '#9ca3af' : '#6b7280',
                      transition: 'transform 0.2s ease',
                      transform: isSummaryCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
                    }}
                    aria-label={isSummaryCollapsed ? 'Expand summary' : 'Collapse summary'}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: isInactive
                      ? 'var(--warning-text, #b45309)'
                      : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
                    margin: 0,
                    display: isMobile ? 'none' : 'block'
                  }}>Latest Test Results</h3>
                </div>

                {!isSummaryCollapsed && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    {/* Client Filter */}
                    <div style={{ position: 'relative' }}>
                      <details
                        ref={clientFilterRef}
                        style={{
                          position: 'relative'
                        }}
                      >
                        <summary
                          style={{
                            listStyle: 'none',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: isInactive
                              ? (isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'var(--warning-bg, rgba(255, 251, 235, 0.8))')
                              : (isDarkMode ? '#334155' : 'var(--badge-bg, #f3f4f6)'),
                            borderRadius: '0.375rem',
                            padding: '0.25rem 0.5rem',
                            border: isInactive
                              ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))'
                              : `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
                            gap: '0.5rem',
                            minWidth: '150px'
                          }}>
                            <span style={{
                              fontSize: '0.75rem',
                              color: isInactive
                                ? 'var(--warning-text, #b45309)'
                                : (isDarkMode ? '#9ca3af' : '#6b7280'),
                              flex: 1
                            }}>
                              Clients: {selectedClients.length === 0 ? 'All' : selectedClients.length === 1 ? selectedClients[0] : selectedClients.length}
                            </span>
                            <span style={{
                              fontSize: '0.75rem',
                              color: isInactive
                                ? 'var(--warning-text, #b45309)'
                                : (isDarkMode ? '#f8fafc' : 'var(--text-primary, #111827)'),
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              ▼
                            </span>
                          </div>
                        </summary>
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.25rem',
                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                            border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
                            borderRadius: '0.375rem',
                            boxShadow: isDarkMode
                              ? '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                              : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            padding: '0.5rem',
                            zIndex: 10,
                            minWidth: '250px',
                            maxHeight: '400px',
                            overflowY: 'auto'
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.5rem',
                              paddingBottom: '0.5rem',
                              borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
                            }}>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: isDarkMode ? '#f8fafc' : '#1e293b',
                              }}>
                                Filter by Clients
                              </span>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {selectedClients.length > 0 && (
                                  <button
                                    onClick={clearClientFilters}
                                    style={{
                                      fontSize: '0.625rem',
                                      color: '#3b82f6',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: '0.125rem 0.25rem',
                                    }}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            </div>
                            {availableClients.map(client => (
                              <label
                                key={client}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  padding: '0.375rem 0.25rem',
                                  cursor: 'pointer',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.75rem',
                                  color: isDarkMode ? '#f8fafc' : '#1e293b',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = isDarkMode ? '#334155' : '#f3f4f6';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedClients.includes(client)}
                                  onChange={() => toggleClient(client)}
                                  style={{
                                    cursor: 'pointer',
                                    width: '14px',
                                    height: '14px',
                                  }}
                                />
                                <span style={{ flex: 1 }}>{client}</span>
                                {favoriteClients.includes(client) && (
                                  <span style={{ fontSize: '0.875rem' }}>⭐</span>
                                )}
                              </label>
                            ))}

                            {selectedClients.length > 0 && (
                              <div style={{
                                marginTop: '0.5rem',
                                paddingTop: '0.5rem',
                                borderTop: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  gap: '0.5rem',
                                  justifyContent: 'space-between'
                                }}>
                                  <button
                                    onClick={saveFavorites}
                                    style={{
                                      flex: 1,
                                      fontSize: '0.7rem',
                                      padding: '0.375rem 0.5rem',
                                      backgroundColor: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '0.25rem',
                                      cursor: 'pointer',
                                      fontWeight: '500',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#2563eb';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = '#3b82f6';
                                    }}
                                  >
                                    ⭐ Save as Favorites
                                  </button>
                                  {favoriteClients.length > 0 && (
                                    <button
                                      onClick={clearFavorites}
                                      style={{
                                        fontSize: '0.7rem',
                                        padding: '0.375rem 0.5rem',
                                        backgroundColor: isDarkMode ? '#374151' : '#e5e7eb',
                                        color: isDarkMode ? '#f8fafc' : '#1e293b',
                                        border: 'none',
                                        borderRadius: '0.25rem',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#d1d5db';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#e5e7eb';
                                      }}
                                    >
                                      Clear Favorites
                                    </button>
                                  )}
                                </div>
                                {favoriteClients.length > 0 && (
                                  <div style={{
                                    fontSize: '0.65rem',
                                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                                    fontStyle: 'italic',
                                    textAlign: 'center',
                                  }}>
                                    Favorites are automatically loaded when switching between pages
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                      </details>
                    </div>

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
                      onClick={() => handleSortByChange('name')}
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
                      onClick={() => handleSortByChange('coverage')}
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
                      onClick={() => handleSortByChange('time')}
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
                      onClick={() => handleGroupByChange('test')}
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
                      onClick={() => handleGroupByChange('client')}
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
                )}
              </div>

              {!isSummaryCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(getGroupedRuns(filterByClients(testRuns), groupBy)).map(([groupKey, groupRuns]) => (
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
              )}
            </div>

            {/* Table Section */}
            <TestResultsTable
              runs={testRuns}
              directory={name}
              directoryAddress={directoryAddresses[name]}
              testNameFilter={testNameFilter}
              clientFilter={clientFilter}
              selectedClients={selectedClients}
              setTestNameFilter={setTestNameFilter}
              setClientFilter={setClientFilter}
              onClientSelectChange={handleClientSelectChange}
            />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default GroupDetail;
