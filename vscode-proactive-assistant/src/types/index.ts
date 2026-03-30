import * as vscode from 'vscode';

export type FlowState = 
  | 'idle'       // User is not actively coding
  | 'working'    // User is coding but in normal state
  | 'deep_flow'  // User is in deep flow - minimize interruptions
  | 'stuck'      // User appears stuck - offer help
  | 'frustrated'; // User appears frustrated - urgent help needed

export interface SuggestionAction {
  id: string;
  label: string;
  type: 'apply' | 'show' | 'open' | 'run' | 'dismiss';
  icon?: string;
  payload?: string;
  isPrimary?: boolean;
  tooltip?: string;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  actions: SuggestionAction[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: Date;
  context?: ActivityContext;
  timeout?: number;
  category?: string;
  confidence?: number;
  seen?: boolean;
}

export interface ActivityContext {
  file?: string;
  line?: number;
  column?: number;
  language?: string;
  content?: string;
  errors?: DiagnosticInfo[];
  warnings?: DiagnosticInfo[];
  duration?: number;
  previousFile?: string;
  clipboard?: string;
  recentCommands?: string[];
  gitStatus?: { branch: string; changes: number; hasUnpushed: boolean; aheadBehind?: { ahead: number; behind: number } };
  capturedAt: Date;
}

export interface DiagnosticInfo {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  code?: string | number;
  source?: string;
}

export interface UserSettings {
  enabled: boolean;
  focusMode: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
  interruptionThreshold: number;
  snoozeDuration: number;
  piecesOs: { enabled: boolean; host: string; port: number };
  logging: { level: 'debug' | 'info' | 'warn' | 'error' };
  activityTracking: { enabled: boolean; sampleInterval: number };
}

export interface ActivityEvent {
  type: 'file_open' | 'file_save' | 'file_close' | 'edit' | 'cursor_move' | 'command_execute' | 'error_encounter' | 'debug_start' | 'debug_stop' | 'focus_change' | 'idle';
  timestamp: Date;
  file?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityStats {
  totalTime: number;
  flowStateTime: Record<FlowState, number>;
  filesWorked: number;
  suggestionsShown: number;
  suggestionsAccepted: number;
  topErrors: Array<{ message: string; count: number }>;
  mostProductiveHour?: number;
  sessionStart: Date;
}

export type ConnectionStatus = 
  | 'connected' 
  | 'disconnected' 
  | 'connecting' 
  | 'error';

export interface IService extends vscode.Disposable {
  initialize(): Promise<void>;
  readonly name: string;
}

export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: Error, ...args: unknown[]): void;
}

export interface IActivityTracker extends IService {
  getCurrentContext(): ActivityContext;
  getRecentEvents(limit?: number): ActivityEvent[];
  getStats(): ActivityStats;
  readonly currentFlowState: FlowState;
  onFlowStateChanged: vscode.Event<FlowState>;
  onActivityRecorded: vscode.Event<ActivityEvent>;
}

export type SuggestionType = 
  | 'stuck'
  | 'context_recovery'
  | 'wellness'
  | 'celebration'
  | 'error_fix'
  | 'productivity'
  | 'learning';

export interface UserSuggestionPreferences {
  preferredTypes: SuggestionType[];
  disabledTypes: SuggestionType[];
  maxSuggestionsPerHour: number;
  preferredTone: 'formal' | 'casual' | 'enthusiastic';
}

export interface SuggestionContext {
  flowState: FlowState;
  activityContext: ActivityContext;
  recentSuggestions: string[];
  userPreferences?: UserSuggestionPreferences;
}

export interface ISuggestionProvider extends IService {
  generateSuggestion(type: SuggestionType, context: SuggestionContext): Result<Suggestion>;
  generateForFlowState(context: SuggestionContext): Result<Suggestion>;
  shouldSuggest(context: ActivityContext): boolean;
  getAvailableTypes(): SuggestionType[];
  isTypeEnabled(type: SuggestionType): boolean;
}

export interface AnalysisResult {
  analyzed: boolean;
  suggestions: Suggestion[];
  context: ActivityContext;
}

export interface IPiecesClient extends IService {
  readonly status: ConnectionStatus;
  onStatusChanged: vscode.Event<ConnectionStatus>;
  analyzeContext(context: ActivityContext): Promise<Result<AnalysisResult>>;
  isAvailable(): boolean;
}

export type InterruptionLevel = 1 | 2 | 3 | 4;

