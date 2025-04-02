import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDirectories } from '../services/api';
import Prism from 'prismjs';
// Import Prism components but no themes - we'll handle themes manually
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-log';
import 'prismjs/plugins/line-numbers/prism-line-numbers';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';
import Header from './Header';
import Footer from './Footer';
import Breadcrumb from './Breadcrumb';
import { useTheme } from '../contexts/useTheme';
import { usePrismTheme } from './PrismTheme';

const LogViewer = () => {
  const params = useParams<{ group: string, suiteId: string, logFile: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDarkMode } = useTheme();
  const { codeClassName } = usePrismTheme(isDarkMode);

  // State declarations
  const [logContent, setLogContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState<number>(0);
  const [fileSize, setFileSize] = useState<string>('0 B');
  const [lineNumbers, setLineNumbers] = useState<string[]>([]);

  // Create refs to access DOM elements directly
  const logContentRef = useRef<HTMLPreElement>(null);

  const group = params.group || '';
  const suiteId = params.suiteId || '';
  const logFile = params.logFile || '';

  // Get the line number from URL query params
  const selectedLine = searchParams.get('line') ? parseInt(searchParams.get('line') || '0') : null;

  // Get byte range parameters from URL query params
  const beginByte = searchParams.get('begin') ? parseInt(searchParams.get('begin') || '0') : null;
  const endByte = searchParams.get('end') ? parseInt(searchParams.get('end') || '0') : null;

  // Fetch directories to get the discovery address
  const { data: directories } = useQuery({
    queryKey: ['directories'],
    queryFn: fetchDirectories,
  });

  // Get directory address for the group
  const discoveryAddress = directories?.find(dir => dir.name === group)?.address || '';

  // Handle line number click
  const handleLineClick = (lineNumber: number) => {
    // Prevent page refresh by using replace: true
    setSearchParams({ line: lineNumber.toString() }, { replace: true });
    scrollToLine(lineNumber);
  };

  // Scroll to specified line number using element ID
  const scrollToLine = (lineNumber: number) => {
    const lineId = `L${lineNumber}`;
    const lineElement = document.getElementById(lineId);

    if (lineElement) {
      lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Scroll to the selected line when URL params change or content loads
  useEffect(() => {
    if (!loading && selectedLine) {
      // Ensure the DOM is ready before scrolling
      setTimeout(() => {
        scrollToLine(selectedLine);
      }, 100);
    }
  }, [loading, selectedLine]);

  useEffect(() => {
    const fetchLogFile = async () => {
      if (!discoveryAddress || !suiteId || !logFile) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Construct the URL to fetch the log file
        const logFilePath = `${discoveryAddress}/results/${decodeURIComponent(logFile)}`;

        // Use range request if both begin and end bytes are provided
        const headers: HeadersInit = {};
        if (beginByte !== null && endByte !== null) {
          headers['Range'] = `bytes=${beginByte}-${endByte}`;
        }

        const response = await fetch(logFilePath, { headers });

        if (!response.ok && response.status !== 206) {
          throw new Error(`Failed to fetch log file: ${response.statusText}`);
        }

        const text = await response.text();
        console.log(`[DEBUG] Log file fetched, length: ${text.length}`);
        setLogContent(text);

        // Calculate line count and file size
        const lines = text.split('\n');
        // Count properly even if the last line doesn't have a newline
        const finalLineCount = text.endsWith('\n') ? lines.length - 1 : lines.length;
        setLineCount(finalLineCount);

        // Generate line numbers array
        const numbers = Array.from({ length: finalLineCount }, (_, i) => (i + 1).toString());
        setLineNumbers(numbers);

        setFileSize(formatBytes(new Blob([text]).size));

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setLoading(false);
      }
    };

    fetchLogFile();
  }, [discoveryAddress, suiteId, logFile, beginByte, endByte]);

  // Format bytes to human readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to get log URL with optional byte range parameters
  const getLogUrl = (includeRange: boolean = false): string => {
    const baseUrl = `${discoveryAddress}/results/${decodeURIComponent(logFile)}`;
    if (includeRange && beginByte !== null && endByte !== null) {
      return `${baseUrl}#:~:text=${beginByte},${endByte}`;
    }
    return baseUrl;
  };

  // Inject styles and handle theme switching
  useEffect(() => {
    // Create the log viewer styles with the current theme
    const logViewerStyles = `
    .log-container {
      position: relative;
      max-width: 100%;
      overflow-x: auto;
      border-radius: 8px;
      margin: 16px 0;
    }

    .log-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-color);
      background-color: var(--card-bg);
    }

    .log-content-wrapper {
      position: relative;
      overflow: hidden;
      background-color: var(--code-bg, ${isDarkMode ? '#1a1a1a' : '#f5f5f5'});
      font-family: 'Consolas', 'Monaco', 'Andale Mono', 'Ubuntu Mono', monospace;
      font-size: 14px;
      line-height: 1.5;
    }

    .log-content {
      padding: 0;
      margin: 0;
      overflow-x: auto;
      background-color: var(--code-bg, ${isDarkMode ? '#1a1a1a' : '#f5f5f5'});
      font-size: 14px;
      line-height: 1.5;
    }

    .log-content code {
      font-family: inherit;
      white-space: pre;
      tab-size: 4;
      line-height: inherit;
    }

    .highlighted-line {
      background-color: ${isDarkMode ? 'rgba(255, 255, 0, 0.15)' : 'rgba(255, 255, 0, 0.3)'};
      display: inline-block;
      width: 100%;
    }

    .line-numbers-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      width: 55px;
      height: 100%;
      overflow: hidden;
      border-right: 1px solid ${isDarkMode ? '#6e6e6e' : '#ccc'};
      background-color: ${isDarkMode ? '#2d2d2d' : '#e8e8e8'};
      text-align: right;
      padding-right: 5px;
      box-sizing: border-box;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
    }

    .line-number {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      cursor: pointer;
      transition: color 0.2s;
      padding-left: 10px;
      color: ${isDarkMode ? '#999' : '#666'};
    }

    .line-number:hover {
      color: ${isDarkMode ? '#fff' : '#000'};
    }

    .line-number.active {
      color: ${isDarkMode ? '#fff' : '#000'};
      font-weight: bold;
      background-color: ${isDarkMode ? 'rgba(255, 255, 0, 0.3)' : 'rgba(255, 255, 0, 0.2)'};
      position: relative;
    }

    .raw-log-link {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      background-color: var(--button-bg);
      color: var(--button-text);
      border-radius: 4px;
      text-decoration: none;
      font-size: 14px;
      transition: background-color 0.2s;
    }

    .raw-log-link:hover {
      background-color: var(--button-hover-bg);
      text-decoration: none;
    }

    .log-stats {
      font-size: 14px;
      color: var(--text-secondary);
      margin-left: 16px;
    }
    `;

    // Remove any existing styles
    const existingStyles = document.getElementById('log-viewer-styles');
    if (existingStyles) {
      document.head.removeChild(existingStyles);
    }

    // Create style element for all styles
    const styleElement = document.createElement('style');
    styleElement.id = 'log-viewer-styles';
    // Only include log viewer styles, not Prism themes (handled by usePrismTheme)
    styleElement.textContent = logViewerStyles;

    // Add to document
    document.head.appendChild(styleElement);

    // Re-highlight when theme changes
    if (logContent && !loading) {
      setTimeout(() => {
        // Disable Prism's line numbers plugin for our custom implementation
        Prism.plugins.lineNumbers = { disable: true };
        Prism.highlightAll();
      }, 100);
    }

    return () => {
      // Clean up on unmount
      const styleElement = document.getElementById('log-viewer-styles');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, [isDarkMode, logContent, loading]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Breadcrumb navigation */}
          <Breadcrumb
            items={[
              { label: 'Home', link: '/' },
              { label: group, link: `/?group=${group}` },
              { label: `Test Suite (${suiteId})`, link: `/test/${group}/${suiteId}` },
              { label: decodeURIComponent(logFile).split('/').pop() || 'Log' }
            ]}
          />

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              Loading log file...
            </div>
          ) : error ? (
            <div style={{
              padding: '16px',
              color: 'var(--error-text)',
              backgroundColor: 'var(--error-bg)',
              borderRadius: '8px',
              margin: '16px 0'
            }}>
              Error: {error}
            </div>
          ) : (
            <div className="log-container">
              <div className="log-header">
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>
                    {decodeURIComponent(logFile).split('/').pop()}
                  </h2>
                  <div className="log-stats">
                    {lineCount} lines · {fileSize}
                    {selectedLine && ` · Line ${selectedLine} selected`}
                    {beginByte !== null && endByte !== null && ` · Bytes ${beginByte}-${endByte}`}
                  </div>
                </div>
                <a
                  href={getLogUrl(true)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="raw-log-link"
                >
                  Raw Log
                </a>
              </div>
              <div className="log-content-wrapper">
                <div
                  className="line-numbers-wrapper"
                  style={{
                    paddingTop: '0.5em',
                    paddingBottom: '0.5em',
                    overflowY: 'hidden',
                    color: isDarkMode ? '#999' : '#666',
                    userSelect: 'none'
                  }}
                >
                  {lineNumbers.map(num => (
                    <div
                      key={num}
                      id={`L${num}`}
                      className={`line-number ${selectedLine === parseInt(num) ? 'active' : ''}`}
                      onClick={() => handleLineClick(parseInt(num))}
                    >
                      {num}
                    </div>
                  ))}
                </div>
                <pre
                  ref={logContentRef}
                  className="log-content"
                  style={{
                    marginTop: 0,
                    paddingLeft: '65px',
                    paddingTop: '0.5em',
                    paddingBottom: '0.5em'
                  }}
                >
                  <code className={`language-log ${codeClassName}`}>
                    {logContent}
                  </code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LogViewer;
