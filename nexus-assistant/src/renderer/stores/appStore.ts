// =============================================================================
// NEXUS - App Store
// Zustand store for conversation and chat state management
// =============================================================================

import { create } from 'zustand';
import { Conversation, ConversationSummary, Message, ConversationSearchResult, SearchOptions, MAX_RECENT_SEARCHES } from '../../shared/types';
import { showError, showSuccess, showInfo } from './toastStore';
import { logger, logIpcCall, logIpcError, logIpcResponse } from '../utils/logger';
import { useSettingsStore } from './settingsStore';

interface AppState {
  // State
  conversations: ConversationSummary[];
  currentConversation: string | null;
  currentConversationData: Conversation | null;
  isInitialized: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;
  streamingThinking: string;
  activeToolCalls: Array<{
    toolCallId: string;
    toolName: string;
    args?: string;
    status: 'running' | 'complete' | 'error';
    result?: unknown;
    error?: string;
    statusMessage?: string;
  }>;
  /** Messages shown in chat via display_message tool (cleared on stream end) */
  agentDisplayMessages: Array<{
    id: string;
    message: string;
    title?: string;
    messageType: 'info' | 'success' | 'warning' | 'error';
    conversationId: string;
  }>;
  error: string | null;
  pendingPrompt: string | null;
  
  // Connection status
  isApiConnected: boolean;
  isPiecesConnected: boolean;
  
  // Search state
  searchQuery: string;
  searchResults: ConversationSearchResult[];
  isSearching: boolean;
  recentSearches: string[];

  // Context reset proposal (agent asking to start fresh)
  contextResetProposal: { id: string; message: string; currentMessageCount: number; estimatedTokens: number } | null;
  
  // Actions
  initialize: () => Promise<void>;
  createConversation: (initialPrompt?: string) => Promise<void>;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  getConversation: (id: string) => Promise<Conversation | null>;
  loadConversation: (id: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, model: string, attachments?: { type: 'image'; base64: string; name: string }[], chatContext?: 'sidebar' | 'main') => Promise<void>;
  regenerateLastResponse: () => Promise<void>;
  cancelStream: () => void;
  appendStreamingContent: (content: string) => void;
  appendStreamingThinking: (content: string) => void;
  finalizeStream: (conversation: Conversation) => void;
  handleStreamError: (error: string) => void;
  clearError: () => void;
  clearPendingPrompt: () => void;
  checkConnectionStatus: () => Promise<void>;
  
  // Search actions
  setSearchQuery: (query: string) => void;
  searchConversations: (query: string) => Promise<void>;
  clearSearch: () => void;
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  loadRecentSearches: () => void;

  respondToContextReset: (proposalId: string, accepted: boolean) => Promise<void>;
}

