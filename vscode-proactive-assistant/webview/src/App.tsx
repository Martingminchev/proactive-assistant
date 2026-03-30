import React, { useState, useEffect, useCallback } from 'react';
import { useExtensionApi } from './hooks/useExtensionApi';
import { useTheme } from './hooks/useTheme';
import type { TabId, Suggestion, CurrentStatus, UserStats, UserSettings, CelebrationData, ExtensionMessage } from './types';

// Components
import { SuggestionCard } from './components/SuggestionCard';
import { CurrentStatus as CurrentStatusComponent } from './components/CurrentStatus';
import { FocusToggle } from './components/FocusToggle';
import { Celebration } from './components/Celebration';
import { StatsPanel } from './components/StatsPanel';
import { SettingsPanel } from './components/SettingsPanel';

// Icons
const SuggestionsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 13A6 6 0 118 2a6 6 0 010 12z"/>
    <path d="M8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z"/>
  </svg>
);

const StatsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1 1h2v14H1V1zm4 4h2v10H5V5zm4-2h2v12H9V3zm4 6h2v6h-2V9z"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
    <path fillRule="evenodd" d="M8.5 1.5a.5.5 0 00-1 0v.5c0 .15-.1.28-.23.32-.35.1-.68.26-.99.46a.5.5 0 01-.66-.05L4.85 2.15a.5.5 0 00-.7.7l.63.77a.5.5 0 01.05.66c-.2.31-.36.64-.46.99a.5.5 0 01-.32.23h-.5a.5.5 0 000 1h.5c.15 0 .28.1.32.23.1.35.26.68.46.99a.5.5 0 01-.05.66l-.63.77a.5.5 0 00.7.7l.77-.63a.5.5 0 01.66.05c.31.2.64.36.99.46.13.04.23.17.23.32v.5a.5.5 0 001 0v-.5c0-.15.1-.28.23-.32.35-.1.68-.26.99-.46a.5.5 0 01.66.05l.77.63a.5.5 0 00.7-.7l-.63-.77a.5.5 0 01-.05-.66c.2-.31.36-.64.46-.99.04-.13.17-.23.32-.23h.5a.5.5 0 000-1h-.5a.5.5 0 01-.32-.23 4.48 4.48 0 00-.46-.99.5.5 0 01.05-.66l.63-.77a.5.5 0 00-.7-.7l-.77.63a.5.5 0 01-.66.05 4.48 4.48 0 00-.99-.46.5.5 0 01-.23-.32v-.5z"/>
  </svg>
);

// Loading component
const LoadingState: React.FC = () => (
  <div className="loading-container" role="status" aria-label="Loading">
    <div className="loading-spinner" />
    <span className="loading-text">Connecting to Proactive AI Assistant...</span>
  </div>
);

