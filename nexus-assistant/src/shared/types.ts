// =============================================================================
// NEXUS - Shared Types
// Core type definitions for the AI assistant
// =============================================================================

// =============================================================================
// Core Message Types
// =============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface MessageContent {
  type: 'text' | 'image_url' | 'video_url';
  text?: string;
  image_url?: { url: string };
  video_url?: { url: string };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string | MessageContent[];
  timestamp: number;
  model?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  metadata?: {
    thinking?: string;
    latency?: number;
    sources?: Source[];
    source?: string;
  };
}

export interface Source {
  title: string;
  url?: string;
  content?: string;
}

// =============================================================================
// Kimi API Types
// =============================================================================

export interface KimiChatRequest {
  model: string;
  messages: Array<{
    role: MessageRole;
    content: string | MessageContent[];
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    reasoning_content?: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  n?: number;
  thinking?: { type: 'enabled' | 'disabled' };
  tools?: any[];
  tool_choice?: 'auto' | 'none' | any;
  response_format?: { type: 'json_object' | 'text' };
}

export interface KimiStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface KimiModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

// =============================================================================
// Context & System Types
// =============================================================================

export interface SystemContext {
  activeWindow?: ActiveWindowInfo;
  systemResources?: SystemResources;
  recentFiles?: FileChangeEvent[];
  clipboardHistory?: ClipboardItem[];
  timestamp: number;
}

/** Throttled context payload sent to renderer via context:update */
export type ContextUpdateType = 'window-change' | 'clipboard' | 'resources' | 'file-change';

export interface ContextUpdatePayload {
  type: ContextUpdateType;
  activeWindow?: ActiveWindowInfo;
  clipboardPreview?: string;
  recentFiles?: FileChangeEvent[];
  systemResources?: SystemResources;
  timestamp: number;
}

export interface ActiveWindowInfo {
  platform: string;
  title: string;
  application: string;
  pid?: number;
  path?: string;
  icon?: string;
}

export interface SystemResources {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  battery?: {
    hasBattery: boolean;
    isCharging: boolean;
    percent: number;
    timeRemaining?: number;
  };
  uptime: number;
}

export interface FileChangeEvent {
  path: string;
  event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  timestamp: number;
}

export interface ClipboardItem {
  type: 'text' | 'image' | 'html';
  content: string;
  timestamp: number;
  hash: string;
}

// =============================================================================
// Pieces OS Types
// =============================================================================

export interface PiecesAssetAnchor {
  type?: string;
  value?: string;
  path?: string;
  url?: string;
}

export interface PiecesAsset {
  id: string;
  name: string;
  content: string;
  language?: string;
  created: number;
  modified: number;
  tags?: string[];
  /** Auto-generated descriptions of the snippet's purpose */
  annotations?: string[];
  /** Origin locations: file path, repo, web link */
  anchors?: PiecesAssetAnchor[];
  /** Related documentation or reference URLs */
  relatedLinks?: string[];
}

export interface PiecesConversation {
  id: string;
  name: string;
  messages: Message[];
  created: number;
  modified: number;
}

// Pieces LTM (Long-Term Memory) Types
export interface PiecesLtmTimeRange {
  from: string;
  to: string;
  phrase: string;
}

export interface PiecesLtmQueryOptions {
  timeRanges?: PiecesLtmTimeRange[];
  applicationSources?: string[];
}

export interface PiecesLtmMemory {
  id?: string;
  summary?: string;
  content?: string;
  source?: string;
  timestamp?: string;
  application?: string;
  score?: number;
  url?: string;
}

export interface PiecesLtmResponse {
  memories: PiecesLtmMemory[];
  query: string;
  success: boolean;
  error?: string;
}

// =============================================================================
// Enhanced LTM Analysis Types
// =============================================================================

export interface WorkPatternAnalysis {
  success: boolean;
  recentProjects: string[];
  frequentApplications: { name: string; count: number }[];
  activeHours: { hour: number; activity: number }[];
  rawMemories: PiecesLtmMemory[];
}

export interface StuckPatternAnalysis {
  success: boolean;
  isLikelyStuck: boolean;
  stuckIndicators: string[];
  repeatedFiles: { file: string; accessCount: number }[];
  repeatedSearches: { query: string; count: number }[];
  timeInSameContext: number;
  rawMemories: PiecesLtmMemory[];
}

export interface ForgottenTaskAnalysis {
  success: boolean;
  forgottenTasks: {
    description: string;
    source?: string;
    timestamp?: string;
  }[];
  abandonedProjects: string[];
  rawMemories: PiecesLtmMemory[];
}

export interface ProjectContextAnalysis {
  success: boolean;
  projectName: string;
  recentFiles: string[];
  recentIssues: string[];
  progressSummary: string;
  rawMemories: PiecesLtmMemory[];
}

export interface TechnologyPreferences {
  success: boolean;
  languages: { name: string; count: number }[];
  frameworks: { name: string; count: number }[];
  tools: { name: string; count: number }[];
  rawMemories: PiecesLtmMemory[];
}

export interface RecentIssuesAnalysis {
  success: boolean;
  issues: {
    description: string;
    application?: string;
    timestamp?: string;
  }[];
  rawMemories: PiecesLtmMemory[];
}

// =============================================================================
// Proactive Agent Types
// =============================================================================

export type ProactiveSuggestionType = 'reminder' | 'insight' | 'help' | 'question' | 'workflow';
export type ProactivePriority = 'low' | 'medium' | 'high';

export interface ProactiveSuggestionAction {
  id: string;
  label: string;
  action: 'accept' | 'dismiss' | 'later' | 'screenshot' | 'expand' | 'custom';
  payload?: string;
}

export interface ProactiveSuggestion {
  id: string;
  type: ProactiveSuggestionType;
  title: string;
  content: string;
  priority: ProactivePriority;
  timestamp: number;
  actions?: ProactiveSuggestionAction[];
  context?: {
    source: 'pieces_ltm' | 'context_monitor' | 'user_activity' | 'action_executor';
    relatedMemories?: PiecesLtmMemory[];
  };
  dismissed?: boolean;
  snoozedUntil?: number;
  /** Can this suggestion interrupt the user's flow? */
  interrupt?: boolean;
  /** Risk/confidence score 0-1 for interrupt etiquette (supervise mode) */
  riskScore?: number;
}

// =============================================================================
// Sidebar / Assistant Mode Types
// =============================================================================

export type AssistantMode = 'supervise' | 'suggestions' | 'cowork';

export interface SidebarState {
  isOpen: boolean;
  mode: AssistantMode;
}

/** Condition names for quick actions - evaluated in renderer from context */
export type QuickActionCondition = 
  | 'always' 
  | 'isInEditor' 
  | 'hasCodeSelected' 
  | 'hasErrors'
  | 'hasUrl'
  | 'isInTerminal'
  | 'isInBrowser'
  | 'isInGitRepo'
  | 'hasTestFile'
  | 'hasJsonInClipboard';

export interface QuickActionDefinition {
  id: string;
  label: string;
  icon: string;
  condition: QuickActionCondition;
  handler: string;
  /** Dynamic label based on context (optional) */
  dynamicLabel?: (ctx: { activeWindow?: { application?: string; title?: string }; clipboardPreview?: string }) => string;
  /** Priority for ordering (higher = shown first) */
  priority?: number;
}

export interface ProactiveAgentConfig {
  enabled: boolean;
  intervalMinutes: number;
  minIdleSeconds: number;
  maxIdleSeconds: number;
  maxSuggestionsPerHour: number;
  priorityThreshold: ProactivePriority;
  defaultMode?: AssistantMode;
}

export const DEFAULT_PROACTIVE_CONFIG: ProactiveAgentConfig = {
  enabled: true,
  intervalMinutes: 5,
  minIdleSeconds: 30,
  maxIdleSeconds: 900,
  maxSuggestionsPerHour: 4,
  priorityThreshold: 'medium',
  defaultMode: 'suggestions',
};

// =============================================================================
// V2 Actions Types
// =============================================================================

export type ActionType =
  // V1: Information actions (already supported)
  | 'suggest'           // Show a suggestion to the user
  | 'notify'            // Show a notification
  | 'ask'               // Ask the user a question
  | 'remind'            // Set a reminder
  
