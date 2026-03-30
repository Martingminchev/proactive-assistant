import React, { useState } from 'react';

interface Suggestion {
  id: string;
  type: 'optimization' | 'refactor' | 'bugfix' | 'style';
  title: string;
  description: string;
  code?: string;
  fileName?: string;
  lineNumber?: number;
  confidence: number;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onView: (id: string) => void;
}

const typeConfig: Record<Suggestion['type'], { icon: string; label: string; color: string }> = {
  optimization: {
    icon: 'codicon-rocket',
    label: 'Optimization',
    color: '#89d185',
  },
  refactor: {
    icon: 'codicon-symbol-class',
    label: 'Refactor',
    color: '#3794ff',
  },
  bugfix: {
    icon: 'codicon-bug',
    label: 'Bug Fix',
    color: '#f14c4c',
  },
  style: {
    icon: 'codicon-symbol-color',
    label: 'Style',
    color: '#cca700',
  },
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onAccept,
  onDismiss,
  onView,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = typeConfig[suggestion.type];

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.9) return 'High confidence';
    if (confidence >= 0.7) return 'Medium confidence';
    return 'Review suggested';
  };

  const getConfidenceClass = (confidence: number): string => {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  };

  return (
    <article
      className={`suggestion-card ${isExpanded ? 'expanded' : ''}`}
      data-type={suggestion.type}
      role="article"
      aria-label={`Suggestion: ${suggestion.title}`}
    >
      {/* Card Header */}
      <div className="suggestion-card-header">
        <div className="suggestion-type" style={{ color: config.color }}>
          <i className={`codicon ${config.icon}`} aria-hidden="true" />
          <span>{config.label}</span>
        </div>
        <div className={`suggestion-confidence ${getConfidenceClass(suggestion.confidence)}`}>
          <div className="confidence-bar" style={{ width: `${suggestion.confidence * 100}%` }} />
          <span>{getConfidenceLabel(suggestion.confidence)}</span>
        </div>
      </div>

      {/* Card Content */}
      <div className="suggestion-card-content">
        <h3 className="suggestion-title">{suggestion.title}</h3>
        <p className="suggestion-description">{suggestion.description}</p>

        {/* Location Info */}
        {suggestion.fileName && (
          <div className="suggestion-location">
            <i className="codicon codicon-file-code" aria-hidden="true" />
            <span>{suggestion.fileName}</span>
            {suggestion.lineNumber && (
              <span className="line-number">:{suggestion.lineNumber}</span>
            )}
          </div>
        )}

        {/* Code Preview (when expanded) */}
        {isExpanded && suggestion.code && (
          <div className="suggestion-code">
            <pre>
              <code>{suggestion.code}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className="suggestion-card-actions">
        <button
          className="action-button secondary"
          onClick={() => onDismiss(suggestion.id)}
          title="Dismiss this suggestion"
          aria-label="Dismiss suggestion"
        >
          <i className="codicon codicon-close" aria-hidden="true" />
          <span>Dismiss</span>
        </button>
        
        {suggestion.code && (
          <button
            className="action-button secondary"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Hide code' : 'Show code'}
            aria-label={isExpanded ? 'Hide code preview' : 'Show code preview'}
            aria-expanded={isExpanded}
          >
            <i className={`codicon ${isExpanded ? 'codicon-chevron-up' : 'codicon-chevron-down'}`} aria-hidden="true" />
            <span>{isExpanded ? 'Hide' : 'Show Code'}</span>
          </button>
        )}

        <button
          className="action-button secondary"
          onClick={() => onView(suggestion.id)}
          title="View in editor"
          aria-label="View in editor"
        >
          <i className="codicon codicon-go-to-file" aria-hidden="true" />
          <span>View</span>
        </button>

        <button
          className="action-button primary"
          onClick={() => onAccept(suggestion.id)}
          title="Apply this suggestion"
          aria-label="Apply suggestion"
        >
          <i className="codicon codicon-check" aria-hidden="true" />
          <span>Apply</span>
        </button>
      </div>
    </article>
  );
};

export default SuggestionCard;
