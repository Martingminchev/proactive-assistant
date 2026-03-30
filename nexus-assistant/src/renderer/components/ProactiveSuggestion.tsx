// =============================================================================
// NEXUS - Proactive Suggestion Component
// Displays proactive suggestions from the AI agent
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Bell,
  HelpCircle,
  MessageCircle,
  GitBranch,
  X,
  Clock,
  Sparkles,
  Camera,
  Play,
  MoreVertical,
  Check,
} from 'lucide-react';
import type { ProactiveSuggestion } from '../../shared/types';

interface ProactiveSuggestionPanelProps {
  onStartChat?: (content: string) => void;
  /** When true, only show floating buttons (no suggestion cards) - used when sidebar is collapsed */
  compact?: boolean;
}

const typeIcons: Record<string, React.ReactNode> = {
  reminder: <Bell className="w-4 h-4" />,
  insight: <Lightbulb className="w-4 h-4" />,
  help: <HelpCircle className="w-4 h-4" />,
  question: <MessageCircle className="w-4 h-4" />,
  workflow: <GitBranch className="w-4 h-4" />,
};

const priorityColors: Record<string, string> = {
  low: 'border-slate-500/30 bg-slate-500/5',
  medium: 'border-nexus-cyan/30 bg-nexus-cyan/5',
  high: 'border-nexus-violet/30 bg-nexus-violet/5',
};

const priorityGlows: Record<string, string> = {
  low: '',
  medium: 'shadow-lg shadow-nexus-cyan/10',
  high: 'shadow-lg shadow-nexus-violet/20 animate-pulse-subtle',
};

export const ProactiveSuggestionPanel: React.FC<ProactiveSuggestionPanelProps> = ({
  onStartChat,
  compact = false,
}) => {
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);

  // Load suggestions and listen for new ones
  useEffect(() => {
    if (!window.electronAPI) return;

    // Load existing suggestions
    const loadSuggestions = async () => {
      try {
        const existing = await window.electronAPI.getProactiveSuggestions();
        setSuggestions(existing);
      } catch (error) {
        console.error('Failed to load suggestions:', error);
      }
    };

    loadSuggestions();

    // Listen for new suggestions
    const unsubscribe = window.electronAPI.onProactiveSuggestion((_, suggestion) => {
      setSuggestions(prev => [suggestion, ...prev.filter(s => s.id !== suggestion.id)]);
      setIsMinimized(false); // Auto-expand when new suggestion arrives
    });

    // Listen for show-suggestion (from notification click)
    const unsubscribeShow = window.electronAPI.onProactiveShowSuggestion((_, suggestion) => {
      setSuggestions(prev => [suggestion, ...prev.filter(s => s.id !== suggestion.id)]);
      setIsMinimized(false);
    });

    return () => {
      unsubscribe();
      unsubscribeShow();
    };
  }, []);

  const handleDismiss = useCallback(async (id: string) => {
    try {
      await window.electronAPI?.dismissProactiveSuggestion(id);
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
    }
  }, []);

  const handleSnooze = useCallback(async (id: string) => {
    try {
      await window.electronAPI?.snoozeProactiveSuggestion(id, 30);
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to snooze suggestion:', error);
    }
  }, []);

  const handleAccept = useCallback(async (id: string) => {
    try {
      await window.electronAPI?.acceptProactiveSuggestion(id);
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
    }
  }, []);

  const handleExecute = useCallback(async (suggestion: ProactiveSuggestion) => {
    try {
      await window.electronAPI?.acceptProactiveSuggestion(suggestion.id);
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      if (onStartChat) {
        onStartChat(`Please perform this suggestion: "${suggestion.title}"\n\n${suggestion.content}\n\nUse your tools to execute any relevant actions.`);
      }
    } catch (error) {
      console.error('Failed to execute suggestion:', error);
    }
  }, [onStartChat]);

  const handleChat = useCallback(async (suggestion: ProactiveSuggestion) => {
    try {
      await window.electronAPI?.acceptProactiveSuggestion(suggestion.id);
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      if (onStartChat) {
        onStartChat(`Based on your earlier suggestion: "${suggestion.title}"\n\n${suggestion.content}\n\nTell me more about this.`);
      }
    } catch (error) {
      console.error('Failed to chat about suggestion:', error);
    }
  }, [onStartChat]);

  const handleTriggerAnalysis = useCallback(async () => {
    try {
      const suggestion = await window.electronAPI?.triggerProactiveAnalysis();
      if (suggestion) {
        setSuggestions(prev => [suggestion, ...prev]);
        setIsMinimized(false);
      }
    } catch (error) {
      console.error('Failed to trigger analysis:', error);
    }
  }, []);

  const handleCaptureScreenshot = useCallback(async () => {
    setIsCapturingScreenshot(true);
    try {
      const screenshot = await window.electronAPI?.captureScreenshot();
      if (screenshot && onStartChat) {
        onStartChat(`I've captured a screenshot of my screen. Can you help me with what you see?\n\n[Screenshot captured]`);
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    } finally {
      setIsCapturingScreenshot(false);
    }
  }, [onStartChat]);

  const activeSuggestions = suggestions.filter(s => !s.dismissed);

  // Compact mode or no suggestions: show minimal floating buttons only
  if (compact || activeSuggestions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed bottom-24 right-4 z-50"
      >
        <div className="flex flex-col gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCaptureScreenshot}
            disabled={isCapturingScreenshot}
            className="w-10 h-10 rounded-full bg-slate-800/90 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-nexus-cyan hover:border-nexus-cyan/30 transition-colors backdrop-blur-sm"
            title="Capture screenshot for analysis"
          >
            <Camera className={`w-4 h-4 ${isCapturingScreenshot ? 'animate-pulse' : ''}`} />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleTriggerAnalysis}
            className="w-10 h-10 rounded-full bg-slate-800/90 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-nexus-violet hover:border-nexus-violet/30 transition-colors backdrop-blur-sm"
            title="Analyze my recent work"
          >
            <Sparkles className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isMinimized ? (
        <motion.button
          key="minimized"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsMinimized(false)}
          className={`fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm border ${priorityColors[activeSuggestions[0]?.priority || 'medium']} ${priorityGlows[activeSuggestions[0]?.priority || 'medium']}`}
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-nexus-cyan" />
            {activeSuggestions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-nexus-violet text-white text-xs rounded-full flex items-center justify-center font-medium">
                {activeSuggestions.length}
              </span>
            )}
          </div>
        </motion.button>
      ) : (
        <motion.div
          key="expanded"
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          className="fixed bottom-24 right-4 z-50 w-80 max-h-96 flex flex-col bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-nexus-cyan" />
              <span className="text-sm font-medium text-slate-200">NEXUS Insights</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleTriggerAnalysis}
                className="p-1.5 rounded-lg text-slate-400 hover:text-nexus-violet hover:bg-slate-800/50 transition-colors"
                title="Analyze now"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Suggestions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {activeSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onDismiss={() => handleDismiss(suggestion.id)}
                onSnooze={() => handleSnooze(suggestion.id)}
                onAccept={() => handleAccept(suggestion.id)}
                onExecute={() => handleExecute(suggestion)}
                onChat={() => handleChat(suggestion)}
              />
            ))}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-700/50">
            <button
              onClick={handleCaptureScreenshot}
              disabled={isCapturingScreenshot}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-slate-400 hover:text-nexus-cyan hover:bg-slate-800/50 transition-colors"
            >
              <Camera className={`w-3.5 h-3.5 ${isCapturingScreenshot ? 'animate-pulse' : ''}`} />
              <span>Screenshot</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// =============================================================================
