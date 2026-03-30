import { useState, useCallback } from 'react';
import './ActionCenter.css';

/**
 * ActionCenter - Shows IMMEDIATE actions needed
 * 
 * Features:
 * - Big, clickable action buttons
 * - One-click dismiss/snooze
 * - Progress indicators
 * - Prioritized by urgency
 */

// Mock data for immediate actions
const MOCK_ACTIONS = [
  {
    id: 'action-1',
    type: 'urgent',
    priority: 'high',
    title: 'Complete project documentation',
    description: 'You\'ve been working on this for 2 hours. Finish the README while it\'s fresh.',
    actionLabel: 'Open Files',
    actionUrl: 'vscode://file/docs',
    progress: 65,
    timeEstimate: '15 min',
    icon: '📝',
    dismissable: true,
  },
  {
    id: 'action-2',
    type: 'suggestion',
    priority: 'medium',
    title: 'Take a break',
    description: 'You\'ve been coding for 90 minutes straight. Your focus may be declining.',
    actionLabel: 'Start 5-min Timer',
    actionCallback: 'startBreak',
    progress: 0,
    timeEstimate: '5 min',
    icon: '☕',
    dismissable: true,
    snoozeOptions: ['10 min', '30 min', '1 hour'],
  },
  {
    id: 'action-3',
    type: 'reminder',
    priority: 'medium',
    title: 'Review pull request',
    description: 'PR #247 from @sarah is waiting for your review for 2 days.',
    actionLabel: 'Open GitHub',
    actionUrl: 'https://github.com/org/repo/pull/247',
    progress: 0,
    timeEstimate: '10 min',
    icon: '👀',
    dismissable: true,
  },
  {
    id: 'action-4',
    type: 'quick_win',
    priority: 'low',
    title: 'Clear notifications',
    description: 'You have 12 unread Slack messages and 5 emails. Quick batch process?',
    actionLabel: 'Batch Clear',
    actionCallback: 'clearNotifications',
    progress: 0,
    timeEstimate: '3 min',
    icon: '✨',
    dismissable: true,
  },
];

// Priority configuration
const PRIORITY_CONFIG = {
  high: { color: '#ef4444', label: 'Urgent', icon: '🔴' },
  medium: { color: '#f59e0b', label: 'Soon', icon: '🟡' },
  low: { color: '#10b981', label: 'When Ready', icon: '🟢' },
};

// Type icons
const TYPE_ICONS = {
  urgent: '🔥',
  suggestion: '💡',
  reminder: '⏰',
  quick_win: '⚡',
};

