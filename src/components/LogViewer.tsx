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

// Custom CSS for Prism themes - t
const prismLightTheme = `
/* Light theme - based on prism.css */
code.prism-light {
  color: black;
  background: none;
  text-shadow: 0 1px white;
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  text-align: left;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  line-height: 1.5;
  tab-size: 4;
  hyphens: none;
}

code.prism-light .token.comment,
code.prism-light .token.prolog,
code.prism-light .token.doctype,
code.prism-light .token.cdata {
  color: slategray;
}

code.prism-light .token.punctuation {
  color: #999;
}

code.prism-light .token.namespace {
  opacity: .7;
}

code.prism-light .token.property,
code.prism-light .token.tag,
code.prism-light .token.boolean,
code.prism-light .token.number,
code.prism-light .token.constant,
code.prism-light .token.symbol,
code.prism-light .token.deleted {
  color: #905;
}

code.prism-light .token.selector,
code.prism-light .token.attr-name,
code.prism-light .token.string,
code.prism-light .token.char,
code.prism-light .token.builtin,
code.prism-light .token.inserted {
  color: #690;
}

code.prism-light .token.operator,
code.prism-light .token.entity,
code.prism-light .token.url,
code.prism-light .language-css .token.string,
code.prism-light .style .token.string {
  color: #9a6e3a;
}

code.prism-light .token.atrule,
code.prism-light .token.attr-value,
code.prism-light .token.keyword {
  color: #07a;
}

code.prism-light .token.function,
code.prism-light .token.class-name {
  color: #DD4A68;
}

code.prism-light .token.regex,
code.prism-light .token.important,
code.prism-light .token.variable {
  color: #e90;
}
`;

const prismDarkTheme = `
/* Dark theme - based on prism-tomorrow.css */
code.prism-dark {
  color: #ccc;
  background: none;
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  text-align: left;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  line-height: 1.5;
  tab-size: 4;
  hyphens: none;
}

code.prism-dark .token.comment,
code.prism-dark .token.block-comment,
code.prism-dark .token.prolog,
code.prism-dark .token.doctype,
code.prism-dark .token.cdata {
  color: #999;
}

code.prism-dark .token.punctuation {
  color: #ccc;
}

code.prism-dark .token.tag,
code.prism-dark .token.attr-name,
code.prism-dark .token.namespace,
code.prism-dark .token.deleted {
  color: #e2777a;
}

code.prism-dark .token.function-name {
  color: #6196cc;
}

code.prism-dark .token.boolean,
code.prism-dark .token.number,
code.prism-dark .token.function {
  color: #f08d49;
}

code.prism-dark .token.property,
code.prism-dark .token.class-name,
code.prism-dark .token.constant,
code.prism-dark .token.symbol {
  color: #f8c555;
}

code.prism-dark .token.selector,
code.prism-dark .token.important,
code.prism-dark .token.atrule,
code.prism-dark .token.keyword,
code.prism-dark .token.builtin {
  color: #cc99cd;
}

code.prism-dark .token.string,
code.prism-dark .token.char,
code.prism-dark .token.attr-value,
code.prism-dark .token.regex,
code.prism-dark .token.variable {
  color: #7ec699;
}

code.prism-dark .token.operator,
code.prism-dark .token.entity,
code.prism-dark .token.url {
  color: #67cdcc;
}

code.prism-dark .token.important,
code.prism-dark .token.bold {
  font-weight: bold;
}

code.prism-dark .token.italic {
  font-style: italic;
}

code.prism-dark .token.entity {
  cursor: help;
}

code.prism-dark .token.inserted {
  color: green;
}
`;

const LogViewer = () => {
  const params = useParams<{ group: string, suiteId: string, logFile: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDarkMode } = useTheme();

  // State declarations
  const [logContent, setLogContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState<number>(0);
  const [fileSize, setFileSize] = useState<string>('0 B');
  const [showTables] = useState<boolean>(true);
  const [lineNumbers, setLineNumbers] = useState<string[]>([]);

  // Create refs to access DOM elements directly
  const logContentRef = useRef<HTMLPreElement>(null);


  const group = params.group || '';
  const suiteId = params.suiteId || '';
  const logFile = params.logFile || '';

  // Get the line number from URL query params
  const selectedLine = searchParams.get('line') ? parseInt(searchParams.get('line') || '0') : null;

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

        const response = await fetch(logFilePath);

        if (!response.ok) {
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
  }, [discoveryAddress, suiteId, logFile]);

  // Format bytes to human readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    // Combine both Prism themes and log viewer styles
    styleElement.textContent = `
      ${prismLightTheme}
      ${prismDarkTheme}
      ${logViewerStyles}
    `;

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
      <Header showTables={showTables} setShowTables={() => {}} />
      <main style={{ flex: 1, padding: '16px' }}>
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
                  </div>
                </div>
                <a
                  href={`${discoveryAddress}/results/${decodeURIComponent(logFile)}`}
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
                  <code className={`language-log ${isDarkMode ? 'prism-dark' : 'prism-light'}`}>
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