// Subscribe to settings store changes to keep isApiConnected in sync
let unsubscribeFromSettings: (() => void) | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  currentConversationData: null,
  isInitialized: false,
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
  streamingMessageId: null,
  streamingThinking: '',
  activeToolCalls: [],
  agentDisplayMessages: [],
  error: null,
  pendingPrompt: null,
  isApiConnected: false,
  isPiecesConnected: false,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  recentSearches: [],
  contextResetProposal: null,

  initialize: async () => {
    logger.info('Initializing app store...');
    set({ isLoading: true });
    
    try {
      logIpcCall('getAllConversations');
      const startTime = Date.now();
      const conversations = await window.electronAPI?.getAllConversations();
      logIpcResponse('getAllConversations', conversations, Date.now() - startTime);
      
      // Convert to summaries
      const summaries: ConversationSummary[] = conversations?.map((c: Conversation) => ({
        id: c.id,
        title: c.title,
        messageCount: c.messages.length,
        lastMessage: c.messages[c.messages.length - 1]?.content as string || '',
        updatedAt: c.updatedAt,
      })) || [];

      set({ 
        conversations: summaries,
        isInitialized: true,
        isLoading: false,
        error: null,
      });
      
      logger.info(`Loaded ${summaries.length} conversations`);
      
      // Load recent searches from localStorage
      get().loadRecentSearches();
      
      // Check connection status
      await get().checkConnectionStatus();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize app:', error);
      logIpcError('getAllConversations', error);
      
      set({ 
        isInitialized: true,
        isLoading: false,
        error: errorMessage,
      });
      
      showError('Failed to load conversations. Please try again.', 8000, {
        label: 'Retry',
        onClick: () => get().initialize(),
      });
    }
  },

  createConversation: async (initialPrompt?: string) => {
    logger.info('Creating new conversation...');
    
    try {
      logIpcCall('createConversation');
      const conversation = await window.electronAPI?.createConversation();
      
      if (!conversation) {
        throw new Error('Failed to create conversation - no response from server');
      }

      const summary: ConversationSummary = {
        id: conversation.id,
        title: conversation.title,
        messageCount: 0,
        lastMessage: '',
        updatedAt: conversation.updatedAt,
      };

      set((state) => ({
        conversations: [summary, ...state.conversations],
        currentConversation: conversation.id,
        pendingPrompt: initialPrompt || null,
        error: null,
      }));
      
      logger.info(`Created conversation: ${conversation.id}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create conversation:', error);
      
      set({ error: errorMessage });
      showError(`Failed to create conversation: ${errorMessage}`, 6000);
    }
  },

  selectConversation: (id: string) => {
    logger.debug(`Selecting conversation: ${id}`);
    set({ 
      currentConversation: id, 
      error: null,
      streamingContent: '',
      streamingThinking: '',
      streamingMessageId: null,
      activeToolCalls: [],
    });
    // Load conversation data
    get().loadConversation(id);
  },

  loadConversation: async (id: string) => {
    try {
      logIpcCall('getConversation', id);
      const conversation = await window.electronAPI?.getConversation(id);
      if (conversation) {
        set({ currentConversationData: conversation });
        logIpcResponse('getConversation', { id: conversation.id, messagesCount: conversation.messages.length });
      } else {
        set({ currentConversationData: null });
        logger.warn(`Conversation not found: ${id}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to load conversation ${id}:`, error);
      set({ currentConversationData: null });
      showError('Failed to load conversation details', 5000);
    }
  },

  deleteConversation: async (id: string) => {
    logger.info(`Deleting conversation: ${id}`);
    
    try {
      logIpcCall('deleteConversation', id);
      await window.electronAPI?.deleteConversation(id);
      
      set((state) => {
        const newConversations = state.conversations.filter(c => c.id !== id);
        const newCurrentId = state.currentConversation === id 
          ? (newConversations[0]?.id || null)
          : state.currentConversation;
        
        logger.info(`Deleted conversation: ${id}`);
        
        return {
          conversations: newConversations,
          currentConversation: newCurrentId,
          error: null,
        };
      });
      
      showInfo('Conversation deleted', 3000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete conversation:', error);
      
      set({ error: errorMessage });
      showError(`Failed to delete conversation: ${errorMessage}`, 6000);
    }
  },

  getConversation: async (id: string) => {
    try {
      logIpcCall('getConversation', id);
      const conversation = await window.electronAPI?.getConversation(id);
      return conversation || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get conversation ${id}:`, error);
      showError('Failed to load conversation details', 5000);
      return null;
    }
  },

  sendMessage: async (conversationId: string, content: string, model: string, attachments?: { type: 'image'; base64: string; name: string }[], chatContext: 'sidebar' | 'main' = 'main') => {
    const { isStreaming, isApiConnected } = get();
    
    // Validation: Check if already streaming
    if (isStreaming) {
      logger.warn('Cannot send message: already streaming');
      return;
    }
    
    // Validation: Check for empty message
    if (!content || !content.trim()) {
      logger.warn('Cannot send message: content is empty');
      showError('Please enter a message before sending', 3000);
      return;
    }
    
    // Validation: Check API connection
    if (!isApiConnected) {
      logger.warn('Cannot send message: API not connected');
      showError('Kimi API key not configured. Please add your API key in settings.', 8000, {
        label: 'Open Settings',
        onClick: () => window.dispatchEvent(new CustomEvent('nexus:open-settings')),
      });
      return;
    }

    logger.info(`Sending message to conversation: ${conversationId}`);

    // Build message content - can be string or array with attachments
    let messageContent: string | { type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }[];
    
    if (attachments && attachments.length > 0) {
      messageContent = [
        { type: 'text', text: content.trim() },
        ...attachments.map(att => ({
          type: 'image_url' as const,
          image_url: { url: `data:image/${att.name.split('.').pop() || 'png'};base64,${att.base64}` }
        }))
      ];
    } else {
      messageContent = content.trim();
    }

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    };

    // Update conversation locally (optimistic user message)
    set((state) => ({
      isStreaming: true,
      streamingContent: '',
      streamingMessageId: `msg_${Date.now()}_assistant`,
      activeToolCalls: [],
      agentDisplayMessages: [],
      conversations: state.conversations.map(c =>
        c.id === conversationId
          ? {
              ...c,
              messageCount: c.messageCount + 1,
              lastMessage: content.trim(),
              updatedAt: Date.now(),
            }
          : c
      ),
      currentConversationData:
        state.currentConversation === conversationId && state.currentConversationData
          ? {
              ...state.currentConversationData,
              messages: [...state.currentConversationData.messages, userMessage],
              updatedAt: Date.now(),
            }
          : state.currentConversationData,
      error: null,
    }));

    try {
      // Send to main process
      const settings = useSettingsStore.getState().settings;
      logIpcCall('sendChatMessage', { conversationId, model });
      await window.electronAPI?.sendChatMessage({
        conversationId,
        message: userMessage,
        model,
        useTools: settings.toolsEnabled ?? true,
        chatContext,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send message:', error);
      logIpcError('sendChatMessage', error);
      
      set({ 
        isStreaming: false,
        error: errorMessage,
      });
      
      showError(`Failed to send message: ${errorMessage}`, 8000, {
        label: 'Retry',
        onClick: () => get().sendMessage(conversationId, content, model, undefined, chatContext),
      });
    }
  },

  regenerateLastResponse: async () => {
    const { currentConversationData, isStreaming, isApiConnected } = get();
    
    if (!currentConversationData) {
      logger.warn('Cannot regenerate: no conversation loaded');
      return;
    }
    
    if (isStreaming) {
      logger.warn('Cannot regenerate: already streaming');
      return;
    }
    
    if (!isApiConnected) {
      logger.warn('Cannot regenerate: API not connected');
      showError('Kimi API key not configured. Please add your API key in settings.', 8000, {
        label: 'Open Settings',
        onClick: () => window.dispatchEvent(new CustomEvent('nexus:open-settings')),
      });
      return;
    }
    
    // Find the last user message
    const messages = currentConversationData.messages;
    let lastUserMessageIndex = -1;
    
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessageIndex = i;
        break;
      }
    }
    
    if (lastUserMessageIndex === -1) {
      logger.warn('Cannot regenerate: no user message found');
      showError('No message to regenerate', 3000);
      return;
    }
    
    const lastUserMessage = messages[lastUserMessageIndex];
    const lastUserContent = typeof lastUserMessage.content === 'string' 
      ? lastUserMessage.content 
      : lastUserMessage.content.find(c => c.type === 'text')?.text || '';
    
    logger.info('Regenerating last response...');
    
    // Remove the assistant response(s) after the last user message
    const trimmedMessages = messages.slice(0, lastUserMessageIndex);
    
    // Update the conversation locally first
    const updatedConversation = {
      ...currentConversationData,
      messages: trimmedMessages,
      updatedAt: Date.now(),
    };
    
    set({ currentConversationData: updatedConversation });
    
    // Send the last user message again
    const settings = useSettingsStore.getState().settings;
    await get().sendMessage(
      currentConversationData.id, 
      lastUserContent, 
      settings.defaultModel
    );
    
    showInfo('Regenerating response...', 2000);
  },

  cancelStream: () => {
    logger.info('Cancelling stream...');
    window.electronAPI?.cancelChat();
    set({ isStreaming: false, activeToolCalls: [], agentDisplayMessages: [] });
    showInfo('Response cancelled', 2000);
  },

  appendStreamingContent: (content: string) => {
    set((state) => ({
      streamingContent: state.streamingContent + content,
    }));
  },

  appendStreamingThinking: (content: string) => {
    set((state) => ({
      streamingThinking: state.streamingThinking + content,
    }));
  },

  finalizeStream: (conversation: Conversation) => {
    logger.info('Stream finalized');
    set((state) => ({
      isStreaming: false,
      streamingContent: '',
      streamingThinking: '',
      streamingMessageId: null,
      activeToolCalls: [],
      agentDisplayMessages: [],
      currentConversationData: conversation,
      conversations: state.conversations.map(c =>
        c.id === conversation.id
          ? {
              ...c,
              messageCount: conversation.messages.length,
              lastMessage: conversation.messages[conversation.messages.length - 1]?.content as string || '',
              updatedAt: conversation.updatedAt,
              title: conversation.title !== 'New Conversation' ? conversation.title : c.title,
            }
          : c
      ),
      error: null,
    }));
  },

  handleStreamError: (error: string) => {
    logger.error('Chat stream error:', error);
    set({ 
      isStreaming: false,
      streamingContent: '',
      streamingThinking: '',
      streamingMessageId: null,
      activeToolCalls: [],
      error,
    });
    
    // Handle specific error types
    if (error.includes('rate limit') || error.includes('429')) {
      showError('Rate limit exceeded. Please wait a moment before sending another message.', 10000);
    } else if (error.includes('API key') || error.includes('401') || error.includes('403')) {
      showError('API key error. Please check your Kimi API key in settings.', 8000, {
        label: 'Open Settings',
        onClick: () => window.dispatchEvent(new CustomEvent('nexus:open-settings')),
      });
    } else if (error.includes('network') || error.includes('ECONNREFUSED')) {
      showError('Network error. Please check your internet connection.', 8000);
    } else {
      showError(`Error: ${error}`, 8000);
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearPendingPrompt: () => {
    set({ pendingPrompt: null });
  },

  checkConnectionStatus: async () => {
    try {
      // Check Pieces status
      const piecesStatus = await window.electronAPI?.getPiecesStatus();
      
      // Check API connection from settings store
      const { apiKeyStatus } = useSettingsStore.getState();
      
      set({ 
        isPiecesConnected: piecesStatus?.available || false,
        isApiConnected: apiKeyStatus === 'valid',
      });
    } catch (error) {
      logger.warn('Failed to check connection status:', error);
      set({ 
        isPiecesConnected: false,
        isApiConnected: false,
      });
    }
  },
  
  // ===========================================================================
  // Search Actions
  // ===========================================================================
  
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },
  
  searchConversations: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    
    set({ isSearching: true });
    
    try {
      logIpcCall('searchConversations', query);
      const startTime = Date.now();
      
      const options: SearchOptions = {
        query: query.trim(),
        limit: 20,
      };
      
      const results = await window.electronAPI?.searchConversations(options) || [];
      
      logIpcResponse('searchConversations', { resultCount: results.length }, Date.now() - startTime);
      
      set({ searchResults: results, isSearching: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Search failed:', error);
      logIpcError('searchConversations', error);
      
      set({ searchResults: [], isSearching: false });
      showError(`Search failed: ${errorMessage}`, 5000);
    }
  },
  
  clearSearch: () => {
    set({ searchQuery: '', searchResults: [], isSearching: false });
  },
  
  addRecentSearch: (query: string) => {
    set((state) => {
      // Remove if already exists (to move to top)
      const filtered = state.recentSearches.filter(q => q.toLowerCase() !== query.toLowerCase());
      // Add to front and limit
      const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      
      // Persist to localStorage
      try {
        localStorage.setItem('nexus:recent-searches', JSON.stringify(updated));
      } catch (e) {
        logger.warn('Failed to save recent searches:', e);
      }
      
      return { recentSearches: updated };
    });
  },
  
  removeRecentSearch: (query: string) => {
    set((state) => {
      const updated = state.recentSearches.filter(q => q !== query);
      
      // Persist to localStorage
      try {
        localStorage.setItem('nexus:recent-searches', JSON.stringify(updated));
      } catch (e) {
        logger.warn('Failed to save recent searches:', e);
      }
      
      return { recentSearches: updated };
    });
  },
  
  clearRecentSearches: () => {
    set({ recentSearches: [] });
    
    try {
      localStorage.removeItem('nexus:recent-searches');
    } catch (e) {
      logger.warn('Failed to clear recent searches:', e);
    }
  },
  
  loadRecentSearches: () => {
    try {
      const stored = localStorage.getItem('nexus:recent-searches');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          set({ recentSearches: parsed.slice(0, MAX_RECENT_SEARCHES) });
        }
      }
    } catch (e) {
      logger.warn('Failed to load recent searches:', e);
    }
  },

  respondToContextReset: async (proposalId: string, accepted: boolean) => {
    await window.electronAPI?.respondToContextReset(proposalId, accepted);
    set({ contextResetProposal: null });
    if (accepted) {
      await useAppStore.getState().initialize();
    }
  },
}));

