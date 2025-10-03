import { TestRun } from '../types';
import { format } from 'date-fns';
import { getStatusStyles } from '../utils/statusHelpers';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Initialize state from URL params
  const [sortField, setSortField] = useState<SortField>(() => {
    const field = searchParams.get('t_sort');
    return (field as SortField) || null;
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const dir = searchParams.get('t_dir');
    return (dir === 'asc' || dir === 'desc') ? dir : 'desc';
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    return searchParams.get('t_status') || 'all';
  });
  const [testNameSelectFilter, setTestNameSelectFilter] = useState<string>(() => {
    return searchParams.get('t_test') || 'all';
  });
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const page = searchParams.get('t_page');
    return page ? parseInt(page, 10) : 1;
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    const size = searchParams.get('t_size');
    return size ? parseInt(size, 10) : 50;
  });

  // Column widths state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('tableColumnWidths');
    return saved ? JSON.parse(saved) : {
      date: 50,
      name: 50,
      clients: 4500,
      total: 100,
      pass: 100,
      fail: 100,
      status: 150
    };
  });

  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  // Save column widths to localStorage
  useEffect(() => {
    localStorage.setItem('tableColumnWidths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  // Handle column resize
  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    resizingColumn.current = column;
    startX.current = e.pageX;
    startWidth.current = columnWidths[column];
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingColumn.current) return;

      const diff = e.pageX - startX.current;
      const newWidth = Math.max(50, startWidth.current + diff);

      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn.current!]: newWidth
      }));
    };

    const handleMouseUp = () => {
      resizingColumn.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Update URL with current filter/sort/pagination state
  const updateURL = () => {
    const params = new URLSearchParams(searchParams);

    // Sort
    if (sortField) {
      params.set('t_sort', sortField);
      params.set('t_dir', sortDirection);
    } else {
      params.delete('t_sort');
      params.delete('t_dir');
    }

    // Status filter
    if (statusFilter !== 'all') {
      params.set('t_status', statusFilter);
    } else {
      params.delete('t_status');
    }

    // Test name filter
    if (testNameSelectFilter !== 'all') {
      params.set('t_test', testNameSelectFilter);
    } else {
      params.delete('t_test');
    }

    // Pagination
    if (currentPage !== 1) {
      params.set('t_page', currentPage.toString());
    } else {
      params.delete('t_page');
    }

    if (pageSize !== 50) {
      params.set('t_size', pageSize.toString());
    } else {
      params.delete('t_size');
    }

    const newSearch = params.toString();
    navigate(newSearch ? `?${newSearch}` : '', { replace: true });
  };

  // Update URL when any filter/sort/pagination changes
  useEffect(() => {
    updateURL();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDirection, statusFilter, testNameSelectFilter, currentPage, pageSize]);

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

  // Render resize handle
  const renderResizeHandle = (column: string) => (
    <div
      onMouseDown={(e) => handleMouseDown(e, column)}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '4px',
        cursor: 'col-resize',
        userSelect: 'none',
        backgroundColor: 'transparent',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--border-color, rgba(229, 231, 235, 0.8))';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    />
  );

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
    setCurrentPage(1); // Reset to first page when clearing filters
  };

  // Calculate pagination
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // Pagination controls component (reusable for top and bottom)
  const PaginationControls = () => (
    <div style={{
      padding: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTop: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
      backgroundColor: 'var(--card-bg, white)',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      {/* Results info and page size selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        fontSize: '0.875rem',
        color: 'var(--text-secondary, #6b7280)'
      }}>
        <span>
          Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} results
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="pageSize" style={{ fontSize: '0.875rem' }}>
            Per page:
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.875rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Page navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          style={{
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: currentPage === 1 ? 'var(--text-secondary, #9ca3af)' : 'var(--text-primary, #111827)',
            backgroundColor: 'var(--card-bg, white)',
            border: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
            borderRadius: '0.375rem',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.backgroundColor = 'var(--summary-bg, rgba(249, 250, 251, 0.5))';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--card-bg, white)';
          }}
        >
          Previous
        </button>

        {getPageNumbers().map((page, idx) => (
          page === '...' ? (
            <span key={`ellipsis-${idx}`} style={{
              padding: '0.5rem',
              color: 'var(--text-secondary, #6b7280)'
            }}>
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => setCurrentPage(page as number)}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: currentPage === page ? 'white' : 'var(--text-primary, #111827)',
                backgroundColor: currentPage === page ? '#3b82f6' : 'var(--card-bg, white)',
                border: `1px solid ${currentPage === page ? '#3b82f6' : 'var(--border-color, rgba(229, 231, 235, 0.8))'}`,
                borderRadius: '0.375rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '2.5rem'
              }}
              onMouseEnter={(e) => {
                if (currentPage !== page) {
                  e.currentTarget.style.backgroundColor = 'var(--summary-bg, rgba(249, 250, 251, 0.5))';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== page) {
                  e.currentTarget.style.backgroundColor = 'var(--card-bg, white)';
                }
              }}
            >
              {page}
            </button>
          )
        ))}

        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          style={{
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: currentPage === totalPages ? 'var(--text-secondary, #9ca3af)' : 'var(--text-primary, #111827)',
            backgroundColor: 'var(--card-bg, white)',
            border: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
            borderRadius: '0.375rem',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.backgroundColor = 'var(--summary-bg, rgba(249, 250, 251, 0.5))';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--card-bg, white)';
          }}
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ overflow: 'auto' }}>
      {hasActiveFilters && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--summary-bg, rgba(249, 250, 251, 0.5))',
          borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            flex: 1
          }}>
            <span style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary, #6b7280)',
              fontWeight: '500'
            }}>
              Active Filters:
            </span>
            {testNameSelectFilter !== 'all' && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: 'var(--card-bg, white)',
                border: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                borderRadius: '9999px',
                fontSize: '0.75rem'
              }}>
                <span style={{
                  color: 'var(--text-secondary, #6b7280)',
                  fontWeight: '500'
                }}>
                  Test:
                </span>
                <span style={{
                  color: 'var(--text-primary, #111827)',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={testNameSelectFilter}>
                  {testNameSelectFilter}
                </span>
                <button
                  onClick={() => setTestNameSelectFilter('all')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-secondary, #6b7280)',
                    fontSize: '0.875rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--error-text, #b91c1c)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary, #6b7280)';
                  }}
                  title="Remove test filter"
                >
                  ✕
                </button>
              </div>
            )}
            {selectedClients.map(client => (
              <div
                key={client}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'var(--card-bg, white)',
                  border: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                  borderRadius: '9999px',
                  fontSize: '0.75rem'
                }}
              >
                <span style={{
                  color: 'var(--text-secondary, #6b7280)',
                  fontWeight: '500'
                }}>
                  Client:
                </span>
                <span style={{ color: 'var(--text-primary, #111827)' }}>
                  {client}
                </span>
                <button
                  onClick={() => {
                    if (onClientSelectChange) {
                      onClientSelectChange(selectedClients.filter(c => c !== client));
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-secondary, #6b7280)',
                    fontSize: '0.875rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--error-text, #b91c1c)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary, #6b7280)';
                  }}
                  title={`Remove ${client} filter`}
                >
                  ✕
                </button>
              </div>
            ))}
            {statusFilter !== 'all' && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: 'var(--card-bg, white)',
                border: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                borderRadius: '9999px',
                fontSize: '0.75rem'
              }}>
                <span style={{
                  color: 'var(--text-secondary, #6b7280)',
                  fontWeight: '500'
                }}>
                  Status:
                </span>
                <span style={{ color: 'var(--text-primary, #111827)', textTransform: 'capitalize' }}>
                  {statusFilter}
                </span>
                <button
                  onClick={() => setStatusFilter('all')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-secondary, #6b7280)',
                    fontSize: '0.875rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--error-text, #b91c1c)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary, #6b7280)';
                  }}
                  title="Remove status filter"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
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
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
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
            Clear All
          </button>
        </div>
      )}

      {/* Pagination Controls - Top */}
      {totalPages > 1 && <PaginationControls />}

      <table style={{
        minWidth: '100%',
        borderCollapse: 'separate',
        borderSpacing: 0,
        tableLayout: 'fixed'
      }}>
        <thead style={{ backgroundColor: 'var(--table-header-bg, #f9fafb)' }}>
          <tr>
            <th
              onClick={() => handleSort('date')}
              style={{
                position: 'relative',
                width: `${columnWidths.date}px`,
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
              {renderResizeHandle('date')}
            </th>
            <th
              style={{
                position: 'relative',
                width: `${columnWidths.name}px`,
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
              {renderResizeHandle('name')}
            </th>
            <th style={{
              position: 'relative',
              width: `${columnWidths.clients}px`,
              padding: '0.75rem 1rem',
              textAlign: 'left',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'var(--text-secondary, #6b7280)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
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
              {renderResizeHandle('clients')}
            </th>
            <th
              onClick={() => handleSort('total')}
              style={{
                position: 'relative',
                width: `${columnWidths.total}px`,
                padding: '0.5rem',
                textAlign: 'right',
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
              Total {renderSortIndicator('total')}
              {renderResizeHandle('total')}
            </th>
            <th
              onClick={() => handleSort('pass')}
              style={{
                position: 'relative',
                width: `${columnWidths.pass}px`,
                padding: '0.5rem',
                textAlign: 'right',
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
              Pass {renderSortIndicator('pass')}
              {renderResizeHandle('pass')}
            </th>
            <th
              onClick={() => handleSort('fail')}
              style={{
                position: 'relative',
                width: `${columnWidths.fail}px`,
                padding: '0.5rem',
                textAlign: 'right',
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
              Fail {renderSortIndicator('fail')}
              {renderResizeHandle('fail')}
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
              width: '80px',
              verticalAlign: 'top'
            }}>
              Diff
            </th>
            <th
              style={{
                position: 'relative',
                width: `${columnWidths.status}px`,
                padding: '0.5rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
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
              {renderResizeHandle('status')}
            </th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((run, runIndex) => {
            const statusStyles = getStatusStyles(run);
            const fileName = run.fileName;
            const diff = getPassDiff(run);

            const testUrl = `/test/${directory}/${fileName.replace(/\.json$/, '')}`;

            return (
              <tr
                key={`${run.name}-${runIndex}`}
                style={{
                  backgroundColor: 'var(--card-bg, white)',
                  transition: 'background-color 0.15s ease-in-out',
                  position: 'relative'
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
                      textDecoration: 'none'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.375rem',
                      alignItems: 'center'
                    }}>
                      {run.versions && Object.entries(run.versions).map(([client, version]) => {
                        const clientName = client.split('_')[0].toLowerCase();
                        const logoPath = `/img/clients/${clientName}.jpg`;
                        return (
                          <Tooltip.Provider key={client} delayDuration={200}>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.375rem',
                                    padding: '0.25rem 0.5rem',
                                    backgroundColor: 'var(--badge-bg, #f3f4f6)',
                                    border: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    color: 'var(--text-primary, #111827)',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    zIndex: 1
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
                                  {client}
                                </div>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  side="top"
                                  align="center"
                                  sideOffset={5}
                                  style={{
                                    backgroundColor: '#1e293b',
                                    color: '#f8fafc',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.75rem',
                                    maxWidth: '400px',
                                    wordBreak: 'break-word',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                    zIndex: 50
                                  }}
                                >
                                  {version}
                                  <Tooltip.Arrow
                                    style={{
                                      fill: '#1e293b'
                                    }}
                                  />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </Tooltip.Provider>
                        );
                      })}

                      {!run.versions && run.clients && run.clients.map((client) => {
                        const clientName = client.split('_')[0].toLowerCase();
                        const logoPath = `/img/clients/${clientName}.jpg`;
                        return (
                          <div
                            key={client}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'var(--badge-bg, #f3f4f6)',
                              border: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              color: 'var(--text-primary, #111827)'
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
                            {client}
                          </div>
                        );
                      })}
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

      {/* Pagination Controls - Bottom */}
      {totalPages > 1 && <PaginationControls />}
    </div>
  );
};

export default TestResultsTable;
