import React, { useState } from 'react';
import { useTheme } from '../contexts/useTheme';
import { ThemeMode } from '../contexts/themeContext';
import { Link } from 'react-router-dom';



const Header: React.FC = () => {
  const { themeMode, isDarkMode, setThemeMode } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [githubToken, setGithubToken] = useState(() => {
    return localStorage.getItem('githubApiToken') || '';
  });
  const [showToken, setShowToken] = useState(false);

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const handleSetThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const handleGithubTokenChange = (token: string) => {
    setGithubToken(token);
    if (token) {
      localStorage.setItem('githubApiToken', token);
    } else {
      localStorage.removeItem('githubApiToken');
    }
  };


  return (
    <header style={{
      backgroundColor: isDarkMode ? '#0f172a' : 'white',
      borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: isDarkMode
        ? '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)'
        : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      width: '100%',
      //overflowX: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        {/* Logo and Navigation */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{
            textDecoration: 'none',
            marginRight: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            color: '#3b82f6',

          }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                borderRadius: '0.5rem',
                padding: '0.25rem',
                marginRight: '0.75rem',
                width: '3.5rem',
                height: '3.5rem',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                const glanceElement = e.currentTarget.querySelector('.glance-effect') as HTMLElement;
                if (glanceElement) {
                  glanceElement.style.left = '100%';
                }
              }}
              onMouseOut={(e) => {
                const glanceElement = e.currentTarget.querySelector('.glance-effect') as HTMLElement;
                if (glanceElement) {
                  glanceElement.style.left = '-100%';
                }
              }}
            >
              <div
                className="glance-effect"
                style={{
                  position: 'absolute',
                  top: '-50%',
                  left: '-100%',
                  width: '50%',
                  height: '200%',
                  background: isDarkMode
                    ? 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)'
                    : 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%)',
                  transform: 'rotate(25deg)',
                  transition: 'left 0.8s ease-in-out',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}
              />
              <img
                src="/img/hive-logo.png"
                alt="Hive Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  position: 'relative',
                  zIndex: 1,
                  filter: isDarkMode
                    ? 'invert(1) brightness(1.1) contrast(1.05) drop-shadow(0 0 0px rgba(185, 185, 185, 0.79))'
                    : 'contrast(0.85) drop-shadow(0 0 5px rgb(246, 246, 246)) drop-shadow(0 0 8px rgb(255, 255, 255))',
                  transition: 'filter 0.3s ease'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontWeight: 700,
                fontSize: '1.25rem',
                color: isDarkMode ? '#f8fafc' : '#0f172a',
                letterSpacing: '0.018em'
              }}>
                Ethereum Hive
              </span>
              <span style={{
                fontSize: '0.75rem',
                color: isDarkMode ? '#94a3b8' : '#64748b',
                fontWeight: 500,
                letterSpacing: '0.15em'
              }}>
                Integration Testing
              </span>
            </div>
          </Link>

          <nav>
            <ul style={{ display: 'flex', gap: '1.5rem', padding: 0, margin: 0, listStyle: 'none' }}>
            </ul>
          </nav>
        </div>

        {/* Settings Menu Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={toggleSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem',
              color: isDarkMode ? '#94a3b8' : '#64748b',
              backgroundColor: isDarkMode ? '#1e293b' : 'white',
              borderRadius: '0.5rem',
              border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
              cursor: 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#334155' : '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#1e293b' : 'white'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                 style={{ width: '1.25rem', height: '1.25rem' }}>
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.455l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>

          {isSettingsOpen && (
            <div
              style={{
                position: 'absolute',
                right: 'auto',
                left: '-2rem',
                transform: 'translateX(-50%)',
                top: 'calc(100% + 0.5rem)',
                width: '16rem',
                maxWidth: 'calc(100vw - 2rem)',
                borderRadius: '0.5rem',
                boxShadow: isDarkMode
                  ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)'
                  : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                backgroundColor: isDarkMode ? '#1e293b' : 'white',
                border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
                zIndex: 10,
                padding: '0.75rem',
                overflowX: 'hidden',
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 6rem)'
              }}
            >
              {/* Settings Menu Header */}
              <div style={{
                borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
                paddingBottom: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: isDarkMode ? '#f8fafc' : '#0f172a',
                  marginBottom: '0.5rem',
                  margin: 0
                }}>
                  Display Settings
                </h3>
              </div>

              {/* Theme Selection */}
              <div style={{
                marginBottom: '0.25rem',
                paddingBottom: '0.25rem',
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  color: isDarkMode ? '#f8fafc' : '#0f172a',
                  fontWeight: 500,
                  marginBottom: '0.5rem'
                }}>
                  Theme
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                }}>
                  <button
                    onClick={() => handleSetThemeMode('light')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.5rem 0',
                      backgroundColor: themeMode === 'light'
                        ? (isDarkMode ? '#334155' : '#f1f5f9')
                        : 'transparent',
                      borderRadius: '0.375rem',
                      border: `1px solid ${themeMode === 'light'
                        ? (isDarkMode ? '#475569' : '#cbd5e1')
                        : 'transparent'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                        style={{
                          width: '1.25rem',
                          height: '1.25rem',
                          color: isDarkMode ? '#94a3b8' : '#64748b',
                          marginBottom: '0.25rem'
                        }}>
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                    <span style={{
                      fontSize: '0.75rem',
                      color: isDarkMode ? '#94a3b8' : '#64748b',
                      fontWeight: themeMode === 'light' ? 500 : 400,
                    }}>
                      Light
                    </span>
                  </button>

                  <button
                    onClick={() => handleSetThemeMode('dark')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.5rem 0',
                      backgroundColor: themeMode === 'dark'
                        ? (isDarkMode ? '#334155' : '#f1f5f9')
                        : 'transparent',
                      borderRadius: '0.375rem',
                      border: `1px solid ${themeMode === 'dark'
                        ? (isDarkMode ? '#475569' : '#cbd5e1')
                        : 'transparent'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                        style={{
                          width: '1.25rem',
                          height: '1.25rem',
                          color: isDarkMode ? '#94a3b8' : '#64748b',
                          marginBottom: '0.25rem'
                        }}>
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                    <span style={{
                      fontSize: '0.75rem',
                      color: isDarkMode ? '#94a3b8' : '#64748b',
                      fontWeight: themeMode === 'dark' ? 500 : 400,
                    }}>
                      Dark
                    </span>
                  </button>

                  <button
                    onClick={() => handleSetThemeMode('system')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.5rem 0',
                      backgroundColor: themeMode === 'system'
                        ? (isDarkMode ? '#334155' : '#f1f5f9')
                        : 'transparent',
                      borderRadius: '0.375rem',
                      border: `1px solid ${themeMode === 'system'
                        ? (isDarkMode ? '#475569' : '#cbd5e1')
                        : 'transparent'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                        style={{
                          width: '1.25rem',
                          height: '1.25rem',
                          color: isDarkMode ? '#94a3b8' : '#64748b',
                          marginBottom: '0.25rem'
                        }}>
                      <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
                    </svg>
                    <span style={{
                      fontSize: '0.75rem',
                      color: isDarkMode ? '#94a3b8' : '#64748b',
                      fontWeight: themeMode === 'system' ? 500 : 400,
                    }}>
                      System
                    </span>
                  </button>
                </div>
              </div>

              {/* GitHub API Token */}
              <div style={{
                marginTop: '1rem',
                borderTop: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
                paddingTop: '0.75rem'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  color: isDarkMode ? '#f8fafc' : '#0f172a',
                  fontWeight: 500,
                  marginBottom: '0.5rem'
                }}>
                  GitHub API Token
                </div>

                <div style={{
                  fontSize: '0.75rem',
                  color: isDarkMode ? '#94a3b8' : '#64748b',
                  marginBottom: '0.5rem',
                  lineHeight: '1.4'
                }}>
                  Add a personal access token to avoid rate limiting (60 requests/hour without token).
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={githubToken}
                    onChange={(e) => handleGithubTokenChange(e.target.value)}
                    placeholder="ghp_..."
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      fontSize: '0.875rem',
                      color: isDarkMode ? '#f8fafc' : '#0f172a',
                      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                      border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
                      borderRadius: '0.375rem',
                      outline: 'none',
                      fontFamily: 'monospace'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 0.8)';
                    }}
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    style={{
                      padding: '0.5rem',
                      color: isDarkMode ? '#94a3b8' : '#64748b',
                      backgroundColor: isDarkMode ? '#1e293b' : 'white',
                      borderRadius: '0.375rem',
                      border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '1rem', height: '1rem' }}>
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '1rem', height: '1rem' }}>
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>

                <div style={{
                  fontSize: '0.75rem',
                  color: isDarkMode ? '#94a3b8' : '#64748b',
                  lineHeight: '1.4'
                }}>
                  <a
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#3b82f6',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    Create a new token
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '0.75rem', height: '0.75rem' }}>
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </a>
                  {' '}(just requires "Public Repositories" read-only scope)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
