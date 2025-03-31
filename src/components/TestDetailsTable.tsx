import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TestDetail } from '../types';
import { format, isValid } from 'date-fns';
import { useTheme } from '../contexts/useTheme';
import DOMPurify from 'dompurify';

interface TestDetailsTableProps {
  testDetail: TestDetail;
  discoveryName: string;
  suiteid: string;
  statusColors: {
    bg: string;
    text: string;
    border: string;
    pattern: string;
  };
  expandedTestId?: string | null;
  setExpandedTestId?: (id: string | null) => void;
}

const TestDetailsTable: React.FC<TestDetailsTableProps> = ({
  testDetail,
  discoveryName,
  suiteid,
  statusColors,
  expandedTestId: propExpandedTestId,
  setExpandedTestId: propSetExpandedTestId
}) => {
  const { isDarkMode } = useTheme();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEntryCount, setSelectedEntryCount] = useState<number>(100);
  const [localExpandedTestId, setLocalExpandedTestId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const initialScrollAppliedRef = useRef(false);

  // Use either the props state or local state
  const expandedTestId = propExpandedTestId !== undefined ? propExpandedTestId : localExpandedTestId;
  const setExpandedTestId = propSetExpandedTestId || setLocalExpandedTestId;

  // Filter test cases by search term
  const filteredTestCases = testDetail ? Object.entries(testDetail.testCases)
    .filter(([, testCase]) =>
      searchTerm ? testCase.name.toLowerCase().includes(searchTerm.toLowerCase()) : true
    ) : [];

  // Sort test cases - failed tests first
  const sortedTestCases = [...filteredTestCases].sort((a, b) => {
    const [, testCaseA] = a;
    const [, testCaseB] = b;

    // If A fails and B passes, A should come first
    if (!testCaseA.summaryResult.pass && testCaseB.summaryResult.pass) {
      return -1;
    }
    // If A passes and B fails, B should come first
    if (testCaseA.summaryResult.pass && !testCaseB.summaryResult.pass) {
      return 1;
    }
    // If both have the same status, maintain original order
    return 0;
  });

  // Calculate pagination
  const totalPages = Math.ceil(sortedTestCases.length / selectedEntryCount);
  const startIndex = (currentPage - 1) * selectedEntryCount;
  const endIndex = startIndex + selectedEntryCount;
  const displayedTestCases = sortedTestCases.slice(startIndex, endIndex);

  // Use React Router's useSearchParams for URL parameter manipulation
  const [searchParams, setSearchParams] = useSearchParams();

  // Create array of page numbers for pagination
  const paginationRange = () => {
    const range = [];
    const maxPagesToShow = 5; // Show at most 5 pages at once

    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    // Adjust start page if we're at the end
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      range.push(i);
    }

    return range;
  };

  // Toggle expanded state for a test
  const toggleExpanded = useCallback((testId: string) => {
    if (expandedTestId === testId) {
      // Collapse if already expanded
      setExpandedTestId(null);

      // Remove the testnumber parameter from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('testnumber');
      setSearchParams(newParams, { replace: true });
    } else {
      // Expand the clicked test and collapse any other
      setExpandedTestId(testId);

      // Update URL with the test ID
      const newParams = new URLSearchParams(searchParams);
      newParams.set('testnumber', testId);
      setSearchParams(newParams, { replace: true });
    }
  }, [expandedTestId, searchParams, setSearchParams]);

  // Handle URL parameters on component mount - only run once
  useEffect(() => {
    // Handle test number parameter
    const testNumber = searchParams.get('testnumber');

    // Handle page parameter
    const pageParam = searchParams.get('page');
    if (pageParam && !isNaN(Number(pageParam))) {
      const page = Number(pageParam);
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    }

    // Handle entries parameter
    const entriesParam = searchParams.get('entries');
    if (entriesParam && !isNaN(Number(entriesParam))) {
      const entries = Number(entriesParam);
      if ([10, 25, 50, 100].includes(entries)) {
        setSelectedEntryCount(entries);
      }
    }

    // Removed search parameter handling

    if (testNumber && sortedTestCases.length > 0) {
      setExpandedTestId(testNumber);

      // Find the test index and navigate to the correct page
      const testIndex = sortedTestCases.findIndex(([id]) => id === testNumber);
      if (testIndex !== -1) {
        const targetPage = Math.floor(testIndex / selectedEntryCount) + 1;

        // If there's a page param but it doesn't match where the test should be,
        // update to the correct page for the test
        if (pageParam && Number(pageParam) !== targetPage) {
          setCurrentPage(targetPage);

          // Update URL with correct page parameter
          const newParams = new URLSearchParams(searchParams);
          newParams.set('page', targetPage.toString());
          setSearchParams(newParams);
        }
        // If there's no page param, set the page to where the test is
        else if (!pageParam && targetPage !== currentPage) {
          setCurrentPage(targetPage);

          // Update URL with page parameter
          const newParams = new URLSearchParams(searchParams);
          newParams.set('page', targetPage.toString());
          setSearchParams(newParams);
        }

        // Only scroll on initial page load
        if (!initialScrollAppliedRef.current) {
          // Wait for re-render and then scroll to the expanded row
          setTimeout(() => {
            const expandedRow = document.getElementById(`test-row-${testNumber}`);
            if (expandedRow) {
              expandedRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
              initialScrollAppliedRef.current = true;
            }
          }, 100);
        }
      }
    }
  // Only run this effect once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle test number parameter changes separately to avoid double scrolling
  useEffect(() => {
    const testNumber = searchParams.get('testnumber');
    if (testNumber && testNumber !== expandedTestId) {
      setExpandedTestId(testNumber);

      // Find the test index and navigate to the correct page if needed
      const testIndex = sortedTestCases.findIndex(([id]) => id === testNumber);
      if (testIndex !== -1) {
        const targetPage = Math.floor(testIndex / selectedEntryCount) + 1;
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
        }
      }
    } else if (!testNumber && expandedTestId !== null) {
      setExpandedTestId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle page and entries changes in one effect to avoid race conditions
  useEffect(() => {
    const pageParam = searchParams.get('page');
    if (pageParam && !isNaN(Number(pageParam))) {
      const newPage = Number(pageParam);
      if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
        setCurrentPage(newPage);
      }
    }

    const entriesParam = searchParams.get('entries');
    if (entriesParam && !isNaN(Number(entriesParam))) {
      const newEntries = Number(entriesParam);
      if ([10, 25, 50, 100].includes(newEntries) && newEntries !== selectedEntryCount) {
        setSelectedEntryCount(newEntries);
      }
    }

    // Removed search parameter handling
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, totalPages]);

  // Handle page change
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      // Batch state updates
      setCurrentPage(page);
      setExpandedTestId(null);

      // Scroll to top of the table
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Update URL with new page and remove testnumber
      const newParams = new URLSearchParams(searchParams);
      newParams.set('page', page.toString());
      newParams.delete('testnumber');
      setSearchParams(newParams, { replace: true });
    }
  }, [totalPages, searchParams, setSearchParams]);

  // Modify pagination click handlers to use memoized functions
  const handleFirstPage = useCallback(() => {
    if (currentPage !== 1) {
      goToPage(1);
    }
  }, [currentPage, goToPage]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const handleLastPage = useCallback(() => {
    if (currentPage !== totalPages) {
      goToPage(totalPages);
    }
  }, [currentPage, totalPages, goToPage]);

  const handlePageClick = useCallback((page: number) => {
    if (page !== currentPage) {
      goToPage(page);
    }
  }, [currentPage, goToPage]);

  // Search input handler - just update local state, no URL changes
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    setCurrentPage(1);

    // Collapse any expanded row when search changes
    if (expandedTestId) {
      setExpandedTestId(null);

      // Only update URL to remove testnumber, don't add search
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('testnumber');
      newParams.set('page', '1');
      setSearchParams(newParams, { replace: true });
    } else {
      // Update page in URL without adding search
      const newParams = new URLSearchParams(searchParams);
      newParams.set('page', '1');
      setSearchParams(newParams, { replace: true });
    }
  }, [expandedTestId, searchParams, setSearchParams]);

  // Entry count selector handler
  const handleEntryCountChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEntryCount = Number(e.target.value);

    // Batch state updates
    setSelectedEntryCount(newEntryCount);
    setCurrentPage(1);
    setExpandedTestId(null);

    // Update URL with new entry count and reset page - no search parameter
    const newParams = new URLSearchParams(searchParams);
    newParams.set('entries', newEntryCount.toString());
    newParams.set('page', '1');
    newParams.delete('testnumber');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Calculate test duration in a human-readable format
  const calculateDuration = (start: string, end: string) => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;

    // For very short durations (less than a second)
    if (durationMs < 1000) {
      return `${durationMs}ms`;
    }

    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
      return `${seconds}s`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return isValid(date) ? format(date, 'MMM d, yyyy HH:mm:ss') : 'Invalid date';
  };

  // Table style
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    marginBottom: '1.5rem'
  };

  // Table header style
  const tableHeaderStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', // Dark blue or light gray
    padding: '0.75rem 1rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '600',
    color: isDarkMode ? '#94a3b8' : '#64748b', // Dark or light muted text
    borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}` // Dark or light border
  };

  // Table cell style
  const tableCellStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    borderTop: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`, // Dark or light border
    fontSize: '0.875rem',
    color: isDarkMode ? '#f8fafc' : '#1e293b', // Light or dark text
    maxWidth: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  // Badge styles
  const passStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? 'rgba(20, 83, 45, 0.5)' : 'rgba(187, 247, 208, 0.5)', // Dark or light green
    color: isDarkMode ? '#4ade80' : '#16a34a', // Light or dark green text
    padding: '0.25rem 0.5rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center'
  };

  const failStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? 'rgba(127, 29, 29, 0.5)' : 'rgba(254, 202, 202, 0.5)', // Dark or light red
    color: isDarkMode ? '#f87171' : '#dc2626', // Light or dark red text
    padding: '0.25rem 0.5rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center'
  };

  // Card style
  const cardStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', // Dark blue or white
    borderRadius: '0.5rem',
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`, // Dark or light border
    padding: '1rem',
    marginBottom: '1rem',
    position: 'relative', // For status bar positioning
    overflow: 'hidden' // Keep background pattern contained
  };

  // Input style
  const inputStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', // Dark blue or light gray
    color: isDarkMode ? '#f8fafc' : '#1e293b', // Light or dark text
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`, // Dark or light border
    borderRadius: '0.375rem',
    padding: '0.5rem 0.75rem 0.5rem 2rem',
    fontSize: '0.875rem',
    width: '100%'
  };

  // Select style
  const selectStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', // Dark blue or light gray
    color: isDarkMode ? '#f8fafc' : '#1e293b', // Light or dark text
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`, // Dark or light border
    borderRadius: '0.375rem',
    padding: '0.5rem',
    fontSize: '0.875rem'
  };

  // Light text style
  const lightTextStyle: React.CSSProperties = {
    color: isDarkMode ? '#94a3b8' : '#64748b' // Dark or light muted text
  };

  // Pagination button style
  const paginationButtonStyle = (isActive: boolean): React.CSSProperties => ({
    backgroundColor: isActive
      ? (isDarkMode ? '#6366f1' : '#6366f1')
      : (isDarkMode ? '#334155' : '#f1f5f9'),
    color: isActive
      ? '#ffffff'
      : (isDarkMode ? '#f8fafc' : '#1e293b'),
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
    borderRadius: '0.375rem',
    padding: '0.5rem 0.75rem',
    fontWeight: '500',
    fontSize: '0.875rem',
    cursor: 'pointer'
  });

  // Table row style
  const tableRowStyle = (testId: string): React.CSSProperties => ({
    backgroundColor: expandedTestId === testId
      ? (isDarkMode ? '#1e293b' : '#f8fafc')
      : hoveredRowId === testId
        ? (isDarkMode ? '#334155' : '#f1f5f9')
        : (isDarkMode ? 'transparent' : 'transparent'),
    cursor: 'pointer'
  });

  // Expanded row style
  const expandedRowStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderRadius: '0.375rem',
    padding: '1rem',
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
  };

  // Sanitize and render HTML
  const sanitizeAndRenderHTML = (html: string) => {
    const sanitizedHTML = DOMPurify.sanitize(html);
    return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
  };

  return (
    <>
      {/* Search controls */}
      <div style={{
        ...cardStyle,
        marginBottom: '1.5rem',
        position: 'relative',
        padding: '1rem'
      }}>
        {/* Subtle status strip */}
        <div style={{
          height: '3px',
          backgroundColor: statusColors.border,
          opacity: 0.3,
          width: '100%',
          position: 'absolute',
          top: 0,
          left: 0
        }}></div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          width: '100%',
          paddingRight: '0.5rem'
        }}>
          {/* Search input - left side, full width */}
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', ...lightTextStyle, pointerEvents: 'none' }}>
              <svg style={{ width: '1rem', height: '1rem' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search tests..."
              value={searchTerm}
              onChange={handleSearchChange}
              style={{
                ...inputStyle,
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Top Pagination with Entries Selector */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.25rem',
            marginTop: '1rem'
          }}>
            {/* Entries per page selector - moved left of pagination */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ ...lightTextStyle, marginRight: '0.5rem', fontSize: '0.875rem' }}>Show</span>
              <select
                value={selectedEntryCount}
                onChange={handleEntryCountChange}
                style={selectStyle}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span style={{ ...lightTextStyle, marginLeft: '0.5rem', fontSize: '0.875rem' }}>entries</span>
            </div>

            {/* Pagination controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                onClick={handleFirstPage}
                disabled={currentPage === 1}
                style={{
                  ...paginationButtonStyle(false),
                  opacity: currentPage === 1 ? 0.5 : 1,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                &laquo;
              </button>

              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                style={{
                  ...paginationButtonStyle(false),
                  opacity: currentPage === 1 ? 0.5 : 1,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                &lsaquo;
              </button>

              <span style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: '500' }}>
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                style={{
                  ...paginationButtonStyle(false),
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                &rsaquo;
              </button>

              <button
                onClick={handleLastPage}
                disabled={currentPage === totalPages}
                style={{
                  ...paginationButtonStyle(false),
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tests table */}
      <div style={{
        ...cardStyle,
        marginBottom: '1.5rem',
        padding: 0,
        overflow: 'hidden',
        borderRadius: '0.5rem',
        position: 'relative'
      }}>
        {/* Status strip */}
        <div style={{
          height: '3px',
          backgroundColor: statusColors.border,
          width: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1
        }}></div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...tableHeaderStyle, width: '75%' }}>Test</th>
              <th style={{ ...tableHeaderStyle, width: '100px' }}>Status</th>
              <th style={{ ...tableHeaderStyle, width: '100px' }}>Duration</th>
              <th style={{ ...tableHeaderStyle, width: '120px' }}>Logs</th>
            </tr>
          </thead>
          <tbody>
            {displayedTestCases.map(([id, testCase]) => (
              <React.Fragment key={id}>
                <tr
                  id={`test-row-${id}`}
                  style={tableRowStyle(id)}
                  onClick={() => toggleExpanded(id)}
                  onMouseEnter={() => setHoveredRowId(id)}
                  onMouseLeave={() => setHoveredRowId(null)}
                >
                  <td style={tableCellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: '0.75rem',
                          color: isDarkMode ? '#94a3b8' : '#64748b',
                          width: '1.5rem',
                          height: '1.5rem',
                          borderRadius: '0.25rem',
                          transform: expandedTestId === id ? 'rotate(90deg)' : 'rotate(0deg)',
                          flexShrink: 0
                        }}
                      >
                        <span style={{
                          fontSize: '0.75rem',
                          display: 'inline-block',
                          lineHeight: 1,
                          flexShrink: 0
                        }}>▶</span>
                      </span>
                      <span style={{
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        maxWidth: 'calc(100% - 2rem)',
                        display: 'inline-block'
                      }}>{testCase.name}</span>
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <div style={testCase.summaryResult.pass ? passStyle : failStyle}>
                      {testCase.summaryResult.pass ? (
                        <>
                          <span style={{ marginRight: '0.25rem' }}>✓</span>
                          Pass
                        </>
                      ) : (
                        <>
                          <span style={{ marginRight: '0.25rem' }}>✕</span>
                          Fail
                        </>
                      )}
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {calculateDuration(testCase.start, testCase.end)}
                    </div>
                  </td>
                  <td style={tableCellStyle} onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={`/logs/${discoveryName}/${suiteid || ''}/${encodeURIComponent(Object.values(testCase.clientInfo)[0]?.logFile || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#6366f1',
                        backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        textDecoration: 'none'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.25rem' }}>
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      Logs
                    </Link>
                  </td>
                </tr>

                {/* Expanded row */}
                {expandedTestId === id && (
                  <tr style={{
                    backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9'
                  }}>
                    <td colSpan={4} style={{ padding: '0.75rem' }}>
                      <div style={{
                        ...expandedRowStyle,
                        position: 'relative'
                      }}>
                        {/* Status strip for expanded row */}
                        <div style={{
                          height: '3px',
                          backgroundColor: testCase.summaryResult.pass ?
                            (isDarkMode ? '#10b981' : '#10b981') :
                            (isDarkMode ? '#ef4444' : '#ef4444'),
                          width: '100%',
                          position: 'absolute',
                          top: 0,
                          left: 0
                        }}></div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1.5rem',
                          paddingTop: '0.5rem'
                        }}>
                          {/* Description and Timing section */}
                          <div style={{ overflow: 'hidden' }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}` }}>Description</h4>
                            <div style={{ ...lightTextStyle, whiteSpace: 'pre-wrap', lineHeight: '1.5', overflow: 'auto', wordBreak: 'break-word' }}>
                              {typeof testCase.description === 'string' && testCase.description.includes('<')
                                ? sanitizeAndRenderHTML(testCase.description)
                                : testCase.description}
                            </div>

                            <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginTop: '1.5rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}` }}>Timing</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                              <div>
                                <div style={{ fontSize: '0.75rem', ...lightTextStyle, marginBottom: '0.25rem' }}>START TIME</div>
                                <div>{formatDate(testCase.start)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.75rem', ...lightTextStyle, marginBottom: '0.25rem' }}>END TIME</div>
                                <div>{formatDate(testCase.end)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.75rem', ...lightTextStyle, marginBottom: '0.25rem' }}>DURATION</div>
                                <div>{calculateDuration(testCase.start, testCase.end)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {filteredTestCases.length === 0 && (
              <tr>
                <td colSpan={4} style={{
                  padding: '2rem',
                  textAlign: 'center',
                  ...lightTextStyle
                }}>
                  No results match the current search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem', gap: '0.25rem' }}>
          {/* First page button */}
          <button
            onClick={handleFirstPage}
            disabled={currentPage === 1}
            style={{
              ...paginationButtonStyle(false),
              opacity: currentPage === 1 ? 0.5 : 1,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            &laquo;
          </button>

          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            style={{
              ...paginationButtonStyle(false),
              opacity: currentPage === 1 ? 0.5 : 1,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            &lsaquo;
          </button>

          {/* Page number buttons */}
          {paginationRange().map((page) => (
            <button
              key={page}
              onClick={() => handlePageClick(page)}
              style={paginationButtonStyle(page === currentPage)}
            >
              {page}
            </button>
          ))}

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{
              ...paginationButtonStyle(false),
              opacity: currentPage === totalPages ? 0.5 : 1,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            &rsaquo;
          </button>

          <button
            onClick={handleLastPage}
            disabled={currentPage === totalPages}
            style={{
              ...paginationButtonStyle(false),
              opacity: currentPage === totalPages ? 0.5 : 1,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            &raquo;
          </button>
        </div>
      )}

      {/* Page info - Added the "Showing x to y of z entries" info */}
      {filteredTestCases.length > 0 && (
        <div style={{ textAlign: 'right', marginBottom: '1.5rem', ...lightTextStyle, fontSize: '0.875rem' }}>
          Showing {startIndex + 1} to {Math.min(endIndex, filteredTestCases.length)} of {filteredTestCases.length} entries
        </div>
      )}
    </>
  );
};

export default TestDetailsTable;
