// =============================================================================
// NEXUS - Situation Aggregator Service
// Aggregates context from multiple sources into unified SituationSnapshots
//
// This service collects data from ContextMonitor, IntentEngine, and TaskTracker
// to produce periodic snapshots of the user's current situation. It emits events
// when significant changes occur to enable proactive assistance.
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';
import { ContextMonitor } from './context-monitor';
import { IntentEngine, DetectedIntent, StruggleDetection } from './intent-engine';
import { TaskTracker, Task } from './task-tracker';
import {
  SystemContext,
  ActiveWindowInfo,
  ClipboardItem,
} from '../../shared/types';

// =============================================================================
// Situation Aggregator Types
// =============================================================================

/**
 * User state representing their current work mode
 */
export type UserState =
  | 'focused'      // Deep work, minimal context switching
  | 'browsing'     // Casual exploration, reading
  | 'stuck'        // Appears blocked on something
  | 'idle'         // No recent activity
  | 'switching'    // Rapidly changing contexts
  | 'error';       // Dealing with errors/debugging

/**
 * Activity level based on recent behavior patterns
 */
export type ActivityLevel = 'high' | 'medium' | 'low' | 'idle';

/**
 * Window change event payload
 */
export interface WindowChangeEvent {
  previous: ActiveWindowInfo | undefined;
  current: ActiveWindowInfo | undefined;
  timestamp: number;
  dwellTimeMs: number;  // Time spent in previous window
}

/**
 * Activity change event payload
 */
export interface ActivityChangeEvent {
  previous: ActivityLevel;
  current: ActivityLevel;
  switchCount: number;
  timestamp: number;
}

/**
 * State change event payload
 */
export interface StateChangeEvent {
  previous: UserState;
  current: UserState;
  reason: string;
  timestamp: number;
}

/**
 * Clipboard change event payload
 */
export interface ClipboardChangeEvent {
  item: ClipboardItem;
  timestamp: number;
}

/**
 * Unified snapshot of the user's current situation
 */
export interface SituationSnapshot {
  id: string;
  timestamp: number;
  
  // Core state
  userState: UserState;
  activityLevel: ActivityLevel;
  
  // Context data
  activeWindow: ActiveWindowInfo | undefined;
  currentIntent: DetectedIntent | null;
  currentTask: Task | null;
  
  // Activity metrics
  windowDwellTimeMs: number;          // Time in current window
  recentAppSwitchCount: number;       // App switches in last minute
  idleTimeMs: number;                 // Time since last activity
  
  // Struggle indicators
  isStruggling: boolean;
  struggleSeverity: 'none' | 'mild' | 'moderate' | 'severe';
  struggleIndicators: string[];
  
  // Clipboard context (most recent, if relevant)
  recentClipboard: ClipboardItem | undefined;
  
  // Computed flags for quick checks
  flags: {
    isInEditor: boolean;
    isInTerminal: boolean;
    isInBrowser: boolean;
    hasRecentError: boolean;
    isDeepWork: boolean;
    needsHelp: boolean;
  };
}

/**
 * Configuration for the Situation Aggregator
 */
export interface SituationAggregatorConfig {
  /** Interval between snapshots in milliseconds (default: 2000) */
  snapshotIntervalMs: number;
  
  /** Time window for calculating activity level (default: 60000 = 1 min) */
  activityWindowMs: number;
  
  /** Number of app switches in window to consider "high" activity */
  highActivityThreshold: number;
  
  /** Number of app switches in window to consider "medium" activity */
  mediumActivityThreshold: number;
  
  /** Time without activity before considered "idle" in ms (default: 60000) */
  idleThresholdMs: number;
  
  /** Minimum dwell time to consider "focused" in ms (default: 120000 = 2 min) */
  focusedDwellThresholdMs: number;
  
  /** App switch rate (per min) to consider "switching" state */
  switchingThreshold: number;
}

export const DEFAULT_AGGREGATOR_CONFIG: SituationAggregatorConfig = {
  snapshotIntervalMs: 2000,
  activityWindowMs: 60000,
  highActivityThreshold: 10,
  mediumActivityThreshold: 4,
  idleThresholdMs: 60000,
  focusedDwellThresholdMs: 120000,
  switchingThreshold: 8,
};

// =============================================================================
// Application Detection Patterns
// =============================================================================

const EDITOR_PATTERNS = [
  'code', 'cursor', 'idea', 'pycharm', 'webstorm', 'sublime', 'atom',
  'vim', 'neovim', 'emacs', 'notepad++', 'visual studio',
];

const TERMINAL_PATTERNS = [
  'terminal', 'iterm', 'cmd', 'powershell', 'hyper', 'alacritty',
  'kitty', 'warp', 'windows terminal', 'command prompt',
];

const BROWSER_PATTERNS = [
  'chrome', 'firefox', 'safari', 'edge', 'brave', 'opera', 'arc',
];

