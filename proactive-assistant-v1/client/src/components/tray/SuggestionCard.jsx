/**
 * SuggestionCard - Individual suggestion display
 * Detailed card with title, description, action buttons, time estimate, and confidence
 */

import { useState, useRef } from 'react';
import './SuggestionCard.css';

/**
 * @typedef {Object} SuggestionCardProps
 * @property {string} id - Unique identifier
 * @property {string} title - Suggestion title
 * @property {string} description - Suggestion description
 * @property {string} [timeEstimate] - Estimated time (e.g., "5 min")
 * @property {number} [confidence] - Confidence score 0-100
 * @property {string} [category] - Suggestion category
 * @property {string} [icon] - Emoji icon for category
 * @property {() => void} onAction - Primary action handler
 * @property {() => void} onDismiss - Dismiss handler
 * @property {() => void} [onSnooze] - Snooze handler
 * @property {boolean} [dismissible] - Whether card can be dismissed
 */

/**
 * @param {SuggestionCardProps} props
 */
function SuggestionCard({
  id,
  title,
  description,
  timeEstimate,
  confidence = 0,
  category = 'general',
  icon = '💡',
  onAction,
  onDismiss,
  onSnooze,
  dismissible = true
}) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef(null);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  // Get confidence color
  const getConfidenceColor = (score) => {
    if (score >= 80) return '#10B981'; // High - green
    if (score >= 50) return '#F59E0B'; // Medium - amber
    return '#64748B'; // Low - slate
  };

  // Get confidence label
  const getConfidenceLabel = (score) => {
    if (score >= 80) return 'High';
    if (score >= 50) return 'Medium';
    return 'Low';
  };

  // Handle dismiss with animation
  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => onDismiss(), 300);
  };

  // Touch handlers for swipe to dismiss
  const handleTouchStart = (e) => {
    if (!dismissible) return;
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = touchStartX.current;
  };

  const handleTouchMove = (e) => {
    if (!dismissible) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    
    // Apply transform during swipe
    if (cardRef.current && diff < 0) {
      const opacity = Math.max(0.5, 1 + diff / 300);
      cardRef.current.style.transform = `translateX(${diff}px)`;
      cardRef.current.style.opacity = String(opacity);
    }
  };

  const handleTouchEnd = () => {
    if (!dismissible) return;
    const diff = touchCurrentX.current - touchStartX.current;
    
    if (diff < -100) {
      // Swiped far enough - dismiss
      handleDismiss();
    } else {
      // Reset position
      if (cardRef.current) {
        cardRef.current.style.transform = '';
        cardRef.current.style.opacity = '';
      }
    }
  };

  return (
    <div
      ref={cardRef}
      className={`tray-suggestion-card ${isDismissing ? 'dismissing' : ''} ${isExpanded ? 'expanded' : ''}`}
      data-category={category}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe hint overlay */}
      <div className="tray-suggestion-card__swipe-hint">
        <span>← Swipe to dismiss</span>
      </div>

      {/* Card header */}
      <div className="tray-suggestion-card__header">
        <div className="tray-suggestion-card__icon">{icon}</div>
        <div className="tray-suggestion-card__meta">
          <span className="tray-suggestion-card__category">{category}</span>
          {confidence > 0 && (
            <div 
              className="tray-suggestion-card__confidence"
              style={{ '--confidence-color': getConfidenceColor(confidence) }}
            >
              <div className="confidence-bar">
                <div 
                  className="confidence-fill" 
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="confidence-label">{getConfidenceLabel(confidence)}</span>
            </div>
          )}
        </div>
        {dismissible && (
          <button 
            className="tray-suggestion-card__close"
            onClick={handleDismiss}
            aria-label="Dismiss suggestion"
          >
            ×
          </button>
        )}
      </div>

      {/* Card content */}
      <div className="tray-suggestion-card__content">
        <h3 className="tray-suggestion-card__title">{title}</h3>
        <p className={`tray-suggestion-card__description ${isExpanded ? 'expanded' : ''}`}>
          {description}
        </p>
        {!isExpanded && description.length > 80 && (
          <button 
            className="tray-suggestion-card__expand"
            onClick={() => setIsExpanded(true)}
          >
            Show more
          </button>
        )}
      </div>

      {/* Card footer */}
      <div className="tray-suggestion-card__footer">
        <div className="tray-suggestion-card__details">
          {timeEstimate && (
            <span className="tray-suggestion-card__time">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {timeEstimate}
            </span>
          )}
        </div>
        <div className="tray-suggestion-card__actions">
          {onSnooze && (
            <button 
              className="tray-suggestion-card__snooze"
              onClick={onSnooze}
            >
              Snooze
            </button>
          )}
          <button 
            className="tray-suggestion-card__action"
            onClick={onAction}
          >
            {getActionLabel(category)}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Get action button label based on category
 */
function getActionLabel(category) {
  const labels = {
    'break': 'Take Break',
    'task': 'Start Task',
    'focus': 'Focus Now',
    'email': 'Check Email',
    'review': 'Review',
    'organize': 'Organize',
    'health': 'Take Action',
    'default': 'Do It'
  };
  return labels[category] || labels.default;
}

export default SuggestionCard;
