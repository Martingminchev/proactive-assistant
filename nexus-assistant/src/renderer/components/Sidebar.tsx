// =============================================================================
// NEXUS - Sidebar
// Collapsible sidebar: conversation history, mode switcher, quick message
// =============================================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  MessageSquare,
  Trash2,
  Clock,
  Loader2,
  Send,
  Square,
  Search,
  Command,
  ChevronRight,
  ChevronLeft,
  Shield,
  Lightbulb,
  Users,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSidebarStore } from '../stores/sidebarStore';
import { useContextBridge } from '../hooks/useContextBridge';
import { NotificationStack } from './NotificationStack';
import { QuickActionsPanel } from './QuickActionsPanel';
import { ContextIndicator } from './ContextIndicator';
import { ConversationSummary } from '../../shared/types';
import type { AssistantMode } from '../../shared/types';
import { formatDistanceToNow } from '../utils/format';

const MODE_CONFIG: Record<AssistantMode, { icon: React.ReactNode; label: string }> = {
  supervise: { icon: <Shield className="w-4 h-4" />, label: 'Supervise' },
  suggestions: { icon: <Lightbulb className="w-4 h-4" />, label: 'Suggestions' },
  cowork: { icon: <Users className="w-4 h-4" />, label: 'Cowork' },
};

