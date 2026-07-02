import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
import { VirtualizedLogContent } from './VirtualizedLogContent';
import {
  classifyLogFile,
  splitIntoLines,
  getFileSizeBytes,
  type LogFileConfig,
} from '../utils/logFileUtils';
import { highlightLinesAsync } from '../utils/chunkHighlighter';
import { byteRangeToLineRange, decodeBytes, type LineRange } from '../utils/byteRange';

const LogViewer = () => {
  const params = useParams<{ group: string; suiteId: string; logFile: string }>();
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

  // New state for virtualization and async highlighting
  const [logConfig, setLogConfig] = useState<LogFileConfig | null>(null);
  const [highlightedLines, setHighlightedLines] = useState<Map<number, string>>(new Map());
  const [highlightProgress, setHighlightProgress] = useState<number>(0);
  const [isHighlighting, setIsHighlighting] = useState<boolean>(false);

  // Line range covered by the anchored byte range, once computed.
  const [rangeLines, setRangeLines] = useState<LineRange | null>(null);

  // Create refs to access DOM elements directly
  const logContentRef = useRef<HTMLPreElement>(null);
  const cancelHighlightRef = useRef<(() => void) | null>(null);

  const group = params.group || '';
  const suiteId = params.suiteId || '';
  const logFile = params.logFile || '';

  // Get the line number from URL query params
  const selectedLine = searchParams.get('line') ? parseInt(searchParams.get('line') || '0') : null;

  // Byte range [begin, end) to anchor on: the log section belonging to one
  // test when the client log is shared across tests (hive TestLogOffsets).
  // The full file is loaded and the range highlighted and scrolled to.
  const beginByte = searchParams.get('begin') ? parseInt(searchParams.get('begin') || '0') : null;
  const endByte = searchParams.get('end') ? parseInt(searchParams.get('end') || '0') : null;

  // Fetch directories to get the discovery address
  const { data: directories } = useQuery({
    queryKey: ['directories'],
    queryFn: fetchDirectories,
  });

  // Get directory address for the group
  const discoveryAddress = directories?.find((dir) => dir.name === group)?.address || '';

  // Memoized log lines
  const logLines = useMemo(() => {
    if (!logContent) return [];
    return splitIntoLines(logContent);
  }, [logContent]);

  // Handle line number click
  const handleLineClick = useCallback(
    (lineNumber: number) => {
      // Create new URLSearchParams to preserve existing parameters
      const newParams = new URLSearchParams(searchParams);
      // Update the line parameter
      newParams.set('line', lineNumber.toString());
      // Prevent page refresh by using replace: true
      setSearchParams(newParams, { replace: true });

      // For small files, scroll manually
      if (!logConfig?.enableVirtualization) {
        const lineId = `L${lineNumber}`;
        const lineElement = document.getElementById(lineId);
        if (lineElement) {
          lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    },
    [searchParams, setSearchParams, logConfig]
  );

  // Scroll to the selected line when URL params change or content loads (for small files)
  useEffect(() => {
    if (!loading && selectedLine && !logConfig?.enableVirtualization) {
      // Ensure the DOM is ready before scrolling
      setTimeout(() => {
        const lineId = `L${selectedLine}`;
        const lineElement = document.getElementById(lineId);
        if (lineElement) {
          lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [loading, selectedLine, logConfig]);

  // Initialize async highlighting for large files
  useEffect(() => {
    if (logConfig?.enableVirtualization && logConfig?.enableHighlighting && logLines.length > 0) {
      console.log('[DEBUG] Starting async highlighting for', logLines.length, 'lines');

      // Cancel any previous highlighting
      if (cancelHighlightRef.current) {
        cancelHighlightRef.current();
      }

      setIsHighlighting(true);
      setHighlightProgress(0);
      setHighlightedLines(new Map());

      // Start chunked highlighting
      cancelHighlightRef.current = highlightLinesAsync(logLines, (update) => {
        setHighlightedLines(update.highlightedLines);
        setHighlightProgress(update.progress);

        if (update.done) {
          setIsHighlighting(false);
          console.log('[DEBUG] Highlighting complete');
        }
      });
    }

    return () => {
      if (cancelHighlightRef.current) {
        cancelHighlightRef.current();
        cancelHighlightRef.current = null;
      }
    };
  }, [logConfig, logLines]);

  useEffect(() => {
    const fetchLogFile = async () => {
      if (!discoveryAddress || !suiteId || !logFile) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setHighlightedLines(new Map());
        setHighlightProgress(0);
        setRangeLines(null);

        // Construct the URL to fetch the log file
        const logFilePath = `${discoveryAddress}/results/${decodeURIComponent(logFile)}`;

        const response = await fetch(logFilePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch log file: ${response.statusText}`);
        }

        let text: string;
        if (beginByte !== null && endByte !== null) {
          // Byte offsets refer to raw bytes, so the byte-to-line mapping
          // must be computed on bytes, not on the decoded string.
          const bytes = new Uint8Array(await response.arrayBuffer());
          setRangeLines(byteRangeToLineRange(bytes, { begin: beginByte, end: endByte }));
          text = decodeBytes(bytes);
        } else {
          text = await response.text();
        }
        setLogContent(text);

        // Calculate line count and file size
        const lines = splitIntoLines(text);
        const finalLineCount = lines.length;
        setLineCount(finalLineCount);

        const sizeBytes = getFileSizeBytes(text);
        setFileSize(formatBytes(sizeBytes));

        // Classify file and determine rendering mode. Anchored views always
        // use the virtualized renderer, which supports range highlighting.
        const config = classifyLogFile(finalLineCount, sizeBytes);
        if (beginByte !== null && endByte !== null) {
          config.enableVirtualization = true;
          config.mode = 'large';
        }
        setLogConfig(config);

        // Generate line numbers array (for small files)
        if (!config.enableVirtualization) {
          const numbers = Array.from({ length: finalLineCount }, (_, i) => (i + 1).toString());
          setLineNumbers(numbers);
        }

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

  // Helper function to get the raw log URL
  const getLogUrl = (): string => {
    return `${discoveryAddress}/results/${decodeURIComponent(logFile)}`;
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
      border: 1px solid var(--border-color);
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

    .highlight-progress {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      background-color: ${isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'};
      border-radius: 4px;
      font-size: 13px;
      color: ${isDarkMode ? '#93c5fd' : '#2563eb'};
    }

    .highlight-progress-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
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

    // Re-highlight when theme changes (only for small files)
    if (logContent && !loading && logConfig && !logConfig.enableVirtualization) {
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
  }, [isDarkMode, logContent, loading, logConfig]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-color)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Header />
      <main style={{ flex: 1 }}>
        <div style={{ maxWidth: '100%', margin: '0 auto', padding: '0 1rem' }}>
          {/* Breadcrumb navigation */}
          <Breadcrumb
            items={[
              { label: 'Home', link: '/' },
              { label: group, link: `/group/${group}` },
              { label: `Test Suite (${suiteId})`, link: `/test/${group}/${suiteId}` },
              { label: decodeURIComponent(logFile).split('/').pop() || 'Log' },
            ]}
          />

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading log file...</div>
          ) : error ? (
            <div
              style={{
                padding: '16px',
                color: 'var(--error-text)',
                backgroundColor: 'var(--error-bg)',
                borderRadius: '8px',
                margin: '16px 0',
              }}
            >
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
                    {lineCount.toLocaleString()} lines · {fileSize}
                    {selectedLine && ` · Line ${selectedLine} selected`}
                    {rangeLines && (
                      <span>
                        {' · '}
                        <span
                          style={{
                            backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
                            borderRadius: '4px',
                            padding: '1px 6px',
                          }}
                        >
                          Test section: lines {rangeLines.start.toLocaleString()}–{rangeLines.end.toLocaleString()}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isHighlighting && (
                    <div className="highlight-progress">
                      <div className="highlight-progress-spinner" />
                      <span>Applying syntax highlighting... {highlightProgress}%</span>
                    </div>
                  )}
                  <a
                    href={getLogUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="raw-log-link"
                  >
                    Raw Log
                  </a>
                </div>
              </div>

              {logConfig?.enableVirtualization ? (
                <VirtualizedLogContent
                  lines={logLines}
                  highlightedLines={highlightedLines}
                  selectedLine={selectedLine}
                  onLineClick={handleLineClick}
                  isDarkMode={isDarkMode}
                  scrollToLine={selectedLine ?? rangeLines?.start}
                  codeClassName={codeClassName}
                  highlightRange={rangeLines}
                />
              ) : (
                <div className="log-content-wrapper">
                  <div
                    className="line-numbers-wrapper"
                    style={{
                      paddingTop: '0.5em',
                      paddingBottom: '0.5em',
                      overflowY: 'hidden',
                      color: isDarkMode ? '#999' : '#666',
                      userSelect: 'none',
                    }}
                  >
                    {lineNumbers.map((num) => (
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
                      paddingBottom: '0.5em',
                    }}
                  >
                    <code className={`language-log ${codeClassName}`}>{logContent}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LogViewer;
