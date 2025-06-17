import React, { useState } from 'react';
import { formatHiveCommand, copyToClipboard } from '../utils/metadata';

interface CommandDisplayProps {
  command: string[];
  className?: string;
}

const CommandDisplay: React.FC<CommandDisplayProps> = ({ command, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const formattedCommand = formatHiveCommand(command);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const success = await copyToClipboard(formattedCommand);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        backgroundColor: 'var(--stat-bg, #f9fafb)',
        border: '1px solid var(--border-color, rgba(229, 231, 235, 0.4))',
        borderRadius: '0.375rem',
        padding: '0.75rem',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: '0.875rem',
        lineHeight: '1.5',
        overflow: 'auto'
      }}
    >
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
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
          transition: 'all 0.2s ease',
          fontFamily: 'inherit'
        }}
        onMouseOver={(e) => {
          if (!copied) {
            e.currentTarget.style.backgroundColor = 'var(--badge-bg, #f3f4f6)';
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
      
      <pre
        style={{
          margin: 0,
          padding: 0,
          paddingRight: '5rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: 'var(--text-primary, #111827)',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          fontFamily: 'inherit'
        }}
      >
        {formattedCommand}
      </pre>
    </div>
  );
};

export default CommandDisplay;