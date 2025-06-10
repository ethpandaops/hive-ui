import { useQuery } from '@tanstack/react-query';
import { fetchAllRunningWorkflows } from '../services/github';
import { GitHubWorkflowRun } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../contexts/useTheme';

interface WorkflowStatusProps {
  workflowUrls?: string[];
  groupName: string;
}

const WorkflowStatus: React.FC<WorkflowStatusProps> = ({ workflowUrls, groupName }) => {
  const { isDarkMode } = useTheme();

  const { data: runningWorkflows = [], isLoading } = useQuery<GitHubWorkflowRun[]>({
    queryKey: ['workflows', groupName],
    queryFn: () => fetchAllRunningWorkflows(workflowUrls || []),
    enabled: !!workflowUrls && workflowUrls.length > 0,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
  });

  if (!workflowUrls || workflowUrls.length === 0) {
    return null;
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

  if (runningWorkflows.length === 0) {
    return null;
  }

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
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#f59e0b',
          animation: 'pulse 2s infinite'
        }}></div>
        <h4 style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          color: isDarkMode ? '#f8fafc' : '#1e293b',
          margin: 0
        }}>
          Active CI Jobs ({runningWorkflows.length})
        </h4>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        {runningWorkflows.map((run) => (
          <a
            key={run.id}
            href={run.html_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem',
              backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.8)',
              borderRadius: '0.375rem',
              border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
              textDecoration: 'none',
              color: 'inherit',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode 
                ? 'rgba(30, 41, 59, 0.8)' 
                : 'rgba(255, 255, 255, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode 
                ? 'rgba(30, 41, 59, 0.5)' 
                : 'rgba(255, 255, 255, 0.8)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path 
                  d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.5 7.5h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3a.5.5 0 0 1 1 0v3h3a.5.5 0 0 1 0 1z" 
                  fill="#f59e0b"
                />
              </svg>
              <div>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: isDarkMode ? '#f8fafc' : '#1e293b'
                }}>
                  {run.name} #{run.run_number}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: isDarkMode ? '#94a3b8' : '#64748b'
                }}>
                  Started {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path 
                d="M6 3l5 5-5 5" 
                stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </a>
        ))}
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
      `}</style>
    </div>
  );
};

export default WorkflowStatus;