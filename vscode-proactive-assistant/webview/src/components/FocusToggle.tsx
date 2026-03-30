import React, { useState, useEffect, useCallback } from 'react';
import type { FocusDuration } from '../types';
import { useTheme, useReducedMotion } from '../hooks/useTheme';

interface FocusToggleProps {
  onToggle: (active: boolean, duration?: number) => void;
  isActive?: boolean;
}

const PRESET_DURATIONS: { label: string; value: FocusDuration }[] = [
  { label: '15m', value: 15 },
  { label: '25m', value: 25 },
  { label: '45m', value: 45 },
  { label: '60m', value: 60 }
];

// Format seconds to mm:ss
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const FocusToggle: React.FC<FocusToggleProps> = ({ onToggle, isActive: externalActive }) => {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  
  const [isActive, setIsActive] = useState(externalActive || false);
  const [selectedDuration, setSelectedDuration] = useState<FocusDuration>(25);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showCustom, setShowCustom] = useState(false);

  // Sync with external state
  useEffect(() => {
    if (externalActive !== undefined) {
      setIsActive(externalActive);
    }
  }, [externalActive]);

  // Countdown timer
  useEffect(() => {
    if (!isActive || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsActive(false);
          onToggle(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeRemaining, onToggle]);

  const handleToggle = useCallback(() => {
    const newActive = !isActive;
    setIsActive(newActive);
    
    if (newActive) {
      const duration = showCustom 
        ? parseInt(customDuration, 10) || 25
        : selectedDuration;
      const seconds = duration * 60;
      setTimeRemaining(seconds);
      onToggle(true, duration);
    } else {
      setTimeRemaining(0);
      onToggle(false);
    }
  }, [isActive, selectedDuration, customDuration, showCustom, onToggle]);

  const handleDurationSelect = useCallback((duration: FocusDuration) => {
    setSelectedDuration(duration);
    setShowCustom(false);
    if (isActive) {
      setTimeRemaining(duration * 60);
      onToggle(true, duration);
    }
  }, [isActive, onToggle]);

  const handleCustomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (/^\d+$/.test(value) && parseInt(value, 10) <= 180)) {
      setCustomDuration(value);
    }
  }, []);

  const handleCustomToggle = useCallback(() => {
    setShowCustom(true);
  }, []);

  const progress = isActive && timeRemaining > 0
    ? ((selectedDuration * 60 - timeRemaining) / (selectedDuration * 60)) * 100
    : 0;

  return (
    <section 
      className={`focus-toggle ${isActive ? 'active' : ''}`}
      aria-label="Focus mode"
    >
      <div className="focus-header">
        <div className="focus-title">
          <span className="focus-icon" aria-hidden="true">🎯</span>
          <span>Focus Mode</span>
        </div>
        
        {isActive && (
          <div className="focus-timer" aria-live="polite">
            <span className="timer-display">{formatTime(timeRemaining)}</span>
          </div>
        )}
      </div>

      {!isActive && (
        <div className="focus-durations" role="group" aria-label="Select focus duration">
          {PRESET_DURATIONS.map(({ label, value }) => (
            <button
              key={value}
              className={`duration-pill ${selectedDuration === value && !showCustom ? 'selected' : ''}`}
              onClick={() => handleDurationSelect(value)}
              aria-pressed={selectedDuration === value && !showCustom}
            >
              {label}
            </button>
          ))}
          
          <button
            className={`duration-pill custom ${showCustom ? 'selected' : ''}`}
            onClick={handleCustomToggle}
            aria-pressed={showCustom}
          >
            Custom
          </button>
        </div>
      )}

      {showCustom && !isActive && (
        <div className="custom-duration">
          <label htmlFor="custom-duration">Minutes:</label>
          <input
            id="custom-duration"
            type="number"
            min="1"
            max="180"
            value={customDuration}
            onChange={handleCustomChange}
            placeholder="25"
            className="custom-input"
          />
        </div>
      )}

      {/* Progress bar when active */}
      {isActive && (
        <div className="focus-progress" role="progressbar" aria-valuenow={progress}>
          <div 
            className="progress-fill"
            style={{ 
              width: `${progress}%`,
              transition: reducedMotion ? 'none' : 'width 1s linear'
            }}
          />
        </div>
      )}

      <button
        className={`focus-button ${isActive ? 'active' : ''}`}
        onClick={handleToggle}
        aria-label={isActive ? 'Stop focus mode' : 'Start focus mode'}
        style={{
          backgroundColor: isActive ? colors.errorForeground : colors.buttonBackground,
          color: colors.buttonForeground
        }}
      >
        {isActive ? (
          <>
            <span className="button-icon">⏹</span>
            Stop Focus
          </>
        ) : (
          <>
            <span className="button-icon">▶</span>
            Start Focus
            <span className="button-duration">
              ({showCustom && customDuration ? `${customDuration}m` : `${selectedDuration}m`})
            </span>
          </>
        )}
      </button>

      {isActive && (
        <p className="focus-hint">
          Only critical suggestions will interrupt you
        </p>
      )}
    </section>
  );
};

export default FocusToggle;
