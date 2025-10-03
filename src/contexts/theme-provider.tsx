import { useState, useEffect, ReactNode } from 'react';
import { ThemeContext, ThemeMode } from './themeContext';

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedMode = localStorage.getItem('themeMode');
    return (savedMode as ThemeMode) || 'system';
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);

    // Determine if dark mode should be active
    const determineIsDarkMode = () => {
      if (themeMode === 'dark') return true;
      if (themeMode === 'light') return false;
      // System preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    };

    setIsDarkMode(determineIsDarkMode());

    // Listen for system preference changes if in system mode
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setIsDarkMode(e.matches);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  // Set CSS variables based on theme
  useEffect(() => {
    const root = document.documentElement;

    if (isDarkMode) {
      // Dark theme colors (matching hive.ethpandaops.io)
      root.style.setProperty('--bg-color', '#0f172a'); // Darker background
      root.style.setProperty('--card-bg', '#1a2332'); // Card background - more matte
      root.style.setProperty('--text-primary', '#f8fafc'); // Main text
      root.style.setProperty('--text-secondary', '#94a3b8'); // Secondary text
      root.style.setProperty('--border-color', 'rgba(71, 85, 105, 0.5)'); // Border
      root.style.setProperty('--header-bg', 'linear-gradient(to right, #0f172a, #1e293b)');
      root.style.setProperty('--summary-bg', 'rgba(30, 41, 59, 0.5)');
      root.style.setProperty('--badge-bg', '#2a3441');
      root.style.setProperty('--table-header-bg', '#2a3441');
      root.style.setProperty('--stat-bg', '#2a3441');
      root.style.setProperty('--row-hover-bg', '#2a3441');

      // Status colors for dark theme
      root.style.setProperty('--success-bg', 'rgba(20, 83, 45, 0.2)');
      root.style.setProperty('--success-text', '#4ade80');
      root.style.setProperty('--success-border', '#22c55e');

      root.style.setProperty('--warning-bg', 'rgba(113, 63, 18, 0.2)');
      root.style.setProperty('--warning-text', '#fbbf24');
      root.style.setProperty('--warning-border', '#f59e0b');

      root.style.setProperty('--error-bg', 'rgba(127, 29, 29, 0.2)');
      root.style.setProperty('--error-text', '#f87171');
      root.style.setProperty('--error-border', '#ef4444');
    } else {
      // Light theme colors
      root.style.setProperty('--bg-color', '#f1f5f9');
      root.style.setProperty('--card-bg', '#f8f9fa');
      root.style.setProperty('--text-primary', '#0f172a');
      root.style.setProperty('--text-secondary', '#64748b');
      root.style.setProperty('--border-color', 'rgba(226, 232, 240, 0.8)');
      root.style.setProperty('--header-bg', 'linear-gradient(to right, #f8fafc, #ffffff)');
      root.style.setProperty('--summary-bg', 'rgba(248, 250, 252, 0.5)');
      root.style.setProperty('--badge-bg', '#f1f5f9');
      root.style.setProperty('--table-header-bg', '#f1f3f5');
      root.style.setProperty('--stat-bg', '#f1f3f5');
      root.style.setProperty('--row-hover-bg', '#e9ecef');

      // Status colors for light theme
      root.style.setProperty('--success-bg', '#f0fdf4');
      root.style.setProperty('--success-text', '#16a34a');
      root.style.setProperty('--success-border', '#22c55e');

      root.style.setProperty('--warning-bg', '#fefce8');
      root.style.setProperty('--warning-text', '#ca8a04');
      root.style.setProperty('--warning-border', '#eab308');

      root.style.setProperty('--error-bg', '#fef2f2');
      root.style.setProperty('--error-text', '#dc2626');
      root.style.setProperty('--error-border', '#ef4444');
    }
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, isDarkMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
