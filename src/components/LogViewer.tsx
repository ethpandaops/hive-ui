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
import {
  byteRangeToLineRange,
  countLines,
  countLinesBefore,
  decodeBytes,
  fetchByteRange,
  fetchFileSize,
  formatByteSize,
  type LineRange,
} from '../utils/byteRange';

// Windowed mode: how much context is loaded around the test's byte range,
// and how much each "load more" click adds.
const WINDOW_CONTEXT_BYTES = 64 * 1024;
const WINDOW_CHUNK_BYTES = 64 * 1024;
const LINE_HEIGHT_PX = 21; // Must match VirtualizedLogContent.

interface WindowMeta {
  // Effective loaded byte range [startByte, endByte), trimmed to line
  // boundaries.
  startByte: number;
  endByte: number;
  totalSize: number | null;
  atEof: boolean;
}

// Drops the partial first line of a window that starts mid-line, returning
// the trimmed bytes and the file offset they start at.
function trimLeadingPartialLine(bytes: Uint8Array, startByte: number): { bytes: Uint8Array; startByte: number } {
  if (startByte === 0) return { bytes, startByte };
  const nl = bytes.indexOf(10);
  if (nl < 0) return { bytes, startByte };
  return { bytes: bytes.subarray(nl + 1), startByte: startByte + nl + 1 };
}

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

  // Line range covered by the anchored byte range (window-relative in
  // windowed mode), once computed.
  const [rangeLines, setRangeLines] = useState<LineRange | null>(null);

  // Windowed mode state: only the bytes around the anchored range are
  // loaded, so arbitrarily large shared client logs render instantly.
  const [windowMeta, setWindowMeta] = useState<WindowMeta | null>(null);
  // Absolute (whole-file) line number of the first loaded line; resolved in
  // the background by streaming and counting the newlines before the window.
  const [absFirstLine, setAbsFirstLine] = useState<number | null>(null);
  const [fullRequested, setFullRequested] = useState<boolean>(false);
  const [expanding, setExpanding] = useState<'up' | 'down' | null>(null);
  // Scroll compensation after prepending lines, keyed to force effect runs.
  const [scrollAdjust, setScrollAdjust] = useState<{ px: number; key: number }>({ px: 0, key: 0 });

  // Create refs to access DOM elements directly
  const logContentRef = useRef<HTMLPreElement>(null);
  const cancelHighlightRef = useRef<(() => void) | null>(null);
  const windowStartRef = useRef<number | null>(null);
  const lineCountAbortRef = useRef<AbortController | null>(null);

  const group = params.group || '';
  const suiteId = params.suiteId || '';
  const logFile = params.logFile || '';

  // Get the line number from URL query params
  const selectedLine = searchParams.get('line') ? parseInt(searchParams.get('line') || '0') : null;

  // Byte range [begin, end) to anchor on: the log section belonging to one
  // test when the client log is shared across tests (hive TestLogOffsets).
  // Only a window around the range is loaded; context can be expanded, or
  // the whole file loaded on request.
  const beginByte = searchParams.get('begin') ? parseInt(searchParams.get('begin') || '0') : null;
  const endByte = searchParams.get('end') ? parseInt(searchParams.get('end') || '0') : null;
  const windowedMode = beginByte !== null && endByte !== null && !fullRequested;

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
    // Applies full-file content to state; used by full mode and as the
    // windowed-mode fallback when the server does not support Range.
    const applyFullContent = (bytes: Uint8Array | null, text: string) => {
      if (bytes && beginByte !== null && endByte !== null) {
        // Byte offsets refer to raw bytes, so the byte-to-line mapping
        // must be computed on bytes, not on the decoded string.
        setRangeLines(byteRangeToLineRange(bytes, { begin: beginByte, end: endByte }));
      }
      setLogContent(text);
      setWindowMeta(null);
      setAbsFirstLine(1);

      const lines = splitIntoLines(text);
      setLineCount(lines.length);
      const sizeBytes = bytes ? bytes.length : getFileSizeBytes(text);
      setFileSize(formatBytes(sizeBytes));

      // Anchored views always use the virtualized renderer, which supports
      // range highlighting.
      const config = classifyLogFile(lines.length, sizeBytes);
      if (beginByte !== null && endByte !== null) {
        config.enableVirtualization = true;
        config.mode = 'large';
      }
      setLogConfig(config);
      if (!config.enableVirtualization) {
        setLineNumbers(Array.from({ length: lines.length }, (_, i) => (i + 1).toString()));
      }
    };

    const fetchFull = async (logFilePath: string) => {
      const response = await fetch(logFilePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch log file: ${response.statusText}`);
      }
      if (beginByte !== null && endByte !== null) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        applyFullContent(bytes, decodeBytes(bytes));
      } else {
        applyFullContent(null, await response.text());
      }
    };

    const fetchWindow = async (logFilePath: string) => {
      const begin = beginByte as number;
      const end = endByte as number;

      const knownSize = await fetchFileSize(logFilePath);
      const desiredStart = Math.max(0, begin - WINDOW_CONTEXT_BYTES);
      const desiredEnd = knownSize !== null ? Math.min(knownSize, end + WINDOW_CONTEXT_BYTES) : end + WINDOW_CONTEXT_BYTES;

      const result = await fetchByteRange(logFilePath, { begin: desiredStart, end: desiredEnd });
      if (result.fullBody) {
        // Server ignored the Range header; we already have the whole file.
        applyFullContent(result.fullBody, decodeBytes(result.fullBody));
        return;
      }

      const totalSize = result.totalSize ?? knownSize;
      const receivedEnd = desiredStart + result.bytes.length;
      const atEof = totalSize !== null ? receivedEnd >= totalSize : result.bytes.length < desiredEnd - desiredStart;

      const trimmed = trimLeadingPartialLine(result.bytes, desiredStart);
      const startByte = trimmed.startByte;
      let bytes = trimmed.bytes;
      if (!atEof) {
        // Also trim the partial last line, but never trim into the
        // anchored range itself.
        const lastNl = bytes.lastIndexOf(10);
        if (lastNl >= 0 && startByte + lastNl + 1 >= end) {
          bytes = bytes.subarray(0, lastNl + 1);
        }
      }

      setRangeLines(byteRangeToLineRange(bytes, { begin: begin - startByte, end: end - startByte }));
      setLogContent(decodeBytes(bytes));
      setWindowMeta({ startByte, endByte: startByte + bytes.length, totalSize, atEof });
      setAbsFirstLine(startByte === 0 ? 1 : null);
      setLineCount(countLines(bytes));
      setFileSize(totalSize !== null ? formatBytes(totalSize) : formatBytes(bytes.length));
      setLogConfig({ mode: 'large', enableHighlighting: true, enableVirtualization: true });
    };

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
        setWindowMeta(null);
        setAbsFirstLine(null);
        setExpanding(null);

        // Construct the URL to fetch the log file
        const logFilePath = `${discoveryAddress}/results/${decodeURIComponent(logFile)}`;

        if (windowedMode) {
          await fetchWindow(logFilePath);
        } else {
          await fetchFull(logFilePath);
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setLoading(false);
      }
    };

    fetchLogFile();
  }, [discoveryAddress, suiteId, logFile, beginByte, endByte, windowedMode]);

  // Resolve absolute line numbers for the window in the background by
  // counting the newlines before it. Streamed and abortable, so even very
  // large files only cost bandwidth, never rendering time.
  useEffect(() => {
    windowStartRef.current = windowMeta?.startByte ?? null;
    if (!windowMeta || windowMeta.startByte === 0 || absFirstLine !== null || !discoveryAddress) {
      return;
    }
    const startByte = windowMeta.startByte;
    const controller = new AbortController();
    lineCountAbortRef.current?.abort();
    lineCountAbortRef.current = controller;
    const logFilePath = `${discoveryAddress}/results/${decodeURIComponent(logFile)}`;
    countLinesBefore(logFilePath, startByte, controller.signal)
      .then((line) => {
        // Ignore the result if the window start moved while counting.
        if (windowStartRef.current === startByte) {
          setAbsFirstLine(line);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMeta?.startByte, discoveryAddress, logFile]);

  // Expand the loaded window upwards (earlier in the log).
  const expandUp = useCallback(async () => {
    if (!windowMeta || windowMeta.startByte <= 0 || expanding || !discoveryAddress) return;
    setExpanding('up');
    try {
      const logFilePath = `${discoveryAddress}/results/${decodeURIComponent(logFile)}`;
      const newStart = Math.max(0, windowMeta.startByte - WINDOW_CHUNK_BYTES);
      const result = await fetchByteRange(logFilePath, { begin: newStart, end: windowMeta.startByte });
      const { bytes, startByte } = trimLeadingPartialLine(result.bytes, newStart);
      const addedLines = countLines(bytes);
      if (addedLines === 0) return;
      setLogContent((prev) => decodeBytes(bytes) + prev);
      setWindowMeta({ ...windowMeta, startByte });
      setLineCount((prev) => prev + addedLines);
      setAbsFirstLine((prev) => (prev !== null ? Math.max(1, prev - addedLines) : startByte === 0 ? 1 : null));
      setRangeLines((prev) => (prev ? { start: prev.start + addedLines, end: prev.end + addedLines } : prev));
      setScrollAdjust((s) => ({ px: addedLines * LINE_HEIGHT_PX, key: s.key + 1 }));
    } catch (err) {
      console.error('Failed to expand log window upwards', err);
    } finally {
      setExpanding(null);
    }
  }, [windowMeta, expanding, discoveryAddress, logFile]);

  // Expand the loaded window downwards (later in the log).
  const expandDown = useCallback(async () => {
    if (!windowMeta || windowMeta.atEof || expanding || !discoveryAddress) return;
    setExpanding('down');
    try {
      const logFilePath = `${discoveryAddress}/results/${decodeURIComponent(logFile)}`;
      const desiredEnd = windowMeta.totalSize !== null
        ? Math.min(windowMeta.totalSize, windowMeta.endByte + WINDOW_CHUNK_BYTES)
        : windowMeta.endByte + WINDOW_CHUNK_BYTES;
      const result = await fetchByteRange(logFilePath, { begin: windowMeta.endByte, end: desiredEnd });
      const totalSize = result.totalSize ?? windowMeta.totalSize;
      const receivedEnd = windowMeta.endByte + result.bytes.length;
      const atEof = totalSize !== null ? receivedEnd >= totalSize : result.bytes.length < desiredEnd - windowMeta.endByte;
      let bytes = result.bytes;
      if (!atEof) {
        const lastNl = bytes.lastIndexOf(10);
        if (lastNl >= 0) {
          bytes = bytes.subarray(0, lastNl + 1);
        }
      }
      if (bytes.length === 0 && !atEof) return;
      setLogContent((prev) => prev + decodeBytes(bytes));
      setWindowMeta({ ...windowMeta, endByte: windowMeta.endByte + bytes.length, totalSize, atEof });
      setLineCount((prev) => prev + countLines(bytes));
    } catch (err) {
      console.error('Failed to expand log window downwards', err);
    } finally {
      setExpanding(null);
    }
  }, [windowMeta, expanding, discoveryAddress, logFile]);

  // Line numbers displayed in the gutter: absolute once known, otherwise
  // relative to the loaded window.
  const displayBase = absFirstLine ?? 1;
  const displayedRange = rangeLines
    ? { start: rangeLines.start + displayBase - 1, end: rangeLines.end + displayBase - 1 }
    : null;

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

    .expand-window-button {
      display: block;
      width: 100%;
      padding: 8px 12px;
      border: none;
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      background-color: ${isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)'};
      color: ${isDarkMode ? '#93c5fd' : '#2563eb'};
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .expand-window-button:hover:not(:disabled) {
      background-color: ${isDarkMode ? 'rgba(59, 130, 246, 0.22)' : 'rgba(59, 130, 246, 0.15)'};
    }

    .expand-window-button:disabled {
      cursor: wait;
      opacity: 0.6;
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
                    {windowMeta ? (
                      <>
                        {lineCount.toLocaleString()} lines loaded ({formatByteSize(windowMeta.endByte - windowMeta.startByte)}
                        {windowMeta.totalSize !== null && ` of ${fileSize}`})
                      </>
                    ) : (
                      <>
                        {lineCount.toLocaleString()} lines · {fileSize}
                      </>
                    )}
                    {selectedLine && ` · Line ${selectedLine} selected`}
                    {displayedRange && (
                      <span>
                        {' · '}
                        <span
                          style={{
                            backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
                            borderRadius: '4px',
                            padding: '1px 6px',
                          }}
                        >
                          Test section: lines {displayedRange.start.toLocaleString()}–{displayedRange.end.toLocaleString()}
                          {windowMeta && absFirstLine === null && ' (within loaded window)'}
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
                  {windowMeta && (
                    <button
                      onClick={() => setFullRequested(true)}
                      className="raw-log-link"
                      style={{ border: 'none', cursor: 'pointer' }}
                      title="Load and render the entire log file"
                    >
                      Load full file{windowMeta.totalSize !== null && ` (${formatByteSize(windowMeta.totalSize)})`}
                    </button>
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
                <>
                  {windowMeta && windowMeta.startByte > 0 && (
                    <button
                      onClick={expandUp}
                      disabled={expanding !== null}
                      className="expand-window-button"
                      title="Load earlier log context"
                    >
                      {expanding === 'up'
                        ? 'Loading…'
                        : `⬆ Load ${formatByteSize(Math.min(WINDOW_CHUNK_BYTES, windowMeta.startByte))} earlier (${formatByteSize(windowMeta.startByte)} above)`}
                    </button>
                  )}
                  <VirtualizedLogContent
                    lines={logLines}
                    highlightedLines={highlightedLines}
                    selectedLine={selectedLine}
                    onLineClick={handleLineClick}
                    isDarkMode={isDarkMode}
                    scrollToLine={selectedLine ?? displayedRange?.start}
                    codeClassName={codeClassName}
                    highlightRange={displayedRange}
                    lineNumberStart={displayBase}
                    scrollAdjust={scrollAdjust}
                  />
                  {windowMeta && !windowMeta.atEof && (
                    <button
                      onClick={expandDown}
                      disabled={expanding !== null}
                      className="expand-window-button"
                      title="Load later log context"
                    >
                      {expanding === 'down'
                        ? 'Loading…'
                        : `⬇ Load ${formatByteSize(windowMeta.totalSize !== null ? Math.min(WINDOW_CHUNK_BYTES, windowMeta.totalSize - windowMeta.endByte) : WINDOW_CHUNK_BYTES)} later${windowMeta.totalSize !== null ? ` (${formatByteSize(windowMeta.totalSize - windowMeta.endByte)} below)` : ''}`}
                    </button>
                  )}
                </>
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
