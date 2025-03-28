import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDirectories } from '../services/api';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-log';
import 'prismjs/plugins/line-numbers/prism-line-numbers';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';
import Header from './Header';
import Footer from './Footer';
import Breadcrumb from './Breadcrumb';

// Custom CSS for the log viewer
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
  background-color: var(--code-bg);
  font-family: 'Consolas', 'Monaco', 'Andale Mono', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.log-content {
  padding: 0;
  margin: 0;
  overflow-x: auto;
  background-color: var(--code-bg);
  font-size: 14px;
  line-height: 1.5;
}

.log-content code {
  font-family: inherit;
  white-space: pre;
  tab-size: 4;
  line-height: inherit;
}

.line-numbers-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 55px;
  height: 100%;
  overflow: hidden;
  border-right: 1px solid #6e6e6e;
  background-color: #2d2d2d;
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

const LogViewer = () => {
  const params = useParams<{ group: string, suiteId: string, logFile: string }>();
  const group = params.group || '';
  const suiteId = params.suiteId || '';
  const logFile = params.logFile || '';

  const [logContent, setLogContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState<number>(0);
  const [fileSize, setFileSize] = useState<string>('0 B');
  const [showTables] = useState<boolean>(true);
  const [lineNumbers, setLineNumbers] = useState<string[]>([]);

  // Fetch directories to get the discovery address
  const { data: directories } = useQuery({
    queryKey: ['directories'],
    queryFn: fetchDirectories,
  });

  // Get directory address for the group
  const discoveryAddress = directories?.find(dir => dir.name === group)?.address || '';

  useEffect(() => {
    // Add the custom styles to the document
    const styleElement = document.createElement('style');
    styleElement.textContent = logViewerStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

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

  // Highlight the code after it loads
  useEffect(() => {
    if (logContent && !loading) {
      // Disable Prism's line numbers plugin for our custom implementation
      Prism.plugins.lineNumbers = { disable: true };
      Prism.highlightAll();
    }
  }, [logContent, loading]);

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
                    color: '#999',
                    userSelect: 'none'
                  }}
                >
                  {lineNumbers.map(num => (
                    <div key={num} className="line-number">
                      {num}
                    </div>
                  ))}
                </div>
                <pre
                  className="log-content"
                  style={{
                    marginTop: 0,
                    paddingLeft: '65px',
                    paddingTop: '0.5em',
                    paddingBottom: '0.5em'
                  }}
                >
                  <code className="language-log">{logContent}</code>
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
