import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import './Dashboard.css';

// Category configuration with icons and colors
const categoryConfig = {
  productivity_tips: { icon: '⚡', label: 'Productivity', color: '#f59e0b' },
  software_tools: { icon: '🔧', label: 'Tools', color: '#8b5cf6' },
  videos: { icon: '🎬', label: 'Video', color: '#ef4444' },
  articles: { icon: '📄', label: 'Article', color: '#3b82f6' },
  learning_resources: { icon: '📚', label: 'Learning', color: '#10b981' },
  books: { icon: '📖', label: 'Book', color: '#6366f1' },
  podcasts: { icon: '🎧', label: 'Podcast', color: '#ec4899' },
  communities: { icon: '👥', label: 'Community', color: '#14b8a6' },
  events: { icon: '📅', label: 'Event', color: '#f97316' },
  wellness: { icon: '🧘', label: 'Wellness', color: '#22c55e' },
  project_ideas: { icon: '💡', label: 'Project Idea', color: '#eab308' },
  automations: { icon: '🤖', label: 'Automation', color: '#64748b' },
  people_to_follow: { icon: '👤', label: 'Follow', color: '#0ea5e9' },
  challenges: { icon: '🎯', label: 'Challenge', color: '#dc2626' },
  quick_wins: { icon: '✅', label: 'Quick Win', color: '#16a34a' }
};