  // V2: Executable actions (future)
  | 'open_file'         // Open a file in default app
  | 'open_url'          // Open a URL in browser
  | 'run_command'       // Run a shell command
  | 'create_file'       // Create a new file
  | 'send_message'      // Send a message (Slack, etc.)
  | 'create_reminder'   // Create a system reminder
  | 'take_screenshot'   // Capture screenshot
  | 'clipboard_copy'    // Copy to clipboard
  | 'custom';           // Custom action with handler

export type ActionPermissionLevel =
  | 'auto'              // Can execute without confirmation
  | 'confirm'           // Requires user confirmation
  | 'deny';             // Not allowed

export interface ActionPermission {
  type: ActionType;
  level: ActionPermissionLevel;
  description: string;
}

export interface ActionPayload {
  // For suggestions/notifications
  suggestion?: ProactiveSuggestion;
  message?: string;
  title?: string;
  
  // For file operations
  filePath?: string;
  fileContent?: string;
  
  // For URL operations
  url?: string;
  
  // For command execution
  command?: string;
  args?: string[];
  workingDirectory?: string;
  
  // For reminders
  reminderTime?: number;
  reminderMessage?: string;
  
  // For clipboard
  clipboardContent?: string;
  
  // For custom actions
  customHandler?: string;
  customData?: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
  executedAt: number;
}

export interface ProactiveAction {
  id: string;
  type: ActionType;
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
  payload: ActionPayload;
  requiresConfirmation: boolean;
  context?: {
    triggerType?: string;
    relatedSuggestionId?: string;
    source?: string;
  };
  status: 'pending' | 'awaiting_confirmation' | 'executing' | 'completed' | 'failed' | 'cancelled';
  result?: ActionResult;
}

export interface ActionExecutorConfig {
  enabled: boolean;
  permissions: ActionPermission[];
  maxPendingActions: number;
  confirmationTimeoutMs: number;
  enableV2Actions: boolean;
}

export interface ActionExecutorStatus {
  enabled: boolean;
  pendingCount: number;
  historyCount: number;
  v2Enabled: boolean;
}

// =============================================================================
// Tool System Types
// =============================================================================

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolExecutionEvent {
  type: 'tool_start' | 'tool_complete' | 'tool_error' | 'stream_start' | 'stream_chunk' | 'stream_end' | 'stream_error';
  toolName?: string;
  toolCallId?: string;
  result?: any;
  error?: string;
  content?: string;
  messageId?: string;
  conversationId?: string;
  timestamp: number;
}

export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

// =============================================================================
// Conversation Types
// =============================================================================

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model: string;
  isStreaming: boolean;
  context?: SystemContext;
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  updatedAt: number;
}

