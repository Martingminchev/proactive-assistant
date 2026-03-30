// Suggestion types
export type SuggestionType = 'error' | 'warning' | 'tip' | 'celebration';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  message: string;
  code?: string;
  language?: string;
  confidence: number;
  filePath?: string;
  lineNumber?: number;
  timestamp: number;
  actions: SuggestionAction[];
}

export interface SuggestionAction {
  id: string;
  label: string;
  type: 'apply' | 'dismiss' | 'snooze' | 'view';
}

// Flow state types
export type FlowState = 'deep' | 'focused' | 'scattered' | 'idle';

export interface FlowStateInfo {
  state: FlowState;
  label: string;
  color: string;
  description: string;
}

// Status types
export interface CurrentStatus {
  watchedFile: string | null;
  activityDuration: number;
  flowState: FlowState;
  isPiecesConnected: boolean;
  lastActivityAt: number;
}

// Focus mode types
export type FocusDuration = 15 | 25 | 45 | 60 | number;

export interface FocusMode {
  isActive: boolean;
  duration: FocusDuration;
  startedAt: number | null;
  endsAt: number | null;
}

// Stats types
export interface DailyStats {
  date: string;
  suggestionsShown: number;
  suggestionsAccepted: number;
  suggestionsDismissed: number;
  timeSaved: number;
  filesWorkedOn: string[];
  focusSessions: number;
  focusMinutes: number;
}

export interface UserStats {
  today: DailyStats;
  week: DailyStats[];
  streak: number;
  totalTimeSaved: number;
  totalSuggestionsAccepted: number;
  totalSuggestionsShown: number;
}

// Settings types
export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface UserSettings {
  enabled: boolean;
  suggestionThreshold: number;
  quietHours: QuietHours;
  focusModeDefault: FocusDuration;
  autoApplyLowRisk: boolean;
  showCelebrations: boolean;
  trackStats: boolean;
  theme: 'auto' | 'dark' | 'light';
}

// Extension message types
export type ExtensionMessageType = 
  | 'suggestions'
  | 'status'
  | 'stats'
  | 'settings'
  | 'theme-changed'
  | 'focus-update'
  | 'celebration'
  | 'ping'
  | 'response'
  | 'stateUpdate';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: unknown;
  requestId?: string;
}

// Webview message types
export type WebviewMessageType =
  | 'ready'
  | 'apply-suggestion'
  | 'dismiss-suggestion'
  | 'snooze-suggestion'
  | 'view-suggestion'
  | 'toggle-focus'
  | 'update-settings'
  | 'export-data'
  | 'reset-data'
  | 'request-status'
  | 'request-stats'
  | 'request-settings';

export interface WebviewMessage {
  type: WebviewMessageType;
  payload?: unknown;
  requestId?: string;
}

// Tab types
export type TabId = 'suggestions' | 'stats' | 'settings';

// VS Code theme colors
export interface VSCodeThemeColors {
  background: string;
  foreground: string;
  editorBackground: string;
  editorForeground: string;
  sidebarBackground: string;
  sidebarForeground: string;
  border: string;
  buttonBackground: string;
  buttonForeground: string;
  buttonHoverBackground: string;
  inputBackground: string;
  inputForeground: string;
  inputBorder: string;
  focusBorder: string;
  errorForeground: string;
  warningForeground: string;
  infoForeground: string;
  successForeground: string;
}

// Celebration types
export interface CelebrationData {
  type: 'streak' | 'milestone' | 'achievement';
  title: string;
  message: string;
  streakCount?: number;
  milestone?: string;
}
