import * as vscode from 'vscode';
import { 
  FlowState, 
  ActivityContext, 
  ActivityEvent, 
  ActivityStats,
  DiagnosticInfo,
  ILogger,
  IActivityTracker,
  DisposableStore,
  IStorageManager
} from '../types';

import type { TypingMetrics, ErrorTracking } from '../types';
import { ACTIVITY_MONITOR_CONFIG } from '../config/settings';

interface SuggestionMetrics {
  shown: number;
  accepted: number;
  dismissed: number;
}

interface ActivityMonitorConfig {
  idleThresholdMs: number;
  deepFlowThresholdMs: number;
  stuckThresholdMs: number;
  typingWindowMs: number;
  sampleIntervalMs: number;
  minTypingVelocity: number;
  frustrationBackspaceRatio: number;
}

const DEFAULT_CONFIG: ActivityMonitorConfig = {
  idleThresholdMs: ACTIVITY_MONITOR_CONFIG.IDLE_THRESHOLD_MS,
  deepFlowThresholdMs: ACTIVITY_MONITOR_CONFIG.DEEP_FLOW_THRESHOLD_MS,
  stuckThresholdMs: ACTIVITY_MONITOR_CONFIG.STUCK_THRESHOLD_MS,
  typingWindowMs: ACTIVITY_MONITOR_CONFIG.TYPING_WINDOW_MS,
  sampleIntervalMs: ACTIVITY_MONITOR_CONFIG.SAMPLE_INTERVAL_MS,
  minTypingVelocity: ACTIVITY_MONITOR_CONFIG.MIN_TYPING_VELOCITY,
  frustrationBackspaceRatio: ACTIVITY_MONITOR_CONFIG.FRUSTRATION_BACKSPACE_RATIO,
};

export class ActivityMonitor implements IActivityTracker {
  public readonly name = 'ActivityMonitor';

  // Events
  private readonly _onFlowStateChanged = new vscode.EventEmitter<FlowState>();
  public readonly onFlowStateChanged = this._onFlowStateChanged.event;

  private readonly _onActivityRecorded = new vscode.EventEmitter<ActivityEvent>();
  public readonly onActivityRecorded = this._onActivityRecorded.event;

  private readonly _onContextChanged = new vscode.EventEmitter<ActivityContext>();
  public readonly onContextChanged = this._onContextChanged.event;

  // State
  private config: ActivityMonitorConfig;
  private disposables = new DisposableStore();
  private currentState: FlowState = 'idle';
  private currentContext: ActivityContext;
  private typingMetrics: TypingMetrics;
  private errorTracking: Map<string, ErrorTracking> = new Map();
  private activityHistory: ActivityEvent[] = [];
  private sessionStart: Date;
  private lastTypingVelocity: number = 0;
  private stateChangeTime: number = Date.now();
  private suggestionMetrics: SuggestionMetrics = {
    shown: 0,
    accepted: 0,
    dismissed: 0
  };