const ERROR_PATTERNS = [
  /error/i, /exception/i, /failed/i, /crash/i, /bug/i,
  /debug/i, /stacktrace/i, /traceback/i,
];

// =============================================================================
// Situation Aggregator Class
// =============================================================================

export class SituationAggregator extends EventEmitter {
  private config: SituationAggregatorConfig;
  
  // Service dependencies
  private contextMonitor: ContextMonitor | null = null;
  private intentEngine: IntentEngine | null = null;
  private taskTracker: TaskTracker | null = null;
  
  // State tracking
  private isRunning: boolean = false;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private currentSnapshot: SituationSnapshot | null = null;
  
  // Activity tracking
  private lastActivityTime: number = Date.now();
  private windowChangeHistory: { app: string; timestamp: number }[] = [];
  private lastWindow: ActiveWindowInfo | undefined;
  private windowStartTime: number = Date.now();
  
  // State tracking
  private currentUserState: UserState = 'idle';
  private currentActivityLevel: ActivityLevel = 'idle';
  private lastClipboard: ClipboardItem | undefined;
  
  // Recent context from monitors
  private latestContext: SystemContext | null = null;
  private latestIntent: DetectedIntent | null = null;
  private latestStruggle: StruggleDetection | null = null;

  constructor(config?: Partial<SituationAggregatorConfig>) {
    super();
    this.config = { ...DEFAULT_AGGREGATOR_CONFIG, ...config };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize with service dependencies
   */
  initialize(deps: {
    contextMonitor: ContextMonitor;
    intentEngine: IntentEngine;
    taskTracker: TaskTracker;
  }): void {
    this.contextMonitor = deps.contextMonitor;
    this.intentEngine = deps.intentEngine;
    this.taskTracker = deps.taskTracker;

    // Listen to context updates
    this.contextMonitor.on('update', (context: SystemContext) => {
      this.handleContextUpdate(context);
    });

    this.contextMonitor.on('clipboardChange', (item: ClipboardItem) => {
      this.handleClipboardChange(item);
    });

    // Listen to intent updates
    this.intentEngine.on('intentChange', (intent: DetectedIntent) => {
      this.latestIntent = intent;
    });

    this.intentEngine.on('struggleDetected', (struggle: StruggleDetection) => {
      this.latestStruggle = struggle;
    });

    this.intentEngine.on('analysis', (analysis: { struggleDetection: StruggleDetection }) => {
      this.latestStruggle = analysis.struggleDetection;
    });

    log.info('[SituationAggregator] Initialized with dependencies');
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Start the aggregator - begins periodic snapshot generation
   */
  start(): void {
    if (this.isRunning) {
      log.warn('[SituationAggregator] Already running');
      return;
    }

    this.isRunning = true;
    this.lastActivityTime = Date.now();
    this.windowStartTime = Date.now();

    // Generate initial snapshot
    this.generateSnapshot();

    // Start periodic snapshot generation
    this.snapshotTimer = setInterval(() => {
      this.generateSnapshot();
    }, this.config.snapshotIntervalMs);

    log.info('[SituationAggregator] Started with interval:', this.config.snapshotIntervalMs, 'ms');
    this.emit('started');
  }

  /**
   * Stop the aggregator
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }

    log.info('[SituationAggregator] Stopped');
    this.emit('stopped');
  }

  // ===========================================================================
  // Context Update Handlers
  // ===========================================================================

  /**
   * Handle context updates from ContextMonitor
   * This is also the public method for manual context injection
   */
  onContextUpdate(context: SystemContext): void {
    this.handleContextUpdate(context);
  }

  private handleContextUpdate(context: SystemContext): void {
    this.latestContext = context;
    this.lastActivityTime = Date.now();

    // Track window changes
    const currentWindow = context.activeWindow;
    if (currentWindow && this.hasWindowChanged(currentWindow)) {
      this.handleWindowChange(currentWindow);
    }
  }

  private hasWindowChanged(current: ActiveWindowInfo): boolean {
    if (!this.lastWindow) return true;
    return (
      current.application !== this.lastWindow.application ||
      current.title !== this.lastWindow.title
    );
  }

  private handleWindowChange(current: ActiveWindowInfo): void {
    const now = Date.now();
    const dwellTime = now - this.windowStartTime;
    const previous = this.lastWindow;

    // Track window switch for activity calculation
    this.windowChangeHistory.push({
      app: current.application,
      timestamp: now,
    });

    // Keep only recent history
    const cutoff = now - this.config.activityWindowMs;
    this.windowChangeHistory = this.windowChangeHistory.filter(
      (w) => w.timestamp > cutoff
    );

    // Emit window change event
    const event: WindowChangeEvent = {
      previous,
      current,
      timestamp: now,
      dwellTimeMs: dwellTime,
    };
    this.emit('windowChange', event);

    // Update tracking
    this.lastWindow = current;
    this.windowStartTime = now;

    log.debug('[SituationAggregator] Window changed:', current.application);
  }

  private handleClipboardChange(item: ClipboardItem): void {
    this.lastClipboard = item;
    this.lastActivityTime = Date.now();

    const event: ClipboardChangeEvent = {
      item,
      timestamp: Date.now(),
    };
    this.emit('clipboardChange', event);
  }

  // ===========================================================================
  // Snapshot Generation
  // ===========================================================================

  private generateSnapshot(): void {
    const now = Date.now();
    
    // Calculate metrics
    const windowDwellTimeMs = now - this.windowStartTime;
    const idleTimeMs = now - this.lastActivityTime;
    const recentAppSwitchCount = this.windowChangeHistory.length;
    
    // Calculate activity level
    const newActivityLevel = this.calculateActivityLevel(recentAppSwitchCount, idleTimeMs);
    
    // Calculate user state
    const newUserState = this.calculateUserState(
      windowDwellTimeMs,
      recentAppSwitchCount,
      idleTimeMs
    );
    
    // Check for state changes and emit events
    this.checkAndEmitStateChanges(newUserState, newActivityLevel, recentAppSwitchCount);
    
    // Build struggle info
    const struggleInfo = this.getStruggleInfo();
    
    // Build flags
    const flags = this.buildFlags(windowDwellTimeMs, struggleInfo.isStruggling);
    
    // Create snapshot
    const snapshot: SituationSnapshot = {
      id: uuidv4(),
      timestamp: now,
      
      userState: this.currentUserState,
      activityLevel: this.currentActivityLevel,
      
      activeWindow: this.latestContext?.activeWindow,
      currentIntent: this.latestIntent,
      currentTask: this.taskTracker?.getCurrentTask() ?? null,
      
      windowDwellTimeMs,
      recentAppSwitchCount,
      idleTimeMs,
      
      isStruggling: struggleInfo.isStruggling,
      struggleSeverity: struggleInfo.severity,
      struggleIndicators: struggleInfo.indicators,
      
      recentClipboard: this.lastClipboard,
      
      flags,
    };

    this.currentSnapshot = snapshot;
    this.emit('snapshot', snapshot);
  }

  private calculateActivityLevel(switchCount: number, idleTimeMs: number): ActivityLevel {
    if (idleTimeMs > this.config.idleThresholdMs) {
      return 'idle';
    }
    
    if (switchCount >= this.config.highActivityThreshold) {
      return 'high';
    }
    
    if (switchCount >= this.config.mediumActivityThreshold) {
      return 'medium';
    }
    
    return 'low';
  }

  private calculateUserState(
    windowDwellTimeMs: number,
    switchCount: number,
    idleTimeMs: number
  ): UserState {
    // Check for idle first
    if (idleTimeMs > this.config.idleThresholdMs) {
      return 'idle';
    }

    // Check for error/debugging state
    const currentTitle = this.latestContext?.activeWindow?.title?.toLowerCase() || '';
    if (ERROR_PATTERNS.some((p) => p.test(currentTitle))) {
      return 'error';
    }

    // Check if struggling (from IntentEngine)
    if (this.latestStruggle?.isStruggling && this.latestStruggle.severity !== 'mild') {
      return 'stuck';
    }

    // Check for rapid switching
    if (switchCount >= this.config.switchingThreshold) {
      return 'switching';
    }

    // Check for focused deep work
    if (windowDwellTimeMs >= this.config.focusedDwellThresholdMs) {
      const app = this.latestContext?.activeWindow?.application?.toLowerCase() || '';
      if (EDITOR_PATTERNS.some((p) => app.includes(p)) ||
          TERMINAL_PATTERNS.some((p) => app.includes(p))) {
        return 'focused';
      }
    }

    // Check current intent for additional context
    const intentType = this.latestIntent?.type;
    if (intentType === 'coding' || intentType === 'writing') {
      if (windowDwellTimeMs >= 60000) {  // 1 minute minimum
        return 'focused';
      }
    }

    // Default to browsing for general activity
    return 'browsing';
  }

  private checkAndEmitStateChanges(
    newUserState: UserState,
    newActivityLevel: ActivityLevel,
    switchCount: number
  ): void {
    const now = Date.now();

    // Check for state change
    if (newUserState !== this.currentUserState) {
      const event: StateChangeEvent = {
        previous: this.currentUserState,
        current: newUserState,
        reason: this.getStateChangeReason(this.currentUserState, newUserState),
        timestamp: now,
      };
      
      this.currentUserState = newUserState;
      this.emit('stateChange', event);
      
      log.debug('[SituationAggregator] State changed:', event.previous, '->', event.current);
    }

    // Check for activity level change
    if (newActivityLevel !== this.currentActivityLevel) {
      const event: ActivityChangeEvent = {
        previous: this.currentActivityLevel,
        current: newActivityLevel,
        switchCount,
        timestamp: now,
      };
      
      this.currentActivityLevel = newActivityLevel;
      this.emit('activityChange', event);
      
      log.debug('[SituationAggregator] Activity changed:', event.previous, '->', event.current);
    }
  }

  private getStateChangeReason(from: UserState, to: UserState): string {
    const reasons: Record<string, string> = {
      'idle->focused': 'Resumed work in focused application',
      'idle->browsing': 'Resumed casual browsing',
      'focused->idle': 'Became inactive',
      'focused->switching': 'Started rapid context switching',
      'focused->stuck': 'Detected struggle indicators',
      'browsing->focused': 'Entered deep work mode',
      'browsing->idle': 'Became inactive',
      'switching->focused': 'Settled into focused work',
      'switching->stuck': 'Detected struggle during switching',
      'stuck->focused': 'Recovered from stuck state',
      'stuck->browsing': 'Moved to casual browsing',
      'error->focused': 'Resolved error state',
      'error->browsing': 'Moved away from error context',
    };

    return reasons[`${from}->${to}`] || `Transitioned from ${from} to ${to}`;
  }

  private getStruggleInfo(): {
    isStruggling: boolean;
    severity: 'none' | 'mild' | 'moderate' | 'severe';
    indicators: string[];
  } {
    if (!this.latestStruggle || !this.latestStruggle.isStruggling) {
      return {
        isStruggling: false,
        severity: 'none',
        indicators: [],
      };
    }

    return {
      isStruggling: true,
      severity: this.latestStruggle.severity,
      indicators: this.latestStruggle.indicators.map((i) => i.description),
    };
  }

  private buildFlags(
    windowDwellTimeMs: number,
    isStruggling: boolean
  ): SituationSnapshot['flags'] {
    const app = this.latestContext?.activeWindow?.application?.toLowerCase() || '';
    const title = this.latestContext?.activeWindow?.title?.toLowerCase() || '';

    const isInEditor = EDITOR_PATTERNS.some((p) => app.includes(p));
    const isInTerminal = TERMINAL_PATTERNS.some((p) => app.includes(p));
    const isInBrowser = BROWSER_PATTERNS.some((p) => app.includes(p));
    const hasRecentError = ERROR_PATTERNS.some((p) => p.test(title));
    const isDeepWork = (isInEditor || isInTerminal) && 
                       windowDwellTimeMs >= this.config.focusedDwellThresholdMs;
    const needsHelp = isStruggling || (hasRecentError && this.currentUserState === 'stuck');

    return {
      isInEditor,
      isInTerminal,
      isInBrowser,
      hasRecentError,
      isDeepWork,
      needsHelp,
    };
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Get the current situation snapshot
   */
  getCurrentSnapshot(): SituationSnapshot | null {
    return this.currentSnapshot ? { ...this.currentSnapshot } : null;
  }

  /**
   * Get current user state
   */
  getUserState(): UserState {
    return this.currentUserState;
  }

  /**
   * Get current activity level
   */
  getActivityLevel(): ActivityLevel {
    return this.currentActivityLevel;
  }

  /**
   * Check if the aggregator is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<SituationAggregatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart timer if interval changed and running
    if (newConfig.snapshotIntervalMs && this.isRunning) {
      if (this.snapshotTimer) {
        clearInterval(this.snapshotTimer);
      }
      this.snapshotTimer = setInterval(() => {
        this.generateSnapshot();
      }, this.config.snapshotIntervalMs);
      
      log.info('[SituationAggregator] Updated snapshot interval:', this.config.snapshotIntervalMs, 'ms');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SituationAggregatorConfig {
    return { ...this.config };
  }

  /**
   * Force a snapshot generation (useful for testing or immediate updates)
   */
  forceSnapshot(): SituationSnapshot | null {
    if (this.isRunning) {
      this.generateSnapshot();
    }
    return this.getCurrentSnapshot();
  }

  /**
   * Get status information for debugging/monitoring
   */
  getStatus(): {
    isRunning: boolean;
    currentUserState: UserState;
    currentActivityLevel: ActivityLevel;
    lastActivityAgo: number;
    windowDwellTime: number;
    recentSwitchCount: number;
    config: SituationAggregatorConfig;
  } {
    const now = Date.now();
    return {
      isRunning: this.isRunning,
      currentUserState: this.currentUserState,
      currentActivityLevel: this.currentActivityLevel,
      lastActivityAgo: now - this.lastActivityTime,
      windowDwellTime: now - this.windowStartTime,
      recentSwitchCount: this.windowChangeHistory.length,
      config: { ...this.config },
    };
  }
}

export default SituationAggregator;