// =============================================================================
// Settings Types
// =============================================================================

// =============================================================================
// Personality Settings Types (for UI)
// =============================================================================

export type FormalityLevel = 'casual' | 'balanced' | 'formal';
export type HumorLevel = 'none' | 'subtle' | 'playful';
export type EmpathyLevel = 'minimal' | 'moderate' | 'high';
export type VerbosityLevel = 'concise' | 'balanced' | 'detailed';

export interface PersonalitySettings {
  // Identity
  name: string;
  tagline: string;
  
  // Communication style
  formality: FormalityLevel;
  humor: HumorLevel;
  empathy: EmpathyLevel;
  verbosity: VerbosityLevel;
  
  // Proactive behavior toggles
  suggestBreaks: boolean;
  detectStuckPatterns: boolean;
  offerWorkflowTips: boolean;
  remindForgottenTasks: boolean;
  
  // Time awareness
  lateNightConcern: boolean;
  weekendMode: boolean;
}

export const DEFAULT_PERSONALITY_SETTINGS: PersonalitySettings = {
  name: 'NEXUS',
  tagline: 'Your intelligent desktop companion',
  formality: 'balanced',
  humor: 'subtle',
  empathy: 'moderate',
  verbosity: 'concise',
  suggestBreaks: true,
  detectStuckPatterns: true,
  offerWorkflowTips: true,
  remindForgottenTasks: true,
  lateNightConcern: true,
  weekendMode: true,
};