interface SidebarProps {
  onOpenSearch: () => void;
  onStartChat?: (content: string) => void;
  suggestionCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ onOpenSearch, onStartChat }) => {
  const {
    conversations,
    currentConversation,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
    cancelStream,
    isStreaming,
    isLoading,
  } = useAppStore();

  const { settings } = useSettingsStore();
  const { isOpen, mode, setOpen, setMode, toggle } = useSidebarStore();
  const { context, availableActions } = useContextBridge();

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<import('../../shared/types').ProactiveSuggestion[]>([]);
  const [contextIndicatorExpanded, setContextIndicatorExpanded] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    const load = async () => {
      const existing = await window.electronAPI.getProactiveSuggestions();
      setSuggestions(existing);
    };
    load();
    const unsub = window.electronAPI.onProactiveSuggestion((_, s) => {
      setSuggestions((prev) => [s, ...prev.filter((x) => x.id !== s.id)]);
    });
    const unsubShow = window.electronAPI.onProactiveShowSuggestion((_, s) => {
      setSuggestions((prev) => [s, ...prev.filter((x) => x.id !== s.id)]);
    });
    return () => {
      unsub();
      unsubShow();
    };
  }, []);

  const handleSuggestionExecute = useCallback(
    async (s: import('../../shared/types').ProactiveSuggestion) => {
      await window.electronAPI?.acceptProactiveSuggestion(s.id);
      setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
      onStartChat?.(`Please perform this suggestion: "${s.title}"\n\n${s.content}\n\nUse your tools to execute any relevant actions.`);
    },
    [onStartChat]
  );
  const handleSuggestionChat = useCallback(
    async (s: import('../../shared/types').ProactiveSuggestion) => {
      await window.electronAPI?.acceptProactiveSuggestion(s.id);
      setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
      onStartChat?.(`Based on your earlier suggestion: "${s.title}"\n\n${s.content}\n\nTell me more about this.`);
    },
    [onStartChat]
  );
  const handleSuggestionSnooze = useCallback(async (id: string) => {
    await window.electronAPI?.snoozeProactiveSuggestion(id, 30);
    setSuggestions((prev) => prev.filter((x) => x.id !== id));
  }, []);
  const handleSuggestionDismiss = useCallback(async (id: string) => {
    await window.electronAPI?.dismissProactiveSuggestion(id);
    setSuggestions((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const handleQuickAction = useCallback(
    async (handler: string) => {
      if (handler === 'captureScreenshot') {
        const screenshot = await window.electronAPI?.captureScreenshot();
        if (screenshot && onStartChat) {
          onStartChat("I've captured a screenshot. Can you help me with what you see?\n\n[Screenshot captured]");
        }
      } else if (handler === 'triggerProactiveAnalysis') {
        const suggestion = await window.electronAPI?.triggerProactiveAnalysis();
        if (suggestion) {
          setSuggestions((prev) => [suggestion, ...prev.filter((x) => x.id !== suggestion.id)]);
        }
      } else if (handler === 'explainSelectedCode' && onStartChat) {
        onStartChat('Explain the code I have selected in my editor.');
      } else if (handler === 'fixCurrentError' && onStartChat) {
        onStartChat('I have an error in my editor. Can you help me fix it?');
      } else if (handler === 'suggestRefactoring' && onStartChat) {
        onStartChat('Suggest refactoring improvements for the code in my editor.');
      }
    },
    [onStartChat]
  );

  const activeSuggestionCount = suggestions.filter(
    (s) => !s.dismissed && (!s.snoozedUntil || s.snoozedUntil < Date.now())
  ).length;

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getSidebarMode().then((m) => setMode(m));
    const unsub = window.electronAPI.onModeChanged((_, newMode) => setMode(newMode));
    return unsub;
  }, [setMode]);

  const handleModeChange = useCallback(
    (newMode: AssistantMode) => {
      setMode(newMode);
      window.electronAPI?.setSidebarMode(newMode);
    },
    [setMode]
  );

  const handleCreateConversation = async () => {
    if (isStreaming) return;
    await createConversation();
  };

  const handleSelectConversation = async (id: string) => {
    if (isStreaming) return;
    await selectConversation(id);
  };

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;

    const messageContent = inputValue.trim();
    setInputValue('');

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    if (!currentConversation) {
      await createConversation();
      const newConvId = useAppStore.getState().currentConversation;
      if (newConvId) {
        await sendMessage(newConvId, messageContent, settings.defaultModel, undefined, 'sidebar');
      }
    } else {
      await sendMessage(currentConversation, messageContent, settings.defaultModel, undefined, 'sidebar');
    }
  }, [inputValue, isStreaming, currentConversation, createConversation, sendMessage, settings.defaultModel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  if (!isOpen) {
    return (
      <motion.aside
        initial={{ width: 48 }}
        animate={{ width: 48 }}
        className="w-12 flex flex-col items-center py-4 border-r border-white/5 bg-[var(--color-bg-secondary)]/50 shrink-0"
      >
        <button
          onClick={toggle}
          className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
          title="Expand sidebar"
        >
          <div className="text-nexus-cyan">{MODE_CONFIG[mode].icon}</div>
          {activeSuggestionCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-nexus-violet text-white text-xs flex items-center justify-center">
              {activeSuggestionCount}
            </span>
          )}
        </button>
        <button
          onClick={toggle}
          className="mt-auto p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          title="Expand"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: 288 }}
      className="w-72 flex flex-col border-r border-white/5 bg-[var(--color-bg-secondary)]/50 shrink-0"
    >
      {/* Mode Switcher + Collapse */}
      <div className="p-2 border-b border-white/5 flex items-center gap-2">
        <div className="flex-1 flex gap-1 p-1 rounded-lg bg-white/5">
          {(['supervise', 'suggestions', 'cowork'] as AssistantMode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-2 rounded-md text-xs font-medium transition-all
                ${mode === m ? 'bg-nexus-cyan/20 text-nexus-cyan' : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'}`}
              title={MODE_CONFIG[m].label}
            >
              {MODE_CONFIG[m].icon}
              <span className="truncate">{MODE_CONFIG[m].label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 shrink-0"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Actions */}
      <QuickActionsPanel actions={availableActions} onAction={handleQuickAction} />

      {/* Proactive Suggestions */}
      <NotificationStack
        suggestions={suggestions}
        onExecute={handleSuggestionExecute}
        onChat={handleSuggestionChat}
        onSnooze={handleSuggestionSnooze}
        onDismiss={handleSuggestionDismiss}
      />

      {/* New Conversation Button */}
      <div className="p-4">
        <motion.button
          onClick={handleCreateConversation}
          disabled={isStreaming}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm
            bg-gradient-to-r from-nexus-cyan/20 to-nexus-violet/20
            border border-nexus-cyan/30
            text-nexus-cyan
            hover:from-nexus-cyan/30 hover:to-nexus-violet/30
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200"
          whileHover={{ scale: isStreaming ? 1 : 1.02 }}
          whileTap={{ scale: isStreaming ? 1 : 0.98 }}
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New Conversation
        </motion.button>
      </div>

      {/* Search Button */}
      <div className="px-3 pb-2">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg
            bg-white/5 border border-white/10 
            text-sm text-slate-400
            hover:bg-white/10 hover:border-white/20 hover:text-slate-300
            transition-all duration-200 group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span>Search conversations...</span>
          </div>
          <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/10 text-xs">
              <Command className="w-3 h-3 inline" />
            </kbd>
            <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/10 text-xs">
              K
            </kbd>
          </div>
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
          <Clock className="w-3 h-3" />
          Recent Conversations
        </div>

        {isLoading && (
          <div className="space-y-2 px-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        <div className="space-y-1 mt-2">
          <AnimatePresence mode="popLayout">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === currentConversation}
                isDisabled={isStreaming}
                onSelect={() => handleSelectConversation(conversation.id)}
                onDelete={() => deleteConversation(conversation.id)}
              />
            ))}
          </AnimatePresence>
        </div>

        {conversations.length === 0 && (
          <EmptyState />
        )}
      </div>

      {/* Quick Message Input */}
      <div className="p-3 border-t border-white/5">
        <div className="glass-light rounded-xl p-2">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isStreaming ? "AI responding..." : "Quick message..."}
              disabled={isStreaming}
              className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 resize-none 
                py-2 px-2 outline-none max-h-[120px] min-h-[36px] text-sm"
              rows={1}
            />
            
            {isStreaming ? (
              <button
                onClick={cancelStream}
                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 
                  transition-colors flex-shrink-0"
                title="Stop generating"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                className="p-2 rounded-lg bg-nexus-cyan/20 text-nexus-cyan 
                  hover:bg-nexus-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed
                  transition-all duration-200 flex-shrink-0"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Bottom Info */}
        <div className="text-xs text-slate-500 text-center mt-2 space-y-1">
          <span className="text-nexus-cyan/70">NEXUS</span> v1.0.0
          {context.activeWindow && (
            <div className="truncate px-2" title={context.activeWindow.title}>
              {context.activeWindow.application}
            </div>
          )}
          <div className="flex justify-center pt-1">
            <ContextIndicator
              context={context}
              isExpanded={contextIndicatorExpanded}
              onRefresh={() => {
                window.electronAPI?.getContext?.();
              }}
              onToggleExpand={() => setContextIndicatorExpanded((v) => !v)}
            />
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

// =============================================================================
// Conversation Item
// =============================================================================

interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  isDisabled: boolean;
  onSelect: () => void;
  onDelete: () => void;
  searchQuery?: string;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  isDisabled,
  onSelect,
  onDelete,
  searchQuery = '',
}) => {
  const handleClick = () => {
    if (!isDisabled) {
      onSelect();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDisabled) {
      onDelete();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`
        group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer
        transition-all duration-200
        ${isActive 
          ? 'bg-white/10 border border-white/10' 
          : 'hover:bg-white/5 border border-transparent'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={handleClick}
    >
      {/* Icon */}
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
        ${isActive 
          ? 'bg-gradient-to-br from-nexus-cyan/30 to-nexus-violet/30' 
          : 'bg-white/5'
        }
      `}>
        <MessageSquare className={`w-4 h-4 ${isActive ? 'text-nexus-cyan' : 'text-slate-400'}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`
          font-medium text-sm truncate
          ${isActive ? 'text-white' : 'text-slate-300'}
        `}>
          {conversation.title}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{conversation.messageCount} messages</span>
          <span>•</span>
          <span>{formatDistanceToNow(conversation.updatedAt)}</span>
        </div>
      </div>

      {/* Delete Button */}
      <motion.button
        onClick={handleDelete}
        disabled={isDisabled}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg
          text-slate-400 hover:text-red-400 hover:bg-red-500/10
          disabled:opacity-0 disabled:cursor-not-allowed
          transition-all duration-200"
        whileHover={{ scale: isDisabled ? 1 : 1.1 }}
        whileTap={{ scale: isDisabled ? 1 : 0.9 }}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </motion.button>

      {/* Active Indicator */}
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 
            bg-gradient-to-b from-nexus-cyan to-nexus-violet rounded-full"
        />
      )}
    </motion.div>
  );
};

// =============================================================================
// Empty State
// =============================================================================

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
      <MessageSquare className="w-8 h-8 text-slate-500" />
    </div>
    <p className="text-slate-400 text-sm">No conversations yet</p>
    <p className="text-slate-500 text-xs mt-1">Start a new chat to begin</p>
  </div>
);

export default Sidebar;
