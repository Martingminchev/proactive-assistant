import React, { useEffect, useState } from 'react';

interface CurrentStatusProps {
  fileName: string | null;
  duration: number; // in seconds
  isWatching: boolean;
}

export const CurrentStatus: React.FC<CurrentStatusProps> = ({
  fileName,
  duration,
  isWatching,
}) => {
  const [displayDuration, setDisplayDuration] = useState(duration);

  // Update duration every second
  useEffect(() => {
    setDisplayDuration(duration);
    
    if (!isWatching) return;

    const interval = setInterval(() => {
      setDisplayDuration(d => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [duration, isWatching]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <section className="current-status" aria-label="Current Status">
      <div className={`status-indicator ${isWatching ? 'active' : 'idle'}`}>
        <div className="status-pulse" />
        <span className="status-text">
          {isWatching ? 'Watching' : 'Idle'}
        </span>
      </div>

      <div className="status-details">
        {fileName ? (
          <>
            <div className="status-file">
              <i className="codicon codicon-file-code" aria-hidden="true" />
              <span className="file-name" title={fileName}>
                {fileName}
              </span>
            </div>
            <div className="status-duration">
              <i className="codicon codicon-clock" aria-hidden="true" />
              <span>{formatDuration(displayDuration)}</span>
            </div>
          </>
        ) : (
          <span className="no-file">No file being watched</span>
        )}
      </div>
    </section>
  );
};

export default CurrentStatus;