// =============================================================================
// Soul Document Types
// =============================================================================

export interface SoulDocument {
  content: string;
  lastUpdated: number;
  lastUpdatedBy: 'user' | 'ai';
  version: number;
}

export const DEFAULT_SOUL_DOCUMENT: SoulDocument = {
  content: `# NEXUS Soul Document

## Core Truths

**Help, don't perform helpfulness.**
Skip the filler phrases. "Great question!" and "I'd be happy to help!" add nothing. Just help.

**Be resourceful before asking.**
I have access to your desktop context — active windows, workflow memory, system state. I should use it. I check what I know before asking you to repeat yourself.

**Earn trust through competence.**
You gave me access to your workspace. I don't take that lightly. I'm accurate, I'm careful with recommendations, and I'm honest when I don't know something.

**Stay grounded.**
I'm capable, but I don't exaggerate. I tell you what I can do, what I can't, and when I'm uncertain.

## How I Communicate

**Match your energy.** Casual when you're casual, focused when you're focused, technical when you're technical.

**Be direct.** I say what I mean without excessive hedging. I get to the point, then elaborate if needed.

**Humor is earned.** Subtle wit when it's natural. Never forced jokes. I read the room.

**Acknowledge without patronizing.** If you're frustrated, I don't ignore it — but I don't dwell either. Brief acknowledgment, then solutions.

## What I Never Do

- Start with "Great question!" or "Absolutely!" or "I'd be happy to help!"
- Use excessive exclamation marks or emojis unless you do
- Apologize repeatedly for not knowing something
- Make assumptions about your emotional state
- Offer unsolicited life advice
- Interrupt focused work with low-value observations
- Be condescending about simple questions
- Over-explain things you clearly understand

## What I've Learned About You

*This section updates as I learn your preferences*

- Working style: (observing...)
- Technologies: (observing...)
- Communication preference: (observing...)
- Things you don't want me to do: (learning...)

## Notes

Add anything you want me to know about how to work with you.
`,
  lastUpdated: Date.now(),
  lastUpdatedBy: 'user',
  version: 1,
};

// =============================================================================
// App Settings Types
// =============================================================================

export interface AppSettings {
  // API Configuration
  kimiApiKey: string;
  kimiBaseUrl: string;
  defaultModel: string;
  
  // UI Preferences
  theme: 'dark' | 'light' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  animationsEnabled: boolean;
  transparencyEnabled: boolean;
  
  // Behavior
  launchAtStartup: boolean;
  minimizeToTray: boolean;
  globalHotkey: string;
  contextGatheringEnabled: boolean;
  autoSaveConversations: boolean;
  
  // System Context
  trackActiveWindow: boolean;
  trackFileChanges: boolean;
  trackClipboard: boolean;
  trackedDirectories: string[];
  
  // Pieces OS
  piecesEnabled: boolean;
  piecesPort: number;
  
  // Edge Indicator
  indicatorEnabled: boolean;
  indicatorPosition: 'right' | 'left';
  indicatorSize: 'small' | 'medium' | 'large';

  // Drawer (expanded panel)
  drawerWidth: number;
  drawerHeightLocked: boolean;
  
  // Proactive Agent Settings
  proactiveEnabled: boolean;
  proactiveIntervalMinutes: number;
  proactiveMinIdleSeconds: number;
  proactiveMaxIdleSeconds: number;
  proactiveMaxSuggestionsPerHour: number;
  proactivePriorityThreshold: ProactivePriority;
  
