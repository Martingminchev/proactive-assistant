import React from 'react';

interface Suggestion {
  id: string;
  type: string;
  status: 'pending' | 'accepted' | 'dismissed' | 'applied';
  timestamp: number;
}

interface UserStats {
  suggestionsAccepted: number;
  suggestionsDismissed: number;
  timeInFocusMode: number; // in minutes
  linesOptimized: number;
  currentStreak: number;
}

interface StatsPanelProps {
  stats: UserStats;
  suggestions: Suggestion[];
}

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <div className="stat-card" style={{ '--stat-color': color } as React.CSSProperties}>
    <i className={`codicon ${icon}`} aria-hidden="true" />
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, suggestions }) => {
  // Calculate derived stats
  const totalSuggestions = suggestions.length;
  const acceptedSuggestions = suggestions.filter(s => s.status === 'accepted' || s.status === 'applied').length;
  const dismissedSuggestions = suggestions.filter(s => s.status === 'dismissed').length;
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending').length;

  const acceptanceRate = totalSuggestions > 0 
    ? Math.round((acceptedSuggestions / totalSuggestions) * 100) 
    : 0;

  // Group by type
  const byType = suggestions.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="stats-panel">
      {/* Header */}
      <div className="stats-header">
        <h2>
          <i className="codicon codicon-dashboard" aria-hidden="true" />
          Your Productivity
        </h2>
      </div>

      {/* Main Stats Grid */}
      <div className="stats-grid">
        <StatCard
          icon="codicon-check"
          label="Suggestions Accepted"
          value={stats.suggestionsAccepted}
          color="#89d185"
        />
        <StatCard
          icon="codicon-target"
          label="Focus Time"
          value={formatTime(stats.timeInFocusMode)}
          color="#b180d7"
        />
        <StatCard
          icon="codicon-flame"
          label="Current Streak"
          value={`${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}`}
          color="#ff6b35"
        />
        <StatCard
          icon="codicon-code"
          label="Lines Optimized"
          value={stats.linesOptimized}
          color="#3794ff"
        />
      </div>

      {/* Session Stats */}
      <div className="stats-section">
        <h3>Session Stats</h3>
        <div className="stats-list">
          <div className="stats-row">
            <span>Total Suggestions</span>
            <span className="stats-badge">{totalSuggestions}</span>
          </div>
          <div className="stats-row">
            <span>Accepted</span>
            <span className="stats-badge success">{acceptedSuggestions}</span>
          </div>
          <div className="stats-row">
            <span>Dismissed</span>
            <span className="stats-badge">{dismissedSuggestions}</span>
          </div>
          <div className="stats-row">
            <span>Pending</span>
            <span className="stats-badge warning">{pendingSuggestions}</span>
          </div>
          <div className="stats-row highlight">
            <span>Acceptance Rate</span>
            <span className="stats-badge primary">{acceptanceRate}%</span>
          </div>
        </div>
      </div>

      {/* By Type */}
      {Object.keys(byType).length > 0 && (
        <div className="stats-section">
          <h3>Suggestions by Type</h3>
          <div className="stats-bars">
            {Object.entries(byType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count], _index) => {
                const max = Math.max(...Object.values(byType));
                const percentage = (count / max) * 100;
                
                const typeConfig: Record<string, { icon: string; color: string }> = {
                  optimization: { icon: 'codicon-rocket', color: '#89d185' },
                  refactor: { icon: 'codicon-symbol-class', color: '#3794ff' },
                  bugfix: { icon: 'codicon-bug', color: '#f14c4c' },
                  style: { icon: 'codicon-symbol-color', color: '#cca700' },
                };
                const config = typeConfig[type] || { icon: 'codicon-lightbulb', color: '#858585' };

                return (
                  <div key={type} className="stat-bar-item">
                    <div className="stat-bar-label">
                      <i className={`codicon ${config.icon}`} style={{ color: config.color }} />
                      <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    </div>
                    <div className="stat-bar-track">
                      <div 
                        className="stat-bar-fill"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: config.color,
                        }}
                      />
                    </div>
                    <span className="stat-bar-value">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalSuggestions === 0 && (
        <div className="stats-empty">
          <i className="codicon codicon-graph" />
          <p>No stats yet</p>
          <span>Keep coding to see your productivity metrics!</span>
        </div>
      )}
    </div>
  );
};

export default StatsPanel;
