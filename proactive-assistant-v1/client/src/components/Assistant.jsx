import { useState, useCallback, useMemo } from 'react';
import { useBriefs } from '../hooks/useBriefs';
import { useGoals } from '../hooks/useGoals';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useTheme } from '../hooks/useTheme';
import { api } from '../api/client';
import ProactiveFeed from './ProactiveFeed';
import AssistantChat from './AssistantChat';
import GoalsPanel from './GoalsPanel';
import Settings from './Settings';
import { HistorySearch } from './HistorySearch';
import { PageSkeleton, HistoryItemSkeleton } from './Skeleton';

// New User-Friendly Components
import ActionCenter from './ActionCenter';
import CurrentFocus from './CurrentFocus';
import InsightsPanel from './InsightsPanel';
import DataQualityIndicator from './DataQualityIndicator';
import SmartBrief from './SmartBrief';

import './Assistant.css';

// Extracted sub-components for clarity
function Header({ stats, view, setView, goalsCount, onToggleGoals, onSettings, theme, onToggleTheme }) {
  return (
    <header className="assistant-header">
      <div className="header-left">
        <h1 className="assistant-title">Proactive Assistant</h1>
        {stats && (
          <span className="header-stats">{stats.totalBriefs || 0} briefs</span>
        )}
      </div>
      <nav className="header-nav">
        <NavButton 
          active={view === 'feed'} 
          onClick={() => setView('feed')}
          icon="📋"
          label="Feed"
        />
        <NavButton 
          active={view === 'dashboard'} 
          onClick={() => setView('dashboard')}
          icon="✨"
          label="New UI"
          className="new-ui-btn"
        />
        <NavButton 
          active={view === 'history'} 
          onClick={() => setView('history')}
          icon="📚"
          label="History"
        />
        <NavButton 
          active={false}
          onClick={onToggleGoals}
          icon="🎯"
          label="Goals"
          badge={goalsCount > 0 ? goalsCount : null}
        />
        <NavButton 
          active={view === 'settings'}
          onClick={onSettings}
          icon="⚙️"
          label="Settings"
          className="settings-btn"
        />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </nav>
    </header>
  );
}

