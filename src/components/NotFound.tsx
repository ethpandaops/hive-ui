import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/useTheme';
import Header from './Header';
import Footer from './Footer';
import { useState } from 'react';

const NotFound = () => {
  const { isDarkMode } = useTheme();
  const [showTables, setShowTables] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Main container style
  const containerStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', // Dark blue or light background
    color: isDarkMode ? '#f8fafc' : '#1e293b', // Light or dark text
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  };

  // Content style
  const contentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    textAlign: 'center'
  };

  // Card style
  const cardStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderRadius: '0.75rem',
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
    padding: '2.5rem',
    maxWidth: '32rem',
    width: '100%',
    boxShadow: isDarkMode ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    marginTop: '1rem'
  };

  // Button style
  const buttonStyle: React.CSSProperties = {
    backgroundColor: isHovered ? '#2563eb' : '#3b82f6',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.375rem',
    fontWeight: '500',
    textDecoration: 'none',
    display: 'inline-block',
    marginTop: '1.5rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  };

  return (
    <div style={containerStyle}>
      <Header showTables={showTables} setShowTables={setShowTables} />

      <div style={contentStyle}>
        <div style={cardStyle}>
          <div style={{ marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke={isDarkMode ? '#f87171' : '#ef4444'} style={{ width: '5rem', height: '5rem', margin: '0 auto' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '1rem', color: isDarkMode ? '#f8fafc' : '#1e293b' }}>
            404 - Page Not Found
          </h1>

          <p style={{ fontSize: '1rem', color: isDarkMode ? '#cbd5e1' : '#475569', marginBottom: '1.5rem' }}>
            The page you're looking for doesn't exist or has been moved.
          </p>

          <Link
            to="/"
            style={buttonStyle}
            onMouseOver={() => setIsHovered(true)}
            onMouseOut={() => setIsHovered(false)}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default NotFound;