  constructor(
    _context: vscode.ExtensionContext,
    private readonly logger: ILogger,
    private readonly storageManager?: IStorageManager,
    config?: Partial<ActivityMonitorConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionStart = new Date();
    this.currentContext = this.createEmptyContext();
    this.typingMetrics = {
      characterCount: 0,
      backspaceCount: 0,
      startTime: Date.now(),
      lastActivityTime: Date.now()
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('[ActivityMonitor] Initializing...');
    await this.loadStatsFromStorage();
    this.setupEventListeners();
    
    // IMPORTANT: Initialize context with the current active editor
    // This ensures we capture the file that's already open when the extension starts
    this.logger.info('[ActivityMonitor] Setting up initial context from active editor...');
    this.updateContextFromEditor();
    
    // Fire initial context changed event so webview gets the initial file info
    this._onContextChanged.fire(this.currentContext);
    this.logger.info('[ActivityMonitor] Initial context:', { 
      file: this.currentContext.file, 
      language: this.currentContext.language 
    });
    
    this.startSampling();
    this.updateFlowState();
    this.logger.info('[ActivityMonitor] Initialization complete');
  }

  private async loadStatsFromStorage(): Promise<void> {
    if (!this.storageManager) {
      return;
    }

    try {
      const stats = await this.storageManager.getStats();
      this.suggestionMetrics.shown = stats.suggestionsShown || 0;
      this.suggestionMetrics.accepted = stats.suggestionsAccepted || 0;
      // dismissed is tracked separately, initialize to 0
      this.suggestionMetrics.dismissed = 0;
    } catch (error) {
      this.logger.warn('Failed to load stats from storage', error as Error);
    }
  }

  private async persistStats(): Promise<void> {
    if (!this.storageManager) {
      return;
    }

    try {
      const stats = await this.storageManager.getStats();
      stats.suggestionsShown = this.suggestionMetrics.shown;
      stats.suggestionsAccepted = this.suggestionMetrics.accepted;
      await this.storageManager.updateStats(stats);
    } catch (error) {
      this.logger.warn('Failed to persist stats', error as Error);
    }
  }

  public recordSuggestionShown(): void {
    this.suggestionMetrics.shown++;
    this.persistStats();
    
    // Also record in storage manager if available
    if (this.storageManager) {
      this.storageManager.recordSuggestionShown().catch(error => {
        this.logger.warn('Failed to record suggestion shown in storage', error as Error);
      });
    }
    
    this.logger.debug(`Suggestion shown. Total: ${this.suggestionMetrics.shown}`);
  }

  public recordSuggestionAccepted(): void {
    this.suggestionMetrics.accepted++;
    this.persistStats();
    
    // Also record in storage manager if available
    if (this.storageManager) {
      this.storageManager.recordSuggestionAccepted().catch(error => {
        this.logger.warn('Failed to record suggestion accepted in storage', error as Error);
      });
    }
    
    this.logger.debug(`Suggestion accepted. Total: ${this.suggestionMetrics.accepted}`);
  }

  public recordSuggestionDismissed(): void {
    this.suggestionMetrics.dismissed++;
    this.persistStats();
    this.logger.debug(`Suggestion dismissed. Total: ${this.suggestionMetrics.dismissed}`);
  }

  private setupEventListeners(): void {
    this.disposables.add(
      vscode.workspace.onDidChangeTextDocument(
        this.safeHandle(e => this.handleTextChange(e), 'handleTextChange')
      )
    );
    this.disposables.add(
      vscode.languages.onDidChangeDiagnostics(
        this.safeHandle(e => this.handleDiagnosticsChange(e), 'handleDiagnosticsChange')
      )
    );
    this.disposables.add(
      vscode.window.onDidChangeActiveTextEditor(
        this.safeHandle(e => this.handleActiveEditorChange(e), 'handleActiveEditorChange')
      )
    );
    this.disposables.add(
      vscode.window.onDidChangeWindowState(
        this.safeHandle(e => this.handleWindowStateChange(e), 'handleWindowStateChange')
      )
    );
    this.disposables.add(
      vscode.commands.registerCommand('proactiveAssistant.onCommand', command => {
        this.safeHandle((_cmd: string) => this.recordActivity('command_execute', { command }), 'onCommand')(command);
      })
    );
  }

  private safeHandle<T>(handler: (arg: T) => void, handlerName: string): (arg: T) => void {
    return (arg: T) => {
      try {
        handler(arg);
      } catch (error) {
        this.logger.error(`Error in ${handlerName}`, error as Error);
      }
    };
  }

  private handleTextChange(e: vscode.TextDocumentChangeEvent): void {
    const now = Date.now();
    const contentChanges = e.contentChanges;

    for (const change of contentChanges) {
      if (change.text.length > 0) {
        this.typingMetrics.characterCount += change.text.length;
      }
      if (change.rangeLength > 0 || change.text === '') {
        this.typingMetrics.backspaceCount += change.rangeLength || 1;
      }
    }

    this.typingMetrics.lastActivityTime = now;
    this.updateContextFromEditor();
    this.recordActivity('edit', {
      file: e.document.fileName,
      language: e.document.languageId,
      changes: contentChanges.length
    });
  }

  private handleDiagnosticsChange(e: vscode.DiagnosticChangeEvent): void {
    const now = Date.now();
    
    for (const uri of e.uris) {
      const diagnostics = vscode.languages.getDiagnostics(uri);
      const filePath = uri.fsPath;

      // Clear old diagnostics for this file
      this.errorTracking.delete(filePath);

      // Process current diagnostics
      const errors: DiagnosticInfo[] = [];
      const warnings: DiagnosticInfo[] = [];

      for (const diagnostic of diagnostics) {
        const info: DiagnosticInfo = {
          message: diagnostic.message,
          line: diagnostic.range.start.line,
          column: diagnostic.range.start.character,
          severity: diagnostic.severity === vscode.DiagnosticSeverity.Error ? 'error' : 
                    diagnostic.severity === vscode.DiagnosticSeverity.Warning ? 'warning' : 'info',
          code: typeof diagnostic.code === 'string' 
            ? diagnostic.code 
            : (diagnostic.code && typeof diagnostic.code === 'object' && 'value' in diagnostic.code) 
              ? String(diagnostic.code.value) 
              : undefined,
          source: diagnostic.source
        };

        if (info.severity === 'error') {
          errors.push(info);
        } else if (info.severity === 'warning') {
          warnings.push(info);
        }

        // Track errors for stuck detection
        if (info.severity === 'error') {
          const key = `${filePath}:${info.line}:${info.message}`;
          const existing = this.errorTracking.get(key);
          
          if (!existing) {
        this.errorTracking.set(key, {
          diagnostics: new Map([[filePath, info]]),
          firstSeen: now,
          count: 1
        });
      } else {
        existing.count++;
      }
        }
      }

      // Update context
      this.currentContext.errors = errors;
      this.currentContext.warnings = warnings;
    }

    this.recordActivity('error_encounter', {
      fileCount: e.uris.length
    });
  }

  private handleActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    this.logger.debug('[ActivityMonitor] Active editor changed:', { 
      hasEditor: !!editor, 
      fileName: editor?.document?.fileName 
    });
    
    if (this.currentContext.file) {
      this.currentContext.previousFile = this.currentContext.file;
    }

    if (editor) {
      this.updateContextFromEditor(editor);
      
      this.recordActivity('file_open', {
        file: editor.document.fileName,
        language: editor.document.languageId
      });
    } else {
      this.currentContext.file = undefined;
      this.currentContext.language = undefined;
      
      this.recordActivity('focus_change', {
        type: 'editor_closed'
      });
    }

    this.logger.debug('[ActivityMonitor] Firing context changed event:', { 
      file: this.currentContext.file,
      language: this.currentContext.language 
    });
    this._onContextChanged.fire(this.currentContext);
  }

