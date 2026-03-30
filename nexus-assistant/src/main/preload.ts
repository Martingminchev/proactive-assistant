// =============================================================================
// NEXUS - Preload Script
// Secure bridge between main and renderer processes
// =============================================================================

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  IPC_CHANNELS,
  AppSettings,
  Conversation,
  PiecesAsset,
  PiecesLtmQueryOptions,
  PiecesLtmResponse,
  Message,
  SystemContext,
  ProactiveSuggestion,
  ProactiveAgentConfig,
  IndicatorState,
  DrawerState,
  AppDisplayMode,
  PersonalitySettings,
  SoulDocument,
  ProactiveAction,
  ActionType,
  ActionPermissionLevel,
  ActionExecutorStatus,
  ToolExecutionEvent,
  ActionConfirmationRequest,
  ActionConfirmationResponse,
  ActionPermissionMemory,
  ConfirmableActionType,
  SearchOptions,
  ConversationSearchResult,
  AssistantMode,
  ContextUpdatePayload,
} from '../shared/types';

// =============================================================================
// Type Definitions for Exposed API
// =============================================================================

export interface ElectronAPI {
  // Window
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
  showWindow: () => Promise<void>;
  toggleWindow: () => Promise<void>;
  
  // App
  quitApp: () => Promise<void>;
  getVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  
  // Settings
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  resetSettings: () => Promise<AppSettings>;
  validateApiKey: (apiKey: string, baseUrl?: string) => Promise<{ valid: boolean; error?: string }>;
  
  // Conversations
  getAllConversations: () => Promise<Conversation[]>;
  getConversation: (id: string) => Promise<Conversation | null>;
  createConversation: () => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<boolean>;
  updateConversation: (conversation: Partial<Conversation> & { id: string }) => Promise<Conversation | null>;
  agentMessage: (content: string, options?: { createNewThread?: boolean; threadTitle?: string; priority?: 'low' | 'normal' | 'high'; conversationId?: string }) => Promise<{ conversationId: string; messageId: string } | null>;
  isContextCluttered: (conversationId?: string) => Promise<boolean>;
  proposeContextReset: (conversationId?: string) => Promise<boolean>;
  respondToContextReset: (proposalId: string, accepted: boolean) => Promise<void>;
  onAgentMessage: (callback: (event: IpcRendererEvent, data: { conversationId: string; message: Message; conversation: Conversation }) => void) => () => void;
  onContextResetProposed: (callback: (event: IpcRendererEvent, proposal: { id: string; message: string; currentMessageCount: number; estimatedTokens: number }) => void) => () => void;
  
  // Chat
  sendChatMessage: (params: {
    conversationId: string;
    message: Message;
    model: string;
    useTools?: boolean;
    chatContext?: 'sidebar' | 'main';
  }) => Promise<void>;
  cancelChat: () => Promise<void>;
  onChatStream: (callback: (event: IpcRendererEvent, data: {
    type: 'start' | 'content' | 'thinking' | 'end' | 'error' | 'tool_start' | 'tool_complete' | 'tool_error';
    content?: string;
    messageId?: string;
    conversationId?: string;
    conversation?: Conversation;
    error?: string;
    toolName?: string;
    toolCallId?: string;
    args?: string;
    result?: any;
  }) => void) => () => void;
  onConversationCreate: (callback: () => void) => () => void;
  onOpenSettings: (callback: () => void) => () => void;
  
  // Context
  getContext: () => Promise<SystemContext>;
  subscribeContext: () => void;
  unsubscribeContext: () => void;
  onContextUpdate: (callback: (event: IpcRendererEvent, payload: ContextUpdatePayload) => void) => () => void;
  setSidebarMode: (mode: AssistantMode) => Promise<void>;
  getSidebarMode: () => Promise<AssistantMode>;
  onModeChanged: (callback: (event: IpcRendererEvent, mode: AssistantMode) => void) => () => void;
  
  // Pieces
  getPiecesStatus: () => Promise<{ available: boolean; version?: string; error?: string }>;
  searchPieces: (query: string, limit?: number) => Promise<PiecesAsset[]>;
  getPiecesAsset: (id: string) => Promise<PiecesAsset | null>;
  getAllPiecesAssets: () => Promise<PiecesAsset[]>;
  getRelevantPieces: (query: string, maxAssets?: number) => Promise<PiecesAsset[]>;
  
