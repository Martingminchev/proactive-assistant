import { useState } from 'react';

// Type configuration with icons and colors
const typeConfig = {
  tip: { icon: '💡', label: 'Tip', color: '#f59e0b' },
  reminder: { icon: '⏰', label: 'Reminder', color: '#8b5cf6' },
  insight: { icon: '🔍', label: 'Insight', color: '#3b82f6' },
  action: { icon: '⚡', label: 'Action', color: '#10b981' },
  warning: { icon: '⚠️', label: 'Warning', color: '#ef4444' }
};

// Category configuration
const categoryConfig = {
  productivity: { icon: '📈', label: 'Productivity' },
  code_quality: { icon: '✨', label: 'Code Quality' },
  learning: { icon: '📚', label: 'Learning' },
  health: { icon: '💪', label: 'Health' },
  focus: { icon: '🎯', label: 'Focus' },
  tools: { icon: '🔧', label: 'Tools' },
  collaboration: { icon: '👥', label: 'Collaboration' },
  documentation: { icon: '📝', label: 'Documentation' },
  testing: { icon: '🧪', label: 'Testing' },
  debugging: { icon: '🐛', label: 'Debugging' },
  optimization: { icon: '🚀', label: 'Optimization' },
  general: { icon: '📌', label: 'General' }
};

function SuggestionCard({ suggestion, onDismiss, onSnooze, onAction }) {
  const [loading, setLoading] = useState(null);
  
  const typeInfo = typeConfig[suggestion.type] || typeConfig.tip;
  const categoryInfo = categoryConfig[suggestion.category] || categoryConfig.general;
  
  const handleAction = async (action) => {
    setLoading(action.type);
    
    try {
      switch (action.type) {
        case 'link':
          window.open(action.payload, '_blank', 'noopener,noreferrer');
          if (onAction) await onAction(suggestion._id, 'link');
          break;
          
        case 'copy':
          await navigator.clipboard.writeText(action.payload);
          if (onAction) await onAction(suggestion._id, 'copy');
          break;
          
        case 'dismiss':
          if (onDismiss) await onDismiss(suggestion._id);
          break;
          
        case 'snooze':
          const minutes = parseInt(action.payload) || 30;
          if (onSnooze) await onSnooze(suggestion._id, minutes);
          break;
          
        case 'execute':
          if (onAction) await onAction(suggestion._id, 'execute', action.payload);
          break;
          
        default:
          console.warn('Unknown action type:', action.type);
      }
    } catch (error) {
      console.error('Error handling action:', error);
    } finally {
      setLoading(null);
    }
  };
  
  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'link': return '🔗';
      case 'copy': return '📋';
      case 'dismiss': return '✖';
      case 'snooze': return '😴';
      case 'execute': return '▶️';
      default: return '•';
    }
  };
  
  const getPriorityClass = (priority) => {
    if (priority >= 8) return 'priority-high';
    if (priority >= 5) return 'priority-medium';
    return 'priority-low';
  };

  return (
    <div 
      className={`suggestion-card ${getPriorityClass(suggestion.priority)}`}
      style={{ borderLeftColor: typeInfo.color }}
    >
      <div className="suggestion-header">
        <div className="suggestion-badges">
          <span 
            className="type-badge" 
            style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}
          >
            {typeInfo.icon} {typeInfo.label}
          </span>
          <span className="category-badge">
            {categoryInfo.icon} {categoryInfo.label}
          </span>
        </div>
        <span className={`priority-indicator ${getPriorityClass(suggestion.priority)}`}>
          {suggestion.priority}/10
        </span>
      </div>
      
      <h4 className="suggestion-title">{suggestion.title}</h4>
      
      <p className="suggestion-description">{suggestion.description}</p>
      
      {suggestion.triggerContext?.keywords?.length > 0 && (
        <div className="suggestion-keywords">
          {suggestion.triggerContext.keywords.slice(0, 3).map((keyword, idx) => (
            <span key={idx} className="keyword-tag">{keyword}</span>
          ))}
        </div>
      )}
      
      <div className="suggestion-actions">
        {suggestion.actions?.map((action, idx) => (
          <button
            key={idx}
            className={`action-btn action-${action.type}`}
            onClick={() => handleAction(action)}
            disabled={loading === action.type}
          >
            {loading === action.type ? (
              <span className="btn-loading">...</span>
            ) : (
              <>
                <span className="action-icon">{getActionIcon(action.type)}</span>
                <span className="action-label">{action.label}</span>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SuggestionCard;
