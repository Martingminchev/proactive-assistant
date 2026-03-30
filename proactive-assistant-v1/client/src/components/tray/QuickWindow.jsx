/**
 * QuickWindow - Main floating tray window
 * Shows current focus, active suggestions, and quick actions
 */

import { useEffect, useRef, useCallback } from 'react';
import './QuickWindow.css';

/**
 * @typedef {Object} Suggestion
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} [timeEstimate]
 * @property {number} [confidence]
 * @property {() => void} onAction
 * @property {() => void} onDismiss
 */

/**
 * @typedef {Object} StatusInfo
 * @property {string} currentApp
 * @property {string} currentFile
 * @property {string} timeSpent
 * @property {'flow' | 'normal' | 'distracted'} flowState
 */

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether window is visible
 * @param {() => void} props.onClose - Close handler
 * @param {StatusInfo} props.status - Current status info
 * @param {Suggestion[]} props.suggestions - Active suggestions (max 3 shown)
 * @param {boolean} props.focusMode - Whether focus mode is active
 * @param {() => void} props.onToggleFocus - Focus toggle handler
 * @param {React.ReactNode} [props.children] - Additional content
 */
function QuickWindow({
  isOpen,
  onClose,
  status,
  suggestions = [],
  focusMode = false,
  onToggleFocus,
  children
}) {
  const windowRef = useRef(null);

  // Close on escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  // Close on click outside
  const handleClickOutside = useCallback((e) => {
    if (windowRef.current && !windowRef.current.contains(e.target)) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown, handleClickOutside]);

  if (!isOpen) return null;

  const visibleSuggestions = suggestions.slice(0, 3);

  return (
    <div className="quick-window__overlay">
      <div
        ref={windowRef}
        className={`quick-window ${focusMode ? 'quick-window--focus' : ''}`}
        role="dialog"
        aria-label="Quick actions"
      >
        {/* Header - Current Status */}
        <div className="quick-window__header">
          <div className="quick-window__status">
            <div className="quick-window__app-icon">
              {status.currentApp?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="quick-window__status-info">
              <span className="quick-window__app-name">
                {status.currentApp || 'Unknown'}
              </span>
              <span className="quick-window__file-name">
                {status.currentFile || 'No file'}
              </span>
            </div>
          </div>
          <div className="quick-window__meta">
            <span className={`quick-window__flow quick-window__flow--${status.flowState}`}>
              {status.flowState === 'flow' ? '⚡ Flow' : 
               status.flowState === 'distracted' ? '💫 Distracted' : '● Active'}
            </span>
            <span className="quick-window__time">{status.timeSpent}</span>
          </div>
        </div>

        {/* Suggestions List */}
        {visibleSuggestions.length > 0 && !focusMode && (
          <div className="quick-window__suggestions">
            <h3 className="quick-window__section-title">
              Suggestions ({visibleSuggestions.length})
            </h3>
            <div className="quick-window__cards">
              {visibleSuggestions.map((suggestion, index) => (
                <SuggestionMiniCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {focusMode && (
          <div className="quick-window__focus-message">
            <div className="quick-window__focus-icon">🎯</div>
            <p>Focus mode is active</p>
            <span>Suggestions paused</span>
          </div>
        )}

        {/* Additional content */}
        {children}

        {/* Quick Actions Footer */}
        <div className="quick-window__footer">
          <button
            className={`quick-window__focus-btn ${focusMode ? 'active' : ''}`}
            onClick={onToggleFocus}
          >
            {focusMode ? 'Exit Focus' : 'Focus Mode'}
          </button>
          <button className="quick-window__action-btn" onClick={onClose}>
            Open Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Mini suggestion card for the quick window
 */
function SuggestionMiniCard({ suggestion, index }) {
  const cardRef = useRef(null);
  const touchStartX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    
    // Swipe left to dismiss (threshold: 50px)
    if (diff > 50) {
      cardRef.current?.classList.add('swiping-out');
      setTimeout(() => suggestion.onDismiss?.(), 200);
    }
  };

  return (
    <div
      ref={cardRef}
      className="suggestion-mini-card"
      style={{ animationDelay: `${index * 50}ms` }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="suggestion-mini-card__content">
        <h4 className="suggestion-mini-card__title">{suggestion.title}</h4>
        <p className="suggestion-mini-card__desc">{suggestion.description}</p>
        {suggestion.timeEstimate && (
          <span className="suggestion-mini-card__time">
            ⏱ {suggestion.timeEstimate}
          </span>
        )}
      </div>
      <div className="suggestion-mini-card__actions">
        <button
          className="suggestion-mini-card__primary"
          onClick={suggestion.onAction}
        >
          Do it
        </button>
        <button
          className="suggestion-mini-card__dismiss"
          onClick={suggestion.onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default QuickWindow;