function ActionCard({ action, onDismiss, onSnooze, onAction, isProcessing }) {
  const [showSnooze, setShowSnooze] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const priority = PRIORITY_CONFIG[action.priority];
  
  const handleAction = useCallback(() => {
    if (action.actionUrl) {
      window.open(action.actionUrl, '_blank');
    }
    if (action.actionCallback) {
      onAction(action.actionCallback, action.id);
    }
  }, [action, onAction]);
  
  const handleDismiss = useCallback(() => {
    onDismiss(action.id);
  }, [action.id, onDismiss]);
  
  const handleSnooze = useCallback((duration) => {
    onSnooze(action.id, duration);
    setShowSnooze(false);
  }, [action.id, onSnooze]);

  return (
    <div className={`action-card priority-${action.priority} ${isExpanded ? 'expanded' : ''}`}>
      {/* Priority Indicator Bar */}
      <div className="action-priority-bar" style={{ backgroundColor: priority.color }} />
      
      {/* Header */}
      <div className="action-header">
        <div className="action-icon-section">
          <span className="action-type-icon">{TYPE_ICONS[action.type] || action.icon}</span>
          <span className="action-priority-badge" style={{ color: priority.color }}>
            {priority.icon} {priority.label}
          </span>
        </div>
        
        <div className="action-meta">
          {action.timeEstimate && (
            <span className="time-estimate">⏱ {action.timeEstimate}</span>
          )}
          {action.dismissable && (
            <button 
              className="dismiss-btn"
              onClick={handleDismiss}
              title="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="action-content">
        <h3 className="action-title">{action.title}</h3>
        <p className="action-description">{action.description}</p>
        
        {/* Progress Indicator */}
        {action.progress > 0 && (
          <div className="progress-section">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${action.progress}%`, backgroundColor: priority.color }}
              />
            </div>
            <span className="progress-text">{action.progress}% complete</span>
          </div>
        )}
      </div>
      
      {/* Action Footer */}
      <div className="action-footer">
        <button 
          className="action-btn primary"
          onClick={handleAction}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <span className="spinner-tiny"></span>
          ) : (
            <>
              <span className="btn-icon">→</span>
              {action.actionLabel}
            </>
          )}
        </button>
        
        {action.snoozeOptions && (
          <div className="snooze-section">
            {showSnooze ? (
              <div className="snooze-options">
                {action.snoozeOptions.map(duration => (
                  <button 
                    key={duration}
                    className="snooze-option"
                    onClick={() => handleSnooze(duration)}
                  >
                    {duration}
                  </button>
                ))}
                <button 
                  className="snooze-cancel"
                  onClick={() => setShowSnooze(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                className="snooze-btn"
                onClick={() => setShowSnooze(true)}
              >
                💤 Snooze
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCenter({ actions: propActions, onActionComplete }) {
  const [actions, setActions] = useState(propActions || MOCK_ACTIONS);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [filter, setFilter] = useState('all'); // all, urgent, suggestions
  
  // Dismiss an action
  const handleDismiss = useCallback((id) => {
    setActions(prev => prev.filter(a => a.id !== id));
    onActionComplete?.('dismiss', id);
  }, [onActionComplete]);
  
  // Snooze an action
  const handleSnooze = useCallback((id, duration) => {
    console.log(`Snoozing ${id} for ${duration}`);
    // In real implementation, this would set a timer to show it again
    setActions(prev => prev.filter(a => a.id !== id));
    onActionComplete?.('snooze', id, duration);
  }, [onActionComplete]);
  
  // Handle action button click
  const handleAction = useCallback((callback, id) => {
    setProcessingIds(prev => new Set(prev).add(id));
    
    // Simulate action processing
    setTimeout(() => {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      
      // Remove from list on success
      setActions(prev => prev.filter(a => a.id !== id));
      onActionComplete?.('complete', id);
    }, 1000);
    
    // Execute the callback
    switch (callback) {
      case 'startBreak':
        alert('Break timer started! (5 minutes)');
        break;
      case 'clearNotifications':
        console.log('Clearing notifications...');
        break;
      default:
        console.log(`Action callback: ${callback}`);
    }
  }, [onActionComplete]);
  
  // Filter actions
  const filteredActions = actions.filter(action => {
    if (filter === 'all') return true;
    if (filter === 'urgent') return action.priority === 'high';
    if (filter === 'suggestions') return action.type === 'suggestion';
    return true;
  });
  
  // Sort by priority
  const sortedActions = [...filteredActions].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  const urgentCount = actions.filter(a => a.priority === 'high').length;
  
  return (
    <div className="action-center">
      {/* Header */}
      <div className="action-center-header">
        <div className="action-center-title">
          <span className="title-icon">🎯</span>
          <h2>Action Center</h2>
          {urgentCount > 0 && (
            <span className="urgent-badge">{urgentCount} urgent</span>
          )}
        </div>
        
        {/* Filter Tabs */}
        <div className="action-filters">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({actions.length})
          </button>
          <button 
            className={filter === 'urgent' ? 'active' : ''}
            onClick={() => setFilter('urgent')}
          >
            Urgent ({urgentCount})
          </button>
          <button 
            className={filter === 'suggestions' ? 'active' : ''}
            onClick={() => setFilter('suggestions')}
          >
            Suggestions
          </button>
        </div>
      </div>
      
      {/* Actions List */}
      {sortedActions.length === 0 ? (
        <div className="actions-empty">
          <span className="empty-icon">✅</span>
          <h3>All caught up!</h3>
          <p>No immediate actions needed. You're doing great!</p>
        </div>
      ) : (
        <div className="actions-list">
          {sortedActions.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              onDismiss={handleDismiss}
              onSnooze={handleSnooze}
              onAction={handleAction}
              isProcessing={processingIds.has(action.id)}
            />
          ))}
        </div>
      )}
      
      {/* Quick Stats Footer */}
      <div className="action-center-footer">
        <div className="stats-row">
          <span className="stat">
            <strong>{actions.filter(a => a.priority === 'high').length}</strong> urgent
          </span>
          <span className="stat">
            <strong>{actions.filter(a => a.progress > 0).length}</strong> in progress
          </span>
          <span className="stat">
            <strong>~{actions.reduce((acc, a) => {
              const minutes = parseInt(a.timeEstimate) || 0;
              return acc + minutes;
            }, 0)} min</strong> total
          </span>
        </div>
      </div>
    </div>
  );
}

export default ActionCenter;
