/**
 * FocusToggle - Enable/disable interruptions
 * Toggle switch with timer option for focus sessions
 */

import { useState, useCallback, useEffect } from 'react';
import './FocusToggle.css';

/**
 * @typedef {Object} FocusToggleProps
 * @property {boolean} isActive - Whether focus mode is currently active
 * @property {(active: boolean) => void} onToggle - Called when focus mode toggles
 * @property {number} [defaultDuration] - Default focus duration in minutes (default: 25)
 * @property {number[]} [durationOptions] - Available duration options in minutes
 * @property {(minutes: number) => void} [onDurationChange] - Called when duration changes
 * @property {string} [label] - Custom label text
 * @property {'compact' | 'full'} [variant] - Visual variant
 * @property {number} [timeRemaining] - Seconds remaining in focus session (for external timer)
 */

/**
 * @param {FocusToggleProps} props
 */
function FocusToggle({
  isActive = false,
  onToggle,
  defaultDuration = 25,
  durationOptions = [15, 25, 45, 60],
  onDurationChange,
  label = 'Focus Mode',
  variant = 'full',
  timeRemaining: externalTimeRemaining
}) {
  const [selectedDuration, setSelectedDuration] = useState(defaultDuration);
  const [internalTimeRemaining, setInternalTimeRemaining] = useState(0);
  
  // Use external timer if provided, otherwise use internal
  const timeRemaining = externalTimeRemaining !== undefined 
    ? externalTimeRemaining 
    : internalTimeRemaining;

  // Internal timer effect
  useEffect(() => {
    if (!isActive || externalTimeRemaining !== undefined) return;

    setInternalTimeRemaining(selectedDuration * 60);
    
    const interval = setInterval(() => {
      setInternalTimeRemaining(prev => {
        if (prev <= 1) {
          onToggle(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, selectedDuration, externalTimeRemaining, onToggle]);

  // Format remaining time
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle duration selection
  const handleDurationSelect = (duration) => {
    setSelectedDuration(duration);
    onDurationChange?.(duration);
    if (isActive) {
      setInternalTimeRemaining(duration * 60);
    }
  };

  // Handle toggle
  const handleToggle = () => {
    onToggle(!isActive);
  };

  // Compact variant
  if (variant === 'compact') {
    return (
      <button
        className={`focus-toggle focus-toggle--compact ${isActive ? 'active' : ''}`}
        onClick={handleToggle}
        aria-pressed={isActive}
      >
        <span className="focus-toggle__icon">{isActive ? '🎯' : '○'}</span>
        <span className="focus-toggle__text">
          {isActive && timeRemaining > 0 
            ? formatTime(timeRemaining) 
            : 'Focus'}
        </span>
      </button>
    );
  }

  return (
    <div className={`focus-toggle ${isActive ? 'active' : ''}`}>
      {/* Main toggle row */}
      <div className="focus-toggle__main">
        <div className="focus-toggle__info">
          <span className="focus-toggle__icon">{isActive ? '🎯' : '○'}</span>
          <div className="focus-toggle__labels">
            <span className="focus-toggle__label">{label}</span>
            {isActive && timeRemaining > 0 && (
              <span className="focus-toggle__timer">
                {formatTime(timeRemaining)} remaining
              </span>
            )}
            {!isActive && (
              <span className="focus-toggle__sublabel">
                Pause suggestions
              </span>
            )}
          </div>
        </div>
        
        <button
          className={`focus-toggle__switch ${isActive ? 'active' : ''}`}
          onClick={handleToggle}
          aria-pressed={isActive}
          aria-label={isActive ? 'Disable focus mode' : 'Enable focus mode'}
        >
          <span className="focus-toggle__thumb" />
        </button>
      </div>

      {/* Duration selector (only when not active) */}
      {!isActive && (
        <div className="focus-toggle__durations">
          <span className="focus-toggle__duration-label">Duration:</span>
          <div className="focus-toggle__duration-options">
            {durationOptions.map((duration) => (
              <button
                key={duration}
                className={`focus-toggle__duration-btn ${
                  selectedDuration === duration ? 'selected' : ''
                }`}
                onClick={() => handleDurationSelect(duration)}
                aria-pressed={selectedDuration === duration}
              >
                {duration}m
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active session indicator */}
      {isActive && (
        <div className="focus-toggle__active-indicator">
          <div className="focus-toggle__progress">
            <div 
              className="focus-toggle__progress-bar"
              style={{
                width: `${((selectedDuration * 60 - timeRemaining) / (selectedDuration * 60)) * 100}%`
              }}
            />
          </div>
          <p className="focus-toggle__message">
            💡 Suggestions are paused. Stay focused!
          </p>
        </div>
      )}
    </div>
  );
}

export default FocusToggle;
