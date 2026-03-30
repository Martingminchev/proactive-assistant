// =============================================================================
// NEXUS - Main App Component
// Root component with state management, error handling, and connection status
// =============================================================================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { 
  Zap, 
  Puzzle, 
  AlertCircle,
  Wifi,
  WifiOff,
  Terminal
} from 'lucide-react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import WelcomeScreen from './components/WelcomeScreen';
import LogsModal from './components/LogsModal';
import SearchModal from './components/SearchModal';
import { ToastContainer } from './components/Toast';
import { ProactiveSuggestionPanel } from './components/ProactiveSuggestion';
import SoulDocumentModal from './components/SoulDocumentModal';
import ErrorBoundary from './components/ErrorBoundary';
import ActionConfirmationModal from './components/ActionConfirmationModal';
import UserQuestionModal, { AskUserRequest } from './components/UserQuestionModal';
import { useAppStore } from './stores/appStore';
import { useSidebarStore } from './stores/sidebarStore';
import { useSettingsStore } from './stores/settingsStore';
import { useActionStore } from './stores/actionStore';
import { logger } from './utils/logger';

const AppContent: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isSoulDocumentOpen, setIsSoulDocumentOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [askUserRequest, setAskUserRequest] = useState<AskUserRequest | null>(null);

  const { 
    currentConversation, 
    conversations, 
    initialize, 
    isInitialized,
    isLoading,
    isStreaming,
    createConversation,
    error,
    clearError,
  } = useAppStore();
  
  const { settings, loadSettings, apiKeyStatus, piecesStatus } = useSettingsStore();
  const { isOpen: sidebarOpen } = useSidebarStore();
  const { pendingRequest, confirmAction, denyAction, setPendingRequest } = useActionStore();

  // Initialize on mount
  useEffect(() => {
    logger.info('NEXUS starting up...');
    
    const init = async () => {
      await loadSettings();
      await initialize();
      setIsReady(true);
      logger.info('NEXUS initialized successfully');
    };
    
    init();
  }, []);

  // Apply font size setting
  useEffect(() => {
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    document.documentElement.style.setProperty('--base-font-size', fontSizeMap[settings.fontSize]);
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
  }, [settings.fontSize]);

  // Listen for IPC events
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribeNewConversation = window.electronAPI.onConversationCreate(() => {
      createConversation();
    });

    const unsubscribeOpenSettings = window.electronAPI.onOpenSettings(() => {
      setIsSettingsOpen(true);
    });
    
    // Listen for search shortcut from main process
    const unsubscribeOpenSearch = window.electronAPI.onOpenSearch(() => {
      setIsSearchOpen(true);
    });

    const unsubscribeAskUser = window.electronAPI.onAskUserRequest?.((_, data: AskUserRequest) => {
      setAskUserRequest(data);
    });

    // Listen for custom event from toast notifications
    const handleOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener('nexus:open-settings', handleOpenSettings);

    return () => {
      unsubscribeNewConversation();
      unsubscribeOpenSettings();
      unsubscribeOpenSearch();
      unsubscribeAskUser?.();
      window.removeEventListener('nexus:open-settings', handleOpenSettings);
    };
  }, [createConversation]);

  // Handle global errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logger.error('Global error:', event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled promise rejection:', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Handle soul document open event from settings
  useEffect(() => {
    const handleOpenSoulDocument = () => {
      setIsSoulDocumentOpen(true);
    };

    window.addEventListener('open-soul-document', handleOpenSoulDocument);
    return () => {
      window.removeEventListener('open-soul-document', handleOpenSoulDocument);
    };
  }, []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <MotionConfig reducedMotion={settings.animationsEnabled ? 'never' : 'always'}>
      <div className="h-screen w-screen flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
        {/* Grid Pattern Background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none" />
        
        {/* Ambient Glow Effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-nexus-cyan/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-nexus-violet/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Title Bar */}
        <TitleBar onOpenSettings={() => setIsSettingsOpen(true)} />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            onOpenSearch={() => setIsSearchOpen(true)}
            onStartChat={(content) => {
              createConversation();
              window.sessionStorage.setItem('pendingProactiveMessage', content);
            }}
          />
          
          <main className="flex-1 flex flex-col relative">
            {/* Error Banner */}
            <ErrorBanner error={error} onDismiss={clearError} />
            
            {/* Connection Status Bar */}
            <ConnectionStatusBar 
              apiKeyStatus={apiKeyStatus}
              piecesStatus={piecesStatus}
              settings={settings}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenLogs={() => setIsLogsOpen(true)}
            />
            
            <AnimatePresence mode="wait">
              {currentConversation ? (
                <ChatArea key="chat" conversationId={currentConversation} />
              ) : (
                <WelcomeScreen key="welcome" onStartChat={createConversation} />
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <SettingsModal 
              onClose={() => setIsSettingsOpen(false)} 
              onOpenLogs={() => setIsLogsOpen(true)}
            />
          )}
        </AnimatePresence>

        {/* Logs Modal */}
        <AnimatePresence>
          {isLogsOpen && (
            <LogsModal onClose={() => setIsLogsOpen(false)} />
          )}
        </AnimatePresence>

        {/* Soul Document Modal */}
        <SoulDocumentModal 
          isOpen={isSoulDocumentOpen}
          onClose={() => setIsSoulDocumentOpen(false)}
        />
        
        {/* Search Modal */}
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />

        {/* Toast Notifications -->
        <ToastContainer />
        
        {/* Proactive Suggestions Panel - floating buttons when sidebar collapsed */}
        {!sidebarOpen && (
          <ProactiveSuggestionPanel
            compact
            onStartChat={(content) => {
              createConversation();
              window.sessionStorage.setItem('pendingProactiveMessage', content);
            }}
          />
        )}
        
        {/* Action Confirmation Modal */}
        <ActionConfirmationModal
          request={pendingRequest}
          onConfirm={(requestId, rememberChoice) => confirmAction(requestId, rememberChoice)}
          onDeny={(requestId) => denyAction(requestId)}
          onClose={() => setPendingRequest(null)}
        />
        <UserQuestionModal
          request={askUserRequest}
          onSubmit={async (requestId, answer) => {
            await window.electronAPI?.respondToAskUser(requestId, answer);
            setAskUserRequest(null);
          }}
          onCancel={async (requestId) => {
            await window.electronAPI?.respondToAskUser(requestId, '');
            setAskUserRequest(null);
          }}
        />
      </div>
    </MotionConfig>
  );
};