  private handleWindowStateChange(state: vscode.WindowState): void {
    if (!state.focused) {
      this.recordActivity('focus_change', {
        type: 'window_blur'
      });
    } else {
      this.recordActivity('focus_change', {
        type: 'window_focus'
      });
    }
  }

  private updateContextFromEditor(editor?: vscode.TextEditor): void {
    const activeEditor = editor || vscode.window.activeTextEditor;
    
    if (activeEditor) {
      const document = activeEditor.document;
      const position = activeEditor.selection.active;

      this.currentContext = {
        ...this.currentContext,
        file: document.fileName,
        language: document.languageId,
        line: position.line,
        column: position.character,
        capturedAt: new Date()
      };

      // Get recent content (first 1000 chars of current line context)
      const lineStart = Math.max(0, position.line - ACTIVITY_MONITOR_CONFIG.CONTEXT_CONTENT_LINES);
      const lineEnd = Math.min(document.lineCount - 1, position.line + ACTIVITY_MONITOR_CONFIG.CONTEXT_CONTENT_LINES);
      this.currentContext.content = document.getText(
        new vscode.Range(lineStart, 0, lineEnd, 0)
      ).slice(0, ACTIVITY_MONITOR_CONFIG.CONTEXT_CONTENT_MAX_LENGTH);
      
      this.logger.debug('[ActivityMonitor] Context updated from editor:', {
        file: this.currentContext.file,
        language: this.currentContext.language,
        line: this.currentContext.line
      });
    } else {
      this.logger.debug('[ActivityMonitor] No active editor found');
    }
  }

  private startSampling(): void {
    const interval = setInterval(() => {
      this.sampleActivity();
    }, this.config.sampleIntervalMs);

    this.disposables.add({
      dispose: () => clearInterval(interval)
    });
  }

  private sampleActivity(): void {
    const now = Date.now();
    const timeSinceLastActivity = now - this.typingMetrics.lastActivityTime;
    
    // Calculate typing velocity (chars per minute)
    const typingDuration = now - this.typingMetrics.startTime;
    if (typingDuration > 0) {
      this.lastTypingVelocity = (this.typingMetrics.characterCount / typingDuration) * 60000;
    }

    // Reset typing window if needed
    if (timeSinceLastActivity > this.config.typingWindowMs) {
      this.typingMetrics = {
        characterCount: 0,
        backspaceCount: 0,
        startTime: now,
        lastActivityTime: now
      };
    }

    // Check for idle state
    if (timeSinceLastActivity > this.config.idleThresholdMs) {
      if (this.currentState !== 'idle') {
        this.recordActivity('idle', {
          duration: timeSinceLastActivity
        });
      }
    }

    // Update duration in context (time since session start in ms)
    this.currentContext.duration = now - this.sessionStart.getTime();

    // Fire context changed event periodically so webview gets duration updates
    // We do this every sample to keep activity time updated in the UI
    this._onContextChanged.fire(this.currentContext);

    // Recalculate flow state
    this.updateFlowState();
  }

