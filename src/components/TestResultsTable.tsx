import { TestRun } from '../types';
import { format } from 'date-fns';
import { getStatusStyles } from '../utils/statusHelpers';
import { Link } from 'react-router-dom';
import { useState } from 'react';

type SortField = 'date' | 'name' | 'total' | 'pass' | 'fail' | 'status' | null;
type SortDirection = 'asc' | 'desc';

interface TestResultsTableProps {
  runs: TestRun[];
  directory: string;
  directoryAddress: string;
  testNameFilter?: string;
  clientFilter?: string;
  selectedClients?: string[];
  setTestNameFilter?: (value: string) => void;
  setClientFilter?: (value: string) => void;
  onClientSelectChange?: (clients: string[]) => void;
}

const TestResultsTable = ({
  runs,
  directory,
  testNameFilter = '',
  clientFilter = '',
  selectedClients = [],
  onClientSelectChange
}: TestResultsTableProps) => {
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [testNameSelectFilter, setTestNameSelectFilter] = useState<string>('all');

  // Get all unique test names
  const uniqueTestNames = Array.from(new Set(runs.map(run => run.name))).sort();

  // Get all unique clients
  const uniqueClients = Array.from(new Set(runs.flatMap(run => run.clients))).sort();

  // Apply filters to the test runs
  const filteredRuns = runs.filter(run => {
    const testName = run.name;
    const matchesTestName = testNameFilter === '' ||
      testName.toLowerCase().includes(testNameFilter.toLowerCase());

    // Apply test name select filter
    const matchesTestNameSelect = testNameSelectFilter === 'all' || run.name === testNameSelectFilter;

    const clients = run.clients.join(', ');
    const matchesClient = clientFilter === '' ||
      clients.toLowerCase().includes(clientFilter.toLowerCase());

    // Apply selectedClients filter (from the dropdown)
    const matchesSelectedClients = selectedClients.length === 0 ||
      run.clients.some(client => selectedClients.includes(client));

    // Apply status filter (matching statusHelpers.ts logic)
    let matchesStatus = true;
    if (statusFilter === 'success') {
      matchesStatus = run.fails === 0;
    } else if (statusFilter === 'timeout') {
      matchesStatus = run.timeout;
    } else if (statusFilter === 'failed') {
      matchesStatus = run.passes > 0 && run.passes / run.ntests > 0.5 && run.fails > 0;
    } else if (statusFilter === 'error') {
      matchesStatus = !run.timeout && (run.passes === 0 || run.passes / run.ntests <= 0.5) && run.fails > 0;
    }

    return matchesTestName && matchesTestNameSelect && matchesClient && matchesSelectedClients && matchesStatus;
  });

  // Sort runs by start time (newest first) for each test/client combination
  const sortedRuns = [...runs].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  // Helper function to find the previous run for a current run
  const findPreviousRun = (currentRun: TestRun): TestRun | null => {
    // Get the current test identity
    const testName = currentRun.name;
    const clientKey = currentRun.clients.sort().join(',');
    const currentRunTime = new Date(currentRun.start).getTime();

    // Find the previous run with the same test name and client combination
    const previousRun = sortedRuns.find(run => {
      const runTestName = run.name;
      const runClientKey = run.clients.sort().join(',');
      const runTime = new Date(run.start).getTime();

      return runTestName === testName &&
             runClientKey === clientKey &&
             runTime < currentRunTime;
    });

    return previousRun || null;
  };

  // Calculate pass difference with previous run
  const getPassDiff = (currentRun: TestRun): { value: number, percentage: number } | null => {
    const previousRun = findPreviousRun(currentRun);
    if (!previousRun) return null;

    const diff = currentRun.passes - previousRun.passes;

    // Calculate percentage difference in success rate
    const currentPassRate = currentRun.ntests > 0 ? (currentRun.passes / currentRun.ntests) * 100 : 0;
    const previousPassRate = previousRun.ntests > 0 ? (previousRun.passes / previousRun.ntests) * 100 : 0;
    const percentage = currentPassRate - previousPassRate;

    return { value: diff, percentage };
  };

  // Helper function to format date
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'MMM d, yyyy HH:mm:ss');
  };

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default direction
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc'); // Default asc for name, desc for others
    }
  };

  // Apply sorting to filtered runs
  const sortData = (data: TestRun[]): TestRun[] => {
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          comparison = new Date(a.start).getTime() - new Date(b.start).getTime();
          break;
        case 'name':
          {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            comparison = nameA.localeCompare(nameB);
          }
          break;
        case 'total':
          comparison = a.ntests - b.ntests;
          break;
        case 'pass':
          comparison = a.passes - b.passes;
          break;
        case 'fail':
          comparison = a.fails - b.fails;
          break;
        case 'status':
          // Sort by pass percentage
          {
            const passRateA = a.ntests > 0 ? a.passes / a.ntests : 0;
            const passRateB = b.ntests > 0 ? b.passes / b.ntests : 0;
            comparison = passRateA - passRateB;
          }
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Get sorted data
  const sortedData = sortData(filteredRuns);

  // Render sort indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;

    return (
      <span style={{ marginLeft: '0.25rem', fontSize: '0.7rem' }}>
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Check if any filters are active
  const hasActiveFilters = testNameSelectFilter !== 'all' ||
                          selectedClients.length > 0 ||
                          statusFilter !== 'all';

  // Clear all filters
  const clearAllFilters = () => {
    setTestNameSelectFilter('all');
    setStatusFilter('all');
    if (onClientSelectChange) {
      onClientSelectChange([]);
    }
  };

  return (
    <div style={{ overflow: 'auto' }}>
      {hasActiveFilters && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--summary-bg, rgba(249, 250, 251, 0.5))',
          borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary, #6b7280)'
          }}>
            Filters active: {[
              testNameSelectFilter !== 'all' && 'Test Name',
              selectedClients.length > 0 && `${selectedClients.length} Client${selectedClients.length > 1 ? 's' : ''}`,
              statusFilter !== 'all' && 'Status'
            ].filter(Boolean).join(', ')}
          </span>
          <button
            onClick={clearAllFilters}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: '500',
              color: '#3b82f6',
              backgroundColor: 'transparent',
              border: '1px solid #3b82f6',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#3b82f6';
            }}
          >
            Clear All Filters
          </button>
        </div>
      )}
      <table style={{
        minWidth: '100%',
        borderCollapse: 'separate',
        borderSpacing: 0
      }}>
        <thead style={{ backgroundColor: 'var(--table-header-bg, #f9fafb)' }}>
          <tr>
            <th
              onClick={() => handleSort('date')}
              style={{
                padding: '0.75rem 1rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                cursor: 'pointer',
                verticalAlign: 'top'
              }}
            >
              Date {renderSortIndicator('date')}
            </th>
            <th
              style={{
                padding: '0.75rem 1rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                verticalAlign: 'top'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span
                  onClick={() => handleSort('name')}
                  style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Test Name {renderSortIndicator('name')}
                </span>
                <select
                  value={testNameSelectFilter}
                  onChange={(e) => setTestNameSelectFilter(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.7rem',
                    borderRadius: '0.25rem',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  <option value="all">All Tests</option>
                  {uniqueTestNames.map(testName => (
                    <option key={testName} value={testName}>
                      {testName}
                    </option>
                  ))}
                </select>
              </div>
            </th>
            <th style={{
              padding: '0.75rem 1rem',
              textAlign: 'left',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'var(--text-secondary, #6b7280)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
              width: '25%',
              verticalAlign: 'top'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{ whiteSpace: 'nowrap' }}>Clients</span>
                <select
                  value={selectedClients.length === 1 ? selectedClients[0] : selectedClients.length === 0 ? 'all' : 'multiple'}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (onClientSelectChange) {
                      onClientSelectChange(value === 'all' ? [] : [value]);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.7rem',
                    borderRadius: '0.25rem',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  <option value="all">All Clients</option>
                  {selectedClients.length > 1 && (
                    <option value="multiple">Multiple Selected ({selectedClients.length})</option>
                  )}
                  {uniqueClients.map(client => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </select>
              </div>
            </th>
            <th
              onClick={() => handleSort('total')}
              style={{
                padding: '0.5rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                width: '50px',
                cursor: 'pointer',
                verticalAlign: 'top'
              }}
            >
              Total {renderSortIndicator('total')}
            </th>
            <th
              onClick={() => handleSort('pass')}
              style={{
                padding: '0.5rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                width: '50px',
                cursor: 'pointer',
                verticalAlign: 'top'
              }}
            >
              Pass {renderSortIndicator('pass')}
            </th>
            <th
              onClick={() => handleSort('fail')}
              style={{
                padding: '0.5rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                width: '50px',
                cursor: 'pointer',
                verticalAlign: 'top'
              }}
            >
              Fail {renderSortIndicator('fail')}
            </th>
            <th style={{
              padding: '0.5rem',
              textAlign: 'right',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'var(--text-secondary, #6b7280)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
              width: '50px',
              verticalAlign: 'top'
            }}>
              Diff
            </th>
            <th
              style={{
                padding: '0.5rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                width: '100px',
                verticalAlign: 'top'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                <span
                  onClick={() => handleSort('status')}
                  style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Status {renderSortIndicator('status')}
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.7rem',
                    borderRadius: '0.25rem',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="timeout">Timeout</option>
                  <option value="failed">Failed</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((run, runIndex) => {
            const statusStyles = getStatusStyles(run);
            const fileName = run.fileName;
            const diff = getPassDiff(run);

            const testUrl = `/test/${directory}/${fileName.replace(/\.json$/, '')}`;

            return (
              <tr
                key={`${run.name}-${runIndex}`}
                style={{
                  backgroundColor: 'var(--card-bg, white)',
                  transition: 'background-color 0.15s ease-in-out'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--row-hover-bg, rgba(249, 250, 251, 0.5))';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--card-bg, white)';
                }}
              >
                <td style={{
                  padding: '0',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))'
                }}>
                  <Link
                    to={testUrl}
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary, #6b7280)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {formatDate(run.start)}
                  </Link>
                </td>
                <td style={{
                  padding: '0',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))'
                }}>
                  <Link
                    to={testUrl}
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: 'var(--text-primary, #111827)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {run.name}
                  </Link>
                </td>
                <td style={{
                  padding: '0',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  maxWidth: '30%'
                }}>
                  <Link
                    to={testUrl}
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      textDecoration: 'none',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      {run.versions && Object.entries(run.versions).map(([client, version]) => (
                        <div key={client} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          fontSize: '0.75rem'
                        }}>
                          <div style={{
                            fontWeight: '500',
                            color: 'var(--text-primary, #111827)'
                          }}>
                            {client}
                          </div>
                          <div style={{
                            color: 'var(--text-secondary, #6b7280)',
                            fontSize: '0.7rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '80ch'
                          }}
                          title={version}>
                            {version.length > 80 ? version.substring(0, 80) + '...' : version}
                          </div>
                        </div>
                      ))}

                      {!run.versions && run.clients && run.clients.map((client) => (
                        <div key={client} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          fontSize: '0.75rem'
                        }}>
                          <div style={{
                            fontWeight: '500',
                            color: 'var(--text-primary, #111827)'
                          }}>
                            {client}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Link>
                </td>
                <td style={{
                  padding: '0',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right'
                }}>
                  <Link
                    to={testUrl}
                    style={{
                      display: 'block',
                      padding: '0.5rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-primary, #111827)',
                      textDecoration: 'none'
                    }}
                  >
                    {run.ntests}
                  </Link>
                </td>
                <td style={{
                  padding: '0',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right'
                }}>
                  <Link
                    to={testUrl}
                    style={{
                      display: 'block',
                      padding: '0.5rem',
                      fontSize: '0.875rem',
                      color: 'var(--success-text, #047857)',
                      fontWeight: '500',
                      textDecoration: 'none'
                    }}
                  >
                    {run.passes}
                  </Link>
                </td>
                <td style={{
                  padding: '0',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right'
                }}>
                  <Link
                    to={testUrl}
                    style={{
                      display: 'block',
                      padding: '0.5rem',
                      fontSize: '0.875rem',
                      color: run.fails > 0 ? 'var(--error-text, #b91c1c)' : 'var(--text-secondary, #6b7280)',
                      fontWeight: run.fails > 0 ? '500' : 'normal',
                      textDecoration: 'none'
                    }}
                  >
                    {run.fails}
                  </Link>
                </td>
                <td style={{
                  padding: '0',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right'
                }}>
                  <Link
                    to={testUrl}
                    style={{
                      display: 'block',
                      padding: '0.5rem',
                      textDecoration: 'none'
                    }}
                  >
                    {diff ? (
                      diff.value !== 0 ? (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: diff.value > 0
                            ? 'var(--success-text, #047857)'
                            : 'var(--error-text, #b91c1c)'
                        }}>
                          <span>
                            {diff.value > 0 ? '↑' : '↓'}
                          </span>
                          <span>
                            {diff.value > 0 ? '+' : ''}{diff.value}
                          </span>
                        </div>
                      ) : (
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary, #6b7280)'
                        }}>
                          —
                        </span>
                      )
                    ) : (
                      <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary, #6b7280)'
                      }}>
                        —
                      </span>
                    )}
                  </Link>
                </td>
                <td style={{
                  padding: '0',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right'
                }}>
                  <Link
                    to={testUrl}
                    style={{
                      display: 'block',
                      padding: '0.5rem',
                      textDecoration: 'none'
                    }}
                  >
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.25rem 0.35rem',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: '500',
                      backgroundColor: statusStyles.bg,
                      color: statusStyles.text,
                      border: `1px solid ${statusStyles.border}20`,
                      width: '60px',
                      minWidth: '60px',
                      textAlign: 'center'
                    }}>
                      <span style={{ marginRight: '0.15rem' }}>{statusStyles.icon}</span>
                      {statusStyles.label}
                    </div>
                  </Link>
                </td>
              </tr>
            );
          })}
          {filteredRuns.length === 0 && (
            <tr>
              <td colSpan={8} style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--card-bg)'
              }}>
                No results match the current filters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TestResultsTable;