const App: React.FC = () => {
  const { isReady, postMessage, onMessage, offMessage, sendRequest } = useExtensionApi();
  const { themeKind, isDark } = useTheme();
  
  // State
  const [activeTab, setActiveTab] = useState<TabId>('suggestions');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<CurrentStatus | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Request initial data
  useEffect(() => {
    if (!isReady) return;

    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        
        // Request all initial data
        await Promise.all([
          sendRequest({ type: 'request-status' }).then(data => setStatus(data as CurrentStatus)),
          sendRequest({ type: 'request-stats' }).then(data => setStats(data as UserStats)),
          sendRequest({ type: 'request-settings' }).then(data => setSettings(data as UserSettings))
        ]);
        
        setError(null);
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError('Failed to connect to extension. Please try reloading.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [isReady, sendRequest]);

  // Handle messages from extension
  useEffect(() => {
    if (!isReady) return;

    console.log('[App] Setting up message handler, isReady:', isReady);

    const handleMessage = (message: ExtensionMessage) => {
      console.log(`[App] Handling message type: ${message.type}`, message.payload);
      
      switch (message.type) {
        case 'suggestions':
          console.log('[App] Setting suggestions:', message.payload);
          setSuggestions(message.payload as Suggestion[]);
          break;
        case 'status':
          console.log('[App] Setting status:', message.payload);
          setStatus(message.payload as CurrentStatus);
          break;
        case 'stats':
          console.log('[App] Setting stats:', message.payload);
          setStats(message.payload as UserStats);
          break;
        case 'settings':
          console.log('[App] Setting settings:', message.payload);
          setSettings(message.payload as UserSettings);
          break;
        case 'celebration':
          console.log('[App] Setting celebration:', message.payload);
          setCelebration(message.payload as CelebrationData);
          // Auto-hide celebration after 5 seconds
          setTimeout(() => setCelebration(null), 5000);
          break;
        case 'ping':
          console.log('[App] Received ping');
          break;
        case 'stateUpdate':
          console.log('[App] Received stateUpdate:', message.payload);
          // Handle stateUpdate - map to status if it contains current file info
          if (message.payload && typeof message.payload === 'object') {
            const state = message.payload as { 
              currentFile?: { path: string | null; duration: number };
              flowState?: string;
              isPiecesConnected?: boolean;
              suggestion?: Suggestion;
            };
            
            // Update status
            if (state.currentFile) {
              setStatus(prev => ({
                ...prev,
                watchedFile: state.currentFile?.path ?? null,
                activityDuration: Math.floor((state.currentFile?.duration ?? 0) / 1000),
                flowState: (state.flowState as CurrentStatus['flowState']) || 'idle',
                isPiecesConnected: state.isPiecesConnected ?? prev?.isPiecesConnected ?? false,
                lastActivityAt: Date.now(),
              }));
            }
            
            // Handle suggestion from stateUpdate as fallback
            if (state.suggestion) {
              console.log('[App] Setting suggestion from stateUpdate:', state.suggestion);
              setSuggestions(prev => {
                // Avoid duplicates
                const exists = prev.some(s => s.id === state.suggestion!.id);
                if (exists) {
                  return prev;
                }
                return [...prev, state.suggestion!];
              });
            }
          }
          break;
        default:
          console.warn(`[App] Unknown message type: ${message.type}`);
      }
    };

    onMessage(handleMessage);
    return () => offMessage();
  }, [isReady, onMessage, offMessage]);

  // Action handlers
  const handleApplySuggestion = useCallback((id: string) => {
    postMessage({ type: 'applySuggestion', suggestionId: id });
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, [postMessage]);

  const handleDismissSuggestion = useCallback((id: string) => {
    postMessage({ type: 'dismissSuggestion', suggestionId: id, reason: 'no_reason' });
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, [postMessage]);

  const handleSnoozeSuggestion = useCallback((id: string) => {
    postMessage({ type: 'snoozeSuggestion', duration: 30 });
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, [postMessage]);

  const handleToggleFocus = useCallback((active: boolean, duration?: number) => {
    postMessage({ type: 'toggle-focus', payload: { active, duration } });
  }, [postMessage]);

  const handleUpdateSettings = useCallback((newSettings: UserSettings) => {
    postMessage({ type: 'update-settings', payload: newSettings });
    setSettings(newSettings);
  }, [postMessage]);

  const handleExportData = useCallback(() => {
    postMessage({ type: 'export-data' });
  }, [postMessage]);

  const handleResetData = useCallback(() => {
    if (window.confirm('Are you sure you want to reset all your data? This cannot be undone.')) {
      postMessage({ type: 'reset-data' });
    }
  }, [postMessage]);

  // Render tabs
  const renderTabContent = () => {
    if (isLoading) {
      return <LoadingState />;
    }

    switch (activeTab) {
      case 'suggestions':
        return (
          <div className="tab-content suggestions-tab">
            <CurrentStatusComponent status={status} />
            <FocusToggle 
              onToggle={handleToggleFocus}
              isActive={status?.flowState === 'deep'}
            />
            
            <div className="suggestions-list">
              <h2 className="section-title">
                Suggestions
                {suggestions.length > 0 && (
                  <span className="badge">{suggestions.length}</span>
                )}
              </h2>
              
              {suggestions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✨</div>
                  <p>No suggestions right now</p>
                  <span className="empty-hint">
                    Keep coding! I'll let you know when I have something helpful.
                  </span>
                </div>
              ) : (
                suggestions.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={handleApplySuggestion}
                    onDismiss={handleDismissSuggestion}
                    onSnooze={handleSnoozeSuggestion}
                  />
                ))
              )}
            </div>
          </div>
        );
      
      case 'stats':
        return <StatsPanel stats={stats} />;
      
      case 'settings':
        return (
          <SettingsPanel
            settings={settings}
            onUpdate={handleUpdateSettings}
            onExport={handleExportData}
            onReset={handleResetData}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={`app-container theme-${themeKind}`} data-theme={isDark ? 'dark' : 'light'}>
      {/* Celebration overlay */}
      {celebration && (
        <Celebration data={celebration} onClose={() => setCelebration(null)} />
      )}

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">
          <span className="error-message">{error}</span>
          <button 
            className="error-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">Proactive AI</h1>
        
        {/* Tab navigation */}
        <nav className="tab-nav" role="tablist">
          <button
            className={`tab-button ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestions')}
            role="tab"
            aria-selected={activeTab === 'suggestions'}
            aria-label="Suggestions"
          >
            <SuggestionsIcon />
            <span>Suggestions</span>
            {suggestions.length > 0 && (
              <span className="tab-badge">{suggestions.length}</span>
            )}
          </button>
          
          <button
            className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
            role="tab"
            aria-selected={activeTab === 'stats'}
            aria-label="Statistics"
          >
            <StatsIcon />
            <span>Stats</span>
          </button>
          
          <button
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            role="tab"
            aria-selected={activeTab === 'settings'}
            aria-label="Settings"
          >
            <SettingsIcon />
            <span>Settings</span>
          </button>
        </nav>
      </header>

      {/* Main content */}
      <main className="app-main">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default App;