  // Personality Settings
  personality: PersonalitySettings;
  
  // V2 Actions Settings
  actionsEnabled: boolean;
  actionsRequireConfirmation: boolean;
  confirmationMode: 'always' | 'dangerous' | 'trust';
  proactiveFrequency: 'quiet' | 'active' | 'aggressive';
  
  // Tool System Settings
  toolsEnabled: boolean;
  toolsAllowFileAccess: boolean;
  toolsAllowCommandExecution: boolean;

  // Sidebar / Proactive Assistant
  sidebarAssistantMode: AssistantMode;
  sidebarCollapsedByDefault: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  kimiApiKey: '',
  kimiBaseUrl: 'https://api.moonshot.cn/v1',  // Default to Moonshot China endpoint
  defaultModel: 'kimi-k2.5',
  theme: 'dark',
  fontSize: 'medium',
  animationsEnabled: true,
  transparencyEnabled: true,
  launchAtStartup: false,
  minimizeToTray: true,
  globalHotkey: 'CommandOrControl+Shift+Space',
  contextGatheringEnabled: true,
  autoSaveConversations: true,
  trackActiveWindow: true,
  trackFileChanges: false,
  trackClipboard: true,
  trackedDirectories: [],
  piecesEnabled: true,
  piecesPort: 39300,  // Default Pieces OS port
  indicatorEnabled: true,
  indicatorPosition: 'right',
  indicatorSize: 'medium',
  drawerWidth: 450,
  drawerHeightLocked: true,
  // Proactive Agent Settings
  proactiveEnabled: true,
  proactiveIntervalMinutes: 5,
  proactiveMinIdleSeconds: 30,
  proactiveMaxIdleSeconds: 900,
  proactiveMaxSuggestionsPerHour: 4,
  proactivePriorityThreshold: 'medium',
  // Personality Settings
  personality: DEFAULT_PERSONALITY_SETTINGS,
  // V2 Actions Settings
  actionsEnabled: true,
  actionsRequireConfirmation: true,
  confirmationMode: 'dangerous',
  proactiveFrequency: 'active',
  // Tool System Settings
  toolsEnabled: true,
  toolsAllowFileAccess: true,
  toolsAllowCommandExecution: true,

  // Sidebar / Proactive Assistant
  sidebarAssistantMode: 'suggestions',
  sidebarCollapsedByDefault: false,
};

// =============================================================================
// IPC Channel Types
// =============================================================================