// Suggestion Card Component
// =============================================================================

interface SuggestionCardProps {
  suggestion: ProactiveSuggestion;
  onDismiss: () => void;
  onSnooze: () => void;
  onAccept: () => void;
  onExecute: () => void;
  onChat: () => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onDismiss,
  onSnooze,
  onAccept,
  onExecute,
  onChat,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`relative p-3 rounded-lg border ${priorityColors[suggestion.priority]} transition-colors`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-nexus-cyan shrink-0">
            {typeIcons[suggestion.type] || <Lightbulb className="w-4 h-4" />}
          </div>
          <span className="text-sm font-medium text-slate-200 line-clamp-1">
            {suggestion.title}
          </span>
        </div>
      </div>

      {/* Content */}
      <p className="text-xs text-slate-400 mb-3 line-clamp-3">
        {suggestion.content}
      </p>

      {/* Actions: [Do it] [Discuss] [Clock] [⋮] */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onExecute}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-nexus-cyan/10 text-nexus-cyan text-xs hover:bg-nexus-cyan/20 transition-colors"
        >
          <Play className="w-3 h-3" />
          <span>Do it</span>
        </button>
        <button
          onClick={onChat}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-nexus-cyan/10 text-nexus-cyan text-xs hover:bg-nexus-cyan/20 transition-colors"
        >
          <MessageCircle className="w-3 h-3" />
          <span>Discuss</span>
        </button>
        <button
          onClick={onSnooze}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
          title="Snooze for 30 minutes"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
            title="More options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-full mt-1 py-1 z-50 min-w-[100px] rounded-md bg-slate-800 border border-slate-600 shadow-lg">
                <button
                  onClick={() => {
                    onAccept();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Got it
                </button>
                <button
                  onClick={() => {
                    onDismiss();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProactiveSuggestionPanel;
