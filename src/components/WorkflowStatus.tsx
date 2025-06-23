import { useQuery } from '@tanstack/react-query';
import { fetchAllRunningWorkflows, fetchMostRecentWorkflowRun, GitHubRateLimitError } from '../services/github';
import { GitHubWorkflowRun, GitHubJob, GitHubJobStep } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../contexts/useTheme';
import { useState } from 'react';

interface WorkflowStatusProps {
  workflowUrls?: string[];
  groupName: string;
}

// Helper function to get job sort priority (lower number = higher priority)
const getJobSortPriority = (job: GitHubJob): number => {
  if (job.status === 'in_progress') return 1;
  if (job.status === 'queued') return 2;
  if (job.status === 'completed' && job.conclusion === 'cancelled') return 3;
  if (job.status === 'completed' && job.conclusion === 'failure') return 4;
  if (job.status === 'completed') return 5;
  return 6; // fallback for any other status
};

// Helper function to format duration in human-readable format
const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    let result = `${hours}h`;
    if (minutes > 0) result += ` ${minutes}m`;
    if (remainingSeconds > 0) result += ` ${remainingSeconds}s`;
    return result;
  }
};

// Helper function to get workflow run status icon
const getWorkflowStatusIcon = (run: GitHubWorkflowRun) => {
  if (run.status === 'queued') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#94a3b8" strokeWidth="2" fill="none" />
      </svg>
    );
  } else if (run.status === 'in_progress') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path 
          d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.5 7.5h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3a.5.5 0 0 1 1 0v3h3a.5.5 0 0 1 0 1z" 
          fill="#f59e0b"
        />
      </svg>
    );
  } else if (run.status === 'completed') {
    if (run.conclusion === 'success') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#10b981" />
          <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    } else if (run.conclusion === 'failure') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#ef4444" />
          <path d="M5 5l6 6M11 5l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    } else if (run.conclusion === 'cancelled') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#6b7280" />
          <rect x="5" y="5" width="6" height="6" fill="white" />
        </svg>
      );
    }
  }
  return null;
};

// Helper function to get job status icon
const getJobStatusIcon = (job: GitHubJob) => {
  if (job.status === 'queued') {
    return (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#94a3b8" strokeWidth="2" fill="none" />
      </svg>
    );
  } else if (job.status === 'in_progress') {
    return (
      <div style={{
        border: `2px solid rgba(251, 146, 60, 0.3)`,
        borderTopColor: '#fb923c',
        borderRadius: '50%',
        width: '12px',
        height: '12px',
        animation: 'spin 1s linear infinite'
      }}></div>
    );
  } else if (job.status === 'completed') {
    if (job.conclusion === 'success') {
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#10b981" />
          <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    } else if (job.conclusion === 'failure') {
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#ef4444" />
          <path d="M5 5l6 6M11 5l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    } else if (job.conclusion === 'cancelled') {
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#6b7280" />
          <rect x="5" y="5" width="6" height="6" fill="white" />
        </svg>
      );
    }
  }
  return null;
};

