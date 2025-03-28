import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/useTheme';

export type BreadcrumbItem = {
  label: string;
  link?: string;
  sublabel?: string;
};

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  const { isDarkMode } = useTheme();

  const breadcrumbStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.875rem',
    margin: '1.5rem 0',
    color: isDarkMode ? '#94a3b8' : '#64748b'
  };

  const breadcrumbLinkStyle: React.CSSProperties = {
    color: '#6366f1',
    textDecoration: 'none',
    fontWeight: '500',
    transition: 'color 0.2s ease'
  };

  const breadcrumbSeparatorStyle: React.CSSProperties = {
    margin: '0 0.5rem',
    color: isDarkMode ? '#475569' : '#cbd5e1'
  };

  return (
    <div style={breadcrumbStyle}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span style={breadcrumbSeparatorStyle}>/</span>}
          {item.link ? (
            <Link to={item.link} style={breadcrumbLinkStyle}>
              {item.label}
            </Link>
          ) : (
            <span>
              {item.label}
              {item.sublabel && (
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  {' '}({item.sublabel})
                </span>
              )}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default Breadcrumb;