  // Pieces LTM (Long-Term Memory via MCP)
  getPiecesLtmStatus: () => Promise<{ connected: boolean; tools?: string[]; error?: string }>;
  queryPiecesLtm: (question: string, options?: PiecesLtmQueryOptions) => Promise<PiecesLtmResponse>;
  queryPiecesLtmTopic: (topic: string) => Promise<PiecesLtmResponse>;
  queryPiecesLtmCoding: (hoursBack?: number) => Promise<PiecesLtmResponse>;
  queryPiecesLtmBrowsing: () => Promise<PiecesLtmResponse>;
  
  // Proactive Agent
  getProactiveSuggestions: () => Promise<ProactiveSuggestion[]>;
  dismissProactiveSuggestion: (id: string) => Promise<boolean>;
  snoozeProactiveSuggestion: (id: string, minutes?: number) => Promise<boolean>;
  acceptProactiveSuggestion: (id: string) => Promise<ProactiveSuggestion | null>;
  triggerProactiveAnalysis: () => Promise<ProactiveSuggestion | null>;
  getProactiveConfig: () => Promise<ProactiveAgentConfig>;
  updateProactiveConfig: (config: Partial<ProactiveAgentConfig>) => Promise<ProactiveAgentConfig>;
  onProactiveSuggestion: (callback: (event: IpcRendererEvent, suggestion: ProactiveSuggestion) => void) => () => void;
  onProactiveShowSuggestion: (callback: (event: IpcRendererEvent, suggestion: ProactiveSuggestion) => void) => () => void;
  
  // Personality
  getPersonality: () => Promise<PersonalitySettings>;
  updatePersonality: (personality: Partial<PersonalitySettings>) => Promise<PersonalitySettings>;
  
  // Soul Document
  getSoulDocument: () => Promise<SoulDocument>;
  updateSoulDocument: (content: string) => Promise<SoulDocument>;
  resetSoulDocument: () => Promise<SoulDocument>;
  aiUpdateSoulDocument: (section: string, content: string) => Promise<SoulDocument>;
  
  // Screenshot
  captureScreenshot: () => Promise<string | null>;
  analyzeScreenshot: (base64Image: string) => Promise<string>;
  
  // Indicator
  getIndicatorState: () => Promise<IndicatorState>;
  indicatorClicked: () => Promise<void>;
  indicatorDismiss: () => Promise<void>;
  onIndicatorStateUpdate: (callback: (event: IpcRendererEvent, state: IndicatorState) => void) => () => void;
  
  // Drawer / Display Mode
  getDrawerState: () => Promise<DrawerState>;
  setAppMode: (mode: AppDisplayMode) => Promise<DrawerState>;
  expandDrawer: () => Promise<DrawerState>;
  collapseDrawer: () => Promise<DrawerState>;
  lockDrawer: (locked: boolean) => Promise<DrawerState>;
  openFullView: () => Promise<DrawerState>;
  setDrawerHeightLocked: (locked: boolean) => Promise<DrawerState>;
  onDrawerStateUpdate: (callback: (event: IpcRendererEvent, state: DrawerState) => void) => () => void;
  
  // V2 Actions
  executeAction: (action: ProactiveAction) => Promise<{ success: boolean; message?: string; data?: any; error?: string; executedAt?: number }>;
  getActionStatus: () => Promise<ActionExecutorStatus>;
  getActionHistory: (limit?: number) => Promise<ProactiveAction[]>;
  getPendingActions: () => Promise<ProactiveAction[]>;
  confirmAction: (actionId: string) => Promise<{ success: boolean; message?: string; data?: any; error?: string; executedAt?: number }>;
  denyAction: (actionId: string) => Promise<{ success: boolean; message?: string; data?: any; error?: string; executedAt?: number }>;
  updateActionConfig: (config: any) => Promise<ActionExecutorStatus>;
  setActionPermission: (type: ActionType, level: ActionPermissionLevel) => Promise<{ success: boolean }>;
  respondToActionConfirmation: (response: ActionConfirmationResponse) => Promise<boolean>;
  clearActionPermission: (actionType: ConfirmableActionType, pattern?: string) => Promise<boolean>;
  getActionPermission: () => Promise<ActionPermissionMemory[]>;
  onActionExecuting: (callback: (event: IpcRendererEvent, action: ProactiveAction) => void) => () => void;
  onActionCompleted: (callback: (event: IpcRendererEvent, action: ProactiveAction) => void) => () => void;
  onActionFailed: (callback: (event: IpcRendererEvent, data: { action: ProactiveAction; error: string }) => void) => () => void;
  onActionCancelled: (callback: (event: IpcRendererEvent, data: { action: ProactiveAction; reason: string }) => void) => () => void;
  onActionConfirmationRequest: (callback: (event: IpcRendererEvent, request: ActionConfirmationRequest) => void) => () => void;
  onActionConfirmationTimeout: (callback: (event: IpcRendererEvent, data: { requestId: string }) => void) => () => void;
  
