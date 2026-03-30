import { useState, useEffect, useCallback } from 'react';
import SuggestionCard from './SuggestionCard';
import './SuggestionPanel.css';

function SuggestionPanel() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState(null);

  const fetchSuggestions = useCallback(async () => {
    try {
      const response = await fetch('/api/suggestions/active');
      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchJobStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/suggestions/job/status');
      const data = await response.json();
      setJobStatus(data);
    } catch (err) {
      console.error('Error fetching job status:', err);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
    fetchJobStatus();
    
    // Poll for new suggestions every 30 seconds
    const suggestionInterval = setInterval(fetchSuggestions, 30000);
    // Poll job status every 60 seconds
    const statusInterval = setInterval(fetchJobStatus, 60000);
    
    return () => {
      clearInterval(suggestionInterval);
      clearInterval(statusInterval);
    };
  }, [fetchSuggestions, fetchJobStatus]);

  const handleDismiss = async (id) => {
    try {
      await fetch(`/api/suggestions/${id}/dismiss`, { method: 'POST' });
      setSuggestions(prev => prev.filter(s => s._id !== id));
    } catch (err) {
      console.error('Error dismissing suggestion:', err);
    }
  };

  const handleSnooze = async (id, minutes) => {
    try {
      await fetch(`/api/suggestions/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      });
      setSuggestions(prev => prev.filter(s => s._id !== id));
    } catch (err) {
      console.error('Error snoozing suggestion:', err);
    }
  };

  const handleAction = async (id, actionType, payload) => {
    try {
      await fetch(`/api/suggestions/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, payload })
      });
      // Optionally remove actioned suggestions
      if (actionType !== 'link' && actionType !== 'copy') {
        setSuggestions(prev => prev.filter(s => s._id !== id));
      }
    } catch (err) {
      console.error('Error marking action:', err);
    }
  };

  const triggerGeneration = async () => {
    try {
      setIsGenerating(true);
      const response = await fetch('/api/suggestions/trigger', { method: 'POST' });
      const data = await response.json();
      
      if (data.status === 'started') {
        // Wait a bit then refresh
        setTimeout(() => {
          fetchSuggestions();
          setIsGenerating(false);
        }, 5000);
      } else {
        setIsGenerating(false);
      }
    } catch (err) {
      console.error('Error triggering generation:', err);
      setIsGenerating(false);
    }
  };

  const dismissAll = async () => {
    try {
      for (const suggestion of suggestions) {
        await fetch(`/api/suggestions/${suggestion._id}/dismiss`, { method: 'POST' });
      }
      setSuggestions([]);
    } catch (err) {
      console.error('Error dismissing all:', err);
    }
  };

  if (loading) {
    return (
      <div className={`suggestion-panel ${isMinimized ? 'minimized' : ''}`}>
        <div className="panel-header">
          <h3>AI Assistant</h3>
        </div>
        <div className="panel-loading">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
          <p>Loading suggestions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`suggestion-panel ${isMinimized ? 'minimized' : ''}`}>
      <div className="panel-header" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="header-left">
          <span className="panel-icon">🤖</span>
          <h3>AI Assistant</h3>
          {suggestions.length > 0 && (
            <span className="suggestion-count">{suggestions.length}</span>
          )}
        </div>
        <div className="header-right">
          <button 
            className="minimize-btn"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="panel-controls">
            <button 
              className="refresh-btn"
              onClick={triggerGeneration}
              disabled={isGenerating}
              title="Generate new suggestions"
            >
              {isGenerating ? '⏳' : '🔄'} {isGenerating ? 'Generating...' : 'Check Now'}
            </button>
            {suggestions.length > 0 && (
              <button 
                className="dismiss-all-btn"
                onClick={dismissAll}
                title="Dismiss all suggestions"
              >
                Clear All
              </button>
            )}
          </div>

          {jobStatus && (
            <div className="job-status">
              <span className={`status-dot ${jobStatus.isRunning ? 'running' : 'idle'}`}></span>
              <span className="status-text">
                {jobStatus.isRunning ? 'Analyzing...' : 'Monitoring'}
              </span>
              {jobStatus.lastRun && (
                <span className="last-run">
                  Last check: {new Date(jobStatus.lastRun).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="panel-error">
              {error}
            </div>
          )}

          <div className="suggestions-list">
            {suggestions.length === 0 ? (
              <div className="no-suggestions">
                <span className="no-suggestions-icon">✨</span>
                <p>No suggestions right now</p>
                <small>Your AI assistant is monitoring your activity and will provide helpful suggestions as you work.</small>
              </div>
            ) : (
              suggestions.map(suggestion => (
                <SuggestionCard
                  key={suggestion._id}
                  suggestion={suggestion}
                  onDismiss={handleDismiss}
                  onSnooze={handleSnooze}
                  onAction={handleAction}
                />
              ))
            )}
          </div>

          <div className="panel-footer">
            <small>Checks every 10 minutes</small>
          </div>
        </>
      )}
    </div>
  );
}

export default SuggestionPanel;
