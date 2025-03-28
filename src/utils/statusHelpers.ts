import { TestRun } from '../types';

// Helper function to get status colors based on test run results
export const getStatusStyles = (run: TestRun) => {
  if (run.fails === 0) {
    return {
      bg: 'var(--success-bg, #ecfdf5)',
      text: 'var(--success-text, #047857)',
      border: 'var(--success-border, #10b981)',
      icon: '✓',
      label: 'Success',
      pattern: 'radial-gradient(circle at 100% 100%, transparent 15%, rgba(16, 185, 129, 0.05) 25%, transparent 30%), linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, var(--card-bg, #ffffff) 100%)'
    };
  } else if (run.timeout) {
    return {
      bg: 'var(--warning-bg, #fffbeb)',
      text: 'var(--warning-text, #b45309)',
      border: 'var(--warning-border, #f59e0b)',
      icon: '⏱',
      label: 'Timeout',
      pattern: 'linear-gradient(45deg, rgba(245, 158, 11, 0.05) 25%, transparent 25%, transparent 50%, rgba(245, 158, 11, 0.05) 50%, rgba(245, 158, 11, 0.05) 75%, transparent 75%, transparent) 0 0 / 8px 8px, linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, var(--card-bg, #ffffff) 100%)'
    };
  } else if (run.passes > 0 && run.passes / run.ntests > 0.5) {
    // More than 50% passed but not all
    return {
      bg: 'var(--warning-bg, #fffbeb)',
      text: 'var(--warning-text, #b45309)',
      border: 'var(--warning-border, #f59e0b)',
      icon: '⚠',
      label: 'Failed',
      pattern: 'linear-gradient(45deg, rgba(245, 158, 11, 0.05) 25%, transparent 25%, transparent 50%, rgba(245, 158, 11, 0.05) 50%, rgba(245, 158, 11, 0.05) 75%, transparent 75%, transparent) 0 0 / 8px 8px, linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, var(--card-bg, #ffffff) 100%)'
    };
  } else {
    return {
      bg: 'var(--error-bg, #fef2f2)',
      text: 'var(--error-text, #b91c1c)',
      border: 'var(--error-border, #ef4444)',
      icon: '✕',
      label: 'Error',
      pattern: 'repeating-linear-gradient(-45deg, rgba(239, 68, 68, 0.05) 0, rgba(239, 68, 68, 0.05) 2px, transparent 2px, transparent 6px), linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, var(--card-bg, #ffffff) 100%)'
    };
  }
};
