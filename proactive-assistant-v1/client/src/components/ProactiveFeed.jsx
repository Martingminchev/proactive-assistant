import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import FeedbackButtons from './FeedbackButtons';
import { ItemActions } from './ItemActions';
import './ProactiveFeed.css';

// Category icons and colors
const categoryConfig = {
  productivity_tips: { icon: '⚡', color: '#f59e0b' },
  software_tools: { icon: '🔧', color: '#3b82f6' },
  videos: { icon: '🎬', color: '#ef4444' },
  articles: { icon: '📄', color: '#10b981' },
  learning_resources: { icon: '📚', color: '#8b5cf6' },
  books: { icon: '📖', color: '#6366f1' },
  podcasts: { icon: '🎧', color: '#ec4899' },
  communities: { icon: '👥', color: '#14b8a6' },
  events: { icon: '📅', color: '#f97316' },
  wellness: { icon: '🧘', color: '#22c55e' },
  project_ideas: { icon: '💡', color: '#eab308' },
  automations: { icon: '🤖', color: '#6b7280' },
  people_to_follow: { icon: '👤', color: '#0ea5e9' },
  challenges: { icon: '🎯', color: '#d946ef' },
  quick_wins: { icon: '✅', color: '#84cc16' }
};

// Format icons
const formatIcons = {
  quick_tip: '💡',
  tool_recommendation: '🔧',
  article: '📄',
  stack_upgrade: '📈',
  learning_path: '🎓',
  action_item: '☑️',
  insight: '📊',
  challenge: '🎯'
};

