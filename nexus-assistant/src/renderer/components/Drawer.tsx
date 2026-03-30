// =============================================================================
// NEXUS - Drawer Component
// Slide-out drawer with collapsed (indicator) and expanded states
// =============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Maximize2, 
  X, 
  Send, 
  ChevronLeft,
  MessageSquare,
  Sparkles,
  Pin,
  PinOff,
  Lock,
  Unlock,
  Play,
  Loader2,
  Plus,
} from 'lucide-react';
import { 
  IndicatorState, 
  IndicatorStatus, 
  DrawerState, 
  Conversation, 
  Message,
  ProactiveSuggestion 
} from '../../shared/types';
import ReactMarkdown from 'react-markdown';

// Color configurations for indicator states
const statusColors: Record<IndicatorStatus, { bg: string; glow: string; pulse: boolean }> = {
  idle: {
    bg: 'rgba(0, 240, 255, 0.6)',
    glow: 'rgba(0, 240, 255, 0.3)',
    pulse: false,
  },
  suggestion: {
    bg: 'rgba(251, 191, 36, 0.8)',
    glow: 'rgba(251, 191, 36, 0.4)',
    pulse: true,
  },
  message: {
    bg: 'rgba(52, 211, 153, 0.8)',
    glow: 'rgba(52, 211, 153, 0.4)',
    pulse: true,
  },
  error: {
    bg: 'rgba(248, 113, 113, 0.8)',
    glow: 'rgba(248, 113, 113, 0.4)',
    pulse: true,
  },
};