// =============================================================================
// Main App Component with Error Boundary
// =============================================================================

const App: React.FC = () => {
  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <AppContent />
    </ErrorBoundary>
  );
};

// =============================================================================
// Error Banner Component
// =============================================================================

interface ErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-red-500/10 border-b border-red-500/30 overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-200">{error}</span>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg text-red-400 hover:text-red-200 hover:bg-red-500/20 transition-colors"
            >
              <span className="sr-only">Dismiss</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// =============================================================================
// Connection Status Bar Component
// =============================================================================

interface ConnectionStatusBarProps {
  apiKeyStatus: 'unknown' | 'valid' | 'invalid';
  piecesStatus: 'unknown' | 'connected' | 'disconnected';
  settings: { kimiApiKey?: string; piecesEnabled?: boolean };
  onOpenSettings: () => void;
  onOpenLogs: () => void;
}

const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  apiKeyStatus,
  piecesStatus,
  settings,
  onOpenSettings,
  onOpenLogs,
}) => {
  // Determine overall connection status
  const hasApiKey = !!settings.kimiApiKey;
  const apiConnected = apiKeyStatus === 'valid';
  const piecesConnected = piecesStatus === 'connected';
  
  // Show API warning if no key or invalid
  const showApiWarning = !hasApiKey || apiKeyStatus === 'invalid';
  
  // Show Pieces warning if enabled but disconnected
  const showPiecesWarning = settings.piecesEnabled && piecesStatus === 'disconnected';

  if (!showApiWarning && !showPiecesWarning) {
    // All good - show minimal status
    return (
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-4">
          {apiConnected && (
            <div className="flex items-center gap-1.5 text-xs text-nexus-emerald/80">
              <Zap className="w-3 h-3" />
              <span>Kimi API Connected</span>
            </div>
          )}
          {piecesConnected && (
            <div className="flex items-center gap-1.5 text-xs text-nexus-cyan/80">
              <Puzzle className="w-3 h-3" />
              <span>Pieces OS Connected</span>
            </div>
          )}
        </div>
        <button
          onClick={onOpenLogs}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          title="View Logs"
        >
          <Terminal className="w-3 h-3" />
          <span>Logs</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-amber-500/5 border-b border-amber-500/20">
      <div className="flex items-center gap-4">
        {showApiWarning && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            {!hasApiKey ? (
              <>
                <AlertCircle className="w-3 h-3" />
                <span>Kimi API key not configured</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Kimi API connection failed</span>
              </>
            )}
          </button>
        )}
        
        {showPiecesWarning && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400/80">
            <WifiOff className="w-3 h-3" />
            <span>Pieces OS not available</span>
          </div>
        )}
      </div>
      
      <button
        onClick={onOpenLogs}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        title="View Logs"
      >
        <Terminal className="w-3 h-3" />
        <span>Logs</span>
      </button>
    </div>
  );
};

// =============================================================================
// Loading Screen
// =============================================================================

const LoadingScreen: React.FC = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
    <div className="flex flex-col items-center gap-6">
      {/* Animated Logo */}
      <div className="relative w-16 h-16">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-nexus-cyan/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          style={{ borderTopColor: 'var(--color-accent-cyan)' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-nexus-violet/30"
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          style={{ borderBottomColor: 'var(--color-accent-violet)' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-display font-bold text-gradient">N</span>
        </div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-slate-400 font-display tracking-wider text-sm"
      >
        INITIALIZING NEXUS
      </motion.div>
    </div>
  </div>
);

export default App;
