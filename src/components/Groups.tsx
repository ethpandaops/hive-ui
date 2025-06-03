import { useQuery } from '@tanstack/react-query';
import { fetchDirectories, fetchTestRuns } from '../services/api';
import { Directory, TestRun } from '../types';
import { differenceInDays } from 'date-fns';
import { useState, useEffect } from 'react';
import * as jdenticon from 'jdenticon';
import { Link } from 'react-router-dom';
import GroupHeader from './GroupHeader';

const Groups = () => {
  const [dirIcons, setDirIcons] = useState<Record<string, string>>({});
  const [, setDirectoryAddresses] = useState<Record<string, string>>({});
  const [failedDirectories, setFailedDirectories] = useState<string[]>([]);
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
  }, [directories, setDirectoryAddresses]);

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
      if (!directories || directories.length === 0) return {};

      const failed: string[] = [];

      const results = await Promise.all(
        directories.map(async (dir) => {
          try {
            return await fetchTestRuns(dir);
          } catch (error) {
            console.error(`Failed to fetch test runs for directory ${dir.name}:`, error);
            failed.push(dir.name);
            return [];
          }
        })
      );

      setFailedDirectories(failed);

      return Object.fromEntries(
        directories.map((dir, i) => [dir.name, results[i]])
      );
    },
    enabled: !!directories && directories.length > 0,
  });

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

  return (
    <div className="space-y-8" style={{
      margin: '0.5rem',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-primary)'
    }}>
      {Object.entries(testRunsByDir)
        .filter(([directory]) => !failedDirectories.includes(directory))
        .sort((a, b) => {
          // Sort by inactive status (inactive directories at the end)
          const [, runsA] = a;
          const [, runsB] = b;

          const mostRecentRunA = getMostRecentRun(runsA);
          const mostRecentRunB = getMostRecentRun(runsB);

          const isInactiveA = mostRecentRunA ?
            differenceInDays(new Date(), new Date(mostRecentRunA.start)) > 7 : false;
          const isInactiveB = mostRecentRunB ?
            differenceInDays(new Date(), new Date(mostRecentRunB.start)) > 7 : false;

          // Put inactive directories at the end
          if (isInactiveA && !isInactiveB) return 1;
          if (!isInactiveA && isInactiveB) return -1;

          // If both have same inactive status, maintain original order
          return 0;
        })
        .map(([directory, runs]) => {
          const mostRecentRun = getMostRecentRun(runs);
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
              <Link to={`/group/${directory}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: isMobile ? 'flex-start' : 'space-between',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  gap: isMobile ? '0.75rem' : '0',
                  cursor: 'pointer',
                  userSelect: 'none',
                  backgroundColor: isInactive ? 'var(--warning-bg, #fffbeb)' : 'transparent',
                  position: 'relative',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isInactive) {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(59, 130, 246, 0.05))';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isInactive ? 'var(--warning-bg, #fffbeb)' : 'transparent';
                }}
                >
                  <GroupHeader
                    name={directory}
                    icon={dirIcons[directory]}
                    testRuns={runs}
                    recentRuns={recentRuns}
                    mostRecentRun={mostRecentRun}
                    isInactive={isInactive}
                    isMobile={isMobile}
                    titleSize="medium"
                    showInactiveBadge={true}
                  />
                </div>
              </Link>
            </div>
          );
        })}
    </div>
  );
};

export default Groups;
