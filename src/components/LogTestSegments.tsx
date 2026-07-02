import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatByteSize } from '../utils/byteRange';
import { type LogTestSegment } from '../hooks/useLogTestSegments';

interface LogTestSegmentListProps {
  segments: LogTestSegment[];
  discoveryName: string;
  suiteId: string;
  currentBegin: number | null;
  currentEnd: number | null;
  onSelect: (segment: LogTestSegment) => void;
  isDarkMode: boolean;
}

const ITEM_HEIGHT = 48;

// Sidebar mapping a shared client log to the tests it contains, in log
// order. The inverse of the per-test "Logs" link: from the log, navigate
// between the tests that ran against this client instance.
export const LogTestSegmentList: React.FC<LogTestSegmentListProps> = ({
  segments,
  discoveryName,
  suiteId,
  currentBegin,
  currentEnd,
  onSelect,
  isDarkMode,
}) => {
  const [failuresOnly, setFailuresOnly] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const failCount = useMemo(() => segments.filter((s) => !s.pass).length, [segments]);
  const shown = useMemo(
    () => (failuresOnly ? segments.filter((s) => !s.pass) : segments),
    [segments, failuresOnly]
  );

  const virtualizer = useVirtualizer({
    count: shown.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 20,
  });

  const currentIndex = useMemo(
    () => shown.findIndex((s) => s.begin === currentBegin && s.end === currentEnd),
    [shown, currentBegin, currentEnd]
  );

  // Keep the current test visible in the sidebar.
  useEffect(() => {
    if (currentIndex >= 0) {
      setTimeout(() => {
        virtualizer.scrollToIndex(currentIndex, { align: 'center' });
      }, 100);
    }
  }, [currentIndex, virtualizer]);

  const border = '1px solid var(--border-color)';

  return (
    <div
      style={{
        width: '320px',
        flexShrink: 0,
        borderLeft: border,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--card-bg)',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: border,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600 }}>
          Tests in this log
          <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '6px' }}>
            {segments.length.toLocaleString()}
            {failCount > 0 && (
              <span style={{ color: '#ef4444' }}> · {failCount.toLocaleString()} ✕</span>
            )}
          </span>
        </div>
        {failCount > 0 && (
          <button
            onClick={() => setFailuresOnly((v) => !v)}
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              cursor: 'pointer',
              border: border,
              backgroundColor: failuresOnly ? (isDarkMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.12)') : 'transparent',
              color: failuresOnly ? '#ef4444' : 'var(--text-secondary)',
            }}
          >
            failures
          </button>
        )}
      </div>
      <div
        ref={parentRef}
        style={{
          flex: 1,
          overflow: 'auto',
          contain: 'strict',
        }}
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((row) => {
            const segment = shown[row.index];
            const isCurrent = row.index === currentIndex;
            return (
              <div
                key={row.key}
                onClick={() => onSelect(segment)}
                title={segment.name}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${row.size}px`,
                  transform: `translateY(${row.start}px)`,
                  boxSizing: 'border-box',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  borderBottom: border,
                  backgroundColor: isCurrent
                    ? isDarkMode
                      ? 'rgba(59, 130, 246, 0.25)'
                      : 'rgba(59, 130, 246, 0.12)'
                    : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      backgroundColor: segment.pass ? '#10b981' : '#ef4444',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                    }}
                  >
                    {segment.displayName}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-secondary)',
                    marginLeft: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span>{formatByteSize(segment.end - segment.begin)}</span>
                  <Link
                    to={`/test/${discoveryName}/${suiteId}?testnumber=${segment.testId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: '#6366f1', textDecoration: 'none' }}
                    title="Open test details"
                  >
                    test ↗
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