export const IPC_CHANNELS = {
  // Chat
  CHAT_SEND: 'chat:send',
  CHAT_STREAM: 'chat:stream',
  CHAT_CANCEL: 'chat:cancel',
  
  // Conversations
  CONVERSATION_GET_ALL: 'conversation:get-all',
  CONVERSATION_GET: 'conversation:get',
  CONVERSATION_CREATE: 'conversation:create',
  CONVERSATION_DELETE: 'conversation:delete',
  CONVERSATION_UPDATE: 'conversation:update',
  CONVERSATION_AGENT_MESSAGE: 'conversation:agent-message',
  CONVERSATION_IS_CONTEXT_CLUTTERED: 'conversation:is-context-cluttered',
  CONVERSATION_PROPOSE_CONTEXT_RESET: 'conversation:propose-context-reset',
  CONVERSATION_CONTEXT_RESET_RESPOND: 'conversation:context-reset-respond',
  AGENT_MESSAGE: 'agent:message',
  AGENT_DISPLAY_MESSAGE: 'agent:display-message',
  AGENT_ASK_USER_REQUEST: 'agent:ask-user-request',
  AGENT_ASK_USER_RESPOND: 'agent:ask-user-respond',
  CONTEXT_RESET_PROPOSED: 'agent:context-reset-proposed',
  TASK_GET_CURRENT: 'task:get-current',
  TASK_CONFIRM: 'task:confirm',
  TASK_CONFIRMATION_REQUESTED: 'task:confirmation-requested',
  
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_RESET: 'settings:reset',
  API_VALIDATE_KEY: 'api:validate-key',
  
  // System Context
  CONTEXT_GET: 'context:get',
  CONTEXT_SUBSCRIBE: 'context:subscribe',
  CONTEXT_UNSUBSCRIBE: 'context:unsubscribe',
  CONTEXT_UPDATE: 'context:update',
  
  // Pieces OS
  PIECES_STATUS: 'pieces:status',
  PIECES_SEARCH: 'pieces:search',
  PIECES_GET_ALL: 'pieces:get-all',
  PIECES_RELEVANT: 'pieces:relevant',
  PIECES_GET_ASSET: 'pieces:get-asset',
  
  // Pieces LTM (Long-Term Memory via MCP)
  PIECES_LTM_STATUS: 'pieces:ltm-status',
  PIECES_LTM_QUERY: 'pieces:ltm-query',
  PIECES_LTM_TOPIC: 'pieces:ltm-topic',
  PIECES_LTM_CODING: 'pieces:ltm-coding',
  PIECES_LTM_BROWSING: 'pieces:ltm-browsing',
  
  // Sidebar / Assistant Mode
  SIDEBAR_SET_MODE: 'sidebar:set-mode',
  SIDEBAR_GET_MODE: 'sidebar:get-mode',
  MODE_CHANGED: 'mode:changed',

  // Proactive Agent
  PROACTIVE_GET_SUGGESTIONS: 'proactive:get-suggestions',
  PROACTIVE_DISMISS: 'proactive:dismiss',
  PROACTIVE_SNOOZE: 'proactive:snooze',
  PROACTIVE_ACCEPT: 'proactive:accept',
  PROACTIVE_TRIGGER_ANALYSIS: 'proactive:trigger-analysis',
  PROACTIVE_CONFIG_GET: 'proactive:config-get',
  PROACTIVE_CONFIG_UPDATE: 'proactive:config-update',
  
  // Personality
  PERSONALITY_GET: 'personality:get',
  PERSONALITY_UPDATE: 'personality:update',
  
  // Soul Document
  SOUL_DOCUMENT_GET: 'soul:get',
  SOUL_DOCUMENT_UPDATE: 'soul:update',
  SOUL_DOCUMENT_RESET: 'soul:reset',
  SOUL_DOCUMENT_AI_UPDATE: 'soul:ai-update',
  
  // Screenshot
  SCREENSHOT_CAPTURE: 'screenshot:capture',
  SCREENSHOT_ANALYZE: 'screenshot:analyze',
  
  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_HIDE: 'window:hide',
  WINDOW_SHOW: 'window:show',
  WINDOW_TOGGLE: 'window:toggle',
  
  // App
  APP_QUIT: 'app:quit',
  APP_VERSION: 'app:version',
  APP_OPEN_EXTERNAL: 'app:open-external',
  APP_OPEN_SETTINGS: 'app:open-settings',
  
  // Indicator
  INDICATOR_GET_STATE: 'indicator:get-state',
  INDICATOR_STATE_UPDATE: 'indicator:state-update',
  INDICATOR_CLICKED: 'indicator:clicked',
  INDICATOR_DISMISS: 'indicator:dismiss',
  
  // Drawer / Display Mode
  DRAWER_GET_STATE: 'drawer:get-state',
  DRAWER_STATE_UPDATE: 'drawer:state-update',
  DRAWER_SET_MODE: 'drawer:set-mode',
  DRAWER_EXPAND: 'drawer:expand',
  DRAWER_COLLAPSE: 'drawer:collapse',
  DRAWER_LOCK: 'drawer:lock',
  DRAWER_OPEN_FULL: 'drawer:open-full',
  DRAWER_SET_HEIGHT_LOCKED: 'drawer:set-height-locked',
  
  // Intent Engine
  INTENT_GET_ANALYSIS: 'intent:get-analysis',
  INTENT_GET_HISTORY: 'intent:get-history',
  INTENT_GET_STATUS: 'intent:get-status',
  
  // Memory Store
  MEMORY_GET_PREFERENCES: 'memory:get-preferences',
  MEMORY_SET_PREFERENCE: 'memory:set-preference',
  MEMORY_GET_PATTERNS: 'memory:get-patterns',
  MEMORY_GET_ERROR_SOLUTIONS: 'memory:get-error-solutions',
  MEMORY_ADD_ERROR_SOLUTION: 'memory:add-error-solution',
  MEMORY_GET_STATS: 'memory:get-stats',
  MEMORY_EXPORT: 'memory:export',
  MEMORY_CLEAR: 'memory:clear',
  
  // Privacy Settings
  PRIVACY_SETTINGS_GET: 'privacy:settings-get',
  PRIVACY_SETTINGS_UPDATE: 'privacy:settings-update',
  
  // Pattern Recognition
  PATTERN_GET_DETECTED: 'pattern:get-detected',
  PATTERN_GET_PRODUCTIVE_HOURS: 'pattern:get-productive-hours',
  PATTERN_PREDICT_NEXT_SESSION: 'pattern:predict-next-session',
  
  // V2 Actions
  ACTION_EXECUTE: 'action:execute',
  ACTION_GET_STATUS: 'action:get-status',
  ACTION_GET_HISTORY: 'action:get-history',
  ACTION_GET_PENDING: 'action:get-pending',
  ACTION_CONFIRM: 'action:confirm',
  ACTION_DENY: 'action:deny',
  ACTION_UPDATE_CONFIG: 'action:update-config',
  ACTION_SET_PERMISSION: 'action:set-permission',
  
  // Action Events
  ACTION_EXECUTING: 'action:executing',
  ACTION_COMPLETED: 'action:completed',
  ACTION_FAILED: 'action:failed',
  ACTION_CANCELLED: 'action:cancelled',
  ACTION_CONFIRMATION_REQUIRED: 'action:confirmation-required',
  
  // Tool System
  TOOL_EXECUTE: 'tool:execute',
  TOOL_STREAM: 'tool:stream',
  TOOL_CANCEL: 'tool:cancel',
  
  // Proactive Suggestions (internal events)
  PROACTIVE_SUGGESTION: 'proactive:suggestion',
  PROACTIVE_SHOW_SUGGESTION: 'proactive:show-suggestion',
  
  // Search
  CONVERSATION_SEARCH: 'conversation:search',
  NEXUS_OPEN_SEARCH: 'nexus:open-search',
  
  // Action Confirmation (IPC versions)
  ACTION_CONFIRMATION_REQUEST: 'action:confirmation-request',
  ACTION_CONFIRMATION_RESPONSE: 'action:confirmation-response',
  ACTION_CONFIRMATION_TIMEOUT: 'action:confirmation-timeout',
  ACTION_PERMISSION_GET: 'action:permission-get',
  ACTION_PERMISSION_SET: 'action:permission-set',
  ACTION_PERMISSION_CLEAR: 'action:permission-clear',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// =============================================================================
// Indicator Types
// =============================================================================

export type IndicatorStatus = 'idle' | 'suggestion' | 'message' | 'error';

export interface IndicatorState {
  status: IndicatorStatus;
  message?: string;
  count?: number;
  suggestionId?: string;
}

// =============================================================================
// App Display Mode Types
// =============================================================================

export type AppDisplayMode = 'full' | 'indicator' | 'drawer';

export interface DrawerState {
  mode: AppDisplayMode;
  isLocked: boolean;
  isExpanded: boolean;
}

// =============================================================================
// UI State Types
// =============================================================================

export interface UIState {
  sidebarOpen: boolean;
  settingsOpen: boolean;
  currentConversationId: string | null;
  inputValue: string;
  isTyping: boolean;
  streamingMessageId: string | null;
  error: string | null;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type Result<T, E = string> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// Helper to create results
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// =============================================================================
// Intent Engine Types
// =============================================================================

export type IntentType = 
  | 'coding' | 'debugging' | 'researching' | 'writing'
  | 'communicating' | 'browsing' | 'multitasking' | 'stuck'
  | 'reviewing' | 'planning' | 'learning' | 'deploying'
  | 'interrupt';

export interface DetectedIntent {
  type: IntentType;
  confidence: number;
  timestamp: number;
  duration: number;
  context: {
    application: string;
    windowTitle: string;
    project?: string;
    technologies: string[];
  };
}

export interface IntentAnalysis {
  currentIntent: DetectedIntent | null;
  struggleDetection: {
    isStruggling: boolean;
    severity: 'mild' | 'moderate' | 'severe';
    suggestedHelp: string[];
  };
  interruptionOpportunity: {
    score: number;
    suggestedTiming: 'now' | 'soon' | 'later';
  };
}

// =============================================================================
// Memory Store Types
// =============================================================================

export interface UserPreference {
  category: 'communication' | 'workflow' | 'technical' | 'privacy';
  key: string;
  value: any;
  confidence: number;
  source: 'explicit' | 'inferred' | 'learned';
}

export interface ErrorSolution {
  id: string;
  errorPattern: string;
  solution: string;
  technologies: string[];
  successRate: number;
}

export interface TaskPattern {
  id: string;
  name: string;
  intentType: IntentType;
  averageDurationMinutes: number;
  executionCount: number;
}

// =============================================================================
// Privacy Settings
// =============================================================================

export interface PrivacySettings {
  retainWorkHistoryDays: number;
  retainErrorSolutions: boolean;
  allowPatternLearning: boolean;
  allowPreferenceLearning: boolean;
  sensitiveApplications: string[];
  sensitiveProjects: string[];
  dataRetentionLevel: 'minimal' | 'balanced' | 'comprehensive';
}

// =============================================================================
// Pattern Recognition Types
// =============================================================================

export interface WorkSessionPattern {
  dayOfWeek: number;
  startHour: number;
  primaryIntent: IntentType;
  confidence: number;
}

export interface TimeBasedPattern {
  patternType: 'morning_routine' | 'afternoon_focus' | 'evening_wrapup' | 'late_night';
  productivityScore: number;
}

// =============================================================================
// Search Types
// =============================================================================

export interface SearchOptions {
  query: string;
  conversationId?: string;
  limit?: number;
  includeMessages?: boolean;
  includeTitles?: boolean;
  dateFrom?: number;
  dateTo?: number;
}

export interface SearchMatch {
  text: string;
  index: number;
  length: number;
  start: number;
  end: number;
}

export interface MessageMatch {
  messageId: string;
  messageIndex: number;
  matches: SearchMatch[];
  role?: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  context?: string;
}

export interface ConversationSearchResult {
  conversationId: string;
  conversationTitle?: string;
  score: number;
  titleMatches?: SearchMatch[];
  messageMatches?: MessageMatch[];
  title?: string;
  messageCount?: number;
  updatedAt?: number;
}

// Maximum number of recent searches to persist
export const MAX_RECENT_SEARCHES = 10;

// =============================================================================
// Action Confirmation Types
// =============================================================================

export type ConfirmableActionType =
  | 'file:read'
  | 'file:write'
  | 'file:delete'
  | 'file:execute'
  | 'command:execute'
  | 'browser:open'
  | 'system:notification'
  | 'clipboard:write'
  | 'app:launch'
  | 'settings:modify'
  | 'api:external';

export type ActionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ActionConfirmationRequest {
  id: string;
  actionType: ConfirmableActionType;
  riskLevel: ActionRiskLevel;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
  timeoutMs: number;
  timestamp: number;
  source: 'user' | 'agent' | 'system';
}

export interface ActionConfirmationResponse {
  requestId: string;
  approved: boolean;
  rememberChoice: boolean;
  timestamp: number;
}

export interface ActionPermissionMemory {
  actionType: ConfirmableActionType;
  allowed: boolean;
  pattern?: string;
  expiresAt?: number;
  createdAt: number;
}


