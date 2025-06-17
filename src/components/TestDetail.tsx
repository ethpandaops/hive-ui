import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchDirectories, fetchTestDetail, fetchTestRuns } from '../services/api';
import { TestDetail as TestDetailType, TestRun } from '../types';
import { format, isValid } from 'date-fns';
import Header from './Header';
import Footer from './Footer';
import { useTheme } from '../contexts/useTheme';
import Breadcrumb from './Breadcrumb';
import TestDetailsTable from './TestDetailsTable';
import CommandDisplay from './CommandDisplay';
import ConfigViewer from './ConfigViewer';
import VersionInfo from './VersionInfo';

const TestDetail = () => {
  const { isDarkMode } = useTheme();
  const { discoveryName, suiteid } = useParams<{ discoveryName: string, suiteid: string }>();
  const [discoveryAddress, setDiscoveryAddress] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [relatedTestRuns, setRelatedTestRuns] = useState<TestRun[]>([]);
  const [currentTestName, setCurrentTestName] = useState<string>('');
  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const navigate = useNavigate();

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

  // Extract the test name without the client part (e.g., "test/consume-rlp" from "test/consume-rlp+reth_default")
  useEffect(() => {
    if (testDetail?.name) {
      // Extract the test name part (before the '+')
      const nameParts = testDetail.name.split('+');
      if (nameParts.length > 0) {
        setCurrentTestName(nameParts[0]);
      }
    }
  }, [testDetail]);

  // Fetch all test runs for the current discovery
  const { data: allTestRuns, isLoading: isTestRunsLoading } = useQuery({
    queryKey: ['testRuns', discoveryAddress],
    queryFn: () => {
      if (!discoveryAddress) return Promise.resolve([]);
      return fetchTestRuns({ name: discoveryName || '', address: discoveryAddress });
    },
    enabled: !!discoveryAddress,
  });

  // Filter related test runs when we have both the test detail and all test runs
  useEffect(() => {
    if (testDetail && allTestRuns && currentTestName) {
      // Get the current client combination
      const currentClients = Object.keys(testDetail.clientVersions).sort().join(',');

      // Filter runs that match the same test name and client combination
      const filteredRuns = allTestRuns.filter(run => {
        const runNameParts = run.name.split('+');
        const runTestName = runNameParts[0];
        const runClients = run.clients.sort().join(',');

        return runTestName === currentTestName && runClients === currentClients;
      });

      setRelatedTestRuns(filteredRuns);
    }
  }, [testDetail, allTestRuns, currentTestName]);

  // Handle run selection change
  const handleRunChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedFileName = event.target.value;
    if (selectedFileName && discoveryName) {
      // Navigate to the selected test run
      navigate(`/test/${discoveryName}/${selectedFileName.replace('.json', '')}`);
    }
  };

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

  // Select style
  const selectStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', // Dark blue or light gray
    color: isDarkMode ? '#f8fafc' : '#1e293b', // Light or dark text
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`, // Dark or light border
    borderRadius: '0.375rem',
    padding: '0.35rem 0.75rem',
    fontSize: '0.875rem'
  };

  // Light text style
  const lightTextStyle: React.CSSProperties = {
    color: isDarkMode ? '#94a3b8' : '#64748b' // Dark or light muted text
  };

  // Reset expandedTestId when suite ID changes
  useEffect(() => {
    setExpandedTestId(null);
  }, [suiteid]);

  // Handle run selection for comparison
  const handleRunSelection = (runId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedRuns(prev => [...prev, runId]);
    } else {
      setSelectedRuns(prev => prev.filter(id => id !== runId));
    }
  };

  // Navigate to comparison view with selected runs
  const handleCompareSelected = () => {
    if (selectedRuns.length > 0) {
      // Add current run if not already selected
      const runsToCompare = new Set([
        suiteid!, // Current run
        ...selectedRuns
      ]);
      navigate(`/compare/${discoveryName}?runs=${Array.from(runsToCompare).join(',')}`);
    }
  };

  return (
    <div style={containerStyle}>
      <Header />

      <div style={{ margin: '0 0.5rem', flex: 1 }}>
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
                { label: discoveryName || '', link: `/group/${discoveryName}` },
                { label: testDetail.name, sublabel: suiteid }
              ]}
            />

            {/* Run Navigation */}
            {relatedTestRuns.length > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                marginTop: '0.75rem',
                marginBottom: '1rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.7)',
                border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                boxShadow: isDarkMode ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  ...lightTextStyle,
                  marginRight: '0.25rem'
                }}>
                </div>

                {/* Run History Boxes Visualization */}
                {relatedTestRuns.length > 0 && (
                  <div style={{
                    display: 'flex',
                    height: '1.75rem',
                    alignItems: 'center',
                    borderRadius: '0.375rem',
                    padding: '0 0.5rem',
                    marginRight: '0.75rem',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    <div
                      style={{
                        display: 'flex',
                        height: '100%',
                        alignItems: 'center',
                        justifyContent: relatedTestRuns.length > 40 ? 'flex-start' : 'space-evenly',
                        width: '100%',
                        gap: relatedTestRuns.length > 40 ? '0' : '2px',
                        overflowX: relatedTestRuns.length > 40 ? 'auto' : 'visible',
                        paddingBottom: relatedTestRuns.length > 40 ? '8px' : '0' // Add padding for scroll
                      }}
                      title="Run history visualization"
                    >
                      {/* Run history boxes - newest to oldest (left to right) */}
                      {relatedTestRuns.map((run) => {
                        // Calculate pass rate percentage with 2 decimal precision
                        const exactPassRate = (run.passes / run.ntests) * 100;
                        const formattedPassRate = exactPassRate.toFixed(2);
                        const passRate = Math.floor(exactPassRate); // Integer part only for display

                        // Determine box color based on test results
                        let bgColor, textColor;
                        if (run.fails === 0) {
                          bgColor = isDarkMode ? 'rgba(16, 185, 129, 0.7)' : 'rgba(16, 185, 129, 0.7)'; // Green
                          textColor = isDarkMode ? 'white' : 'white';
                        } else if (run.passes > 0 && run.passes / run.ntests > 0.5) {
                          bgColor = isDarkMode ? 'rgba(245, 158, 11, 0.7)' : 'rgba(245, 158, 11, 0.7)'; // Orange
                          textColor = isDarkMode ? 'white' : 'black';
                        } else {
                          bgColor = isDarkMode ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.7)'; // Red
                          textColor = isDarkMode ? 'white' : 'black';
                        }

                        // Highlight current run
                        const isCurrentRun = run.fileName === fileName;
                        const borderWidth = isCurrentRun ? 2 : 0;
                        const borderColor = isDarkMode ? 'white' : 'white';
                        const boxOpacity = isCurrentRun ? 1 : 0.8;
                        const boxShadow = isCurrentRun ?
                          `0 0 0 2px ${isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'}` :
                          'none';

                        // Calculate box dimensions based on number of runs
                        const totalRuns = relatedTestRuns.length;
                        let boxSize;

                        if (totalRuns <= 10) {
                          boxSize = '26px';
                        } else if (totalRuns <= 20) {
                          boxSize = '22px';
                        } else if (totalRuns <= 30) {
                          boxSize = '18px';
                        } else if (totalRuns <= 40) {
                          boxSize = '14px';
                        } else {
                          boxSize = '12px';
                        }

                        // Calculate font size based on box size
                        const fontSize =
                          totalRuns <= 10 ? '10px' :
                          totalRuns <= 20 ? '8px' :
                          totalRuns <= 30 ? '7px' :
                          '0'; // Hide text for very small boxes

                        return (
                          <div
                            key={`${run.fileName}-box`}
                            style={{
                              width: boxSize,
                              height: boxSize,
                              backgroundColor: bgColor,
                              color: textColor,
                              borderRadius: '4px',
                              cursor: 'pointer',
                              opacity: boxOpacity,
                              border: isCurrentRun ? `${borderWidth}px solid ${borderColor}` : 'none',
                              boxSizing: 'border-box',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: fontSize,
                              fontWeight: 'bold',
                              flexShrink: 0,
                              margin: '0 1px',
                              boxShadow: boxShadow,
                              transform: isCurrentRun ? 'scale(1.05)' : 'scale(1)'
                            }}
                            onClick={() => {
                              navigate(`/test/${discoveryName}/${run.fileName.replace('.json', '')}`);
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.opacity = '1';
                              e.currentTarget.style.transform = 'scale(1.1)';
                              e.currentTarget.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.opacity = isCurrentRun ? '1' : '0.8';
                              e.currentTarget.style.transform = isCurrentRun ? 'scale(1.05)' : 'scale(1)';
                              e.currentTarget.style.boxShadow = isCurrentRun ? boxShadow : 'none';
                            }}
                            title={`${format(new Date(run.start), 'MMM d, HH:mm')} - ${run.passes}/${run.ntests} passed (${formattedPassRate}%)`}
                          >
                            {passRate == 100 ? `✓` : `${passRate}%`}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Compare Button */}
                <button
                  onClick={() => {
                    // Get at most 4 related runs including the current one
                    const runsToCompare = [
                      suiteid, // Current run
                      ...relatedTestRuns
                        .filter(run => run.fileName !== fileName) // Skip current run
                        .slice(0, 9) // Take max 9 additional runs
                        .map(run => run.fileName.replace('.json', ''))
                    ];
                    navigate(`/compare/${discoveryName}?runs=${runsToCompare.join(',')}`);
                  }}
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
                    color: '#6366f1',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginRight: '0.75rem'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}>
                    <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                  </svg>
                  Compare recent runs
                </button>

                {/* Runs Dropdown */}
                {isTestRunsLoading ? (
                  <div style={{
                    fontSize: '0.875rem',
                    padding: '0.35rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    borderRadius: '0.375rem',
                    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                    height: '2.25rem',
                    flex: '1'
                  }}>
                    <div style={{
                      border: `2px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                      borderTopColor: '#6366f1',
                      borderRadius: '50%',
                      width: '0.75rem',
                      height: '0.75rem',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span>Loading runs...</span>
                  </div>
                ) : (
                  <select
                    style={{
                      ...selectStyle,
                      minWidth: '260px',
                      flex: '1',
                      maxWidth: '400px',
                      margin: '0 0.25rem',
                      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                      border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                      padding: '0.4rem 0.6rem'
                    }}
                    value={fileName}
                    onChange={handleRunChange}
                    title="Select a specific run"
                  >
                    {relatedTestRuns.map((run, index) => {
                      const isCurrentRun = run.fileName === fileName;
                      const runDate = new Date(run.start);
                      const passRate = Math.round((run.passes / run.ntests) * 100);
                      const relativePosition = index === 0
                        ? 'Latest'
                        : index === relatedTestRuns.length - 1
                          ? 'Oldest'
                          : `${index + 1} of ${relatedTestRuns.length}`;

                      return (
                        <option
                          key={run.fileName}
                          value={run.fileName}
                          style={{
                            backgroundColor: isDarkMode ? '#334155' : '#f1f5f9'
                          }}
                        >
                          {`${format(runDate, 'MMM d, HH:mm')} - ${run.passes}/${run.ntests} passed (${passRate}%) ${isCurrentRun ? '(current)' : ''} - ${relativePosition}`}
                        </option>
                      );
                    })}
                  </select>
                )}

                {/* Latest Run Button */}
                <button
                  onClick={() => {
                    if (relatedTestRuns.length > 0) {
                      const latestRun = relatedTestRuns[0]; // First run is the most recent
                      navigate(`/test/${discoveryName}/${latestRun.fileName.replace('.json', '')}`);
                    }
                  }}
                  title="Latest Run"
                  disabled={relatedTestRuns.findIndex(run => run.fileName === fileName) === 0}
                  style={{
                    backgroundColor: isDarkMode ? '#334155' : '#ffffff',
                    color: isDarkMode ? '#f8fafc' : '#1e293b',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                    cursor: relatedTestRuns.findIndex(run => run.fileName === fileName) === 0 ? 'not-allowed' : 'pointer',
                    opacity: relatedTestRuns.findIndex(run => run.fileName === fileName) === 0 ? 0.5 : 1,
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '2rem'
                  }}
                >
                  &lt;&lt;
                </button>

                {/* Next Run Button */}
                <button
                  onClick={() => {
                    const currentIndex = relatedTestRuns.findIndex(run => run.fileName === fileName);
                    if (currentIndex > 0) {
                      const nextRun = relatedTestRuns[currentIndex - 1]; // Newer runs have lower indices
                      navigate(`/test/${discoveryName}/${nextRun.fileName.replace('.json', '')}`);
                    }
                  }}
                  title="Next (Newer) Run"
                  disabled={relatedTestRuns.findIndex(run => run.fileName === fileName) === 0}
                  style={{
                    backgroundColor: isDarkMode ? '#334155' : '#ffffff',
                    color: isDarkMode ? '#f8fafc' : '#1e293b',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                    cursor: relatedTestRuns.findIndex(run => run.fileName === fileName) === 0 ? 'not-allowed' : 'pointer',
                    opacity: relatedTestRuns.findIndex(run => run.fileName === fileName) === 0 ? 0.5 : 1,
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '2rem'
                  }}
                >
                  &lt;
                </button>

                {/* Previous Run Button */}
                <button
                  onClick={() => {
                    const currentIndex = relatedTestRuns.findIndex(run => run.fileName === fileName);
                    if (currentIndex < relatedTestRuns.length - 1) {
                      const prevRun = relatedTestRuns[currentIndex + 1]; // Older runs have higher indices
                      navigate(`/test/${discoveryName}/${prevRun.fileName.replace('.json', '')}`);
                    }
                  }}
                  title="Previous (Older) Run"
                  disabled={relatedTestRuns.findIndex(run => run.fileName === fileName) === relatedTestRuns.length - 1}
                  style={{
                    backgroundColor: isDarkMode ? '#334155' : '#ffffff',
                    color: isDarkMode ? '#f8fafc' : '#1e293b',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                    cursor: relatedTestRuns.findIndex(run => run.fileName === fileName) === relatedTestRuns.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: relatedTestRuns.findIndex(run => run.fileName === fileName) === relatedTestRuns.length - 1 ? 0.5 : 1,
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '2rem'
                  }}
                >
                  &gt;
                </button>
              </div>
            )}


              {/* Test Runs History Table */}
              {relatedTestRuns.length > 1 && (
                <div style={{
                  ...cardStyle,
                  marginTop: '2rem',
                  padding: 0,
                  overflow: 'hidden'
                }}>
                  <div
                    style={{
                      padding: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: showHistoryTable ? `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}` : 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowHistoryTable(!showHistoryTable)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        transition: 'transform 0.2s ease',
                        transform: showHistoryTable ? 'rotate(0deg)' : 'rotate(-90deg)'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '1.25rem', height: '1.25rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '0.9rem',
                        fontWeight: '600'
                      }}>
                        Historical Test Runs ({relatedTestRuns.length})
                      </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {selectedRuns.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompareSelected();
                          }}
                          style={{
                            backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
                            color: '#6366f1',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: `1px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}>
                            <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                          </svg>
                          Compare Selected ({selectedRuns.length + 1})
                        </button>
                      )}
                    </div>
                  </div>

                  {showHistoryTable && (
                    <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'separate',
                        borderSpacing: 0
                      }}>
                        <thead style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc'
                        }}>
                          <tr>
                            <th style={{
                              width: '40px',
                              padding: '0.75rem 0.5rem',
                              textAlign: 'center',
                              borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedRuns.length === relatedTestRuns.length}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedRuns(relatedTestRuns
                                        .filter(run => run.fileName !== fileName) // Skip current run
                                        .map(run => run.fileName.replace('.json', ''))
                                      );
                                    } else {
                                      setSelectedRuns([]);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ cursor: 'pointer' }}
                                />
                              </div>
                            </th>
                            <th style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'left',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: isDarkMode ? '#94a3b8' : '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                              width: '180px'
                            }}>
                              Date
                            </th>
                            <th style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: isDarkMode ? '#94a3b8' : '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                              width: '80px'
                            }}>
                              Total
                            </th>
                            <th style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: isDarkMode ? '#94a3b8' : '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                              width: '80px'
                            }}>
                              Pass
                            </th>
                            <th style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: isDarkMode ? '#94a3b8' : '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                              width: '80px'
                            }}>
                              Fail
                            </th>
                            <th style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: isDarkMode ? '#94a3b8' : '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                              width: '100px'
                            }}>
                              Status
                            </th>
                            <th style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: isDarkMode ? '#94a3b8' : '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
                              width: '100px'
                            }}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedTestRuns.map((run) => {
                            const isCurrentRun = run.fileName === fileName;
                            const runId = run.fileName.replace('.json', '');
                            const isSelected = selectedRuns.includes(runId);
                            const passRate = run.ntests > 0 ? (run.passes / run.ntests) * 100 : 0;

                            // Determine status style based on results
                            let statusStyle = {
                              bg: '',
                              text: '',
                              border: '',
                              label: '',
                              icon: ''
                            };

                            if (run.fails === 0) {
                              statusStyle = {
                                bg: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(187, 247, 208, 0.5)',
                                text: isDarkMode ? '#4ade80' : '#16a34a',
                                border: isDarkMode ? '#10b981' : '#10b981',
                                label: 'Passed',
                                icon: '✓'
                              };
                            } else if (passRate > 50) {
                              statusStyle = {
                                bg: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(254, 215, 170, 0.5)',
                                text: isDarkMode ? '#fbbf24' : '#d97706',
                                border: isDarkMode ? '#f59e0b' : '#f59e0b',
                                label: 'Failed',
                                icon: '!'
                              };
                            } else {
                              statusStyle = {
                                bg: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(254, 202, 202, 0.5)',
                                text: isDarkMode ? '#f87171' : '#dc2626',
                                border: isDarkMode ? '#ef4444' : '#ef4444',
                                label: 'Failed',
                                icon: '✕'
                              };
                            }

                            return (
                              <tr
                                key={run.fileName}
                                style={{
                                  backgroundColor: isCurrentRun
                                    ? (isDarkMode ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)')
                                    : 'transparent',
                                  transition: 'background-color 0.15s ease'
                                }}
                                onMouseOver={(e) => {
                                  if (!isCurrentRun) {
                                    e.currentTarget.style.backgroundColor = isDarkMode
                                      ? 'rgba(51, 65, 85, 0.5)'
                                      : 'rgba(241, 245, 249, 0.8)';
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (!isCurrentRun) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }
                                }}
                              >
                                <td style={{
                                  padding: '0.75rem 0.5rem',
                                  textAlign: 'center',
                                  borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
                                }}>
                                  {!isCurrentRun && (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => handleRunSelection(runId, e.target.checked)}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  )}
                                  {isCurrentRun && (
                                    <div style={{
                                      width: '1rem',
                                      height: '1rem',
                                      borderRadius: '50%',
                                      backgroundColor: isDarkMode ? '#6366f1' : '#6366f1',
                                      margin: '0 auto'
                                    }}></div>
                                  )}
                                </td>
                                <td style={{
                                  padding: '0.75rem 1rem',
                                  fontSize: '0.875rem',
                                  fontWeight: isCurrentRun ? '600' : '400',
                                  color: isCurrentRun
                                    ? (isDarkMode ? '#6366f1' : '#6366f1')
                                    : (isDarkMode ? '#f8fafc' : '#1e293b'),
                                  borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
                                }}>
                                  <div>
                                    {formatDate(run.start)}
                                  </div>
                                  {isCurrentRun && (
                                    <div style={{
                                      fontSize: '0.75rem',
                                      color: isDarkMode ? '#94a3b8' : '#64748b'
                                    }}>
                                      (current)
                                    </div>
                                  )}
                                </td>
                                <td style={{
                                  padding: '0.75rem 1rem',
                                  fontSize: '0.875rem',
                                  fontWeight: isCurrentRun ? '600' : '400',
                                  textAlign: 'center',
                                  borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
                                }}>
                                  {run.ntests}
                                </td>
                                <td style={{
                                  padding: '0.75rem 1rem',
                                  fontSize: '0.875rem',
                                  fontWeight: isCurrentRun ? '600' : '400',
                                  textAlign: 'center',
                                  color: isDarkMode ? '#4ade80' : '#16a34a',
                                  borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
                                }}>
                                  {run.passes}
                                </td>
                                <td style={{
                                  padding: '0.75rem 1rem',
                                  fontSize: '0.875rem',
                                  fontWeight: isCurrentRun ? '600' : '400',
                                  textAlign: 'center',
                                  color: run.fails > 0
                                    ? (isDarkMode ? '#f87171' : '#dc2626')
                                    : (isDarkMode ? '#94a3b8' : '#64748b'),
                                  borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
                                }}>
                                  {run.fails}
                                </td>
                                <td style={{
                                  padding: '0.75rem 1rem',
                                  borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
                                  textAlign: 'center'
                                }}>
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    backgroundColor: statusStyle.bg,
                                    color: statusStyle.text,
                                    border: `1px solid ${statusStyle.border}20`,
                                    minWidth: '80px'
                                  }}>
                                    <span style={{ marginRight: '0.25rem' }}>{statusStyle.icon}</span>
                                    {statusStyle.label}
                                  </div>
                                </td>
                                <td style={{
                                  padding: '0.75rem 1rem',
                                  borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
                                  textAlign: 'center'
                                }}>
                                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                    {!isCurrentRun && (
                                      <Link
                                        to={`/test/${discoveryName}/${runId}`}
                                        style={{
                                          color: isDarkMode ? '#6366f1' : '#6366f1',
                                          backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '0.375rem',
                                          fontSize: '0.75rem',
                                          fontWeight: '500',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          textDecoration: 'none',
                                          border: `1px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.25rem' }}>
                                          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                                          <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                        </svg>
                                        View
                                      </Link>
                                    )}
                                    {!isCurrentRun && (
                                    <Link
                                      to={`/compare/${discoveryName}?runs=${suiteid},${runId}`}
                                      style={{
                                        color: isDarkMode ? '#3b82f6' : '#3b82f6',
                                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        textDecoration: 'none',
                                        border: `1px solid ${isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                                      }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.25rem' }}>
                                        <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                                      </svg>
                                      Compare
                                      </Link>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

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

                      {/* Only show the fails count if there are fails */}
                      {testStats.fails > 0 && (
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
                      )}

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
                      {testDetail.description}
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

              {/* Detailed Metadata Section */}
              {testDetail.runMetadata && (
                <div style={{
                  ...cardStyle,
                  marginBottom: '1.5rem',
                  backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#ffffff'
                }}>
                  <h3 style={sectionTitleStyle}>Detailed Test Run Information</h3>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '1.5rem',
                    marginTop: '1rem'
                  }}>
                    {/* Command Section */}
                    <div>
                      <h4 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: isDarkMode ? '#e5e7eb' : '#374151',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        Hive Command
                      </h4>
                      <CommandDisplay command={testDetail.runMetadata.hiveCommand} />
                    </div>

                    {/* Version Section */}
                    <div>
                      <h4 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: isDarkMode ? '#e5e7eb' : '#374151',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        Version Information
                      </h4>
                      <VersionInfo hiveVersion={testDetail.runMetadata.hiveVersion} />
                    </div>
                  </div>

                  {/* Client Configuration Section */}
                  {testDetail.runMetadata.clientConfig && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <h4 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: isDarkMode ? '#e5e7eb' : '#374151',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span>📄</span>
                        Client Configuration
                      </h4>
                      <ConfigViewer
                        config={testDetail.runMetadata.clientConfig.content}
                        filePath={testDetail.runMetadata.clientConfig.filePath}
                        isDarkMode={isDarkMode}
                        collapsed={true}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Use the new TestDetailsTable component */}
              <TestDetailsTable
                testDetail={testDetail}
                discoveryName={discoveryName || ''}
                suiteid={suiteid || ''}
                statusColors={statusColors}
                expandedTestId={expandedTestId}
                setExpandedTestId={setExpandedTestId}
              />

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