// Helper function to get step status icon
const getStepStatusIcon = (step: GitHubJobStep) => {
  if (step.status === 'queued') {
    return (
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#94a3b8" strokeWidth="2" fill="none" />
      </svg>
    );
  } else if (step.status === 'in_progress') {
    return (
      <div style={{
        border: `2px solid rgba(251, 146, 60, 0.3)`,
        borderTopColor: '#fb923c',
        borderRadius: '50%',
        width: '10px',
        height: '10px',
        animation: 'spin 1s linear infinite'
      }}></div>
    );
  } else if (step.status === 'completed') {
    if (step.conclusion === 'success') {
      return (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#10b981" />
          <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    } else if (step.conclusion === 'failure') {
      return (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#ef4444" />
          <path d="M5 5l6 6M11 5l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    } else if (step.conclusion === 'cancelled') {
      return (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#6b7280" />
          <rect x="5" y="5" width="6" height="6" fill="white" />
        </svg>
      );
    } else if (step.conclusion === 'skipped') {
      return (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#94a3b8" />
          <path d="M6 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
  }
  return null;
};

const WorkflowStatus: React.FC<WorkflowStatusProps> = ({ workflowUrls, groupName }) => {
  const { isDarkMode } = useTheme();
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());

  const { data: runningWorkflows = [], isLoading, error: runningError } = useQuery<GitHubWorkflowRun[]>({
    queryKey: ['workflows', groupName],
    queryFn: () => fetchAllRunningWorkflows(workflowUrls || []),
    enabled: !!workflowUrls && workflowUrls.length > 0,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
    retry: (failureCount, error) => {
      // Don't retry if it's a rate limit error
      if (error instanceof GitHubRateLimitError) return false;
      return failureCount < 3;
    }
  });

  const { data: mostRecentRun, error: recentError } = useQuery<GitHubWorkflowRun | null>({
    queryKey: ['mostRecentWorkflow', groupName],
    queryFn: () => fetchMostRecentWorkflowRun(workflowUrls || []),
    enabled: !!workflowUrls && workflowUrls.length > 0 && runningWorkflows.length === 0,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 50000, // Consider data stale after 50 seconds
    retry: (failureCount, error) => {
      // Don't retry if it's a rate limit error
      if (error instanceof GitHubRateLimitError) return false;
      return failureCount < 3;
    }
  });

  if (!workflowUrls || workflowUrls.length === 0) {
    return null;
  }

  // Check for rate limit errors first, before checking loading state
  const error = runningError || recentError;
  if (error instanceof GitHubRateLimitError) {
    return (
      <div style={{
        padding: '0.75rem 1.25rem',
        borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ 
            width: '1.25rem', 
            height: '1.25rem',
            color: '#ef4444'
          }}>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span style={{ 
            fontSize: '0.875rem', 
            fontWeight: '600',
            color: isDarkMode ? '#f87171' : '#dc2626' 
          }}>
            GitHub API Rate Limit Exceeded
          </span>
        </div>
        <p style={{
          fontSize: '0.8125rem',
          color: isDarkMode ? '#94a3b8' : '#64748b',
          margin: 0,
          lineHeight: '1.4'
        }}>
          Unable to fetch workflow status. Please add a GitHub personal access token in the settings menu to increase your API rate limit.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{
        padding: '0.75rem 1.25rem',
        borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <div style={{
          border: `2px solid ${isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          width: '1rem',
          height: '1rem',
          animation: 'spin 1s linear infinite'
        }}></div>
        <span style={{ fontSize: '0.875rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
          Checking workflow status...
        </span>
      </div>
    );
  }

  if (runningWorkflows.length === 0 && !mostRecentRun) {
    return null;
  }

  // Display either running workflows or the most recent run
  const workflowsToDisplay = runningWorkflows.length > 0 ? runningWorkflows : (mostRecentRun ? [mostRecentRun] : []);
  const isShowingActive = runningWorkflows.length > 0;

  return (
    <div style={{
      padding: '0.75rem 1.25rem',
      borderBottom: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.5rem'
      }}>
        {isShowingActive ? (
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#f59e0b',
            animation: 'pulse 2s infinite'
          }}></div>
        ) : (
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#6b7280'
          }}></div>
        )}
        <h4 style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          color: isDarkMode ? '#f8fafc' : '#1e293b',
          margin: 0
        }}>
          {isShowingActive ? `Active CI Jobs (${runningWorkflows.length})` : 'Most Recent CI Run'}
        </h4>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        {workflowsToDisplay.map((run) => {
          const isExpanded = expandedRuns.has(run.id);
          const runningJobs = run.jobs?.filter(job => job.status === 'in_progress' || job.status === 'queued') || [];
          const completedJobs = run.jobs?.filter(job => job.status === 'completed') || [];
          const failedJobs = completedJobs.filter(job => job.conclusion === 'failure');
          
          return (
            <div key={run.id} style={{
              backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.8)',
              borderRadius: '0.375rem',
              border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
              overflow: 'hidden'
            }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onClick={() => {
                  const newExpanded = new Set(expandedRuns);
                  if (isExpanded) {
                    newExpanded.delete(run.id);
                  } else {
                    newExpanded.add(run.id);
                  }
                  setExpandedRuns(newExpanded);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode 
                    ? 'rgba(51, 65, 85, 0.5)' 
                    : 'rgba(243, 244, 246, 1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {getWorkflowStatusIcon(run)}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <a
                        href={run.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: isDarkMode ? '#f8fafc' : '#1e293b',
                          textDecoration: 'none'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {run.name} #{run.run_number}
                      </a>
                      {run.jobs && (
                        <div style={{
                          display: 'flex',
                          gap: '0.25rem',
                          fontSize: '0.75rem'
                        }}>
                          {runningJobs.length > 0 && (
                            <span style={{
                              padding: '0.125rem 0.375rem',
                              borderRadius: '0.25rem',
                              backgroundColor: isDarkMode ? 'rgba(251, 146, 60, 0.2)' : 'rgba(251, 146, 60, 0.1)',
                              color: '#fb923c',
                              border: '1px solid rgba(251, 146, 60, 0.3)'
                            }}>
                              {runningJobs.length} running
                            </span>
                          )}
                          {failedJobs.length > 0 && (
                            <span style={{
                              padding: '0.125rem 0.375rem',
                              borderRadius: '0.25rem',
                              backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}>
                              {failedJobs.length} failed
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: isDarkMode ? '#94a3b8' : '#64748b'
                    }}>
                      Started {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 16 16" 
                  fill="none"
                  style={{
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <path 
                    d="M6 3l5 5-5 5" 
                    stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              
              {isExpanded && run.jobs && run.jobs.length > 0 && (
                <div style={{
                  padding: '0.5rem',
                  borderTop: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
                  backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.3)' : 'rgba(249, 250, 251, 0.5)'
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: isDarkMode ? '#cbd5e1' : '#475569',
                    marginBottom: '0.5rem'
                  }}>
                    Jobs ({run.jobs.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {run.jobs
                      .sort((a, b) => getJobSortPriority(a) - getJobSortPriority(b))
                      .map((job) => {
                      const isJobExpanded = expandedJobs.has(job.id);
                      const hasSteps = job.steps && job.steps.length > 0;
                      
                      return (
                        <div key={job.id} style={{
                          backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.8)',
                          borderRadius: '0.25rem',
                          border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(229, 231, 235, 0.6)'}`,
                          overflow: 'hidden'
                        }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.375rem 0.5rem',
                              fontSize: '0.75rem',
                              cursor: hasSteps ? 'pointer' : 'default',
                              transition: 'background-color 0.2s'
                            }}
                            onClick={() => {
                              if (hasSteps) {
                                const newExpanded = new Set(expandedJobs);
                                if (isJobExpanded) {
                                  newExpanded.delete(job.id);
                                } else {
                                  newExpanded.add(job.id);
                                }
                                setExpandedJobs(newExpanded);
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (hasSteps) {
                                e.currentTarget.style.backgroundColor = isDarkMode 
                                  ? 'rgba(51, 65, 85, 0.8)' 
                                  : 'rgba(255, 255, 255, 1)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              {getJobStatusIcon(job)}
                              <a
                                href={job.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: isDarkMode ? '#e2e8f0' : '#334155',
                                  textDecoration: 'none'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {job.name}
                              </a>
                              {hasSteps && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  color: isDarkMode ? '#64748b' : '#94a3b8',
                                  marginLeft: '0.25rem'
                                }}>
                                  ({job.steps?.length || 0} steps)
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {job.started_at && (
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  color: isDarkMode ? '#94a3b8' : '#64748b' 
                                }}>
                                  {formatDistanceToNow(new Date(job.started_at), { addSuffix: true })}
                                </span>
                              )}
                              {hasSteps && (
                                <svg 
                                  width="12" 
                                  height="12" 
                                  viewBox="0 0 16 16" 
                                  fill="none"
                                  style={{
                                    transform: isJobExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease'
                                  }}
                                >
                                  <path 
                                    d="M6 3l5 5-5 5" 
                                    stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                          
                          {isJobExpanded && hasSteps && (
                            <div style={{
                              padding: '0.5rem',
                              borderTop: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(229, 231, 235, 0.6)'}`,
                              backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.2)' : 'rgba(249, 250, 251, 0.3)'
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {job.steps!.map((step) => (
                                  <div
                                    key={step.number}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.25rem 0.375rem',
                                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.3)' : 'rgba(255, 255, 255, 0.6)',
                                      borderRadius: '0.2rem',
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                      {getStepStatusIcon(step)}
                                      <span style={{
                                        color: isDarkMode ? '#cbd5e1' : '#475569',
                                        fontFamily: 'monospace'
                                      }}>
                                        {step.number}. {step.name}
                                      </span>
                                    </div>
                                    {step.started_at && step.completed_at && (
                                      <span style={{
                                        fontSize: '0.65rem',
                                        color: isDarkMode ? '#64748b' : '#94a3b8',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {formatDuration(Math.round((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000))}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default WorkflowStatus;