export const Drawer: React.FC = () => {
  const [indicatorState, setIndicatorState] = useState<IndicatorState>({ status: 'idle' });
  const [drawerState, setDrawerState] = useState<DrawerState>({ 
    mode: 'indicator', 
    isLocked: false, 
    isExpanded: false 
  });
  const [isHovered, setIsHovered] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [heightLocked, setHeightLocked] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen for state updates from main process
  useEffect(() => {
    const unsubIndicator = window.electronAPI.onIndicatorStateUpdate((_, newState) => {
      setIndicatorState(newState);
    });

    const unsubDrawer = window.electronAPI.onDrawerStateUpdate((_, newState) => {
      setDrawerState(newState);
    });

    // Get initial states
    window.electronAPI.getIndicatorState().then((state) => {
      if (state) setIndicatorState(state);
    });

    window.electronAPI.getDrawerState().then((state) => {
      if (state) setDrawerState(state);
    });

    return () => {
      unsubIndicator();
      unsubDrawer();
    };
  }, []);

  // Listen for chat stream events
  useEffect(() => {
    const unsubStream = window.electronAPI.onChatStream((_, data) => {
      if (data.type === 'start') {
        setIsStreaming(true);
        setStreamingContent('');
      } else if (data.type === 'content') {
        setStreamingContent(prev => prev + (data.content || ''));
      } else if (data.type === 'end') {
        setIsStreaming(false);
        setStreamingContent('');
        // Reload conversation to get the final message
        loadCurrentConversation();
      } else if (data.type === 'error') {
        setIsStreaming(false);
        setStreamingContent('');
      }
    });

    return unsubStream;
  }, []);

  // Listen for proactive suggestions in real time
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubSuggestion = window.electronAPI.onProactiveSuggestion((_, suggestion) => {
      setSuggestions(prev => [suggestion, ...prev.filter(s => s.id !== suggestion.id)]);
    });

    const unsubShowSuggestion = window.electronAPI.onProactiveShowSuggestion((_, suggestion) => {
      setSuggestions(prev => [suggestion, ...prev.filter(s => s.id !== suggestion.id)]);
    });

    return () => {
      unsubSuggestion();
      unsubShowSuggestion();
    };
  }, []);

  // Load conversation and suggestions when drawer expands; trigger analysis if empty
  useEffect(() => {
    if (drawerState.isExpanded) {
      loadCurrentConversation();
      loadSuggestions(true);
    }
  }, [drawerState.isExpanded]);

  // Load height lock setting
  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setHeightLocked(s.drawerHeightLocked ?? true);
    });
  }, [drawerState.isExpanded]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages, streamingContent]);

  const loadCurrentConversation = async () => {
    try {
      const conversations = await window.electronAPI.getAllConversations();
      if (conversations && conversations.length > 0) {
        // Get the most recent conversation
        const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
        const conv = await window.electronAPI.getConversation(sorted[0].id);
        if (conv) setConversation(conv);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const loadSuggestions = async (triggerIfEmpty = false) => {
    try {
      const sug = await window.electronAPI.getProactiveSuggestions();
      setSuggestions(sug || []);
      if (triggerIfEmpty && (!sug || sug.length === 0)) {
        setIsAnalyzing(true);
        try {
          await window.electronAPI.triggerProactiveAnalysis();
          const updated = await window.electronAPI.getProactiveSuggestions();
          setSuggestions(updated || []);
        } finally {
          setIsAnalyzing(false);
        }
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      setIsAnalyzing(false);
    }
  };

  const handleTriggerAnalysis = useCallback(async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      await window.electronAPI.triggerProactiveAnalysis();
      const sug = await window.electronAPI.getProactiveSuggestions();
      setSuggestions(sug || []);
    } catch (error) {
      console.error('Failed to trigger analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing]);

  // Handle hover to expand
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    
    // Clear any pending collapse
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    
    // Delay before expanding
    if (!drawerState.isExpanded && !drawerState.isLocked) {
      hoverTimeoutRef.current = setTimeout(() => {
        window.electronAPI.expandDrawer();
      }, 300);
    }
  }, [drawerState.isExpanded, drawerState.isLocked]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    
    // Clear pending expand
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // Collapse after delay if not locked
    if (drawerState.isExpanded && !drawerState.isLocked) {
      collapseTimeoutRef.current = setTimeout(() => {
        window.electronAPI.collapseDrawer();
      }, 500);
    }
  }, [drawerState.isExpanded, drawerState.isLocked]);

  // Handle click on indicator
  const handleIndicatorClick = useCallback(() => {
    if (!drawerState.isExpanded) {
      // Expand and lock
      window.electronAPI.expandDrawer();
      window.electronAPI.lockDrawer(true);
    }
  }, [drawerState.isExpanded]);

  // Handle double-click to open full view
  const handleDoubleClick = useCallback(() => {
    window.electronAPI.openFullView();
  }, []);

  // Toggle lock state
  const toggleLock = useCallback(() => {
    window.electronAPI.lockDrawer(!drawerState.isLocked);
  }, [drawerState.isLocked]);

  const toggleHeightLock = useCallback(async () => {
    const next = !heightLocked;
    setHeightLocked(next);
    await window.electronAPI.setDrawerHeightLocked(next);
  }, [heightLocked]);

  // Open full view
  const handleOpenFullView = useCallback(() => {
    window.electronAPI.openFullView();
  }, []);

  // Collapse drawer
  const handleCollapse = useCallback(() => {
    window.electronAPI.collapseDrawer();
  }, []);

  // Start new chat
  const handleNewChat = useCallback(async () => {
    if (isStreaming) return;
    try {
      const conv = await window.electronAPI.createConversation();
      setConversation(conv);
      setInputValue('');
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }, [isStreaming]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;
    
    const messageContent = inputValue.trim();
    setInputValue('');
    
    try {
      // Create conversation if none exists
      let conv = conversation;
      if (!conv) {
        conv = await window.electronAPI.createConversation();
        setConversation(conv);
      }
      
      // Create user message
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: messageContent,
        timestamp: Date.now(),
      };
      
      // Update local state immediately
      setConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, userMessage],
      } : null);
      
      // Get settings for model
      const settings = await window.electronAPI.getSettings();
      
      // Send message
      await window.electronAPI.sendChatMessage({
        conversationId: conv.id,
        message: userMessage,
        model: settings.defaultModel,
        useTools: settings.toolsEnabled ?? true,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [inputValue, isStreaming, conversation]);

  // Handle key press in input
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Send a message with given content (for suggestion actions)
  const sendSuggestionMessage = useCallback(async (content: string) => {
    if (isStreaming) return;
    try {
      let conv = conversation;
      if (!conv) {
        conv = await window.electronAPI.createConversation();
        setConversation(conv);
      }
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      setConversation(prev => prev ? { ...prev, messages: [...prev.messages, userMessage] } : null);
      const settings = await window.electronAPI.getSettings();
      await window.electronAPI.sendChatMessage({
        conversationId: conv.id,
        message: userMessage,
        model: settings.defaultModel,
        useTools: settings.toolsEnabled ?? true,
      });
    } catch (error) {
      console.error('Failed to send suggestion message:', error);
    }
  }, [isStreaming, conversation]);

  const handleSuggestionDismiss = useCallback(async (sug: ProactiveSuggestion) => {
    try {
      await window.electronAPI.dismissProactiveSuggestion(sug.id);
      setSuggestions(prev => prev.filter(s => s.id !== sug.id));
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
    }
  }, []);

  const handleSuggestionExecute = useCallback(async (sug: ProactiveSuggestion) => {
    try {
      await window.electronAPI.acceptProactiveSuggestion(sug.id);
      setSuggestions(prev => prev.filter(s => s.id !== sug.id));
      await sendSuggestionMessage(`Please perform this suggestion: "${sug.title}"\n\n${sug.content}\n\nUse your tools to execute any relevant actions.`);
    } catch (error) {
      console.error('Failed to execute suggestion:', error);
    }
  }, [sendSuggestionMessage]);

  const handleSuggestionChat = useCallback(async (sug: ProactiveSuggestion) => {
    try {
      await window.electronAPI.acceptProactiveSuggestion(sug.id);
      setSuggestions(prev => prev.filter(s => s.id !== sug.id));
      await sendSuggestionMessage(`Based on your earlier suggestion: "${sug.title}"\n\n${sug.content}\n\nTell me more about this.`);
    } catch (error) {
      console.error('Failed to chat about suggestion:', error);
    }
  }, [sendSuggestionMessage]);

  const colors = statusColors[indicatorState.status];

  // Render collapsed indicator
  if (!drawerState.isExpanded) {
    return (
      <motion.div
        className="w-full h-full flex items-center justify-center cursor-pointer"
        onClick={handleIndicatorClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <motion.div
          className="rounded-full"
          animate={{
            backgroundColor: colors.bg,
            boxShadow: `0 0 ${isHovered ? '20px' : '12px'} ${colors.glow}`,
            scale: isHovered ? 1.2 : 1,
            width: isHovered ? '100%' : '80%',
            height: isHovered ? '100%' : '90%',
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ minWidth: 6, minHeight: 40 }}
        >
          {colors.pulse && (
            <motion.div
              className="w-full h-full rounded-full"
              animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ backgroundColor: colors.bg }}
            />
          )}
        </motion.div>
        
        {indicatorState.count && indicatorState.count > 1 && (
          <motion.div
            className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-red-500 
              flex items-center justify-center text-[8px] font-bold text-white"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            {indicatorState.count > 9 ? '9+' : indicatorState.count}
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Render expanded drawer
  return (
    <motion.div
      className="w-full h-full flex flex-col bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.bg, boxShadow: `0 0 8px ${colors.glow}` }}
          />
          <span className="text-sm font-medium text-slate-200">NEXUS</span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* New chat button */}
          <button
            onClick={handleNewChat}
            disabled={isStreaming}
            className="p-1.5 rounded-lg text-slate-400 hover:text-nexus-cyan hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Height lock button */}
          <button
            onClick={toggleHeightLock}
            className={`p-1.5 rounded-lg transition-colors ${
              heightLocked
                ? 'text-nexus-emerald bg-nexus-emerald/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={heightLocked ? 'Height locked (scrollable)' : 'Height unlocked (resizable)'}
          >
            {heightLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>

          {/* Lock/Pin button */}
          <button
            onClick={toggleLock}
            className={`p-1.5 rounded-lg transition-colors ${
              drawerState.isLocked
                ? 'text-nexus-cyan bg-nexus-cyan/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={drawerState.isLocked ? 'Unpin drawer' : 'Pin drawer open'}
          >
            {drawerState.isLocked ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>

          {/* Open Full View button */}
          <button
            onClick={handleOpenFullView}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Open Full View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          
          {/* Collapse button */}
          <button
            onClick={handleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Collapse"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Suggestions */}
      <div className="border-b border-slate-700/50 overflow-hidden">
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Sparkles className="w-3 h-3" />
              <span>Suggestions</span>
            </div>
            <button
              onClick={handleTriggerAnalysis}
              disabled={isAnalyzing}
              className="p-1.5 rounded-lg text-slate-400 hover:text-nexus-violet hover:bg-slate-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={suggestions.length > 0 ? 'Analyze again' : 'Analyze my work'}
            >
              {isAnalyzing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
            </button>
          </div>
          {suggestions.length > 0 ? (
            suggestions.slice(0, 2).map((sug) => (
              <div
                key={sug.id}
                className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-slate-300"
              >
                <div className="font-medium text-amber-400">{sug.title}</div>
                <div className="line-clamp-2 mt-1 mb-2">{sug.content}</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSuggestionExecute(sug)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-nexus-cyan/10 text-nexus-cyan hover:bg-nexus-cyan/20 text-[10px] transition-colors"
                  >
                    <Play className="w-2.5 h-2.5" />
                    Do it
                  </button>
                  <button
                    onClick={() => handleSuggestionChat(sug)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-nexus-cyan/10 text-nexus-cyan hover:bg-nexus-cyan/20 text-[10px] transition-colors"
                  >
                    <MessageSquare className="w-2.5 h-2.5" />
                    Discuss
                  </button>
                  <button
                    onClick={() => handleSuggestionDismiss(sug)}
                    className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <button
              onClick={handleTriggerAnalysis}
              disabled={isAnalyzing}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-nexus-violet hover:border-nexus-violet/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>Analyze my work</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {conversation?.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-nexus-cyan/20 text-slate-200 border border-nexus-cyan/30'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {typeof msg.content === 'string' ? (
                <ReactMarkdown
                  className="prose prose-sm prose-invert max-w-none"
                  components={{
                    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                    code: ({ children }) => (
                      <code className="bg-slate-900 px-1 py-0.5 rounded text-xs">{children}</code>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <span>{JSON.stringify(msg.content)}</span>
              )}
            </div>
          </div>
        ))}
        
        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm bg-slate-800 text-slate-300 border border-slate-700">
              <ReactMarkdown className="prose prose-sm prose-invert max-w-none">
                {streamingContent}
              </ReactMarkdown>
              <span className="inline-block w-1.5 h-4 bg-nexus-cyan animate-pulse ml-0.5" />
            </div>
          </div>
        )}
        
        {/* Empty state */}
        {(!conversation || conversation.messages.length === 0) && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs">Start a conversation</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-700/50">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask something..."
            className="flex-1 min-h-[36px] max-h-[100px] px-3 py-2 rounded-xl
              bg-slate-800 border border-slate-700 text-sm text-slate-200
              placeholder-slate-500 resize-none focus:outline-none focus:border-nexus-cyan/50
              transition-colors"
            rows={1}
            disabled={isStreaming}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isStreaming}
            className="p-2 rounded-xl bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30
              hover:bg-nexus-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default Drawer;