function ProactiveFeed({ items, hasNewFormat, onFeedback, onChatAbout, dailyChallenge, reflection }) {
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpand = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const getItemId = (item, index) => item._id || item.title + index;

  const renderQuickTip = (item, index) => (
    <div className="feed-card quick-tip-card animate-fade-in" key={getItemId(item, index)} style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="quick-tip-content">
        <span className="format-icon">{formatIcons.quick_tip}</span>
        <div className="quick-tip-text">
          <strong>{item.title}</strong>
          <p>{item.description}</p>
        </div>
      </div>
      <ItemActions
        item={item}
        onChat={() => onChatAbout(item)}
        compact
      />
    </div>
  );

  const renderToolCard = (item, index) => {
    const config = categoryConfig[item.category] || { icon: '📦', color: '#6b7280' };
    const metadata = item.metadata || {};

    return (
      <div className="feed-card tool-card" key={getItemId(item, index)}>
        <div className="card-header">
          <span className="category-badge" style={{ background: config.color }}>
            {config.icon} {item.category?.replace('_', ' ')}
          </span>
          {item.timeToComplete && (
            <span className="time-badge">{item.timeToComplete}</span>
          )}
        </div>
        <h3 className="card-title">{item.title}</h3>
        <p className="card-description">{item.description || item.summary}</p>
        
        {metadata.installSteps && (
          <div className="install-steps">
            <strong>Get Started:</strong>
            <pre>{metadata.installSteps}</pre>
          </div>
        )}
        
        {metadata.relevanceToGoal && (
          <div className="relevance-note">
            <span className="relevance-icon">🎯</span>
            {metadata.relevanceToGoal}
          </div>
        )}

        <div className="card-footer">
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="action-btn primary">
              Get it →
            </a>
          )}
          <FeedbackButtons
            item={item}
            itemId={getItemId(item, index)}
            onFeedback={onFeedback}
            onChat={() => onChatAbout(item)}
          />
        </div>
      </div>
    );
  };

  const renderArticleCard = (item, index) => {
    const isExpanded = expandedItems[getItemId(item, index)];
    const metadata = item.metadata || {};
    const config = categoryConfig[item.category] || { icon: '📄', color: '#10b981' };

    return (
      <div className={`feed-card article-card ${isExpanded ? 'expanded' : ''}`} key={getItemId(item, index)}>
        <div className="card-header">
          <span className="category-badge" style={{ background: config.color }}>
            {config.icon} {item.category?.replace('_', ' ')}
          </span>
          {metadata.readTime && (
            <span className="time-badge">{metadata.readTime} read</span>
          )}
        </div>
        <h3 className="card-title">{item.title}</h3>
        <p className="card-description">{item.summary || item.description}</p>
        
        {item.fullContent && (
          <>
            <button 
              className="expand-btn"
              onClick={() => toggleExpand(getItemId(item, index))}
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
            
            {isExpanded && (
              <div className="full-content">
                <ReactMarkdown>{item.fullContent}</ReactMarkdown>
              </div>
            )}
          </>
        )}

        {metadata.sources && metadata.sources.length > 0 && (
          <div className="sources">
            <strong>Sources:</strong>
            {metadata.sources.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                {new URL(src).hostname}
              </a>
            ))}
          </div>
        )}

        <div className="card-footer">
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="action-btn">
              Read Original →
            </a>
          )}
          <FeedbackButtons
            item={item}
            itemId={getItemId(item, index)}
            onFeedback={onFeedback}
            onChat={() => onChatAbout(item)}
          />
        </div>
      </div>
    );
  };

  const renderStackUpgrade = (item, index) => {
    const metadata = item.metadata || {};

    return (
      <div className="feed-card stack-upgrade-card" key={getItemId(item, index)}>
        <div className="card-header">
          <span className="category-badge upgrade">
            📈 Stack Upgrade
          </span>
        </div>
        <h3 className="card-title">{item.title}</h3>
        <p className="card-description">{item.description}</p>
        
        {metadata.currentState && metadata.upgradeTarget && (
          <div className="upgrade-comparison">
            <div className="current-state">
              <span className="state-label">Current</span>
              <span className="state-value">{metadata.currentState}</span>
            </div>
            <span className="upgrade-arrow">→</span>
            <div className="upgrade-target">
              <span className="state-label">Upgrade to</span>
              <span className="state-value">{metadata.upgradeTarget}</span>
            </div>
          </div>
        )}

        {metadata.migrationSteps && (
          <div className="migration-steps">
            <strong>Migration Steps:</strong>
            <ol>
              {metadata.migrationSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="card-footer">
          <FeedbackButtons
            item={item}
            itemId={getItemId(item, index)}
            onFeedback={onFeedback}
            onChat={() => onChatAbout(item)}
          />
        </div>
      </div>
    );
  };

  const renderLearningPath = (item, index) => {
    const metadata = item.metadata || {};

    return (
      <div className="feed-card learning-path-card" key={getItemId(item, index)}>
        <div className="card-header">
          <span className="category-badge learning">
            🎓 Learning Path
          </span>
          {metadata.estimatedTime && (
            <span className="time-badge">{metadata.estimatedTime}</span>
          )}
        </div>
        <h3 className="card-title">{item.title}</h3>
        <p className="card-description">{item.description}</p>

        {metadata.resources && metadata.resources.length > 0 && (
          <div className="resources-list">
            <strong>Resources:</strong>
            <ul>
              {metadata.resources.map((resource, i) => (
                <li key={i}>
                  {typeof resource === 'string' ? (
                    <a href={resource} target="_blank" rel="noopener noreferrer">
                      {new URL(resource).hostname}
                    </a>
                  ) : (
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      {resource.title || resource.url}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card-footer">
          <FeedbackButtons
            item={item}
            itemId={getItemId(item, index)}
            onFeedback={onFeedback}
            onChat={() => onChatAbout(item)}
          />
        </div>
      </div>
    );
  };

  const renderActionItem = (item, index) => {
    const metadata = item.metadata || {};

    return (
      <div className="feed-card action-item-card" key={getItemId(item, index)}>
        <div className="action-item-content">
          <span className="action-checkbox">☐</span>
          <div className="action-details">
            <h4 className="action-title">{item.title}</h4>
            <p className="action-description">{item.description}</p>
            {metadata.dueBy && (
              <span className="due-date">Due: {metadata.dueBy}</span>
            )}
          </div>
          {metadata.priority && (
            <span className={`priority-badge priority-${metadata.priority}`}>
              P{metadata.priority}
            </span>
          )}
        </div>
        <FeedbackButtons
          item={item}
          itemId={getItemId(item, index)}
          onFeedback={onFeedback}
          onChat={() => onChatAbout(item)}
          compact
        />
      </div>
    );
  };

  const renderInsight = (item, index) => {
    const metadata = item.metadata || {};

    return (
      <div className="feed-card insight-card" key={getItemId(item, index)}>
        <div className="insight-icon">📊</div>
        <div className="insight-content">
          <h4 className="insight-title">{item.title}</h4>
          <p className="insight-description">{item.description}</p>
          {metadata.dataPoint && (
            <div className="data-point">{metadata.dataPoint}</div>
          )}
        </div>
        <FeedbackButtons
          item={item}
          itemId={getItemId(item, index)}
          onFeedback={onFeedback}
          onChat={() => onChatAbout(item)}
          compact
        />
      </div>
    );
  };

  const renderChallengeCard = (item, index) => {
    const metadata = item.metadata || {};
    const difficulty = metadata.difficulty || 'medium';

    return (
      <div className="feed-card challenge-card" key={getItemId(item, index)}>
        <div className="card-header">
          <span className="category-badge challenge">
            🎯 Challenge
          </span>
          <span className={`difficulty-badge ${difficulty}`}>
            {difficulty}
          </span>
        </div>
        <h3 className="card-title">{item.title}</h3>
        <p className="card-description">{item.description}</p>
        {metadata.reward && (
          <div className="reward-note">
            <span>🏆</span> {metadata.reward}
          </div>
        )}
        <div className="card-footer">
          <button className="action-btn primary">Accept Challenge</button>
          <FeedbackButtons
            item={item}
            itemId={getItemId(item, index)}
            onFeedback={onFeedback}
            onChat={() => onChatAbout(item)}
          />
        </div>
      </div>
    );
  };

  const renderGenericCard = (item, index) => {
    const config = categoryConfig[item.category] || { icon: '📦', color: '#6b7280' };

    return (
      <div className="feed-card generic-card animate-fade-in" key={getItemId(item, index)} style={{ animationDelay: `${index * 0.05}s` }}>
        <div className="card-header">
          <span className="category-badge" style={{ background: config.color }}>
            {config.icon} {item.category?.replace('_', ' ')}
          </span>
          {item.timeToComplete && (
            <span className="time-badge">{item.timeToComplete}</span>
          )}
        </div>
        <h3 className="card-title">{item.title}</h3>
        <p className="card-description">{item.description}</p>
        {item.actionItem && (
          <div className="action-item-section">
            <strong>Action:</strong> {item.actionItem}
          </div>
        )}
        <div className="card-footer">
          <ItemActions
            item={item}
            onChat={() => onChatAbout(item)}
          />
        </div>
      </div>
    );
  };

  const renderItem = (item, index) => {
    // Use format for new items, fallback to category-based rendering
    const format = item.format;

    if (format) {
      switch (format) {
        case 'quick_tip':
          return renderQuickTip(item, index);
        case 'tool_recommendation':
          return renderToolCard(item, index);
        case 'article':
          return renderArticleCard(item, index);
        case 'stack_upgrade':
          return renderStackUpgrade(item, index);
        case 'learning_path':
          return renderLearningPath(item, index);
        case 'action_item':
          return renderActionItem(item, index);
        case 'insight':
          return renderInsight(item, index);
        case 'challenge':
          return renderChallengeCard(item, index);
        default:
          return renderGenericCard(item, index);
      }
    }

    // Fallback for legacy format
    return renderGenericCard(item, index);
  };

  return (
    <div className="proactive-feed">
      <div className="feed-grid">
        {items.map((item, index) => renderItem(item, index))}
      </div>

      {/* Daily Challenge Section */}
      {dailyChallenge && (
        <div className="daily-challenge-section">
          <div className="section-header">
            <h3>🎯 Today's Challenge</h3>
            <span className={`difficulty-badge ${dailyChallenge.difficulty}`}>
              {dailyChallenge.difficulty}
            </span>
          </div>
          <h4>{dailyChallenge.title}</h4>
          <p>{dailyChallenge.description}</p>
        </div>
      )}

      {/* Reflection Section */}
      {reflection && (
        <div className="reflection-section">
          <div className="section-header">
            <h3>🤔 Reflection</h3>
          </div>
          <blockquote className="reflection-question">
            {reflection.question}
          </blockquote>
          {reflection.context && (
            <p className="reflection-context">{reflection.context}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default ProactiveFeed;
