import React, { useState, useEffect } from 'react';

interface FocusToggleProps {
  isActive: boolean;
  timeRemaining?: number; // in seconds
  onToggle: (active: boolean, duration?: number) => void;
}

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export const FocusToggle: React.FC<FocusToggleProps> = ({
  isActive,
  timeRemaining,
  onToggle,
}) => {
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [displayTime, setDisplayTime] = useState(timeRemaining || 0);
  const [showDurationSelect, setShowDurationSelect] = useState(false);

  // Sync with props
  useEffect(() => {
    if (timeRemaining !== undefined) {
      setDisplayTime(timeRemaining);
    }
  }, [timeRemaining]);

  // Countdown timer
  useEffect(() => {
    if (!isActive || displayTime <= 0) return;

    const interval = setInterval(() => {
      setDisplayTime(t => {
        if (t <= 1) {
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, displayTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartFocus = () => {
    onToggle(true, selectedDuration);
    setShowDurationSelect(false);
    setDisplayTime(selectedDuration * 60);
  };

  const handleStopFocus = () => {
    onToggle(false);
  };

  return (
    <section className={`focus-toggle ${isActive ? 'active' : ''}`} aria-label="Focus Mode">
      <div className="focus-header">
        <div className="focus-title">
          <i className="codicon codicon-target" aria-hidden="true" />
          <span>Focus Mode</span>
        </div>
        
        {isActive && (
          <div className="focus-timer">
            <span className="timer-display">{formatTime(displayTime)}</span>
          </div>
        )}
      </div>

      {!isActive ? (
        <div className="focus-inactive">
          {showDurationSelect ? (
            <div className="duration-select">
              <label htmlFor="focus-duration">Select duration:</label>
              <select
                id="focus-duration"
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                aria-label="Focus mode duration"
              >
                {DURATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="focus-actions">
                <button
                  className="action-button secondary"
                  onClick={() => setShowDurationSelect(false)}
                  aria-label="Cancel focus mode"
                >
                  Cancel
                </button>
                <button
                  className="action-button primary"
                  onClick={handleStartFocus}
                  aria-label={`Start focus mode for ${selectedDuration} minutes`}
                >
                  Start Focus
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="focus-description">
                Minimize distractions and stay focused on your current task.
              </p>
              <button
                className="focus-start-button"
                onClick={() => setShowDurationSelect(true)}
                aria-label="Enable focus mode"
              >
                <i className="codicon codicon-play" aria-hidden="true" />
                <span>Start Focus Mode</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="focus-active">
          <p className="focus-message">
            You're in focus mode. Notifications are minimized.
          </p>
          <button
            className="focus-stop-button"
            onClick={handleStopFocus}
            aria-label="End focus mode"
          >
            <i className="codicon codicon-stop" aria-hidden="true" />
            <span>End Focus Mode</span>
          </button>
        </div>
      )}
    </section>
  );
};

export default FocusToggle;
