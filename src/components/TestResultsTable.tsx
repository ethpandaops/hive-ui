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
  testNameFilter: string;
  clientFilter: string;
  setTestNameFilter: (value: string) => void;
  setClientFilter: (value: string) => void;
}

const TestResultsTable = ({
  runs,
  directory,
  testNameFilter,
  clientFilter,
  setTestNameFilter,
  setClientFilter
}: TestResultsTableProps) => {
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Apply filters to the test runs
  const filteredRuns = runs.filter(run => {
    const testName = run.name.split('/').slice(1).join('/');
    const matchesTestName = testNameFilter === '' ||
      testName.toLowerCase().includes(testNameFilter.toLowerCase());

    const clients = run.clients.join(', ');
    const matchesClient = clientFilter === '' ||
      clients.toLowerCase().includes(clientFilter.toLowerCase());

    return matchesTestName && matchesClient;
  });

  // Sort runs by start time (newest first) for each test/client combination
  const sortedRuns = [...runs].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  // Helper function to find the previous run for a current run
  const findPreviousRun = (currentRun: TestRun): TestRun | null => {
    // Get the current test identity
    const testName = currentRun.name.split('/').slice(1).join('/'); // Format test name consistently
    const clientKey = currentRun.clients.sort().join(',');
    const currentRunTime = new Date(currentRun.start).getTime();

    // Find the previous run with the same test name and client combination
    const previousRun = sortedRuns.find(run => {
      const runTestName = run.name.split('/').slice(1).join('/');
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
            const nameA = a.name.split('/').slice(1).join('/').toLowerCase();
            const nameB = b.name.split('/').slice(1).join('/').toLowerCase();
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

  return (
    <div style={{ overflow: 'auto' }}>
      <div style={{
        padding: '1rem',
        display: 'flex',
        gap: '1rem',
        backgroundColor: 'var(--summary-bg, rgba(249, 250, 251, 0.5))'
      }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Filter by test name..."
            value={testNameFilter}
            onChange={(e) => setTestNameFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)'
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Filter by client..."
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)'
            }}
          />
        </div>
      </div>
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
                cursor: 'pointer'
              }}
            >
              Date {renderSortIndicator('date')}
            </th>
            <th
              onClick={() => handleSort('name')}
              style={{
                padding: '0.75rem 1rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                cursor: 'pointer'
              }}
            >
              Test Name {renderSortIndicator('name')}
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
              width: '30%'
            }}>
              Clients
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
                cursor: 'pointer'
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
                cursor: 'pointer'
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
                cursor: 'pointer'
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
              width: '50px'
            }}>
              Diff
            </th>
            <th
              onClick={() => handleSort('status')}
              style={{
                padding: '0.5rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                width: '80px',
                cursor: 'pointer'
              }}
            >
              Status {renderSortIndicator('status')}
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
              width: '70px'
            }}>
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((run, runIndex) => {
            const statusStyles = getStatusStyles(run);
            const fileName = run.fileName;
            const diff = getPassDiff(run);

            return (
              <tr key={`${run.name}-${runIndex}`} style={{
                backgroundColor: 'var(--card-bg, white)',
                transition: 'background-color 0.15s ease-in-out'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--row-hover-bg, rgba(249, 250, 251, 0.5))';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--card-bg, white)';
              }}>
                <td style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary, #6b7280)',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  whiteSpace: 'nowrap'
                }}>
                  {formatDate(run.start)}
                </td>
                <td style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary, #111827)',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  whiteSpace: 'nowrap'
                }}>
                  {run.name.split('/').slice(1).join('/')}
                </td>
                <td style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  maxWidth: '30%',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    {Object.entries(run.versions).map(([client, version]) => (
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
                  </div>
                </td>
                <td style={{
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right',
                  color: 'var(--text-primary, #111827)'
                }}>
                  {run.ntests}
                </td>
                <td style={{
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right',
                  color: 'var(--success-text, #047857)',
                  fontWeight: '500'
                }}>
                  {run.passes}
                </td>
                <td style={{
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right',
                  color: run.fails > 0 ? 'var(--error-text, #b91c1c)' : 'var(--text-secondary, #6b7280)',
                  fontWeight: run.fails > 0 ? '500' : 'normal'
                }}>
                  {run.fails}
                </td>
                <td style={{
                  padding: '0.5rem',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right'
                }}>
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
                </td>
                <td style={{
                  padding: '0.5rem',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right'
                }}>
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
                </td>
                <td style={{
                  padding: '0.5rem',
                  borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  textAlign: 'right'
                }}>
                  <Link
                    to={`/test/${directory}/${fileName.replace(/\.json$/, '')}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.25rem 0.35rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.7rem',
                      fontWeight: '500',
                      backgroundColor: 'var(--badge-bg, #f3f4f6)',
                      color: 'var(--text-secondary, #4b5563)',
                      textDecoration: 'none',
                      border: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--card-bg, white)';
                      e.currentTarget.style.borderColor = 'var(--primary-color, #3b82f6)';
                      e.currentTarget.style.color = 'var(--primary-color, #3b82f6)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--badge-bg, #f3f4f6)';
                      e.currentTarget.style.borderColor = 'var(--border-color, rgba(229, 231, 235, 0.8))';
                      e.currentTarget.style.color = 'var(--text-secondary, #4b5563)';
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                         style={{ width: '0.8rem', height: '0.8rem', marginRight: '0.3rem' }}>
                      <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25ZM4 13.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75ZM4.75 6.5a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5ZM4 9.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 4 9.5Z" clipRule="evenodd" />
                    </svg>
                    Details
                  </Link>
                </td>
              </tr>
            );
          })}
          {filteredRuns.length === 0 && (
            <tr>
              <td colSpan={9} style={{
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