  private updateFlowState(): void {
    const newState = this.calculateFlowState();
    
    if (newState !== this.currentState) {
      this.logger.info(`Flow state changed: ${this.currentState} -> ${newState}`);
      this.currentState = newState;
      this.stateChangeTime = Date.now();
      this._onFlowStateChanged.fire(newState);
    }
  }

  private calculateFlowState(): FlowState {
    const now = Date.now();
    const timeSinceActivity = now - this.typingMetrics.lastActivityTime;

    // Check idle state
    if (timeSinceActivity > this.config.idleThresholdMs) {
      return 'idle';
    }

    // Check for stuck state (error persisting > threshold)
    for (const [, tracking] of this.errorTracking) {
      const errorDuration = now - tracking.firstSeen;
      if (errorDuration > this.config.stuckThresholdMs) {
        return 'stuck';
      }
    }

    // Check for frustrated state (high backspace ratio)
    const totalChars = this.typingMetrics.characterCount + this.typingMetrics.backspaceCount;
    if (totalChars > 10) {
      const backspaceRatio = this.typingMetrics.backspaceCount / totalChars;
      if (backspaceRatio > this.config.frustrationBackspaceRatio) {
        return 'frustrated';
      }
    }

    // Check for deep flow state
    const stateDuration = now - this.stateChangeTime;
    const isSteadyTyping = this.lastTypingVelocity >= this.config.minTypingVelocity;
    const hasLowErrors = !this.currentContext.errors || this.currentContext.errors.length === 0;
    
    if (isSteadyTyping && hasLowErrors && stateDuration > this.config.deepFlowThresholdMs) {
      return 'deep_flow';
    }

    // Default to working state
    return 'working';
  }

  private recordActivity(type: ActivityEvent['type'], metadata?: Record<string, unknown>): void {
    const event: ActivityEvent = {
      type,
      timestamp: new Date(),
      file: this.currentContext.file,
      metadata
    };

    this.activityHistory.push(event);
    
    // Trim history to last 1000 events
    if (this.activityHistory.length > ACTIVITY_MONITOR_CONFIG.ACTIVITY_HISTORY_LIMIT) {
      this.activityHistory = this.activityHistory.slice(-ACTIVITY_MONITOR_CONFIG.ACTIVITY_HISTORY_LIMIT);
    }

    this._onActivityRecorded.fire(event);
  }

  private createEmptyContext(): ActivityContext {
    return {
      capturedAt: new Date(),
      errors: [],
      warnings: []
    };
  }

  get currentFlowState(): FlowState {
    return this.currentState;
  }

  getCurrentContext(): ActivityContext {
    return { ...this.currentContext };
  }

  getRecentEvents(limit: number = 100): ActivityEvent[] {
    return this.activityHistory.slice(-limit);
  }

  getStats(): ActivityStats {
    const now = Date.now();
    const flowStateTime: Record<FlowState, number> = {
      idle: 0,
      working: 0,
      deep_flow: 0,
      stuck: 0,
      frustrated: 0
    };

    // Calculate time in each state (simplified)
    // In production, you'd track state transitions more precisely
    const sessionDuration = now - this.sessionStart.getTime();
    flowStateTime[this.currentState] = sessionDuration;

    // Count unique files
    const filesWorked = new Set(
      this.activityHistory
        .filter(e => e.file)
        .map(e => e.file!)
    ).size;

    // Count suggestions from real tracking
    const suggestionsShown = this.suggestionMetrics.shown;
    const suggestionsAccepted = this.suggestionMetrics.accepted;

    // Top errors
    const errorCounts = new Map<string, number>();
    for (const [, tracking] of this.errorTracking) {
      const message = tracking.diagnostics.values().next().value?.message || 'Unknown error';
      errorCounts.set(message, (errorCounts.get(message) || 0) + tracking.count);
    }

    const topErrors = Array.from(errorCounts.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalTime: sessionDuration,
      flowStateTime,
      filesWorked,
      suggestionsShown,
      suggestionsAccepted,
      topErrors,
      sessionStart: this.sessionStart
    };
  }

  getTypingVelocity(): number {
    return this.lastTypingVelocity;
  }

  getIdleTime(): number {
    return Date.now() - this.typingMetrics.lastActivityTime;
  }

  dispose(): void {
    this.disposables.dispose();
    this._onFlowStateChanged.dispose();
    this._onActivityRecorded.dispose();
    this._onContextChanged.dispose();
  }
}


export default ActivityMonitor;
