import React, { useEffect, useState } from 'react';
import type { CurrentStatus as CurrentStatusType, FlowState, FlowStateInfo } from '../types';
import { useTheme } from '../hooks/useTheme';

interface CurrentStatusProps {
  status: CurrentStatusType | null;
}

const flowStateConfig: Record<FlowState, FlowStateInfo> = {
  deep: {
    state: 'deep',
    label: 'Deep Focus',
    color: '#89d185',
    description: 'In the zone - minimal interruptions'
  },
  focused: {
    state: 'focused',
    label: 'Focused',
    color: '#75beff',
    description: 'Actively working - important suggestions only'
  },
  scattered: {
    state: 'scattered',
    label: 'Exploring',
    color: '#cca700',
    description: 'Context switching - helpful tips welcome'
  },
  idle: {
    state: 'idle',
    label: 'Idle',
    color: '#808080',
    description: 'Taking a break'
  }
};

// Format duration from seconds to human readable
const formatDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0s';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export const CurrentStatus: React.FC<CurrentStatusProps> = ({ status }) => {
  useTheme();
  const [displayDuration, setDisplayDuration] = useState(0);

  // Update duration counter
  useEffect(() => {
    if (!status) return;
    
    setDisplayDuration(status.activityDuration);
    
    const interval = setInterval(() => {
      setDisplayDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status?.activityDuration, status?.lastActivityAt]);

  if (!status) {
    return (
      <section className="current-status loading" aria-label="Loading status">
        <div className="status-placeholder">
          <div className="pulse-dot" />
          <span>Connecting...</span>
        </div>
      </section>
    );
  }

  const flowConfig = flowStateConfig[status.flowState] ?? flowStateConfig.idle;
  const fileName = status.watchedFile 
    ? status.watchedFile.split(/[/\\]/).pop() 
    : null;

  return (
    <section className="current-status" aria-label="Current status">
      <div className="status-grid">
        {/* Watched file */}
        <div className="status-item file-status">
          <span className="status-label">Current File</span>
          <div className="status-value" title={status.watchedFile || 'None'}>
            {status.watchedFile ? (
              <>
                <span className="file-icon" aria-hidden="true">📄</span>
                <code className="file-name">{fileName}</code>
              </>
            ) : (
              <span className="empty-value">No file</span>
            )}
          </div>
        </div>

        {/* Activity duration */}
        <div className="status-item duration-status">
          <span className="status-label">Activity</span>
          <div className="status-value">
            <span className="duration-icon" aria-hidden="true">⏱️</span>
            <time className="duration-time">{formatDuration(displayDuration)}</time>
          </div>
        </div>

        {/* Flow state */}
        <div className="status-item flow-status">
          <span className="status-label">Flow State</span>
          <div className="status-value">
            <span 
              className="flow-indicator"
              style={{ backgroundColor: flowConfig.color }}
              aria-hidden="true"
            />
            <span className="flow-label" style={{ color: flowConfig.color }}>
              {flowConfig.label}
            </span>
          </div>
          <span className="flow-description">{flowConfig.description}</span>
        </div>

        {/* Pieces OS connection */}
        <div className="status-item connection-status">
          <span className="status-label">Pieces OS</span>
          <div className="status-value">
            <span 
              className={`connection-dot ${status.isPiecesConnected ? 'connected' : 'disconnected'}`}
              aria-hidden="true"
            />
            <span className={status.isPiecesConnected ? 'connected-text' : 'disconnected-text'}>
              {status.isPiecesConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CurrentStatus;
