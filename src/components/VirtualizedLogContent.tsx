import { useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualizedLogContentProps {
  lines: string[];
  highlightedLines: Map<number, string>;
  selectedLine: number | null;
  onLineClick: (lineNumber: number) => void;
  isDarkMode: boolean;
  scrollToLine?: number | null;
  codeClassName: string;
}

const LINE_HEIGHT = 21; // 14px font-size * 1.5 line-height

export const VirtualizedLogContent: React.FC<VirtualizedLogContentProps> = ({
  lines,
  highlightedLines,
  selectedLine,
  onLineClick,
  isDarkMode,
  scrollToLine,
  codeClassName,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: 50, // Render 50 extra items above/below viewport for smooth scrolling
  });

  // Scroll to specific line when requested
  useEffect(() => {
    if (scrollToLine && scrollToLine > 0 && scrollToLine <= lines.length) {
      // Small delay to ensure virtualizer is ready
      setTimeout(() => {
        virtualizer.scrollToIndex(scrollToLine - 1, { align: 'center', behavior: 'smooth' });
      }, 100);
    }
  }, [scrollToLine, virtualizer, lines.length]);

  const handleLineClick = useCallback(
    (lineNumber: number) => {
      onLineClick(lineNumber);
    },
    [onLineClick]
  );

  const virtualItems = virtualizer.getVirtualItems();

  const getLineContent = (index: number) => {
    const highlighted = highlightedLines.get(index);
    if (highlighted) {
      // Wrap in code element so Prism CSS selectors work (code.prism-dark .token.xxx)
      return (
        <code
          className={codeClassName}
          style={{ background: 'none' }}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      );
    }
    return lines[index] || ' '; // Plain text fallback, space for empty lines
  };

  return (
    <div
      ref={parentRef}
      className="log-virtualized-container"
      style={{
        height: 'calc(100vh - 250px)',
        minHeight: '400px',
        overflow: 'auto',
        contain: 'strict',
        position: 'relative',
        backgroundColor: `var(--code-bg, ${isDarkMode ? '#1a1a1a' : '#f5f5f5'})`,
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Line numbers column */}
        <div
          className="line-numbers-column"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '55px',
            height: `${virtualizer.getTotalSize()}px`,
            backgroundColor: isDarkMode ? '#2d2d2d' : '#e8e8e8',
            borderRight: `1px solid ${isDarkMode ? '#6e6e6e' : '#ccc'}`,
            zIndex: 2,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const lineNumber = virtualRow.index + 1;
            const isSelected = selectedLine === lineNumber;

            return (
              <div
                key={virtualRow.key}
                id={`L${lineNumber}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '8px',
                  cursor: 'pointer',
                  color: isSelected ? (isDarkMode ? '#fff' : '#000') : isDarkMode ? '#999' : '#666',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  backgroundColor: isSelected
                    ? isDarkMode
                      ? 'rgba(255, 255, 0, 0.3)'
                      : 'rgba(255, 255, 0, 0.2)'
                    : 'transparent',
                  fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  boxSizing: 'border-box',
                  userSelect: 'none',
                }}
                onClick={() => handleLineClick(lineNumber)}
              >
                {lineNumber}
              </div>
            );
          })}
        </div>

        {/* Log content column */}
        <div
          className="log-content-column"
          style={{
            position: 'absolute',
            top: 0,
            left: '65px',
            right: 0,
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const lineNumber = virtualRow.index + 1;
            const isSelected = selectedLine === lineNumber;

            return (
              <div
                key={virtualRow.key}
                data-line={lineNumber}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  backgroundColor: isSelected
                    ? isDarkMode
                      ? 'rgba(255, 255, 0, 0.15)'
                      : 'rgba(255, 255, 0, 0.3)'
                    : 'transparent',
                  fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre',
                  color: isDarkMode ? '#ccc' : '#333',
                  paddingLeft: '10px',
                  boxSizing: 'border-box',
                }}
              >
                {getLineContent(virtualRow.index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VirtualizedLogContent;