// Subscribe to settings store apiKeyStatus changes to sync isApiConnected
// This ensures isApiConnected is updated whenever settings are loaded/updated
const setupSettingsSubscription = () => {
  if (unsubscribeFromSettings) return; // Already subscribed
  
  let previousApiKeyStatus = useSettingsStore.getState().apiKeyStatus;
  
  unsubscribeFromSettings = useSettingsStore.subscribe((state) => {
    const apiKeyStatus = state.apiKeyStatus;
    if (apiKeyStatus !== previousApiKeyStatus) {
      previousApiKeyStatus = apiKeyStatus;
      logger.debug('apiKeyStatus changed, syncing isApiConnected...');
      useAppStore.getState().checkConnectionStatus();
    }
  });
};

// Setup subscription when in renderer environment
if (typeof window !== 'undefined') {
  setupSettingsSubscription();
}

// Setup IPC listeners for streaming and agent messages
if (typeof window !== 'undefined' && window.electronAPI) {
  window.electronAPI.onContextResetProposed((_, proposal) => {
    useAppStore.setState({ contextResetProposal: proposal });
  });

  window.electronAPI.onChatStream((_, data) => {
    const { 
      appendStreamingContent, 
      appendStreamingThinking,
      finalizeStream, 
      handleStreamError,
      isStreaming,
      activeToolCalls,
    } = useAppStore.getState();

    // Agent-initiated message - always process
    if (data.type === 'agent_message') {
      const { conversationId, message, conversation } = data;
      if (!conversationId || !conversation) return;
      const state = useAppStore.getState();
      const summaries = state.conversations.map((s) =>
        s.id === conversationId
          ? { ...s, messageCount: conversation.messages.length, lastMessage: typeof message.content === 'string' ? message.content.slice(0, 100) : '', updatedAt: conversation.updatedAt }
          : s
      );
      const isNew = !summaries.some((s) => s.id === conversationId);
      if (isNew) {
        summaries.unshift({
          id: conversation.id,
          title: conversation.title,
          messageCount: conversation.messages.length,
          lastMessage: typeof message.content === 'string' ? message.content.slice(0, 100) : '',
          updatedAt: conversation.updatedAt,
        });
      }
      useAppStore.setState({
        conversations: summaries,
        currentConversation: state.currentConversation || conversationId,
        currentConversationData: state.currentConversation === conversationId || !state.currentConversation ? conversation : state.currentConversationData,
      });
      showInfo('NEXUS sent a message', 3000);
      return;
    }

    // Only process if we're in streaming state (except for errors, tool events, display_message, and complete for current conversation)
    if (!isStreaming && data.type !== 'error' && data.type !== 'tool_start' && data.type !== 'tool_complete' && data.type !== 'tool_error' && data.type !== 'complete' && data.type !== 'display_message') {
      return;
    }

    // Scope tool events to current conversation (show when no conversation selected or event matches)
    const currentConversation = useAppStore.getState().currentConversation;
    const isForCurrentConversation = !currentConversation || !data.conversationId || data.conversationId === currentConversation;
    if (!isForCurrentConversation && ['tool_start', 'tool_complete', 'tool_error'].includes(data.type)) {
      return;
    }

    switch (data.type) {
      case 'content':
        if (data.content) {
          appendStreamingContent(data.content);
        }
        break;
        
      case 'thinking':
        if (data.content) {
          appendStreamingThinking(data.content);
        }
        break;
        
      case 'tool_start':
        if (data.toolName && data.toolCallId) {
          const state = useAppStore.getState();
          useAppStore.setState({
            ...(!state.isStreaming && { isStreaming: true }),
            activeToolCalls: [
              ...activeToolCalls.filter((t) => t.toolCallId !== data.toolCallId),
              {
                toolCallId: data.toolCallId,
                toolName: data.toolName,
                args: data.args,
                status: 'running' as const,
                statusMessage: data.statusMessage,
              },
            ],
          });
        }
        break;
        
      case 'tool_complete':
        if (data.toolCallId && data.toolName) {
          const exists = activeToolCalls.some((t) => t.toolCallId === data.toolCallId);
          useAppStore.setState({
            activeToolCalls: exists
              ? activeToolCalls.map((t) =>
                  t.toolCallId === data.toolCallId
                    ? { ...t, status: 'complete' as const, result: data.result }
                    : t
                )
              : [
                  ...activeToolCalls,
                  {
                    toolCallId: data.toolCallId,
                    toolName: data.toolName,
                    status: 'complete' as const,
                    result: data.result,
                  },
                ],
          });
        }
        break;
        
      case 'tool_error':
        if (data.toolCallId && data.toolName) {
          const exists = activeToolCalls.some((t) => t.toolCallId === data.toolCallId);
          useAppStore.setState({
            activeToolCalls: exists
              ? activeToolCalls.map((t) =>
                  t.toolCallId === data.toolCallId
                    ? { ...t, status: 'error' as const, error: data.error }
                    : t
                )
              : [
                  ...activeToolCalls,
                  {
                    toolCallId: data.toolCallId,
                    toolName: data.toolName,
                    status: 'error' as const,
                    error: data.error,
                  },
                ],
          });
        }
        break;
        
      case 'end':
        if (data.conversation) {
          finalizeStream(data.conversation);
          showSuccess('Response complete', 2000);
        }
        break;
        
      case 'error':
        handleStreamError(data.error || 'Unknown streaming error');
        break;

      case 'complete':
        useAppStore.setState({ isStreaming: false, agentDisplayMessages: [] });
        showSuccess('Command execution complete', 2000);
        setTimeout(() => {
          useAppStore.setState({ activeToolCalls: [] });
        }, 5000);
        break;

      case 'display_message':
        if (data.message != null && data.conversationId && (!currentConversation || data.conversationId === currentConversation)) {
          useAppStore.setState((s) => ({
            agentDisplayMessages: [
              ...s.agentDisplayMessages,
              {
                id: `display_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                message: String(data.message),
                title: data.title != null ? String(data.title) : undefined,
                messageType: (['info', 'success', 'warning', 'error'] as const).includes(data.messageType) ? data.messageType : 'info',
                conversationId: data.conversationId,
              },
            ],
          }));
        }
        break;

      default:
        logger.debug('Unknown stream event type:', data.type);
    }
  });
}