export interface InterruptionStats {
  totalSuggestions: number;
  totalDismissals: number;
  totalAcceptances: number;
  blacklistedSuggestions: string[];
  lastInterruptionTime: number | null;
  currentFocusModeEnd: number | null;
  dismissalHistory: Map<string, number[]>;
}

export interface InterruptionDecision {
  shouldInterrupt: boolean;
  level: InterruptionLevel;
  reason: string;
  waitTimeMs?: number;
}

export interface IInterruptionManager extends IService {
  shouldInterrupt(context: ActivityContext, flowState: FlowState, suggestionId?: string): InterruptionDecision;
  calculateInterruptionLevel(flowState: FlowState, context: ActivityContext): InterruptionLevel;
  recordDismissal(suggestionId: string): Promise<void>;
  recordAcceptance(suggestionId: string): Promise<void>;
  recordInterruption(suggestionId: string): Promise<void>;
  enableFocusMode(durationMinutes?: number): Promise<void>;
  disableFocusMode(): Promise<void>;
  isFocusModeActive(): boolean;
  getFocusModeRemainingMinutes(): number;
  getStats(): InterruptionStats;
  isBlacklisted(suggestionId: string): boolean;
  clearBlacklist(suggestionId?: string): Promise<void>;
  getTimeUntilNextInterruption(): number;
}

export interface DismissalRecord {
  suggestionId: string;
  timestamp: number;
  reason?: string;
  context?: string;
}

export interface UsagePatterns {
  mostActiveHours: number[];
  preferredSuggestionTypes: string[];
  commonErrors: string[];
  fileTypesWorked: string[];
  averageSessionDuration: number;
}

export interface TypingMetrics {
  characterCount: number;
  backspaceCount: number;
  startTime: number;
  lastActivityTime: number;
}

export interface ErrorTracking {
  diagnostics: Map<string, DiagnosticInfo>;
  firstSeen: number;
  count: number;
}

export type StorageKey = 
  | 'dismissals'
  | 'dismissalCounts'
  | 'settings'
  | 'stats'
  | 'sessionCount'
  | 'patterns'
  | 'firstRun'
  | 'installDate'
  | 'lastVersion';

export interface IStorageManager extends IService {
  getDismissals(): Promise<DismissalRecord[]>;
  recordDismissal(suggestionId: string, reason?: string, context?: string): Promise<void>;
  getDismissalCount(suggestionId: string): Promise<number>;
  clearDismissals(suggestionId?: string): Promise<void>;
  getSettings(): Promise<UserSettings>;
  updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): Promise<void>;
  resetSettings(): Promise<void>;
  getStats(): Promise<ActivityStats>;
  updateStats(stats: ActivityStats): Promise<void>;
  resetStats(): Promise<void>;
  recordSuggestionShown(): Promise<void>;
  recordSuggestionAccepted(): Promise<void>;
  getSessionCount(): Promise<number>;
  incrementSessionCount(): Promise<number>;
  isFirstRun(): Promise<boolean>;
  get<T>(key: StorageKey): Promise<T | undefined>;
  set<T>(key: StorageKey, value: T): Promise<void>;
  clear(): Promise<void>;
  exportAll(): Promise<Record<string, unknown>>;
  importAll(data: Record<string, unknown>): Promise<Result<void>>;
  onChange<T>(key: StorageKey, callback: (value: T) => void): vscode.Disposable;
}

export interface VisionEvent {
  id: string;
  text?: string;
  timestamp: string;
  application: string;
  transferable: boolean;
  confidence?: number;
  context?: string;
  metadata?: Record<string, unknown>;
}

export type StatusBarState = 
  | 'idle'
  | 'watching'
  | 'suggestion'
  | 'urgent'
  | 'focus'
  | 'offline';

export interface StatusBarConfig {
  showInStatusBar: boolean;
  updateIntervalMs: number;
  enableAnimations: boolean;
  priority: number;
}

export interface IStatusBarManager extends IService {
  updateState(state: StatusBarState): void;
  showMessage(message: string, durationMs?: number): void;
  setPulsing(enabled: boolean): void;
  hide(): void;
  show(): void;
}

export class DisposableStore implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  add<T extends vscode.Disposable>(disposable: T): T {
    this.disposables.push(disposable);
    return disposable;
  }

  addAll(...disposables: vscode.Disposable[]): void {
    this.disposables.push(...disposables);
  }

  dispose(): void {
    this.disposables.forEach(d => {
      try { d.dispose(); } catch { /* ignore */ }
    });
    this.disposables = [];
  }
}

export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

export function err<E extends Error>(error: E): Result<never, E> {
  return { success: false, error };
}
