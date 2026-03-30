import React, { useState, useCallback } from 'react';
import type { Suggestion, SuggestionType } from '../types';
import { useTheme } from '../hooks/useTheme';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
}

// Type icons with colors (using SVG instead of emoji for compatibility)
const typeConfig: Record<SuggestionType, { icon: React.ReactNode; label: string; color: string }> = {
  error: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 12a1 1 0 110-2 1 1 0 010 2zm0-3a1 1 0 01-1-1V4a1 1 0 112 0v4a1 1 0 01-1 1z"/>
      </svg>
    ),
    label: 'Error Prevention',
    color: 'var(--vscode-errorForeground)'
  },
  warning: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1l-7 13h14L8 1zm0 11a1 1 0 110-2 1 1 0 010 2zm0-3a1 1 0 01-1-1V5a1 1 0 112 0v3a1 1 0 01-1 1z"/>
      </svg>
    ),
    label: 'Warning',
    color: 'var(--vscode-editorWarning-foreground)'
  },
  tip: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0a6 6 0 00-6 6c0 2.32 1.32 4.33 3.25 5.33L6 14.5a.5.5 0 00.5.5h3a.5.5 0 00.5-.5l.75-3.17A6.002 6.002 0 008 0zM5 6a1 1 0 112 0 1 1 0 01-2 0zm4 0a1 1 0 112 0 1 1 0 01-2 0z"/>
      </svg>
    ),
    label: 'Tip',
    color: 'var(--vscode-editorInfo-foreground)'
  },
  celebration: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0L6.5 6.5 0 8l6.5 1.5L8 16l1.5-6.5L16 8l-6.5-1.5z"/>
      </svg>
    ),
    label: 'Achievement',
    color: 'var(--vscode-testing-iconPassed)'
  }
};

// Default config for unknown types
const defaultConfig = {
  icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0a6 6 0 00-6 6c0 2.32 1.32 4.33 3.25 5.33L6 14.5a.5.5 0 00.5.5h3a.5.5 0 00.5-.5l.75-3.17A6.002 6.002 0 008 0zM5 6a1 1 0 112 0 1 1 0 01-2 0zm4 0a1 1 0 112 0 1 1 0 01-2 0z"/>
    </svg>
  ),
  label: 'Suggestion',
  color: 'var(--vscode-editorInfo-foreground)'
};

// Confidence indicator
const ConfidenceBar: React.FC<{ confidence: number }> = ({ confidence }) => {
  // Ensure confidence is a valid number between 0 and 1
  const validConfidence = typeof confidence === 'number' && !isNaN(confidence) 
    ? Math.max(0, Math.min(1, confidence)) 
    : 0.8;
  const percentage = Math.round(validConfidence * 100);
  let color = 'var(--vscode-errorForeground)';
  if (validConfidence >= 0.7) color = 'var(--vscode-testing-iconPassed)';
  else if (validConfidence >= 0.4) color = 'var(--vscode-editorWarning-foreground)';

  return (
    <div className="confidence-bar" title={`${percentage}% confidence`}>
      <div className="confidence-track">
        <div 
          className="confidence-fill"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>
      <span className="confidence-label">{percentage}%</span>
    </div>
  );
};

// Code block with syntax highlighting placeholder
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const lines = code.split('\n');
  const shouldTruncate = lines.length > 6;
  const displayCode = isExpanded || !shouldTruncate ? code : lines.slice(0, 6).join('\n') + '\n...';

  return (
    <div className="code-block">
      <div className="code-header">
        {language && <span className="code-language">{language}</span>}
        {shouldTruncate && (
          <button 
            className="code-expand"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse code' : 'Expand code'}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
      <pre className="code-content">
        <code>{displayCode}</code>
      </pre>
    </div>
  );
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onApply,
  onDismiss,
  onSnooze
}) => {
  const { colors } = useTheme();
  const [isApplying, setIsApplying] = useState(false);
  
  // Handle missing or invalid type
  const suggestionType = suggestion.type || 'tip';
  const config = typeConfig[suggestionType] || defaultConfig;
  
  // Handle missing fields with defaults
  const title = suggestion.title || 'Suggestion';
  const message = suggestion.message || 'No details provided';
  const confidence = typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.8;

  const handleApply = useCallback(async () => {
    setIsApplying(true);
    // Small delay for visual feedback
    await new Promise(r => setTimeout(r, 200));
    onApply(suggestion.id);
  }, [suggestion.id, onApply]);

  const handleDismiss = useCallback(() => {
    onDismiss(suggestion.id);
  }, [suggestion.id, onDismiss]);

  const handleSnooze = useCallback(() => {
    onSnooze(suggestion.id);
  }, [suggestion.id, onSnooze]);

  const formatFilePath = (path?: string, line?: number) => {
    if (!path) return null;
    const fileName = path.split(/[/\\]/).pop() || path;
    return line ? `${fileName}:${line}` : fileName;
  };

  return (
    <article 
      className={`suggestion-card type-${suggestion.type}`}
      style={{ borderLeftColor: config.color }}
    >
      {/* Header */}
      <header className="suggestion-header">
        <div className="suggestion-type" style={{ color: config.color }}>
          <span className="type-icon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>{config.icon}</span>
          <span className="type-label">{config.label}</span>
        </div>
        <ConfidenceBar confidence={confidence} />
      </header>

      {/* Content */}
      <div className="suggestion-content">
        <h3 className="suggestion-title">{title}</h3>
        <p className="suggestion-message">{message}</p>
        
        {suggestion.code && (
          <CodeBlock code={suggestion.code} language={suggestion.language} />
        )}

        {suggestion.filePath && (
          <div className="suggestion-context">
            <span className="context-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 1h5l3 3v9a2 2 0 01-2 2H4a2 2 0 01-2-2V3a2 2 0 012-2zm0 1a1 1 0 00-1 1v10a1 1 0 001 1h6a1 1 0 001-1V5H9a1 1 0 01-1-1V2H4zm6 1.8V4h1.5L10 2.8z"/>
              </svg>
            </span>
            <code className="context-file">
              {formatFilePath(suggestion.filePath, suggestion.lineNumber)}
            </code>
          </div>
        )}
      </div>

      {/* Actions */}
      <footer className="suggestion-actions">
        <button
          className="action-button primary"
          onClick={handleApply}
          disabled={isApplying}
          aria-label="Apply suggestion"
          style={{
            backgroundColor: colors.buttonBackground,
            color: colors.buttonForeground
          }}
        >
          {isApplying ? (
            <>
              <span className="spinner" />
              Applying...
            </>
          ) : (
            <>
              <span className="action-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.5 2L6 9.5 2.5 6 1 7.5l5 5 8.5-8.5z"/>
                </svg>
              </span>
              Apply
            </>
          )}
        </button>
        
        <button
          className="action-button secondary"
          onClick={handleSnooze}
          aria-label="Snooze suggestion"
        >
          <span className="action-icon">⏰</span>
          Snooze
        </button>
        
        <button
          className="action-button tertiary"
          onClick={handleDismiss}
          aria-label="Dismiss suggestion"
        >
          <span className="action-icon">✕</span>
          Dismiss
        </button>
      </footer>
    </article>
  );
};

export default SuggestionCard;