function NavButton({ active, onClick, icon, label, badge, className = '' }) {
  return (
    <button 
      className={`nav-btn ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {badge && <span className="nav-badge">{badge}</span>}
    </button>
  );
}

function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div className="error-banner">
      <span className="error-icon">⚠️</span>
      <span className="error-text">{error}</span>
      <button className="error-dismiss" onClick={onDismiss}>×</button>
    </div>
  );
}

function GoalsBar({ goals, onEdit }) {
  if (goals.length === 0) return null;
  
  return (
    <div className="goals-bar">
      <span className="goals-bar-label">Active Goals:</span>
      <div className="goals-bar-tags">
        {goals.slice(0, 3).map((goal, i) => (
          <span key={goal._id || i} className="goal-chip">{goal.title}</span>
        ))}
        {goals.length > 3 && (
          <span className="goal-chip more">+{goals.length - 3}</span>
        )}
      </div>
      <button className="goals-edit-btn" onClick={onEdit}>Edit</button>
    </div>
  );
}

function BriefContent({ brief, isGenerating, onRegenerate }) {
  const items = brief?.items || brief?.recommendations || [];
  
  return (
    <div className="brief-container">
      <section className="greeting-section">
        <h2 className="greeting-text">{brief.greeting || 'Welcome back!'}</h2>
        {brief.activitySummary && (
          <p className="activity-summary">{brief.activitySummary}</p>
        )}
        
        {brief.focusArea && (
          <div className="focus-badge">
            <span className="focus-label">Current Focus:</span>
            <span className="focus-title">{brief.focusArea.title}</span>
            {brief.focusArea.confidence && (
              <span className={`focus-confidence ${brief.focusArea.confidence}`}>
                {brief.focusArea.confidence}
              </span>
            )}
          </div>
        )}

        {brief.contextSummary && (
          <div className="context-stats">
            {brief.contextSummary.filesAccessed > 0 && (
              <StatChip icon="📁" value={brief.contextSummary.filesAccessed} label="files" />
            )}
            {brief.contextSummary.websitesVisited > 0 && (
              <StatChip icon="🌐" value={brief.contextSummary.websitesVisited} label="websites" />
            )}
            {brief.contextSummary.totalActivities > 0 && (
              <StatChip icon="📊" value={brief.contextSummary.totalActivities} label="activities" />
            )}
          </div>
        )}

        {brief.quickTip && (
          <div className="quick-tip-bar">
            <span className="tip-icon">💡</span>
            <span className="tip-content">{brief.quickTip}</span>
          </div>
        )}
      </section>

      {items.length > 0 && (
        <ProactiveFeed 
          items={items}
          hasNewFormat={!!brief.items}
          dailyChallenge={brief.dailyChallenge}
          reflection={brief.reflection}
        />
      )}

      <div className="regenerate-section">
        <button 
          className="regenerate-btn"
          onClick={onRegenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <><span className="spinner-tiny"></span>Generating...</>
          ) : (
            <><span className="regen-icon">🔄</span>Regenerate Brief</>
          )}
        </button>
        <span className="last-generated">
          Generated {new Date(brief.generatedAt || brief.date).toLocaleTimeString()}
          {brief.generationTime && ` in ${(brief.generationTime / 1000).toFixed(1)}s`}
        </span>
      </div>
    </div>
  );
}

function StatChip({ icon, value, label }) {
  return (
    <span className="stat-chip">
      <span className="stat-icon">{icon}</span>
      {value} {label}
    </span>
  );
}

function EmptyState({ isGenerating, onGenerate }) {
  return (
    <div className="no-brief-cta">
      <span className="cta-icon">🚀</span>
      <h2>Ready to get started?</h2>
      <p>Generate your personalized daily brief based on your recent activity and goals.</p>
      <button 
        className="generate-btn primary"
        onClick={onGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <><span className="spinner-tiny"></span>Generating your brief...</>
        ) : (
          'Generate Today\'s Brief'
        )}
      </button>
      {isGenerating && (
        <p className="generating-hint">
          This may take 30-60 seconds as we analyze your activity...
        </p>
      )}
    </div>
  );
}

function HistoryView({ history, isLoading, onBack }) {
  const [selectedBrief, setSelectedBrief] = useState(null);
  
  if (selectedBrief) {
    return (
      <div className="history-view animate-fade-in">
        <div className="view-header">
          <h2>Brief Details</h2>
          <button className="back-btn" onClick={() => setSelectedBrief(null)}>
            ← Back to History
          </button>
        </div>
        <BriefDetailView brief={selectedBrief} />
      </div>
    );
  }

  return (
    <div className="history-view">
      <div className="view-header">
        <h2>Brief History</h2>
        <button className="back-btn" onClick={onBack}>← Back to Feed</button>
      </div>
      
      {isLoading ? (
        <div className="history-list">
          <HistoryItemSkeleton index={0} />
          <HistoryItemSkeleton index={1} />
          <HistoryItemSkeleton index={2} />
        </div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No previous briefs found.</p>
          <p className="empty-hint">Generate your first brief to get started!</p>
        </div>
      ) : (
        <HistorySearch 
          history={history} 
          onSelectBrief={setSelectedBrief}
        />
      )}
    </div>
  );
}

function BriefDetailView({ brief }) {
  const items = brief.items || brief.recommendations || [];
  
  return (
    <div className="brief-detail animate-fade-in">
      <div className="detail-header">
        <h3>{new Date(brief.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</h3>
        <span className="detail-provider">{brief.provider}</span>
      </div>
      
      {brief.greeting && <p className="detail-greeting">{brief.greeting}</p>}
      
      <div className="detail-items">
        <h4>Items ({items.length})</h4>
        {items.map((item, i) => (
          <div key={i} className="detail-item">
            <h5>{item.title}</h5>
            <p>{item.description}</p>
          </div>
        ))}
      </div>
      
      <div className="detail-meta">
        <span>Generated in {((brief.generationTime || 0) / 1000).toFixed(1)}s</span>
        {brief.contextSummary?.filesAccessed > 0 && (
          <span>• {brief.contextSummary.filesAccessed} files analyzed</span>
        )}
      </div>
    </div>
  );
}

function HistoryCard({ brief }) {
  const itemCount = brief.items?.length || brief.recommendations?.length || 0;
  
  return (
    <div className="history-card">
      <div className="history-card-header">
        <span className="history-date">
          {new Date(brief.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </span>
        <span className="history-provider">{brief.provider}</span>
      </div>
      {brief.greeting && <p className="history-greeting">{brief.greeting}</p>}
      <div className="history-meta">
        <MetaItem icon="📝" text={`${itemCount} items`} />
        <MetaItem icon="⏱" text={`${((brief.generationTime || 0) / 1000).toFixed(1)}s`} />
        {brief.contextSummary?.filesAccessed > 0 && (
          <MetaItem icon="📁" text={`${brief.contextSummary.filesAccessed} files`} />
        )}
      </div>
    </div>
  );
}

function MetaItem({ icon, text }) {
  return (
    <span className="meta-item">
      <span className="meta-icon">{icon}</span>
      {text}
    </span>
  );
}

// New Dashboard View with all the improved components
function NewDashboardView() {
  return (
    <div className="new-dashboard animate-fade-in">
      <div className="dashboard-grid">
        {/* Left Column - Focus & Brief */}
        <div className="dashboard-column main-column">
          <CurrentFocus />
          <SmartBrief />
        </div>
        
        {/* Right Column - Actions & Insights */}
        <div className="dashboard-column side-column">
          <ActionCenter />
          <InsightsPanel />
          <DataQualityIndicator />
        </div>
      </div>
    </div>
  );
}

// Keyboard shortcuts help component
function KeyboardShortcutsHelp({ isOpen, onClose }) {
  if (!isOpen) return null;
  
  const shortcuts = [
    { key: 'G', action: 'Generate new brief' },
    { key: 'H', action: 'View history' },
    { key: 'F', action: 'Toggle goals panel' },
    { key: ',', action: 'Open settings' },
    { key: 'ESC', action: 'Close panels / Go back' },
    { key: '?', action: 'Show this help' },
  ];
  
  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h3>Keyboard Shortcuts</h3>
          <button className="shortcuts-close" onClick={onClose}>×</button>
        </div>
        <div className="shortcuts-list">
          {shortcuts.map(({ key, action }) => (
            <div key={key} className="shortcut-item">
              <kbd>{key}</kbd>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Theme toggle button
function ThemeToggle({ theme, onToggle }) {
  return (
    <button 
      className="theme-toggle"
      onClick={onToggle}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

// Main component
export default function Assistant() {
  const [view, setView] = useState('feed');
  const [showGoalsPanel, setShowGoalsPanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [chatContext, setChatContext] = useState(null);
  
  const {
    todayBrief,
    history,
    stats,
    isLoading,
    isGenerating,
    error,
    setError,
    generate,
    fetchHistory,
  } = useBriefs();

  const { goals, addGoal } = useGoals();
  const { theme, toggle: toggleTheme } = useTheme();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'mod+g': () => {
      if (!isGenerating && view === 'feed') generate();
    },
    'mod+h': () => handleViewHistory(),
    'mod+f': () => setShowGoalsPanel(prev => !prev),
    'mod+,': () => setView('settings'),
    'escape': () => {
      if (chatContext) setChatContext(null);
      else if (showGoalsPanel) setShowGoalsPanel(false);
      else if (showShortcuts) setShowShortcuts(false);
      else if (view !== 'feed') setView('feed');
    },
    'shift+?': () => setShowShortcuts(true),
  });

  // Handlers
  const handleViewHistory = useCallback(async () => {
    setView('history');
    if (history.length === 0) {
      await fetchHistory();
    }
  }, [history.length, fetchHistory]);

  const handleChatAbout = useCallback((item) => {
    setChatContext({
      itemId: item._id || item.title,
      itemTitle: item.title,
      itemCategory: item.category || item.type,
      itemDescription: item.description || item.summary
    });
  }, []);

  const handleDismissError = useCallback(() => setError(null), [setError]);

  // Views
  if (view === 'settings') {
    return (
      <div className="assistant-container">
        <Settings onBack={() => setView('feed')} />
      </div>
    );
  }

  return (
    <div className="assistant-container">
      <Header 
        stats={stats}
        view={view}
        setView={setView}
        goalsCount={goals.length}
        onToggleGoals={() => setShowGoalsPanel(!showGoalsPanel)}
        onSettings={() => setView('settings')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      
      <KeyboardShortcutsHelp 
        isOpen={showShortcuts} 
        onClose={() => setShowShortcuts(false)} 
      />

      {showGoalsPanel && (
        <GoalsPanel 
          goals={goals}
          onClose={() => setShowGoalsPanel(false)}
          onGoalAdded={addGoal}
        />
      )}

      <main className="assistant-main">
        <ErrorBanner error={error} onDismiss={handleDismissError} />

        {isLoading ? (
          <PageSkeleton />
        ) : view === 'history' ? (
          <HistoryView 
            history={history}
            isLoading={isLoading}
            onBack={() => setView('feed')}
          />
        ) : view === 'dashboard' ? (
          <NewDashboardView />
        ) : (
          <>
            <GoalsBar goals={goals} onEdit={() => setShowGoalsPanel(true)} />
            
            {todayBrief ? (
              <BriefContent 
                brief={todayBrief}
                isGenerating={isGenerating}
                onRegenerate={generate}
              />
            ) : (
              <EmptyState isGenerating={isGenerating} onGenerate={generate} />
            )}
          </>
        )}
      </main>

      {chatContext && (
        <AssistantChat 
          context={chatContext}
          onClose={() => setChatContext(null)}
        />
      )}
    </div>
  );
}
