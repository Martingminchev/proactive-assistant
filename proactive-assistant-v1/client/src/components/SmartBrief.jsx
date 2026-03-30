import { useState, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import './SmartBrief.css';

/**
 * SmartBrief - Redesigned brief display with better UX
 * 
 * Features:
 * - Prioritized by urgency
 * - Action buttons for each item
 * - Collapsible sections
 * - "Mark as done" functionality
 * - Smart grouping
 */

// Mock data for smart brief
const MOCK_BRIEF = {
  greeting: "Good morning! Here's what needs your attention today.",
  generatedAt: new Date().toISOString(),
  items: [
    {
      id: 'item-1',
      title: 'Code review needed: Payment API integration',
      description: 'The payment API PR has been waiting for review for 2 days. It\'s blocking the release.',
      category: 'urgent',
      urgency: 'high',
      type: 'action_required',
      actionLabel: 'Open PR',
      actionUrl: 'https://github.com/org/repo/pull/247',
      metadata: {
        deadline: 'Today, 5 PM',
        assignee: 'You',
        source: 'GitHub',
      },
      completed: false,
    },
    {
      id: 'item-2',
      title: 'Database migration scheduled',
      description: 'A critical database migration is scheduled for tonight at 2 AM. Please review the plan.',
      category: 'reminder',
      urgency: 'high',
      type: 'scheduled_task',
      actionLabel: 'Review Plan',
      actionUrl: '#migration-plan',
      metadata: {
        scheduledTime: 'Tonight, 2:00 AM',
        duration: '30 min downtime',
      },
      completed: false,
    },
    {
      id: 'item-3',
      title: 'New TypeScript 5.5 features',
      description: 'TypeScript 5.5 was released with new inference improvements that could benefit your current project.',
      category: 'learning',
      urgency: 'low',
      type: 'opportunity',
      actionLabel: 'Read More',
      actionUrl: 'https://devblogs.microsoft.com/typescript/',
      metadata: {
        readTime: '5 min',
        relevance: 85,
      },
      completed: false,
    },
    {
      id: 'item-4',
      title: 'Team standup in 30 minutes',
      description: 'Daily standup at 10:00 AM. Prepare your update.',
      category: 'meeting',
      urgency: 'medium',
      type: 'reminder',
      actionLabel: 'Add to Calendar',
      actionUrl: '#calendar',
      metadata: {
        time: '10:00 AM',
        duration: '15 min',
      },
      completed: false,
    },
    {
      id: 'item-5',
      title: 'Refactor suggestion: API client',
      description: 'I noticed you\'re repeating similar fetch patterns. Consider creating a reusable API client.',
      category: 'improvement',
      urgency: 'low',
      type: 'suggestion',
      actionLabel: 'View Example',
      actionCallback: 'showExample',
      metadata: {
        effort: 'Medium',
        impact: 'High',
        files: 3,
      },
      completed: false,
    },
    {
      id: 'item-6',
      title: 'Update dependencies',
      description: '3 dependencies have security updates available.',
      category: 'maintenance',
      urgency: 'medium',
      type: 'action_required',
      actionLabel: 'Update Now',
      actionCallback: 'updateDeps',
      metadata: {
        packages: ['axios', 'lodash', 'express'],
        severity: 'moderate',
      },
      completed: false,
    },
  ],
  stats: {
    urgent: 2,
    medium: 2,
    low: 2,
    completed: 0,
  },
};

// Category configuration
const CATEGORY_CONFIG = {
  urgent: { color: '#ef4444', icon: '🔴', bgColor: 'rgba(239, 68, 68, 0.1)' },
  reminder: { color: '#f59e0b', icon: '⏰', bgColor: 'rgba(245, 158, 11, 0.1)' },
  learning: { color: '#3b82f6', icon: '📚', bgColor: 'rgba(59, 130, 246, 0.1)' },
  meeting: { color: '#8b5cf6', icon: '👥', bgColor: 'rgba(139, 92, 246, 0.1)' },
  improvement: { color: '#10b981', icon: '✨', bgColor: 'rgba(16, 185, 129, 0.1)' },
  maintenance: { color: '#64748b', icon: '🔧', bgColor: 'rgba(100, 116, 139, 0.1)' },
};

// Urgency configuration
const URGENCY_CONFIG = {
  high: { label: 'High Priority', color: '#ef4444' },
  medium: { label: 'Medium Priority', color: '#f59e0b' },
  low: { label: 'Low Priority', color: '#10b981' },
};

function BriefItem({ item, onComplete, onAction, isCompleted }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const category = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.reminder;
  const urgency = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.low;
  
  const handleAction = async () => {
    if (item.actionUrl) {
      window.open(item.actionUrl, '_blank');
    }
    if (item.actionCallback) {
      setIsProcessing(true);
      await onAction(item.actionCallback, item);
      setIsProcessing(false);
    }
  };
  
  const handleComplete = async () => {
    setIsProcessing(true);
    await onComplete(item.id);
    setIsProcessing(false);
  };

  return (
    <div className={`brief-item urgency-${item.urgency} ${isCompleted ? 'completed' : ''}`}>
      {/* Left: Completion Toggle */}
      <button 
        className="complete-toggle"
        onClick={handleComplete}
        disabled={isProcessing}
        title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isProcessing ? (
          <span className="spinner-tiny"></span>
        ) : isCompleted ? (
          <span className="check-icon checked">✓</span>
        ) : (
          <span className="check-icon">○</span>
        )}
      </button>
      
      {/* Main Content */}
      <div className="item-content">
        {/* Header Row */}
        <div className="item-header-row">
          <div 
            className="item-category-badge"
            style={{ backgroundColor: category.bgColor, color: category.color }}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-name">{item.category}</span>
          </div>
          
          <span 
            className="urgency-badge"
            style={{ color: urgency.color }}
          >
            {urgency.label}
          </span>
        </div>
        
        {/* Title */}
        <h4 className="item-title">{item.title}</h4>
        
        {/* Description */}
        <p className="item-description">{item.description}</p>
        
        {/* Expanded Metadata */}
        {isExpanded && item.metadata && (
          <div className="item-metadata">
            {Object.entries(item.metadata).map(([key, value]) => (
              <div key={key} className="metadata-row">
                <span className="metadata-key">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <span className="metadata-value">
                  {Array.isArray(value) ? value.join(', ') : value}
                </span>
              </div>
            ))}
          </div>
        )}
        
        {/* Action Row */}
        <div className="item-actions-row">
          <button 
            className="action-btn primary"
            onClick={handleAction}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <span className="spinner-tiny"></span>
            ) : (
              <>
                {item.actionLabel}
                <span className="btn-arrow">→</span>
              </>
            )}
          </button>
          
          <button 
            className="expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Less info' : 'More info'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ completed, total }) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  
  return (
    <div className="progress-section">
      <div className="progress-header">
        <span className="progress-label">Progress</span>
        <span className="progress-count">{completed} of {total} done</span>
      </div>
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function FilterTabs({ activeFilter, onFilterChange, counts }) {
  const filters = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'high', label: 'Urgent', count: counts.urgent },
    { id: 'medium', label: 'Soon', count: counts.medium },
    { id: 'low', label: 'Later', count: counts.low },
  ];
  
  return (
    <div className="filter-tabs">
      {filters.map(filter => (
        <button
          key={filter.id}
          className={activeFilter === filter.id ? 'active' : ''}
          onClick={() => onFilterChange(filter.id)}
        >
          {filter.label}
          {filter.count > 0 && (
            <span className="filter-count">{filter.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function SmartBrief({ briefData: propData, onItemComplete, onItemAction }) {
  const [brief, setBrief] = useState(propData || MOCK_BRIEF);
  const [filter, setFilter] = useState('all');
  const [completedItems, setCompletedItems] = useState(new Set());
  const [dismissedItems, setDismissedItems] = useState(new Set());
  
  // Calculate counts
  const counts = useMemo(() => {
    const items = brief.items.filter(item => !dismissedItems.has(item.id));
    return {
      all: items.length - completedItems.size,
      urgent: items.filter(i => i.urgency === 'high' && !completedItems.has(i.id)).length,
      medium: items.filter(i => i.urgency === 'medium' && !completedItems.has(i.id)).length,
      low: items.filter(i => i.urgency === 'low' && !completedItems.has(i.id)).length,
    };
  }, [brief.items, completedItems, dismissedItems]);
  
  // Filter and sort items
  const displayedItems = useMemo(() => {
    let items = brief.items.filter(item => !dismissedItems.has(item.id));
    
    if (filter !== 'all') {
      items = items.filter(item => item.urgency === filter);
    }
    
    // Sort: incomplete first, then by urgency
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => {
      const aCompleted = completedItems.has(a.id);
      const bCompleted = completedItems.has(b.id);
      
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }
      
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
  }, [brief.items, filter, completedItems, dismissedItems]);
  
  // Handle item completion
  const handleComplete = useCallback(async (itemId) => {
    const newCompleted = new Set(completedItems);
    
    if (completedItems.has(itemId)) {
      newCompleted.delete(itemId);
    } else {
      newCompleted.add(itemId);
    }
    
    setCompletedItems(newCompleted);
    onItemComplete?.(itemId, !completedItems.has(itemId));
  }, [completedItems, onItemComplete]);
  
  // Handle item action
  const handleAction = useCallback(async (callback, item) => {
    onItemAction?.(callback, item);
    
    // Simulate actions
    switch (callback) {
      case 'showExample':
        alert('Opening API client example...');
        break;
      case 'updateDeps':
        alert('Starting dependency update...');
        break;
      default:
        console.log('Action:', callback);
    }
  }, [onItemAction]);
  
  // Handle dismiss all completed
  const handleDismissCompleted = useCallback(() => {
    const newDismissed = new Set(dismissedItems);
    completedItems.forEach(id => newDismissed.add(id));
    setDismissedItems(newDismissed);
  }, [completedItems, dismissedItems]);
  
  // Handle regenerate
  const handleRegenerate = useCallback(() => {
    console.log('Regenerating brief...');
    // In real app, this would call the API
    alert('Regenerating your brief...');
  }, []);
  
  const completedCount = completedItems.size;
  const totalCount = brief.items.length;
  const allCompleted = completedCount === totalCount;

  return (
    <div className="smart-brief">
      {/* Header */}
      <div className="brief-header">
        <div className="brief-title">
          <span className="title-icon">📋</span>
          <div>
            <h2>Today's Brief</h2>
            <span className="brief-greeting">{brief.greeting}</span>
          </div>
        </div>
        <button className="regenerate-btn" onClick={handleRegenerate} title="Regenerate">
          🔄
        </button>
      </div>
      
      {/* Progress */}
      <ProgressBar completed={completedCount} total={totalCount} />
      
      {/* Filters */}
      <FilterTabs 
        activeFilter={filter} 
        onFilterChange={setFilter}
        counts={counts}
      />
      
      {/* Items List */}
      <div className="brief-items">
        {displayedItems.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">{allCompleted ? '🎉' : '✅'}</span>
            <h3>{allCompleted ? 'All done!' : 'No items match this filter'}</h3>
            <p>
              {allCompleted 
                ? "You've completed everything for today. Great job!" 
                : 'Try a different filter to see more items.'}
            </p>
            {allCompleted && (
              <button className="dismiss-btn" onClick={handleDismissCompleted}>
                Clear Completed Items
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="items-list">
              {displayedItems.map(item => (
                <BriefItem
                  key={item.id}
                  item={item}
                  onComplete={handleComplete}
                  onAction={handleAction}
                  isCompleted={completedItems.has(item.id)}
                />
              ))}
            </div>
            
            {completedCount > 0 && (
              <button 
                className="clear-completed-btn"
                onClick={handleDismissCompleted}
              >
                Clear {completedCount} completed items
              </button>
            )}
          </>
        )}
      </div>
      
      {/* Footer */}
      <div className="brief-footer">
        <span className="generated-time">
          Generated {new Date(brief.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="item-count">
          {completedCount}/{totalCount} completed
        </span>
      </div>
    </div>
  );
}

export default SmartBrief;
