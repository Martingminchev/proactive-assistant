import React, { useCallback, useEffect, useState } from 'react';
import { CurrentStatus } from './components/CurrentStatus';
import { SuggestionCard } from './components/SuggestionCard';
import { FocusToggle } from './components/FocusToggle';
import { StatsPanel } from './components/StatsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Celebration } from './components/Celebration';
import { useExtensionApi } from './hooks/useExtensionApi';
import { useTheme } from './hooks/useTheme';

// Types
interface Suggestion {
  id: string;
  type: 'optimization' | 'refactor' | 'bugfix' | 'style';
  title: string;
  description: string;
  code?: string;
  fileName?: string;
  lineNumber?: number;
  confidence: number;
  status: 'pending' | 'accepted' | 'dismissed' | 'applied';
  timestamp: number;
}

interface UserStats {
  suggestionsAccepted: number;
  suggestionsDismissed: number;
  timeInFocusMode: number;
  linesOptimized: number;
  currentStreak: number;
}

interface CurrentFile {
  path: string | null;
  name: string | null;
  duration: number;
}

interface FocusModeState {
  active: boolean;
  timeRemaining?: number;
}

export const App: React.FC = () => {
  console.log('App component rendering...');
  
  const {
    isReady,
    appState,
    onMessage,
    postMessage,
    acceptSuggestion,
    dismissSuggestion,
    viewSuggestion,
    toggleFocusMode,
    openSettings,
    showStats: _showStats,
    enableFocusMode: _enableFocusMode,
    disableFocusMode: _disableFocusMode,
    snoozeSuggestion: _snoozeSuggestion,
  } = useExtensionApi();
  const { theme } = useTheme();

  // Local state
  const [currentFile, setCurrentFile] = useState<CurrentFile>({
    path: null,
    name: null,
    duration: 0,
  });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [focusMode, setFocusMode] = useState<FocusModeState>({ active: false });
  const [stats, setStats] = useState<UserStats>({
    suggestionsAccepted: 0,
    suggestionsDismissed: 0,
    timeInFocusMode: 0,
    linesOptimized: 0,
    currentStreak: 0,
  });
  const [celebration, setCelebration] = useState<{ type: string; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'stats' | 'settings'>('suggestions');
  const [isLoading, setIsLoading] = useState(true);

  console.log('App render - isReady:', isReady, 'isLoading:', isLoading, 'appState:', appState);

  // Safety timeout - exit loading after 5 seconds regardless
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  // Sync with appState from extension
  useEffect(() => {
    console.log('appState effect triggered, appState:', appState);
    if (!appState) return;

    // Update view based on state from extension
    if (appState.view === 'suggestions') {
      setActiveTab('suggestions');
    } else if (appState.view === 'stats') {
      setActiveTab('stats');
    } else if (appState.view === 'settings') {
      setActiveTab('settings');
    }

    // Update current file
    if (appState.currentFile) {
      setCurrentFile(appState.currentFile);
    }
    setIsLoading(false);  // Always set to false

    // Update focus mode
    if (appState.focusMode) {
      setFocusMode(appState.focusMode);
    }

    // Update stats
    if (appState.stats) {
      setStats({
        suggestionsAccepted: appState.stats.suggestionsAccepted ?? 0,
        suggestionsDismissed: appState.stats.suggestionsDismissed ?? 0,
        timeInFocusMode: appState.stats.timeInFocusMode ?? 0,
        linesOptimized: appState.stats.linesOptimized ?? 0,
        currentStreak: appState.stats.currentStreak ?? 0,
      });
    }

    // Update suggestion from state
    if (appState.suggestion) {
      const newSuggestion: Suggestion = {
        id: appState.suggestion.id,
        type: 'optimization',
        title: appState.suggestion.title,
        description: appState.suggestion.description,
        confidence: 0.8,
        status: 'pending',
        timestamp: Date.now(),
      };
      setSuggestions(prev => {
        const exists = prev.find(s => s.id === newSuggestion.id);
        if (exists) return prev;
        return [newSuggestion, ...prev].slice(0, 5);
      });
    }
  }, [appState]);

  // Handle incoming messages from extension
  useEffect(() => {
    console.log('Message handler effect - isReady:', isReady);
    if (!isReady) return;

    const unsubscribers: (() => void)[] = [];

    // Current file updates
    unsubscribers.push(
      onMessage('currentFile', (payload: unknown) => {
        const file = payload as CurrentFile;
        setCurrentFile(file);
        setIsLoading(false);
      })
    );

    // New suggestions
    unsubscribers.push(
      onMessage('newSuggestion', (payload: unknown) => {
        const suggestionData = payload as Omit<Suggestion, 'status' | 'timestamp'>;
        setSuggestions(prev => {
          if (prev.find(s => s.id === suggestionData.id)) return prev;

          const newSuggestion: Suggestion = {
            ...suggestionData,
            status: 'pending',
            timestamp: Date.now(),
          };
          return [newSuggestion, ...prev].slice(0, 5);
        });
      })
    );

    // Suggestion status updates
    unsubscribers.push(
      onMessage('suggestionStatus', (payload: unknown) => {
        const { id, status } = payload as { id: string; status: Suggestion['status'] };
        setSuggestions(prev =>
          prev.map(s => (s.id === id ? { ...s, status } : s))
        );
      })
    );

    // Focus mode updates
    unsubscribers.push(
      onMessage('focusMode', (payload: unknown) => {
        setFocusMode(payload as FocusModeState);
      })
    );

    // Stats updates
    unsubscribers.push(
      onMessage('stats', (payload: unknown) => {
        const statsData = payload as UserStats;
        setStats(statsData);
      })
    );

    // Celebration trigger
    unsubscribers.push(
      onMessage('celebration', (payload: unknown) => {
        const { type, message } = payload as { type: string; message: string };
        setCelebration({ type, message });
      })
    );

    // Request initial state
    postMessage('getCurrentState');

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isReady, onMessage, postMessage]);

  // Handlers
  const handleAcceptSuggestion = useCallback((id: string) => {
    acceptSuggestion(id);
    setSuggestions(prev =>
      prev.map(s => (s.id === id ? { ...s, status: 'accepted' } : s))
    );
  }, [acceptSuggestion]);

  const handleDismissSuggestion = useCallback((id: string) => {
    dismissSuggestion(id);
    setSuggestions(prev =>
      prev.map(s => (s.id === id ? { ...s, status: 'dismissed' } : s))
    );
  }, [dismissSuggestion]);

  const handleViewSuggestion = useCallback((id: string) => {
    viewSuggestion(id);
  }, [viewSuggestion]);

  const handleFocusToggle = useCallback((active: boolean, duration?: number) => {
    toggleFocusMode(active, duration);
  }, [toggleFocusMode]);

  const handleClearCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  const handleOpenSettings = useCallback(() => {
    openSettings();
  }, [openSettings]);

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <span>Connecting to AI Assistant...</span>
      </div>
    );
  }

  return (
    <div className="app" data-theme={theme}>
      {/* Header */}
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-icon">🤖</span>
          <h1 className="app-title">AI Assistant</h1>
        </div>
        <div className="app-header-right">
          <button
            className="icon-button"
            onClick={() => setActiveTab('suggestions')}
            title="Suggestions"
            aria-label="Suggestions"
            aria-pressed={activeTab === 'suggestions'}
          >
            <i className="codicon codicon-lightbulb" />
            {pendingSuggestions.length > 0 && (
              <span className="badge">{pendingSuggestions.length}</span>
            )}
          </button>
          <button
            className="icon-button"
            onClick={() => setActiveTab('stats')}
            title="Statistics"
            aria-label="Statistics"
            aria-pressed={activeTab === 'stats'}
          >
            <i className="codicon codicon-graph" />
          </button>
          <button
            className="icon-button"
            onClick={() => setActiveTab('settings')}
            title="Settings"
            aria-label="Settings"
            aria-pressed={activeTab === 'settings'}
          >
            <i className="codicon codicon-gear" />
          </button>
        </div>
      </header>

      {/* Current Status */}
      <CurrentStatus
        fileName={currentFile.name}
        duration={currentFile.duration}
        isWatching={!!currentFile.path}
      />

      {/* Focus Toggle */}
      <FocusToggle
        isActive={focusMode.active}
        timeRemaining={focusMode.timeRemaining}
        onToggle={handleFocusToggle}
      />

      {/* Main Content */}
      <main className="app-main">
        {activeTab === 'suggestions' && (
          <div className="suggestions-section">
            {pendingSuggestions.length === 0 ? (
              <div className="empty-state">
                <i className="codicon codicon-check" />
                <p>No active suggestions</p>
                <span>Keep coding! Suggestions will appear here.</span>
              </div>
            ) : (
              <div className="suggestions-list">
                {pendingSuggestions.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAccept={handleAcceptSuggestion}
                    onDismiss={handleDismissSuggestion}
                    onView={handleViewSuggestion}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <StatsPanel stats={stats} suggestions={suggestions} />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel onOpenVscodeSettings={handleOpenSettings} />
        )}
      </main>

      {/* Celebration Overlay */}
      {celebration && (
        <Celebration
          type={celebration.type as 'streak' | 'milestone' | 'achievement'}
          message={celebration.message}
          onComplete={handleClearCelebration}
        />
      )}
    </div>
  );
};

export default App;