function Dashboard() {
  const [todayBrief, setTodayBrief] = useState(null);
  const [briefHistory, setBriefHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchTodayBrief();
    fetchBriefHistory();
    fetchStats();
    
    const interval = setInterval(() => {
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchTodayBrief = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/briefs/today');
      const data = await response.json();
      
      if (data.message && data.message.includes('No brief generated yet')) {
        setTodayBrief({ message: data.message });
      } else {
        setTodayBrief(data);
      }
    } catch (error) {
      setError('Failed to fetch today\'s brief');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBriefHistory = async () => {
    try {
      const response = await fetch('/api/briefs/history?limit=7');
      const data = await response.json();
      setBriefHistory(data.briefs || []);
    } catch (error) {
      console.error('Error fetching brief history:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/briefs/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const triggerBriefGeneration = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      const response = await fetch('/api/briefs/generate', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.status === 'started') {
        setTimeout(() => {
          fetchTodayBrief();
          fetchBriefHistory();
          setGenerating(false);
        }, 5000);
      } else if (data.status === 'running') {
        setError('Brief generation already in progress');
        setGenerating(false);
      }
    } catch (error) {
      setError('Failed to trigger brief generation');
      setGenerating(false);
      console.error('Error:', error);
    }
  };

  if (loading) {
    return (
      <div className="dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your daily brief...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {stats && (
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Total Briefs:</span>
            <span className="stat-value">{stats.totalBriefs || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Last Brief:</span>
            <span className="stat-value">
              {stats.latestBriefDate ? format(new Date(stats.latestBriefDate), 'MMM d, yyyy') : 'Never'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Generation Time:</span>
            <span className="stat-value">
              {stats.avgGenerationTime ? `${(stats.avgGenerationTime / 1000).toFixed(2)}s` : 'N/A'}
            </span>
          </div>
        </div>
      )}

      <div className="dashboard-header">
        <h2>Daily Brief</h2>
        <button 
          onClick={triggerBriefGeneration}
          disabled={generating}
          className={`generate-btn ${generating ? 'generating' : ''}`}
        >
          {generating ? '⏳ Generating...' : '🚀 Generate Brief Now'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="tabs">
        <button 
          className={activeTab === 'today' ? 'active' : ''}
          onClick={() => setActiveTab('today')}
        >
          Today's Brief
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      {activeTab === 'today' && renderTodayBrief()}
      {activeTab === 'history' && renderHistory()}
    </div>
  );

  function renderTodayBrief() {
    if (todayBrief && todayBrief.message) {
      return (
        <div className="no-brief">
          <p>{todayBrief.message}</p>
          <button onClick={triggerBriefGeneration} disabled={generating}>
            Generate First Brief
          </button>
        </div>
      );
    }

    if (!todayBrief) {
      return (
        <div className="no-brief">
          <p>No brief data available</p>
        </div>
      );
    }

    // Check if this is a new-format brief (has recommendations array)
    const isNewFormat = todayBrief.recommendations && todayBrief.recommendations.length > 0;

    return (
      <div className="brief-content">
        {/* New format: Greeting and Activity Summary */}
        {isNewFormat && todayBrief.greeting && (
          <div className="greeting-section">
            <p className="greeting">{todayBrief.greeting}</p>
            {todayBrief.activitySummary && (
              <p className="activity-summary">{todayBrief.activitySummary}</p>
            )}
          </div>
        )}

        {/* New format: Quick Tip */}
        {isNewFormat && todayBrief.quickTip && (
          <div className="quick-tip">
            <span className="tip-icon">💡</span>
            <span className="tip-text">{todayBrief.quickTip}</span>
          </div>
        )}

        {/* New format: Dynamic Recommendations */}
        {isNewFormat && (
          <section className="section recommendations-section">
            <h2>📋 Your Personalized Recommendations</h2>
            <div className="recommendations-grid">
              {todayBrief.recommendations.map((item, idx) => {
                const config = categoryConfig[item.category] || { icon: '📌', label: item.category, color: '#6b7280' };
                return (
                  <div 
                    key={idx} 
                    className="card recommendation-card"
                    style={{ borderLeftColor: config.color }}
                  >
                    <div className="card-header">
                      <span className="category-badge" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
                        {config.icon} {config.label}
                      </span>
                      {item.timeToComplete && (
                        <span className="time-badge">⏱ {item.timeToComplete}</span>
                      )}
                    </div>
                    <h3>{item.title}</h3>
                    <div className="card-content">
                      <ReactMarkdown>{item.description}</ReactMarkdown>
                    </div>
                    {item.actionItem && (
                      <div className="action-item">
                        <strong>Next Step:</strong> {item.actionItem}
                      </div>
                    )}
                    <div className="card-footer">
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="read-more">
                          Learn More →
                        </a>
                      )}
                      {item.relevanceScore && (
                        <div className="relevance">
                          Relevance: {item.relevanceScore}/10
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* New format: Daily Challenge */}
        {isNewFormat && todayBrief.dailyChallenge && todayBrief.dailyChallenge.title && (
          <section className="section challenge-section">
            <h2>🎯 Daily Challenge</h2>
            <div className="card challenge-card">
              <div className="challenge-header">
                <h3>{todayBrief.dailyChallenge.title}</h3>
                {todayBrief.dailyChallenge.difficulty && (
                  <span className={`difficulty-badge ${todayBrief.dailyChallenge.difficulty}`}>
                    {todayBrief.dailyChallenge.difficulty}
                  </span>
                )}
              </div>
              <div className="card-content">
                <ReactMarkdown>{todayBrief.dailyChallenge.description}</ReactMarkdown>
              </div>
            </div>
          </section>
        )}

        {/* New format: Reflection */}
        {isNewFormat && todayBrief.reflection && todayBrief.reflection.question && (
          <section className="section reflection-section">
            <h2>🤔 Reflection</h2>
            <div className="card reflection-card">
              <blockquote className="reflection-question">
                "{todayBrief.reflection.question}"
              </blockquote>
              {todayBrief.reflection.context && (
                <p className="reflection-context">{todayBrief.reflection.context}</p>
              )}
            </div>
          </section>
        )}

        {/* Legacy format: Improvements */}
        {!isNewFormat && todayBrief.improvements && todayBrief.improvements.length > 0 && (
          <section className="section improvements-section">
            <h2>💡 Code Improvements</h2>
            {todayBrief.improvements.map((item, idx) => (
              <div key={idx} className="card improvement-card">
                <h3>{item.title}</h3>
                <div className="card-content">
                  <ReactMarkdown>{item.description}</ReactMarkdown>
                </div>
                {item.relevanceScore && (
                  <div className="relevance">
                    Relevance: {item.relevanceScore}/10
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Legacy format: News */}
        {!isNewFormat && todayBrief.news && todayBrief.news.length > 0 && (
          <section className="section news-section">
            <h2>📰 News For You</h2>
            {todayBrief.news.map((item, idx) => (
              <div key={idx} className="card news-card">
                <h3>{item.title}</h3>
                <div className="card-content">
                  <ReactMarkdown>{item.description}</ReactMarkdown>
                </div>
                <div className="news-meta">
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="read-more">
                      Read More →
                    </a>
                  )}
                  {item.relevanceScore && (
                    <div className="relevance">
                      Relevance: {item.relevanceScore}/10
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Legacy format: MVP Idea */}
        {!isNewFormat && todayBrief.mvpIdea && todayBrief.mvpIdea.length > 0 && (
          <section className="section mvp-section">
            <h2>🚀 MVP Idea of the Day</h2>
            {todayBrief.mvpIdea.map((item, idx) => (
              <div key={idx} className="card mvp-card">
                <h3>{item.title}</h3>
                <div className="card-content">
                  <ReactMarkdown>{item.description}</ReactMarkdown>
                </div>
              </div>
            ))}
          </section>
        )}

        <div className="brief-footer">
          <small>
            Generated on {format(new Date(todayBrief.generatedAt), 'MMMM d, yyyy \'at\' h:mm a')}
            {todayBrief.generationTime && ` in ${(todayBrief.generationTime / 1000).toFixed(2)}s`}
            {todayBrief.provider && ` • Provider: ${todayBrief.provider}`}
          </small>
        </div>
      </div>
    );
  }

  function renderHistory() {
    if (briefHistory.length === 0) {
      return (
        <div className="no-brief">
          <p>No brief history available yet</p>
        </div>
      );
    }

    return (
      <div className="brief-history">
        {briefHistory?.length > 0 && briefHistory.map(brief => {
          const isNewFormat = brief.recommendations && brief.recommendations.length > 0;
          return (
            <div key={brief._id} className="history-item">
              <div className="history-header">
                <h3>{format(new Date(brief.date), 'EEEE, MMMM d, yyyy')}</h3>
                <div className="history-stats">
                  {isNewFormat ? (
                    <>
                      <span>📋 {brief.recommendations?.length || 0} recommendations</span>
                      {brief.dailyChallenge?.title && <span>🎯 Challenge</span>}
                    </>
                  ) : (
                    <>
                      <span>💡 {brief.improvements?.length || 0} improvements</span>
                      <span>📰 {brief.news?.length || 0} articles</span>
                      <span>🚀 {brief.mvpIdea?.length || 0} ideas</span>
                    </>
                  )}
                </div>
              </div>
              <p className="history-summary">
                Generated {format(new Date(brief.generatedAt), 'MMMM d, yyyy \'at\' h:mm a')}
                {brief.generationTime && ` (${(brief.generationTime / 1000).toFixed(2)}s)`}
                {brief.provider && ` • ${brief.provider}`}
              </p>
            </div>
          );
        })}
      </div>
    );
  }
}

export default Dashboard;