  // Search
  searchConversations: (options: SearchOptions) => Promise<ConversationSearchResult[]>;
  onOpenSearch: (callback: () => void) => () => void;
  
  // Tool System
  executeTool: (params: {
    conversationId: string;
    messages: Message[];
    systemContext?: SystemContext;
  }) => Promise<Message>;
  cancelTool: () => Promise<{ success: boolean; error?: string }>;
  onAskUserRequest: (callback: (event: IpcRendererEvent, data: {
    requestId: string;
    question: string;
    options: string[];
    inputType: 'text' | 'choice' | 'confirm';
    conversationId: string;
  }) => void) => () => void;
  respondToAskUser: (requestId: string, answer: string) => Promise<{ ok: boolean }>;
  onToolStream: (callback: (event: IpcRendererEvent, data: {
    type: 'tool_start' | 'tool_complete' | 'tool_error' | 'content' | 'thinking' | 'complete' | 'error';
    toolName?: string;
    toolCallId?: string;
    result?: any;
    error?: string;
    content?: string;
    thinking?: string;
    message?: Message;
    conversationId?: string;
  }) => void) => () => void;
}

// =============================================================================
// Secure IPC Wrapper
// =============================================================================

const createIpcInvoker = <T>(channel: string) => {
  return (...args: any[]): Promise<T> => ipcRenderer.invoke(channel, ...args);
};

const createIpcListener = (channel: string) => {
  return (callback: (event: IpcRendererEvent, ...args: any[]) => void) => {
    const wrappedCallback = (event: IpcRendererEvent, ...args: any[]) => {
      callback(event, ...args);
    };
    ipcRenderer.on(channel, wrappedCallback);
    return () => ipcRenderer.off(channel, wrappedCallback);
  };
};

// =============================================================================
// Expose API to Renderer
// =============================================================================

