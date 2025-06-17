import React, { useState, useEffect } from 'react';
import { parseConfigContent, copyToClipboard } from '../utils/metadata';
import { usePrismTheme } from './PrismTheme';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';

interface ConfigViewerProps {
  config: unknown;
  filePath?: string;
  isDarkMode: boolean;
  className?: string;
  collapsed?: boolean;
}

const ConfigViewer: React.FC<ConfigViewerProps> = ({ 
  config, 
  filePath, 
  isDarkMode, 
  className = '',
  collapsed = false 
}) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [highlightedCode, setHighlightedCode] = useState('');
  const { codeClassName } = usePrismTheme(isDarkMode);
  
  const { isValid, formatted } = parseConfigContent(config);

  useEffect(() => {
    if (isValid && !isCollapsed) {
      const highlighted = Prism.highlight(formatted, Prism.languages.json, 'json');
      setHighlightedCode(highlighted);
    }
  }, [formatted, isValid, isCollapsed]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const success = await copyToClipboard(formatted);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={className}
      style={{
        border: '1px solid var(--border-color, rgba(229, 231, 235, 0.4))',
        borderRadius: '0.375rem',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem',
          backgroundColor: 'var(--badge-bg, #f3f4f6)',
          borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color, rgba(229, 231, 235, 0.4))'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={toggleCollapse}
            style={{
              padding: '0.25rem',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary, #6b7280)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-bg, #f3f4f6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
            <span style={{ 
              fontSize: '0.875rem', 
              fontWeight: '500',
              color: 'var(--text-primary, #111827)'
            }}>
              Client Configuration
            </span>
            {filePath && (
              <span style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-secondary, #6b7280)',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
              }}>
                {filePath}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleCopy}
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: copied ? 'var(--success-bg, #ecfdf5)' : 'var(--badge-bg, #f3f4f6)',
            color: copied ? 'var(--success-text, #047857)' : 'var(--text-secondary, #6b7280)',
            border: copied ? '1px solid var(--success-border, #10b981)' : '1px solid var(--border-color, rgba(229, 231, 235, 0.6))',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            if (!copied) {
              e.currentTarget.style.backgroundColor = 'var(--stat-bg, #f9fafb)';
            }
          }}
          onMouseOut={(e) => {
            if (!copied) {
              e.currentTarget.style.backgroundColor = 'var(--badge-bg, #f3f4f6)';
            }
          }}
        >
          {copied ? (
            <>
              <span>✓</span>
              Copied!
            </>
          ) : (
            <>
              <span>📋</span>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--stat-bg, #f9fafb)',
            maxHeight: '400px',
            overflow: 'auto'
          }}
        >
          {isValid ? (
            <pre
              className={codeClassName}
              style={{
                margin: 0,
                padding: 0,
                fontSize: '0.875rem',
                lineHeight: '1.5',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          ) : (
            <div style={{
              color: 'var(--error-text, #b91c1c)',
              fontSize: '0.875rem',
              padding: '0.5rem',
              backgroundColor: 'var(--error-bg, #fef2f2)',
              border: '1px solid var(--error-border, #ef4444)20',
              borderRadius: '0.25rem'
            }}>
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                Invalid JSON Configuration
              </div>
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {formatted}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConfigViewer;