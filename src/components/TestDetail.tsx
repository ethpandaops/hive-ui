import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { fetchDirectories, fetchTestDetail } from '../services/api';
import { TestDetail as TestDetailType } from '../types';
import { format, isValid } from 'date-fns';
import Header from './Header';
import Footer from './Footer';
import { useTheme } from '../contexts/useTheme';
import DOMPurify from 'dompurify';
import Breadcrumb from './Breadcrumb';

const TestDetail = () => {
  const { isDarkMode } = useTheme();
  const { discoveryName, suiteid } = useParams<{ discoveryName: string, suiteid: string }>();
  const [discoveryAddress, setDiscoveryAddress] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEntryCount, setSelectedEntryCount] = useState<number>(100);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [showTables, setShowTables] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Get the file name with .json extension for API calls
  const fileName = suiteid ? `${suiteid}.json` : '';

  // Fetch directories to get the discovery address
  const { data: directories } = useQuery({
    queryKey: ['directories'],
    queryFn: fetchDirectories,
  });

  // Set discovery address when directories are loaded
  useEffect(() => {
    if (directories && discoveryName) {
      const directory = directories.find(dir => dir.name === discoveryName);
      if (directory) {
        setDiscoveryAddress(directory.address);
      }
    }
  }, [directories, discoveryName]);

  // Fetch test details - ensure fileName has .json extension
  const { data: testDetail, isLoading } = useQuery<TestDetailType>({
    queryKey: ['testDetail', discoveryAddress, fileName],
    queryFn: () => {
      console.log(`Fetching test detail for ${discoveryAddress}/${fileName}`);
      return fetchTestDetail(discoveryAddress!, fileName!);
    },
    enabled: !!discoveryAddress && !!suiteid,
  });

  // Parse the URL query parameters on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const testNumber = searchParams.get('testnumber');
    if (testNumber) {
      setExpandedTestId(testNumber);

      // If we have test details, find the expanded test and scroll to it
      if (testDetail) {
        const testCases = Object.entries(testDetail.testCases)
          .filter(([, testCase]) =>
            searchTerm ? testCase.name.toLowerCase().includes(searchTerm.toLowerCase()) : true
          );

        // Sort the test cases as we do later
        const sorted = [...testCases].sort((a, b) => {
          const [, testCaseA] = a;
          const [, testCaseB] = b;

          if (!testCaseA.summaryResult.pass && testCaseB.summaryResult.pass) {
            return -1;
          }
          if (testCaseA.summaryResult.pass && !testCaseB.summaryResult.pass) {
            return 1;
          }
          return 0;
        });

        // Find the test index
        const testIndex = sorted.findIndex(([id]) => id === testNumber);
        if (testIndex !== -1) {
          const targetPage = Math.floor(testIndex / selectedEntryCount) + 1;
          if (targetPage !== currentPage) {
            setCurrentPage(targetPage);
          }

          // Wait for re-render and then scroll to the expanded row
          setTimeout(() => {
            const expandedRow = document.getElementById(`test-row-${testNumber}`);
            if (expandedRow) {
              expandedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      }
    }
  }, [location.search, testDetail, currentPage, selectedEntryCount, searchTerm]);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return isValid(date) ? format(date, 'MMM d, yyyy HH:mm:ss') : 'Invalid date';
  };

  // Calculate test stats
  const testStats = testDetail ? Object.values(testDetail.testCases).reduce(
    (acc, testCase) => {
      if (testCase.summaryResult.pass) {
        acc.passes += 1;
      } else {
        acc.fails += 1;
      }
      return acc;
    },
    { passes: 0, fails: 0 }
  ) : { passes: 0, fails: 0 };

  // Calculate status colors based on test results, mimicking the TestResultCard logic
  const getStatusColors = () => {
    if (!testDetail) return {
      bg: '',
      text: '',
      border: '',
      pattern: ''
    };

    if (testStats.fails === 0) {
      // Success - all tests passed
      return {
        bg: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
        text: isDarkMode ? '#4ade80' : '#047857',
        border: isDarkMode ? '#10b981' : '#10b981',
        pattern: isDarkMode ?
          'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, #1e293b 100%)' :
          'radial-gradient(circle at 100% 100%, transparent 15%, rgba(16, 185, 129, 0.05) 25%, transparent 30%), linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, #ffffff 100%)'
      };
    } else if (testStats.passes > 0 && testStats.passes / (testStats.passes + testStats.fails) > 0.5) {
      // Warning - more than 50% passed
      return {
        bg: isDarkMode ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
        text: isDarkMode ? '#fbbf24' : '#b45309',
        border: isDarkMode ? '#f59e0b' : '#f59e0b',
        pattern: isDarkMode ?
          'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, #1e293b 100%)' :
          'linear-gradient(45deg, rgba(245, 158, 11, 0.05) 25%, transparent 25%, transparent 50%, rgba(245, 158, 11, 0.05) 50%, rgba(245, 158, 11, 0.05) 75%, transparent 75%, transparent) 0 0 / 8px 8px, linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, #ffffff 100%)'
      };
    } else {
      // Error - most or all tests failed
      return {
        bg: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
        text: isDarkMode ? '#f87171' : '#b91c1c',
        border: isDarkMode ? '#ef4444' : '#ef4444',
        pattern: isDarkMode ?
          'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, #1e293b 100%)' :
          'repeating-linear-gradient(-45deg, rgba(239, 68, 68, 0.05) 0, rgba(239, 68, 68, 0.05) 2px, transparent 2px, transparent 6px), linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, #ffffff 100%)'
      };
    }
  };

  const statusColors = getStatusColors();

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

  // Handle page change
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      // Close any expanded row when changing pages - always reset expanded state
      setExpandedTestId(null);

      // Update URL to remove the query parameter
      navigate({ search: '' }, { replace: true });

      setCurrentPage(page);
      // Scroll to top of the table
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Modify pagination click handlers to ensure direct function calls
  const handleFirstPage = () => {
    if (currentPage !== 1) {
      goToPage(1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const handleLastPage = () => {
    if (currentPage !== totalPages) {
      goToPage(totalPages);
    }
  };

  const handlePageClick = (page: number) => {
    if (page !== currentPage) {
      goToPage(page);
    }
  };

  // Toggle expanded state for a test
  const toggleExpanded = (testId: string) => {
    if (expandedTestId === testId) {
      // Collapse if already expanded
      setExpandedTestId(null);
      // Update URL to remove the query parameter
      navigate({ search: '' }, { replace: true });
    } else {
      // Expand the clicked test and collapse any other
      setExpandedTestId(testId);
      // Update URL with the test ID
      navigate({ search: `?testnumber=${testId}` }, { replace: true });
    }
  };

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

  // Main container style
  const containerStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', // Dark blue or light background
    color: isDarkMode ? '#f8fafc' : '#1e293b', // Light or dark text
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  };


  // Card style updated to match TestResultCard
  const cardStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', // Dark blue or white
    borderRadius: '0.5rem',
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`, // Dark or light border
    padding: '1rem',
    marginBottom: '1rem',
    position: 'relative', // For status bar positioning
    overflow: 'hidden' // Keep background pattern contained
  };

  // Section title style
  const sectionTitleStyle: React.CSSProperties = {
    marginBottom: '0.75rem',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '600',
    color: isDarkMode ? '#94a3b8' : '#64748b' // Dark or light muted text
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

  // Badge style
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
    padding: '0.35rem 0.75rem',
    fontSize: '0.875rem'
  };

  // Expanded row style
  const expandedRowStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', // Dark blue or white
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`, // Dark or light border
    borderRadius: '0.5rem',
    padding: '1rem',
    fontSize: '0.875rem',
    overflow: 'auto',
    maxWidth: '100%',
    position: 'relative'
  };

  // Client info card style
  const clientInfoCardStyle: React.CSSProperties = {
    padding: '0.75rem',
    borderRadius: '0.5rem',
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`, // Dark or light border
    backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', // Dark blue or light gray
  };

  // Light text style
  const lightTextStyle: React.CSSProperties = {
    color: isDarkMode ? '#94a3b8' : '#64748b' // Dark or light muted text
  };

  // Pagination button style
  const paginationButtonStyle = (isActive: boolean): React.CSSProperties => ({
    backgroundColor: isActive
      ? statusColors.border
      : (isDarkMode ? '#334155' : '#f1f5f9'),
    color: isActive
      ? '#ffffff'
      : (isDarkMode ? '#f8fafc' : '#1e293b'),
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    margin: '0 0.25rem'
  });

  // Function to safely render HTML content
  const sanitizeAndRenderHTML = (html: string) => {
    const sanitizedHTML = DOMPurify.sanitize(html);
    return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
  };

  // Table row style with hover effect
  const tableRowStyle = (testId: string): React.CSSProperties => ({
    backgroundColor: isDarkMode
      ? (expandedTestId === testId ? '#2c3e50' : hoveredRowId === testId ? '#2c3e50' : '#1e293b')
      : (expandedTestId === testId ? '#f1f5f9' : hoveredRowId === testId ? '#f1f5f9' : '#ffffff'),
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  });

  return (
    <div style={containerStyle}>
      <Header showTables={showTables} setShowTables={setShowTables} />

      <div style={{ padding: '0 1.5rem', flex: 1 }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
            <div style={{
              border: `4px solid ${isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              width: '2.5rem',
              height: '2.5rem',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
        ) : testDetail ? (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Breadcrumb navigation */}
            <Breadcrumb
              items={[
                { label: 'Home', link: '/' },
                { label: discoveryName || '', link: `/?group=${discoveryName}` },
                { label: testDetail.name, sublabel: suiteid }
              ]}
            />

            {/* Main content */}
            <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
              <div style={{
                ...cardStyle,
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                background: statusColors.pattern,
                position: 'relative'
              }}>
                {/* Status strip */}
                <div style={{
                  height: '3px',
                  backgroundColor: statusColors.border,
                  width: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0
                }}></div>

                <div style={{ padding: '0.5rem 0 0 0' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem'
                  }}>
                    <h1 style={{
                      fontSize: '1.25rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      margin: 0
                    }}>
                      Results: {testDetail.name}
                    </h1>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: isDarkMode ? 'rgba(20, 83, 45, 0.2)' : 'rgba(187, 247, 208, 0.3)',
                        color: isDarkMode ? '#4ade80' : '#16a34a',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        <span style={{ marginRight: '0.25rem' }}>✓</span>
                        {testStats.passes}
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: isDarkMode ? 'rgba(127, 29, 29, 0.2)' : 'rgba(254, 202, 202, 0.3)',
                        color: isDarkMode ? '#f87171' : '#dc2626',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        <span style={{ marginRight: '0.25rem' }}>✕</span>
                        {testStats.fails}
                      </div>

                      <div style={testStats.fails === 0 ? passStyle : failStyle}>
                        {testStats.fails === 0 ? 'All Pass' : 'Some Failed'}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '1rem'
                  }}>
                    <p style={{
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                      ...lightTextStyle,
                      margin: 0
                    }}>
                      {typeof testDetail.description === 'string' && testDetail.description.includes('<')
                        ? sanitizeAndRenderHTML(testDetail.description)
                        : testDetail.description}
                    </p>
                  </div>

                  {/* Stats grid - Client card and Test stats card side by side */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    {/* Client */}
                    <div style={{
                      ...cardStyle,
                      position: 'relative',
                      padding: '1rem',
                      marginBottom: 0,
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#ffffff'
                    }}>
                      {/* Subtle status strip for client card */}
                      <div style={{
                        height: '3px',
                        backgroundColor: statusColors.border,
                        opacity: 0.6,
                        width: '100%',
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }}></div>
                      <h3 style={sectionTitleStyle}>Client</h3>
                      {Object.entries(testDetail.clientVersions).map(([client, version]) => (
                        <div key={client} style={{ marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: '500' }}>{client}</span>{' '}
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.8 }}>{version}</span>
                        </div>
                      ))}
                    </div>

                    {/* Test Stats Card */}
                    <div style={{
                      ...cardStyle,
                      position: 'relative',
                      padding: '1rem',
                      marginBottom: 0,
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#ffffff'
                    }}>
                      {/* Subtle status strip for test info card */}
                      <div style={{
                        height: '3px',
                        backgroundColor: statusColors.border,
                        opacity: 0.6,
                        width: '100%',
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }}></div>
                      <h3 style={sectionTitleStyle}>Test Information</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* Date */}
                        <div>
                          <div style={{ fontSize: '0.75rem', ...lightTextStyle, marginBottom: '0.25rem' }}>DATE</div>
                          <div style={{ fontSize: '0.875rem' }}>{formatDate(Object.values(testDetail.testCases)[0]?.start || '')}</div>
                        </div>

                        {/* Duration */}
                        <div>
                          <div style={{ fontSize: '0.75rem', ...lightTextStyle, marginBottom: '0.25rem' }}>DURATION</div>
                          <div style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {(() => {
                              // Get all test cases with valid timestamps
                              const testCases = Object.values(testDetail.testCases).filter(testCase => {
                                try {
                                  const start = new Date(testCase.start).getTime();
                                  const end = new Date(testCase.end).getTime();
                                  return !isNaN(start) && !isNaN(end) && end >= start;
                                } catch (error) {
                                  console.error('Error parsing timestamp:', error);
                                  return false;
                                }
                              });

                              if (testCases.length === 0) {
                                return "0m 0s";
                              }

                              // Find the earliest start time and latest end time
                              let earliestStart = new Date(testCases[0].start).getTime();
                              let latestEnd = new Date(testCases[0].end).getTime();

                              testCases.forEach(testCase => {
                                const start = new Date(testCase.start).getTime();
                                const end = new Date(testCase.end).getTime();

                                if (start < earliestStart) {
                                  earliestStart = start;
                                }

                                if (end > latestEnd) {
                                  latestEnd = end;
                                }
                              });

                              // Calculate total duration from earliest start to latest end
                              const totalDurationMs = latestEnd - earliestStart;

                              // Format duration in a human-readable way (days, hours, minutes, seconds)
                              const totalSeconds = Math.floor(totalDurationMs / 1000);

                              const days = Math.floor(totalSeconds / (24 * 60 * 60));
                              const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
                              const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
                              const seconds = totalSeconds % 60;

                              // Format based on the duration length
                              if (days > 0) {
                                return `${days}d ${hours}h ${minutes}m`;
                              } else if (hours > 0) {
                                return `${hours}h ${minutes}m`;
                              } else {
                                return `${minutes}m ${seconds}s`;
                              }
                            })()}
                          </div>
                        </div>

                        {/* View Full Simulator Log button */}
                        <div>
                          <div style={{ fontSize: '0.75rem', ...lightTextStyle, marginBottom: '0.25rem' }}>SIMULATOR LOG</div>
                          <Link
                            to={`/logs/${discoveryName}/${suiteid || ''}/${encodeURIComponent(testDetail.simLog)}`}
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
                            View Full Simulator Log
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
                      onChange={(e) => setSearchTerm(e.target.value)}
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
                        onChange={(e) => setSelectedEntryCount(Number(e.target.value))}
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
                      <th style={{ ...tableHeaderStyle, width: '50%' }}>Test</th>
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
                                  transition: 'transform 0.2s ease'
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
                              View Client Log
                            </Link>
                          </td>
                        </tr>

                        {/* Expanded row */}
                        {expandedTestId === id && (
                          <tr style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9' }}>
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

                                  {/* Client Info section */}
                                  <div>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}` }}>Client Info</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', maxWidth: '100%', overflow: 'hidden' }}>
                                      {Object.entries(testCase.clientInfo).map(([clientId, info]) => (
                                        <div
                                          key={clientId}
                                          style={clientInfoCardStyle}
                                        >
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: '500', wordBreak: 'break-word' }}>{info.name}</span>
                                            <Link
                                              to={`/logs/${discoveryName}/${suiteid || ''}/${encodeURIComponent(info.logFile)}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{
                                                color: '#6366f1',
                                                backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
                                                borderRadius: '0.25rem',
                                                padding: '0.25rem 0.5rem',
                                                fontSize: '0.75rem',
                                                textDecoration: 'none',
                                                whiteSpace: 'nowrap'
                                              }}
                                            >
                                              View Log
                                            </Link>
                                          </div>

                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
                                            <div>
                                              <div style={{ fontSize: '0.75rem', ...lightTextStyle, marginBottom: '0.25rem' }}>ID</div>
                                              <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={info.id}>
                                                {info.id.substring(0, 8)}...
                                              </div>
                                            </div>
                                            <div>
                                              <div style={{ fontSize: '0.75rem', ...lightTextStyle, marginBottom: '0.25rem' }}>IP</div>
                                              <div>{info.ip}</div>
                                            </div>

                                            <div style={{ gridColumn: 'span 2' }}>
                                              <div style={{ fontSize: '0.75rem', ...lightTextStyle, marginBottom: '0.25rem' }}>INSTANTIATED AT</div>
                                              <div>{formatDate(info.instantiatedAt)}</div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
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

                  {/* Previous page button */}
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

                  {/* Page numbers */}
                  {paginationRange().map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageClick(page)}
                      style={paginationButtonStyle(page === currentPage)}
                    >
                      {page}
                    </button>
                  ))}

                  {/* Next page button */}
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

                  {/* Last page button */}
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

              {/* Page info */}
              {filteredTestCases.length > 0 && (
                <div style={{ textAlign: 'right', marginBottom: '1.5rem', ...lightTextStyle, fontSize: '0.875rem' }}>
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredTestCases.length)} of {filteredTestCases.length} entries
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</div>
              <div style={{ ...lightTextStyle }}>Test details not found</div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default TestDetail;
