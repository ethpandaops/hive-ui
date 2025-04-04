import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { fetchDirectories, fetchTestDetail, fetchTestRuns } from '../services/api';
import { TestDetail, TestCaseDetail } from '../types';
import { format, isValid } from 'date-fns';
import Header from './Header';
import Footer from './Footer';
import { useTheme } from '../contexts/useTheme';
import Breadcrumb from './Breadcrumb';

interface ComparisonTestCase {
  id: string;
  name: string;
  details: Record<string, TestCaseDetail>;
}

const TestComparison = () => {
  const { isDarkMode } = useTheme();
  const { discoveryName } = useParams<{ discoveryName: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  // Store runIds in a stable reference using useMemo
  const runIds = useMemo(() => {
    return searchParams.get('runs')?.split(',') || [];
  }, [searchParams]);

  // Add compareBy state
  const compareBy = useMemo(() => {
    return searchParams.get('compareBy') || 'name';
  }, [searchParams]);

  const [discoveryAddress, setDiscoveryAddress] = useState<string | null>(null);
  const [testDetails, setTestDetails] = useState<Record<string, TestDetail>>({});

  // Add state for pagination and search
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(100);

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

  // Fetch all test runs for the current discovery
  const { data: allTestRuns } = useQuery({
    queryKey: ['testRuns', discoveryAddress],
    queryFn: () => {
      if (!discoveryAddress) return Promise.resolve([]);
      return fetchTestRuns({ name: discoveryName || '', address: discoveryAddress });
    },
    enabled: !!discoveryAddress,
  });

  // Get selected test runs with useMemo for stability
  const selectedRuns = useMemo(() => {
    return allTestRuns?.filter(run =>
      runIds.includes(run.fileName.replace('.json', ''))
    ) || [];
  }, [allTestRuns, runIds]);

  // Create a stable query key
  const testDetailsQueryKey = useMemo(() => {
    if (!discoveryAddress || selectedRuns.length === 0) return null;
    return ['testDetails', discoveryAddress, selectedRuns.map(run => run.fileName).join(',')];
  }, [discoveryAddress, selectedRuns]);

  // Fetch test details for each selected run
  const { data: fetchedTestDetails, isLoading: isTestDetailsLoading } = useQuery({
    queryKey: testDetailsQueryKey || ['testDetails', 'empty'],
    queryFn: async () => {
      if (!discoveryAddress || selectedRuns.length === 0)
        return {} as Record<string, TestDetail>;

      const detailsMap: Record<string, TestDetail> = {};

      for (const run of selectedRuns) {
        try {
          const detail = await fetchTestDetail(discoveryAddress, run.fileName);
          detailsMap[run.fileName] = detail;
        } catch (error) {
          console.error(`Error fetching details for ${run.fileName}:`, error);
        }
      }

      return detailsMap;
    },
    enabled: !!testDetailsQueryKey,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (renamed from cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false, // Prevent automatic refetching
  });

  // Simple state update without setTimeout
  useEffect(() => {
    if (fetchedTestDetails && Object.keys(fetchedTestDetails).length > 0) {
      setTestDetails(fetchedTestDetails);
    }
  }, [fetchedTestDetails]);

  // Helper to check if all test results are the same
  const allSameResults = (details: TestCaseDetail[]) => {
    if (details.length <= 1) return true;
    const firstResult = details[0].summaryResult.pass;
    return details.every(detail => detail.summaryResult.pass === firstResult);
  };

  // Update compareBy param in URL
  const handleCompareByChange = (newCompareBy: string) => {
    setCurrentPage(1); // Reset pagination when changing grouping
    searchParams.set('compareBy', newCompareBy);
    setSearchParams(searchParams);
  };

  // Create comparison data structure when test details are loaded - wrapped with useMemo
  const comparisonTestCases = useMemo(() => {
    if (Object.keys(testDetails).length === 0) return [];

    if (compareBy === 'id') {
      // Original grouping by ID
      const allTestCaseIds = new Set<string>();
      Object.values(testDetails).forEach(detail => {
        Object.keys(detail.testCases).forEach(id => allTestCaseIds.add(id));
      });

      const comparison: ComparisonTestCase[] = Array.from(allTestCaseIds).map(id => {
        const firstDetailWithCase = Object.values(testDetails).find(detail => detail.testCases[id]);
        const name = firstDetailWithCase?.testCases[id]?.name || id;

        const details: Record<string, TestCaseDetail> = {};
        Object.keys(testDetails).forEach(fileName => {
          if (testDetails[fileName].testCases[id]) {
            details[fileName] = testDetails[fileName].testCases[id];
          }
        });

        return { id, name, details };
      });

      // Sort cases - failed tests first, then by name
      return comparison.sort((a, b) => {
        // Check if any run has a failure for this test case
        const aHasFailure = Object.values(a.details).some(detail => !detail.summaryResult.pass);
        const bHasFailure = Object.values(b.details).some(detail => !detail.summaryResult.pass);

        // Count failures
        const aFailCount = Object.values(a.details).filter(detail => !detail.summaryResult.pass).length;
        const bFailCount = Object.values(b.details).filter(detail => !detail.summaryResult.pass).length;

        // First sort by whether there are any failures (failures first)
        if (aHasFailure && !bHasFailure) return -1;
        if (!aHasFailure && bHasFailure) return 1;

        // Then sort by failure count (more failures first)
        if (aFailCount !== bFailCount) {
          return bFailCount - aFailCount;
        }

        // Result difference (some passed, some failed)
        const aHasDifference = !allSameResults(Object.values(a.details));
        const bHasDifference = !allSameResults(Object.values(b.details));

        if (aHasDifference && !bHasDifference) return -1;
        if (!aHasDifference && bHasDifference) return 1;

        // If same status, sort by name
        return a.name.localeCompare(b.name);
      });
    } else {
      // Group by name
      // First collect all unique test case names
      const testCasesByName = new Map<string, ComparisonTestCase>();

      // Iterate through all test details to collect cases by name
      Object.entries(testDetails).forEach(([fileName, detail]) => {
        Object.entries(detail.testCases).forEach(([id, testCase]) => {
          const name = testCase.name;

          if (!testCasesByName.has(name)) {
            testCasesByName.set(name, {
              id: name, // Use name as the id for the grouped item
              name,
              details: {}
            });
          }

          // Add this test case to the appropriate name group
          const group = testCasesByName.get(name)!;
          group.details[fileName] = testCase;
        });
      });

      // Convert to array
      const comparison = Array.from(testCasesByName.values());

      // Sort cases - failed tests first, then by name
      return comparison.sort((a, b) => {
        // Check if any run has a failure for this test case
        const aHasFailure = Object.values(a.details).some(detail => !detail.summaryResult.pass);
        const bHasFailure = Object.values(b.details).some(detail => !detail.summaryResult.pass);

        // Count failures
        const aFailCount = Object.values(a.details).filter(detail => !detail.summaryResult.pass).length;
        const bFailCount = Object.values(b.details).filter(detail => !detail.summaryResult.pass).length;

        // First sort by whether there are any failures (failures first)
        if (aHasFailure && !bHasFailure) return -1;
        if (!aHasFailure && bHasFailure) return 1;

        // Then sort by failure count (more failures first)
        if (aFailCount !== bFailCount) {
          return bFailCount - aFailCount;
        }

        // Result difference (some passed, some failed)
        const aHasDifference = !allSameResults(Object.values(a.details));
        const bHasDifference = !allSameResults(Object.values(b.details));

        if (aHasDifference && !bHasDifference) return -1;
        if (!aHasDifference && bHasDifference) return 1;

        // If same status, sort by name
        return a.name.localeCompare(b.name);
      });
    }
  }, [testDetails, compareBy]); // Add compareBy to dependencies

  // Filter and paginate comparison test cases
  const filteredTestCases = useMemo(() => {
    if (!comparisonTestCases) return [];

    return comparisonTestCases.filter(testCase =>
      testCase.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [comparisonTestCases, searchTerm]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredTestCases.length / itemsPerPage);
  const paginatedTestCases = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTestCases.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTestCases, currentPage, itemsPerPage]);

  // Handle search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on new search
  };

  // Pagination controls
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return isValid(date) ? format(date, 'MMM d, yyyy HH:mm:ss') : 'Invalid date';
  };

  // Calculate duration display
  const calculateDuration = (start: string, end: string) => {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (!isValid(startDate) || !isValid(endDate)) {
        return 'Invalid time';
      }

      const durationMs = endDate.getTime() - startDate.getTime();

      if (durationMs < 0) {
        return 'Invalid duration';
      }

      // Format based on duration length
      if (durationMs < 1000) {
        return `${durationMs}ms`;
      } else if (durationMs < 60000) {
        return `${(durationMs / 1000).toFixed(2)}s`;
      } else {
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
      }
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 'Error calculating';
    }
  };

  // Main container style
  const containerStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
    color: isDarkMode ? '#f8fafc' : '#1e293b',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  };

  // Card style
  const cardStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderRadius: '0.5rem',
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
    padding: '1rem',
    marginBottom: '1rem',
    position: 'relative',
    overflow: 'hidden'
  };

  // Table styles
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    fontSize: '0.875rem'
  };

  const tableHeaderStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    textAlign: 'left',
    borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
    position: 'sticky',
    top: 0,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '600',
    color: isDarkMode ? '#94a3b8' : '#64748b'
  };

  const tableCellStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
    verticalAlign: 'middle'
  };

  // Badge styles for pass/fail
  const passStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? 'rgba(20, 83, 45, 0.5)' : 'rgba(187, 247, 208, 0.5)',
    color: isDarkMode ? '#4ade80' : '#16a34a',
    padding: '0.25rem 0.5rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center'
  };

  const failStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? 'rgba(127, 29, 29, 0.5)' : 'rgba(254, 202, 202, 0.5)',
    color: isDarkMode ? '#f87171' : '#dc2626',
    padding: '0.25rem 0.5rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center'
  };

  // Light text style
  const lightTextStyle: React.CSSProperties = {
    color: isDarkMode ? '#94a3b8' : '#64748b'
  };

  // Section title style
  const sectionTitleStyle: React.CSSProperties = {
    marginBottom: '0.75rem',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '600',
    color: isDarkMode ? '#94a3b8' : '#64748b'
  };

  // Add a loading indicator component for better UX
  const LoadingSpinner = ({ size = '2rem', color = '#3b82f6', text = 'Loading...' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{
        border: `4px solid ${isDarkMode ? `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.3)` : `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.2)`}`,
        borderTopColor: color,
        borderRadius: '50%',
        width: size,
        height: size,
        animation: 'spin 1s linear infinite'
      }}></div>
      {text && <span style={{ ...lightTextStyle, fontSize: '0.875rem' }}>{text}</span>}
    </div>
  );

  // Table controls style
  const inputStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    color: isDarkMode ? '#f8fafc' : '#1e293b',
    fontSize: '0.875rem',
    width: '250px',
    outline: 'none',
  };

  const paginationButtonStyle: React.CSSProperties = {
    padding: '0.25rem 0.5rem',
    borderRadius: '0.375rem',
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    color: isDarkMode ? '#f8fafc' : '#1e293b',
    fontSize: '0.75rem',
    cursor: 'pointer',
    marginLeft: '0.25rem',
  };

  const activePageStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#3b82f6' : '#3b82f6',
    color: '#ffffff',
    borderColor: isDarkMode ? '#3b82f6' : '#3b82f6',
  };

  const disabledButtonStyle: React.CSSProperties = {
    opacity: 0.5,
    cursor: 'default',
  };

  // Add a reusable pagination component
  const PaginationControls = ({ includeSearch = false }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      justifyContent: 'space-between',
      padding: '0.75rem 1rem',
      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(248, 250, 252, 0.7)',
      borderTop: includeSearch ? 'none' : `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
      borderBottom: includeSearch ? `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}` : 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {includeSearch ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search test cases..."
              value={searchTerm}
              onChange={handleSearchChange}
              style={inputStyle}
            />
            <span style={{ ...lightTextStyle, fontSize: '0.75rem', marginLeft: '0.75rem' }}>
              {filteredTestCases.length} {filteredTestCases.length === 1 ? 'test' : 'tests'} found
            </span>
          </div>
        ) : (
          <span style={{ ...lightTextStyle, fontSize: '0.75rem' }}>
            {filteredTestCases.length} {filteredTestCases.length === 1 ? 'test' : 'tests'} found
          </span>
        )}
      </div>
      <div>
          <div style={toggleButtonStyle}>
            <div
              onClick={() => handleCompareByChange('name')}
              style={{
                ...toggleOptionStyle,
                ...(compareBy === 'name' ? activeToggleStyle : {})
              }}
            >
              Compare by name
            </div>
            <div
              onClick={() => handleCompareByChange('id')}
              style={{
                ...toggleOptionStyle,
                ...(compareBy === 'id' ? activeToggleStyle : {})
              }}
            >
              Compare by run index
            </div>
          </div>
        </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ ...lightTextStyle, fontSize: '0.75rem', marginRight: '0.5rem' }}>
            Show:
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              ...inputStyle,
              width: 'auto',
              padding: '0.25rem 0.5rem',
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              style={{
                ...paginationButtonStyle,
                ...(currentPage === 1 ? disabledButtonStyle : {})
              }}
            >
              &laquo;
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                ...paginationButtonStyle,
                ...(currentPage === 1 ? disabledButtonStyle : {})
              }}
            >
              &lsaquo;
            </button>

            {/* Page numbers */}
            <div style={{ display: 'flex', margin: '0 0.25rem' }}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Calculate which page numbers to show
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    style={{
                      ...paginationButtonStyle,
                      ...(currentPage === pageNum ? activePageStyle : {})
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                ...paginationButtonStyle,
                ...(currentPage === totalPages ? disabledButtonStyle : {})
              }}
            >
              &rsaquo;
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                ...paginationButtonStyle,
                ...(currentPage === totalPages ? disabledButtonStyle : {})
              }}
            >
              &raquo;
            </button>
            <span style={{ ...lightTextStyle, fontSize: '0.75rem', marginLeft: '0.5rem' }}>
              Page {currentPage} of {totalPages}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  // Add style for the toggle button
  const toggleButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '0.375rem',
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
    overflow: 'hidden',
    fontSize: '0.75rem',
  };

  const toggleOptionStyle: React.CSSProperties = {
    padding: '0.25rem 0.75rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };

  const activeToggleStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#3b82f6' : '#3b82f6',
    color: '#ffffff',
  };

  if (isTestDetailsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <LoadingSpinner text="Loading comparison data..." />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <Header />

      <div style={{ padding: '0 1.5rem', flex: 1 }}>
        {!discoveryAddress ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                border: `4px solid ${isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                width: '3rem',
                height: '3rem',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }}></div>
              <div style={{ ...lightTextStyle }}>Loading discovery information...</div>
            </div>
          </div>
        ) : selectedRuns.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
              <div style={{ ...lightTextStyle, marginBottom: '1.5rem' }}>No test runs selected for comparison</div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Breadcrumb navigation */}
            <Breadcrumb
              items={[
                { label: 'Home', link: '/' },
                { label: discoveryName || '', link: `/?group=${discoveryName}` },
                { label: 'Test Comparison', sublabel: `${selectedRuns.length} runs` }
              ]}
            />

            {/* Summary and Controls */}
            <div style={{ ...cardStyle, marginTop: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                  Comparing {selectedRuns.length} Test Runs
                </h1>
              </div>

              {/* Run Information */}
              <div style={{ ...cardStyle, backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(241, 245, 249, 0.7)' }}>
                <h3 style={sectionTitleStyle}>Selected Test Runs</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedRuns.map((run, index) => (
                    <div key={run.fileName} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      borderRadius: '0.375rem',
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                      border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                          width: '1.5rem',
                          height: '1.5rem',
                          borderRadius: '50%',
                          backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '500',
                          fontSize: '0.75rem'
                        }}>
                          {index + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight: '500' }}>{run.name}</div>
                          <div style={{ fontSize: '0.75rem', ...lightTextStyle }}>{formatDate(run.start)}</div>
                          {testDetails[run.fileName] && (
                            <div style={{
                              fontSize: '0.75rem',
                              ...lightTextStyle,
                              marginTop: '0.25rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.125rem'
                            }}>
                              {Object.entries(testDetails[run.fileName].clientVersions || {}).map(([client, version]) => (
                                <div key={client}>
                                  <span style={{ fontWeight: '500' }}>{client}</span>:{' '}
                                  <span style={{ fontFamily: 'monospace' }}>{version}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          backgroundColor: run.passes === run.ntests
                            ? (isDarkMode ? 'rgba(20, 83, 45, 0.2)' : 'rgba(187, 247, 208, 0.3)') // Green for 100%
                            : run.passes / run.ntests > 0.5
                              ? (isDarkMode ? 'rgba(234, 88, 12, 0.2)' : 'rgba(254, 215, 170, 0.3)') // Orange for >50%
                              : (isDarkMode ? 'rgba(127, 29, 29, 0.2)' : 'rgba(254, 202, 202, 0.3)'), // Red for <50%
                          color: run.passes === run.ntests
                            ? (isDarkMode ? '#4ade80' : '#16a34a') // Green text for 100%
                            : run.passes / run.ntests > 0.5
                              ? (isDarkMode ? '#fb923c' : '#ea580c') // Orange text for >50%
                              : (isDarkMode ? '#f87171' : '#dc2626'), // Red text for <50%
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem'
                        }}>
                          <span>
                            {run.passes}/{run.ntests} passed
                          </span>
                          <span style={{ fontWeight: '500' }}>
                            ({((run.passes / run.ntests) * 100).toFixed(2)}%)
                          </span>
                        </div>
                        <Link
                          to={`/test/${discoveryName}/${run.fileName.replace('.json', '')}`}
                          style={{
                            color: '#6366f1',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}>
                            <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                            <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                          View Details
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Comparison Table */}
            <div style={{
              ...cardStyle,
              marginBottom: '1.5rem',
              padding: 0,
              overflow: 'hidden',
              borderRadius: '0.5rem',
              position: 'relative'
            }}>
              {/* Table Controls - Search and Pagination */}
              <PaginationControls includeSearch={true} />

              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...tableHeaderStyle, width: '60%', textAlign: 'left' }}>Test Case</th>
                    {selectedRuns.map((run, index) => (
                      <th key={run.fileName} style={{ ...tableHeaderStyle, width: '100px', padding: '0.5rem', textAlign: 'center' }}>
                        Run {index + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedTestCases.map((testCase, index) => (
                    <tr
                      key={testCase.id}
                      style={{
                        // Highlight rows where any test failed
                        ...(Object.values(testCase.details).some(detail => !detail.summaryResult.pass) ?
                          {
                            fontWeight: '500',
                            borderLeft: `3px solid ${isDarkMode ? '#f59e0b' : '#fb923c'}`,
                            backgroundColor: isDarkMode
                              ? (index % 2 === 0 ? 'rgba(127, 29, 29, 0.1)' : 'rgba(127, 29, 29, 0.15)')
                              : (index % 2 === 0 ? 'rgba(254, 202, 202, 0.2)' : 'rgba(254, 202, 202, 0.4)')
                          } :
                          {
                            backgroundColor: isDarkMode
                              ? (index % 2 === 0 ? 'rgba(30, 41, 59, 0.5)' : 'rgba(30, 41, 59, 0.8)')
                              : (index % 2 === 0 ? 'rgba(248, 250, 252, 0.5)' : 'white')
                          }),
                      }}
                    >
                      <td style={{...tableCellStyle, textAlign: 'left'}}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          wordBreak: 'break-all'
                        }}>
                          <span title={testCase.name}>{testCase.name}</span>
                          {compareBy === 'id' && (
                            <span style={{
                              fontSize: '0.75rem',
                              color: isDarkMode ? '#94a3b8' : '#64748b',
                              fontFamily: 'monospace'
                            }}>
                              Run index: {testCase.id}
                            </span>
                          )}
                        </div>
                      </td>
                      {selectedRuns.map((run) => {
                        const detail = testCase.details[run.fileName];
                        return (
                          <td key={`${testCase.id}-${run.fileName}`} style={{ ...tableCellStyle, padding: '0.4rem', width: '100px', textAlign: 'center' }}>
                            {detail ? (
                              <Link
                                to={`/test/${discoveryName}/${run.fileName.replace('.json', '')}?testnumber=${compareBy === 'name' ?
                                  // When grouped by name, find the actual ID for this test case in this run
                                  Object.entries(testDetails[run.fileName].testCases)
                                    .find(([_, tc]) => tc.name === testCase.name)?.[0] || '' :
                                  // When grouped by ID, use the ID directly
                                  testCase.id
                                }`}
                                style={{
                                  textDecoration: 'none',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.2rem',
                                  alignItems: 'center',
                                  color: 'inherit',
                                  padding: '0.2rem',
                                  borderRadius: '0.25rem',
                                  transition: 'background-color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)';
                                  e.currentTarget.style.boxShadow = `0 1px 2px ${isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)'}`;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                                title="View test details"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <div style={{
                                  ...detail.summaryResult.pass ? passStyle : failStyle,
                                  padding: '0.15rem 0.3rem',
                                  fontSize: '0.7rem'
                                }}>
                                  {detail.summaryResult.pass ? "✓" : "✕"}
                                </div>
                                <div style={{ fontSize: '0.65rem', fontFamily: 'monospace' }}>
                                  {calculateDuration(detail.start, detail.end)}
                                </div>
                              </Link>
                            ) : (
                              <div style={{ ...lightTextStyle, fontStyle: 'italic', fontSize: '0.65rem' }}>
                                N/A
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {paginatedTestCases.length === 0 && (
                    <tr>
                      <td colSpan={selectedRuns.length + 1} style={{ ...tableCellStyle, textAlign: 'center', padding: '3rem 1rem' }}>
                        {isTestDetailsLoading ? (
                          <LoadingSpinner text="Loading comparison data..." />
                        ) : searchTerm ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '2rem', height: '2rem', color: isDarkMode ? '#94a3b8' : '#94a3b8' }}>
                              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                            </svg>
                            <span style={{ ...lightTextStyle, fontSize: '0.875rem' }}>No matching test cases found</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '2rem', height: '2rem', color: isDarkMode ? '#94a3b8' : '#94a3b8' }}>
                              <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.5 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
                            </svg>
                            <span style={{ ...lightTextStyle, fontSize: '0.875rem' }}>No test cases found for comparison</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Bottom pagination - reusing the pagination component */}
              {paginatedTestCases.length > 0 && <PaginationControls />}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default TestComparison;