const api: ElectronAPI = {
  // Window controls
  minimizeWindow: createIpcInvoker(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: createIpcInvoker(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: createIpcInvoker(IPC_CHANNELS.WINDOW_CLOSE),
  hideWindow: createIpcInvoker(IPC_CHANNELS.WINDOW_HIDE),
  showWindow: createIpcInvoker(IPC_CHANNELS.WINDOW_SHOW),
  toggleWindow: createIpcInvoker(IPC_CHANNELS.WINDOW_TOGGLE),
  
  // App controls
  quitApp: createIpcInvoker(IPC_CHANNELS.APP_QUIT),
  getVersion: createIpcInvoker(IPC_CHANNELS.APP_VERSION),
  openExternal: createIpcInvoker(IPC_CHANNELS.APP_OPEN_EXTERNAL),
  
  // Settings
  getSettings: createIpcInvoker(IPC_CHANNELS.SETTINGS_GET),
  updateSettings: createIpcInvoker(IPC_CHANNELS.SETTINGS_UPDATE),
  resetSettings: createIpcInvoker(IPC_CHANNELS.SETTINGS_RESET),
  validateApiKey: createIpcInvoker(IPC_CHANNELS.API_VALIDATE_KEY),
  
  // Conversations
  getAllConversations: createIpcInvoker(IPC_CHANNELS.CONVERSATION_GET_ALL),
  getConversation: createIpcInvoker(IPC_CHANNELS.CONVERSATION_GET),
  createConversation: createIpcInvoker(IPC_CHANNELS.CONVERSATION_CREATE),
  deleteConversation: createIpcInvoker(IPC_CHANNELS.CONVERSATION_DELETE),
  updateConversation: createIpcInvoker(IPC_CHANNELS.CONVERSATION_UPDATE),
  agentMessage: createIpcInvoker(IPC_CHANNELS.CONVERSATION_AGENT_MESSAGE),
  isContextCluttered: createIpcInvoker(IPC_CHANNELS.CONVERSATION_IS_CONTEXT_CLUTTERED),
  proposeContextReset: createIpcInvoker(IPC_CHANNELS.CONVERSATION_PROPOSE_CONTEXT_RESET),
  respondToContextReset: createIpcInvoker(IPC_CHANNELS.CONVERSATION_CONTEXT_RESET_RESPOND),
  onAgentMessage: createIpcListener(IPC_CHANNELS.AGENT_MESSAGE),
  onContextResetProposed: createIpcListener(IPC_CHANNELS.CONTEXT_RESET_PROPOSED),

  // Chat
  sendChatMessage: createIpcInvoker(IPC_CHANNELS.CHAT_SEND),
  cancelChat: createIpcInvoker(IPC_CHANNELS.CHAT_CANCEL),
  onChatStream: createIpcListener(IPC_CHANNELS.CHAT_STREAM),
  onConversationCreate: createIpcListener(IPC_CHANNELS.CONVERSATION_CREATE),
  onOpenSettings: createIpcListener(IPC_CHANNELS.APP_OPEN_SETTINGS),
  
  // Context
  getContext: createIpcInvoker(IPC_CHANNELS.CONTEXT_GET),
  subscribeContext: () => ipcRenderer.send(IPC_CHANNELS.CONTEXT_SUBSCRIBE),
  unsubscribeContext: () => ipcRenderer.send(IPC_CHANNELS.CONTEXT_UNSUBSCRIBE),
  onContextUpdate: createIpcListener(IPC_CHANNELS.CONTEXT_UPDATE),
  setSidebarMode: createIpcInvoker(IPC_CHANNELS.SIDEBAR_SET_MODE),
  getSidebarMode: createIpcInvoker(IPC_CHANNELS.SIDEBAR_GET_MODE),
  onModeChanged: createIpcListener(IPC_CHANNELS.MODE_CHANGED),
  
  // Pieces
  getPiecesStatus: createIpcInvoker(IPC_CHANNELS.PIECES_STATUS),
  searchPieces: createIpcInvoker(IPC_CHANNELS.PIECES_SEARCH),
  getPiecesAsset: createIpcInvoker(IPC_CHANNELS.PIECES_GET_ASSET),
  getAllPiecesAssets: createIpcInvoker(IPC_CHANNELS.PIECES_GET_ALL),
  getRelevantPieces: createIpcInvoker(IPC_CHANNELS.PIECES_RELEVANT),
  
  // Pieces LTM (Long-Term Memory via MCP)
  getPiecesLtmStatus: createIpcInvoker(IPC_CHANNELS.PIECES_LTM_STATUS),
  queryPiecesLtm: createIpcInvoker(IPC_CHANNELS.PIECES_LTM_QUERY),
  queryPiecesLtmTopic: createIpcInvoker(IPC_CHANNELS.PIECES_LTM_TOPIC),
  queryPiecesLtmCoding: createIpcInvoker(IPC_CHANNELS.PIECES_LTM_CODING),
  queryPiecesLtmBrowsing: createIpcInvoker(IPC_CHANNELS.PIECES_LTM_BROWSING),
  
  // Proactive Agent
  getProactiveSuggestions: createIpcInvoker(IPC_CHANNELS.PROACTIVE_GET_SUGGESTIONS),
  dismissProactiveSuggestion: createIpcInvoker(IPC_CHANNELS.PROACTIVE_DISMISS),
  snoozeProactiveSuggestion: createIpcInvoker(IPC_CHANNELS.PROACTIVE_SNOOZE),
  acceptProactiveSuggestion: createIpcInvoker(IPC_CHANNELS.PROACTIVE_ACCEPT),
  triggerProactiveAnalysis: createIpcInvoker(IPC_CHANNELS.PROACTIVE_TRIGGER_ANALYSIS),
  getProactiveConfig: createIpcInvoker(IPC_CHANNELS.PROACTIVE_CONFIG_GET),
  updateProactiveConfig: createIpcInvoker(IPC_CHANNELS.PROACTIVE_CONFIG_UPDATE),
  onProactiveSuggestion: createIpcListener('proactive:suggestion'),
  onProactiveShowSuggestion: createIpcListener('proactive:show-suggestion'),
  
  // Personality
  getPersonality: createIpcInvoker(IPC_CHANNELS.PERSONALITY_GET),
  updatePersonality: createIpcInvoker(IPC_CHANNELS.PERSONALITY_UPDATE),
  
  // Soul Document
  getSoulDocument: createIpcInvoker(IPC_CHANNELS.SOUL_DOCUMENT_GET),
  updateSoulDocument: createIpcInvoker(IPC_CHANNELS.SOUL_DOCUMENT_UPDATE),
  resetSoulDocument: createIpcInvoker(IPC_CHANNELS.SOUL_DOCUMENT_RESET),
  aiUpdateSoulDocument: (section: string, content: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.SOUL_DOCUMENT_AI_UPDATE, { section, content }),
  
  // Screenshot
  captureScreenshot: createIpcInvoker(IPC_CHANNELS.SCREENSHOT_CAPTURE),
  analyzeScreenshot: createIpcInvoker(IPC_CHANNELS.SCREENSHOT_ANALYZE),
  
  // Indicator
  getIndicatorState: createIpcInvoker(IPC_CHANNELS.INDICATOR_GET_STATE),
  indicatorClicked: createIpcInvoker(IPC_CHANNELS.INDICATOR_CLICKED),
  indicatorDismiss: createIpcInvoker(IPC_CHANNELS.INDICATOR_DISMISS),
  onIndicatorStateUpdate: createIpcListener(IPC_CHANNELS.INDICATOR_STATE_UPDATE),
  
  // Drawer / Display Mode
  getDrawerState: createIpcInvoker(IPC_CHANNELS.DRAWER_GET_STATE),
  setAppMode: createIpcInvoker(IPC_CHANNELS.DRAWER_SET_MODE),
  expandDrawer: createIpcInvoker(IPC_CHANNELS.DRAWER_EXPAND),
  collapseDrawer: createIpcInvoker(IPC_CHANNELS.DRAWER_COLLAPSE),
  lockDrawer: createIpcInvoker(IPC_CHANNELS.DRAWER_LOCK),
  openFullView: createIpcInvoker(IPC_CHANNELS.DRAWER_OPEN_FULL),
  setDrawerHeightLocked: createIpcInvoker(IPC_CHANNELS.DRAWER_SET_HEIGHT_LOCKED),
  onDrawerStateUpdate: createIpcListener(IPC_CHANNELS.DRAWER_STATE_UPDATE),
  
  // V2 Actions
  executeAction: createIpcInvoker(IPC_CHANNELS.ACTION_EXECUTE),
  getActionStatus: createIpcInvoker(IPC_CHANNELS.ACTION_GET_STATUS),
  getActionHistory: createIpcInvoker(IPC_CHANNELS.ACTION_GET_HISTORY),
  getPendingActions: createIpcInvoker(IPC_CHANNELS.ACTION_GET_PENDING),
  confirmAction: createIpcInvoker(IPC_CHANNELS.ACTION_CONFIRM),
  denyAction: createIpcInvoker(IPC_CHANNELS.ACTION_DENY),
  updateActionConfig: createIpcInvoker(IPC_CHANNELS.ACTION_UPDATE_CONFIG),
  setActionPermission: createIpcInvoker(IPC_CHANNELS.ACTION_SET_PERMISSION),
  respondToActionConfirmation: createIpcInvoker(IPC_CHANNELS.ACTION_CONFIRMATION_RESPONSE),
  clearActionPermission: createIpcInvoker(IPC_CHANNELS.ACTION_PERMISSION_CLEAR),
  getActionPermission: createIpcInvoker(IPC_CHANNELS.ACTION_PERMISSION_GET),
  onActionExecuting: createIpcListener(IPC_CHANNELS.ACTION_EXECUTING),
  onActionCompleted: createIpcListener(IPC_CHANNELS.ACTION_COMPLETED),
  onActionFailed: createIpcListener(IPC_CHANNELS.ACTION_FAILED),
  onActionCancelled: createIpcListener(IPC_CHANNELS.ACTION_CANCELLED),
  onActionConfirmationRequest: createIpcListener(IPC_CHANNELS.ACTION_CONFIRMATION_REQUEST),
  onActionConfirmationTimeout: createIpcListener(IPC_CHANNELS.ACTION_CONFIRMATION_TIMEOUT),
  
  // Search
  searchConversations: createIpcInvoker(IPC_CHANNELS.CONVERSATION_SEARCH),
  onOpenSearch: createIpcListener(IPC_CHANNELS.NEXUS_OPEN_SEARCH),
  
  // Tool System
  executeTool: createIpcInvoker(IPC_CHANNELS.TOOL_EXECUTE),
  cancelTool: createIpcInvoker(IPC_CHANNELS.TOOL_CANCEL),
  onAskUserRequest: createIpcListener(IPC_CHANNELS.AGENT_ASK_USER_REQUEST),
  respondToAskUser: createIpcInvoker(IPC_CHANNELS.AGENT_ASK_USER_RESPOND),
  onToolStream: createIpcListener(IPC_CHANNELS.TOOL_STREAM),
};

// Expose to window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', api);

// For TypeScript support
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
