import React from 'react';
import type { UserStats, DailyStats } from '../types';

interface StatsPanelProps {
  stats: UserStats | null;
}

// Day labels
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Format minutes to hours and minutes
const formatTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Stat card component
const StatCard: React.FC<{
  icon: string;
  label: string;
  value: string | number;
  subtext?: string;
  accent?: boolean;
}> = ({ icon, label, value, subtext, accent }) => (
  <div className={`stat-card ${accent ? 'accent' : ''}`}>
    <span className="stat-icon" aria-hidden="true">{icon}</span>
    <div className="stat-content">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {subtext && <span className="stat-subtext">{subtext}</span>}
    </div>
  </div>
);

// Weekly chart component
const WeeklyChart: React.FC<{ week: DailyStats[] }> = ({ week }) => {
  const maxValue = Math.max(...(week || []).map(d => d?.suggestionsAccepted || 0), 1);
  const today = new Date().getDay();

  return (
    <div className="weekly-chart">
      <h3 className="chart-title">Weekly Activity</h3>
      <div className="chart-container" role="img" aria-label="Weekly suggestions accepted">
        {week.map((day) => {
          const date = new Date(day.date);
          const dayIndex = date.getDay();
          const isToday = dayIndex === today;
          const height = day.suggestionsAccepted > 0 
            ? (day.suggestionsAccepted / maxValue) * 100 
            : 4;

          return (
            <div key={day.date} className="chart-bar-wrapper">
              <div 
                className={`chart-bar ${isToday ? 'today' : ''}`}
                style={{ height: `${height}%` }}
                title={`${DAYS[dayIndex]}: ${day.suggestionsAccepted} accepted`}
              >
                {day.suggestionsAccepted > 0 && (
                  <span className="bar-value">{day.suggestionsAccepted}</span>
                )}
              </div>
              <span className={`bar-label ${isToday ? 'today' : ''}`}>
                {DAYS[dayIndex].charAt(0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Streak display component
const StreakDisplay: React.FC<{ streak: number }> = ({ streak }) => (
  <div className="streak-display-large">
    <div className="streak-ring">
      <div className="streak-center">
        <span className="streak-icon" aria-hidden="true">🔥</span>
        <span className="streak-number">{streak}</span>
      </div>
      {streak >= 7 && <div className="streak-glow" />}
    </div>
    <span className="streak-text">
      {streak === 0 ? 'Start your streak today!' : `Day streak${streak === 1 ? '' : 's'}`}
    </span>
  </div>
);

// Acceptance rate gauge
const AcceptanceGauge: React.FC<{ rate: number }> = ({ rate }) => {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (rate / 100) * circumference;

  return (
    <div className="acceptance-gauge">
      <svg viewBox="0 0 100 100" className="gauge-svg">
        <circle
          className="gauge-bg"
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="8"
        />
        <circle
          className="gauge-fill"
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="gauge-content">
        <span className="gauge-value">{Math.round(rate)}%</span>
        <span className="gauge-label">Acceptance</span>
      </div>
    </div>
  );
};

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  if (!stats) {
    return (
      <div className="stats-panel loading">
        <div className="stats-skeleton">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>
    );
  }

  const { 
    today, 
    week, 
    streak, 
    totalTimeSaved, 
    totalSuggestionsAccepted, 
    totalSuggestionsShown 
  } = stats || {};

  const safeToday = today || { 
    suggestionsShown: 0, 
    suggestionsAccepted: 0, 
    focusMinutes: 0, 
    focusSessions: 0, 
    timeSaved: 0, 
    filesWorkedOn: [] 
  };

  const safeWeek = week || [];
  const safeStreak = streak || 0;
  const safeTotalTimeSaved = totalTimeSaved || 0;
  const safeTotalSuggestionsAccepted = totalSuggestionsAccepted || 0;
  const safeTotalSuggestionsShown = totalSuggestionsShown || 0;
  
  const acceptanceRate = safeTotalSuggestionsShown > 0 
    ? (safeTotalSuggestionsAccepted / safeTotalSuggestionsShown) * 100 
    : 0;

  return (
    <div className="stats-panel">
      {/* Today's stats grid */}
      <section className="today-stats">
        <h2 className="section-title">Today</h2>
        <div className="stats-grid">
          <StatCard
            icon="💡"
            label="Suggestions"
            value={safeToday.suggestionsShown}
            subtext={`${safeToday.suggestionsAccepted} accepted`}
          />
          <StatCard
            icon="⏱️"
            label="Focus Time"
            value={formatTime(safeToday.focusMinutes)}
            subtext={`${safeToday.focusSessions} session${safeToday.focusSessions === 1 ? '' : 's'}`}
          />
          <StatCard
            icon="🚀"
            label="Time Saved"
            value={formatTime(safeToday.timeSaved)}
            accent
          />
        </div>
      </section>

      {/* Weekly chart */}
      <WeeklyChart week={safeWeek} />

      {/* Streak and overall stats */}
      <section className="overall-stats">
        <div className="stats-row">
          <StreakDisplay streak={safeStreak} />
          
          <div className="overall-metrics">
            <div className="metric">
              <AcceptanceGauge rate={acceptanceRate} />
            </div>
            
            <div className="metric-list">
              <div className="metric-item">
                <span className="metric-icon" aria-hidden="true">💾</span>
                <div className="metric-info">
                  <span className="metric-value">{formatTime(safeTotalTimeSaved)}</span>
                  <span className="metric-label">Total Time Saved</span>
                </div>
              </div>
              
              <div className="metric-item">
                <span className="metric-icon" aria-hidden="true">✨</span>
                <div className="metric-info">
                  <span className="metric-value">{safeTotalSuggestionsAccepted}</span>
                  <span className="metric-label">Suggestions Applied</span>
                </div>
              </div>
              
              <div className="metric-item">
                <span className="metric-icon" aria-hidden="true">📁</span>
                <div className="metric-info">
                  <span className="metric-value">{safeToday.filesWorkedOn.length}</span>
                  <span className="metric-label">Files Today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StatsPanel;
