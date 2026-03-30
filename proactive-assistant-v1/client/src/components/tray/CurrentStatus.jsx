/**
 * CurrentStatus - What user is doing now
 * Shows current app/file, time spent, flow state, and mini productivity stats
 */

import { useMemo } from 'react';
import './CurrentStatus.css';

/**
 * @typedef {Object} CurrentStatusProps
 * @property {string} appName - Current application name
 * @property {string} [fileName] - Current file/document name
 * @property {string} [windowTitle] - Current window title
 * @property {number} timeSpentMinutes - Minutes spent on current activity
 * @property {'flow' | 'focused' | 'normal' | 'distracted'} [flowState] - Current flow state
 * @property {number} [productivityScore] - Productivity score 0-100
 * @property {number} [dailyGoalMinutes] - Daily focus goal in minutes
 * @property {number} [dailyProgressMinutes] - Today's progress toward goal
 * @property {boolean} [compact] - Compact mode for small spaces
 */

/**
 * @param {CurrentStatusProps} props
 */
function CurrentStatus({
  appName,
  fileName,
  windowTitle,
  timeSpentMinutes,
  flowState = 'normal',
  productivityScore,
  dailyGoalMinutes = 240,
  dailyProgressMinutes = 0,
  compact = false
}) {
  // Format time display
  const formattedTime = useMemo(() => {
    const hours = Math.floor(timeSpentMinutes / 60);
    const mins = timeSpentMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }, [timeSpentMinutes]);

  // Get flow state config
  const flowConfig = useMemo(() => {
    const configs = {
      flow: {
        icon: '⚡',
        label: 'Deep Flow',
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        description: 'You\'re in the zone!'
      },
      focused: {
        icon: '🎯',
        label: 'Focused',
        color: '#3B82F6',
        bgColor: 'rgba(59, 130, 246, 0.15)',
        description: 'Staying on track'
      },
      normal: {
        icon: '●',
        label: 'Active',
        color: '#64748B',
        bgColor: 'rgba(100, 116, 139, 0.15)',
        description: 'Working steadily'
      },
      distracted: {
        icon: '💫',
        label: 'Distracted',
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        description: 'Consider refocusing'
      }
    };
    return configs[flowState] || configs.normal;
  }, [flowState]);

  // Get app icon/color
  const appConfig = useMemo(() => {
    const configs = {
      'vscode': { icon: '◈', color: '#3B82F6' },
      'chrome': { icon: '○', color: '#F59E0B' },
      'slack': { icon: '#', color: '#8B5CF6' },
      'terminal': { icon: '>', color: '#10B981' },
      'finder': { icon: '📁', color: '#60A5FA' },
      'default': { icon: appName?.[0]?.toUpperCase() || '?', color: '#64748B' }
    };
    const key = Object.keys(configs).find(k => 
      appName?.toLowerCase().includes(k)
    );
    return configs[key] || configs.default;
  }, [appName]);

  // Calculate daily progress
  const progressPercent = useMemo(() => {
    return Math.min(100, Math.round((dailyProgressMinutes / dailyGoalMinutes) * 100));
  }, [dailyProgressMinutes, dailyGoalMinutes]);

  if (compact) {
    return (
      <div className="current-status current-status--compact">
        <div 
          className="current-status__app-badge"
          style={{ backgroundColor: appConfig.color }}
        >
          {appConfig.icon}
        </div>
        <div className="current-status__info">
          <span className="current-status__app-name">{appName}</span>
          <div className="current-status__meta">
            <span className="current-status__time">{formattedTime}</span>
            <span 
              className="current-status__flow-dot"
              style={{ backgroundColor: flowConfig.color }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="current-status">
      {/* Main status card */}
      <div className="current-status__main">
        <div 
          className="current-status__app-icon"
          style={{ backgroundColor: appConfig.color }}
        >
          {appConfig.icon}
        </div>
        <div className="current-status__details">
          <h3 className="current-status__app">{appName}</h3>
          {(fileName || windowTitle) && (
            <p className="current-status__file">
              {fileName || windowTitle}
            </p>
          )}
        </div>
        <div className="current-status__timer">
          <span className="current-status__time-value">{formattedTime}</span>
          <span className="current-status__time-label">this session</span>
        </div>
      </div>

      {/* Flow state indicator */}
      <div 
        className="current-status__flow"
        style={{ backgroundColor: flowConfig.bgColor }}
      >
        <span 
          className="current-status__flow-icon"
          style={{ color: flowConfig.color }}
        >
          {flowConfig.icon}
        </span>
        <div className="current-status__flow-info">
          <span 
            className="current-status__flow-label"
            style={{ color: flowConfig.color }}
          >
            {flowConfig.label}
          </span>
          <span className="current-status__flow-desc">
            {flowConfig.description}
          </span>
        </div>
      </div>

      {/* Mini stats */}
      <div className="current-status__stats">
        {/* Daily progress */}
        <div className="current-status__stat">
          <div className="current-status__stat-header">
            <span className="current-status__stat-label">Daily Goal</span>
            <span className="current-status__stat-value">{progressPercent}%</span>
          </div>
          <div className="current-status__progress-bar">
            <div 
              className="current-status__progress-fill"
              style={{ 
                width: `${progressPercent}%`,
                backgroundColor: progressPercent >= 100 ? '#10B981' : '#3B82F6'
              }}
            />
          </div>
          <span className="current-status__stat-sublabel">
            {Math.floor(dailyProgressMinutes / 60)}h {dailyProgressMinutes % 60}m / {Math.floor(dailyGoalMinutes / 60)}h goal
          </span>
        </div>

        {/* Productivity score */}
        {typeof productivityScore === 'number' && (
          <div className="current-status__stat current-status__stat--score">
            <span className="current-status__stat-label">Productivity</span>
            <div className="current-status__score">
              <svg className="current-status__score-ring" viewBox="0 0 36 36">
                <path
                  className="current-status__score-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="current-status__score-fill"
                  strokeDasharray={`${productivityScore}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  style={{
                    stroke: productivityScore >= 80 ? '#10B981' : 
                            productivityScore >= 50 ? '#F59E0B' : '#64748B'
                  }}
                />
              </svg>
              <span className="current-status__score-value">{productivityScore}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CurrentStatus;
