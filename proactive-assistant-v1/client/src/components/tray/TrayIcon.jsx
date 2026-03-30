/**
 * TrayIcon - Animated tray icon with status overlay
 * Shows pulsing animation for watching state, badge for suggestions
 */

import './TrayIcon.css';

/**
 * @typedef {'idle' | 'watching' | 'focus' | 'suggestion'} TrayStatus
 */

/**
 * @param {Object} props
 * @param {TrayStatus} props.status - Current tray status
 * @param {number} props.suggestionCount - Number of pending suggestions (for badge)
 * @param {boolean} props.isOpen - Whether the tray window is open
 * @param {() => void} props.onClick - Click handler
 */
function TrayIcon({ status = 'idle', suggestionCount = 0, isOpen = false, onClick }) {
  const getStatusColor = () => {
    switch (status) {
      case 'watching':
        return '#10B981'; // emerald-500
      case 'focus':
        return '#8B5CF6'; // violet-500
      case 'suggestion':
        return '#F59E0B'; // amber-500
      default:
        return '#64748B'; // slate-500
    }
  };

  const showPulse = status === 'watching' || status === 'suggestion';
  const showBadge = suggestionCount > 0;

  return (
    <button
      className={`tray-icon ${isOpen ? 'tray-icon--open' : ''} tray-icon--${status}`}
      onClick={onClick}
      aria-label={`Assistant ${status}${suggestionCount > 0 ? `, ${suggestionCount} suggestions` : ''}`}
    >
      <div className="tray-icon__container">
        {/* Pulse animation ring */}
        {showPulse && <div className="tray-icon__pulse" />}
        
        {/* Main icon */}
        <svg
          className="tray-icon__svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke={getStatusColor()}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Assistant icon - stylized eye/spark */}
          <circle cx="12" cy="12" r="3" fill={getStatusColor()} fillOpacity="0.2" />
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          <path d="M12 6v2M12 16v2M6 12h2M16 12h2" />
          <circle cx="12" cy="12" r="1" fill={getStatusColor()} />
        </svg>

        {/* Suggestion badge */}
        {showBadge && (
          <span className="tray-icon__badge">
            {suggestionCount > 9 ? '9+' : suggestionCount}
          </span>
        )}

        {/* Status dot */}
        <span
          className="tray-icon__dot"
          style={{ backgroundColor: getStatusColor() }}
        />
      </div>
    </button>
  );
}

export default TrayIcon;
