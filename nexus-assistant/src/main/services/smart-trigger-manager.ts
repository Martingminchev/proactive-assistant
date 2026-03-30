// =============================================================================
// NEXUS - Smart Trigger Manager
// Advanced triggers for proactive behavior based on context changes and patterns
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { ContextMonitor } from './context-monitor';
import { PiecesMcpClient } from './pieces-mcp-client';
import { SystemContext, StuckPatternAnalysis } from '../../shared/types';
import { MoodIndicator } from '../../shared/personality';

// =============================================================================
// Trigger Types
// =============================================================================

export type TriggerType = 
  | 'interval'           // Regular time-based trigger
  | 'context_change'     // App/project switch detected
  | 'stuck_detection'    // User appears stuck
  | 'break_suggestion'   // Long work session
  | 'end_of_day'         // Approaching end of work day
  | 'return_from_idle'   // User returned after being away
  | 'error_detected'     // Error patterns in activity
  | 'project_switch';    // Switched to different project

export interface TriggerEvent {
  type: TriggerType;
  timestamp: number;
  context: TriggerContext;
  priority: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
}

export interface TriggerContext {
  previousApplication?: string;
  currentApplication?: string;
  previousProject?: string;
  currentProject?: string;
  sessionDuration: number;
  idleDuration: number;
  moodIndicators: MoodIndicator[];
}

// =============================================================================
// Trigger Configuration
// =============================================================================

export interface SmartTriggerConfig {
  enabled: boolean;
  
  // Time-based settings
  intervalMinutes: number;
  minIdleSeconds: number;
  maxIdleMinutes: number;
  
  // Context change detection
  detectAppChanges: boolean;
  detectProjectChanges: boolean;
  appChangeDebounceMs: number;
  
  // Pattern detection
  detectStuckPatterns: boolean;
  stuckCheckIntervalMinutes: number;
  
  // Work session monitoring
  suggestBreaksAfterMinutes: number;
  endOfDayHour: number;
  
  // Rate limiting
  maxTriggersPerHour: number;
  cooldownBetweenTriggersMs: number;
}

export const DEFAULT_SMART_TRIGGER_CONFIG: SmartTriggerConfig = {
  enabled: true,
  intervalMinutes: 3,
  minIdleSeconds: 30,
  maxIdleMinutes: 5,
  detectAppChanges: true,
  detectProjectChanges: true,
  appChangeDebounceMs: 5000,
  detectStuckPatterns: true,
  stuckCheckIntervalMinutes: 10,
  suggestBreaksAfterMinutes: 90,
  endOfDayHour: 18,
  maxTriggersPerHour: 6,
  cooldownBetweenTriggersMs: 60000, // 1 minute for faster proactive response
};

// =============================================================================
// Smart Trigger Manager Class
// =============================================================================

export class SmartTriggerManager extends EventEmitter {
  private config: SmartTriggerConfig;
  private contextMonitor: ContextMonitor | null = null;
  private piecesMcpClient: PiecesMcpClient | null = null;
  
  // State tracking
  private isRunning: boolean = false;
  private lastContext: SystemContext | null = null;
  private lastApplication: string | null = null;
  private lastProject: string | null = null;
  private sessionStartTime: number = Date.now();
  private lastActivityTime: number = Date.now();
  private lastTriggerTime: number = 0;
  private triggersThisHour: number = 0;
  private hourResetTime: number = Date.now();
  
  // Timers
  private intervalTimer: NodeJS.Timeout | null = null;
  private stuckCheckTimer: NodeJS.Timeout | null = null;
  private endOfDayTimer: NodeJS.Timeout | null = null;
  private appChangeDebounceTimer: NodeJS.Timeout | null = null;
  
  // Tracking for pattern detection
  private recentApplications: { app: string; timestamp: number }[] = [];
  private recentErrors: { error: string; timestamp: number }[] = [];
  private lastBreakSuggestionTime: number = 0;

  constructor(config?: Partial<SmartTriggerConfig>) {
    super();
    this.config = { ...DEFAULT_SMART_TRIGGER_CONFIG, ...config };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  initialize(deps: {
    contextMonitor: ContextMonitor;
    piecesMcpClient: PiecesMcpClient;
  }): void {
    this.contextMonitor = deps.contextMonitor;
    this.piecesMcpClient = deps.piecesMcpClient;

    log.debug('[SmartTriggerManager] Initialized with config:', this.config);
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  start(): void {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    this.isRunning = true;
    this.sessionStartTime = Date.now();
    this.lastActivityTime = Date.now();

    // Start listening to context updates
    if (this.contextMonitor) {
      this.contextMonitor.on('update', (context: SystemContext) => {
        this.handleContextUpdate(context);
      });
    }

    // Start interval timer
    this.startIntervalTimer();

    // Start stuck pattern checker
    if (this.config.detectStuckPatterns) {
      this.startStuckPatternChecker();
    }

    // Schedule end-of-day check
    this.scheduleEndOfDayCheck();

    log.debug('[SmartTriggerManager] Started');
    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear all timers
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    if (this.stuckCheckTimer) {
      clearInterval(this.stuckCheckTimer);
      this.stuckCheckTimer = null;
    }

    if (this.endOfDayTimer) {
      clearTimeout(this.endOfDayTimer);
      this.endOfDayTimer = null;
    }

    if (this.appChangeDebounceTimer) {
      clearTimeout(this.appChangeDebounceTimer);
      this.appChangeDebounceTimer = null;
    }

    log.debug('[SmartTriggerManager] Stopped');
    this.emit('stopped');
  }

  updateConfig(config: Partial<SmartTriggerConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (wasEnabled && !this.config.enabled) {
      this.stop();
    } else if (!wasEnabled && this.config.enabled) {
      this.start();
    }

    log.debug('[SmartTriggerManager] Config updated:', this.config);
  }

  // ===========================================================================
  // Context Change Detection
  // ===========================================================================

  private handleContextUpdate(context: SystemContext): void {
    this.lastActivityTime = Date.now();
    
    const previousApp = this.lastApplication;
    const currentApp = context.activeWindow?.application;

    // Detect application change
    if (this.config.detectAppChanges && currentApp && currentApp !== previousApp) {
      this.handleApplicationChange(previousApp, currentApp);
    }

    // Track recent applications for pattern analysis
    if (currentApp) {
      this.recentApplications.push({
        app: currentApp,
        timestamp: Date.now()
      });
      // Keep only last hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      this.recentApplications = this.recentApplications.filter(a => a.timestamp > oneHourAgo);
    }

    // Update state
    this.lastContext = context;
    this.lastApplication = currentApp || null;

    // Infer project from window title
    const inferredProject = this.inferProjectFromContext(context);
    if (this.config.detectProjectChanges && inferredProject !== this.lastProject) {
      this.handleProjectChange(this.lastProject, inferredProject);
      this.lastProject = inferredProject;
    }
  }

  private handleApplicationChange(previousApp: string | null | undefined, currentApp: string): void {
    // Debounce rapid app switches
    if (this.appChangeDebounceTimer) {
      clearTimeout(this.appChangeDebounceTimer);
    }

    this.appChangeDebounceTimer = setTimeout(() => {
      // Don't trigger for brief app switches
      if (this.lastApplication === currentApp) {
        this.emitTrigger({
          type: 'context_change',
          timestamp: Date.now(),
          context: this.buildTriggerContext(),
          priority: 'low',
          metadata: {
            previousApplication: previousApp,
            currentApplication: currentApp,
          }
        });
      }
    }, this.config.appChangeDebounceMs);
  }

  private handleProjectChange(previousProject: string | null, currentProject: string | null): void {
    if (!currentProject) return;

    this.emitTrigger({
      type: 'project_switch',
      timestamp: Date.now(),
      context: this.buildTriggerContext(),
      priority: 'medium',
      metadata: {
        previousProject,
        currentProject,
      }
    });
  }

  private inferProjectFromContext(context: SystemContext): string | null {
    const title = context.activeWindow?.title || '';
    const app = context.activeWindow?.application || '';

    // Look for common patterns in window titles
    // VS Code / Cursor: "filename - project - App"
    if (app.toLowerCase().includes('code') || app.toLowerCase().includes('cursor')) {
      const parts = title.split(' - ');
      if (parts.length >= 2) {
        return parts[parts.length - 2]; // Project name is usually second to last
      }
    }

    // Terminal: look for directory paths
    if (app.toLowerCase().includes('terminal') || app.toLowerCase().includes('iterm')) {
      const pathMatch = title.match(/[\/\\]([^\/\\]+)$/);
      if (pathMatch) {
        return pathMatch[1];
      }
    }

    return null;
  }

  // ===========================================================================
  // Pattern Detection
  // ===========================================================================

  private startStuckPatternChecker(): void {
    const intervalMs = this.config.stuckCheckIntervalMinutes * 60 * 1000;

    this.stuckCheckTimer = setInterval(async () => {
      await this.checkStuckPatterns();
    }, intervalMs);
  }

  private async checkStuckPatterns(): Promise<void> {
    if (!this.piecesMcpClient?.isConnected()) {
      return;
    }

    try {
      const analysis = await this.piecesMcpClient.getStuckPatterns(2); // Last 2 hours

      if (analysis.isLikelyStuck && analysis.stuckIndicators.length > 0) {
        this.emitTrigger({
          type: 'stuck_detection',
          timestamp: Date.now(),
          context: this.buildTriggerContext(),
          priority: 'high',
          metadata: {
            indicators: analysis.stuckIndicators,
            repeatedFiles: analysis.repeatedFiles,
            repeatedSearches: analysis.repeatedSearches,
          }
        });
      }
    } catch (error) {
      log.error('[SmartTriggerManager] Error checking stuck patterns:', error);
    }
  }

  // ===========================================================================
  // Time-Based Triggers
  // ===========================================================================

  private startIntervalTimer(): void {
    const intervalMs = this.config.intervalMinutes * 60 * 1000;

    this.intervalTimer = setInterval(() => {
      this.handleIntervalTrigger();
    }, intervalMs);
  }

  private handleIntervalTrigger(): void {
    const idleSeconds = (Date.now() - this.lastActivityTime) / 1000;
    const idleMinutes = idleSeconds / 60;

    // Skip if too idle (user is away)
    if (idleMinutes > this.config.maxIdleMinutes) {
      log.debug('[SmartTriggerManager] User idle too long, skipping interval trigger');
      return;
    }

    // Skip if too active (don't interrupt)
    if (idleSeconds < this.config.minIdleSeconds) {
      log.debug('[SmartTriggerManager] User too active, skipping interval trigger');
      return;
    }

    // Check break suggestion
    const sessionMinutes = (Date.now() - this.sessionStartTime) / 60000;
    const timeSinceBreakSuggestion = Date.now() - this.lastBreakSuggestionTime;

    if (
      sessionMinutes >= this.config.suggestBreaksAfterMinutes &&
      timeSinceBreakSuggestion > 30 * 60 * 1000 // At least 30 min between break suggestions
    ) {
      this.emitTrigger({
        type: 'break_suggestion',
        timestamp: Date.now(),
        context: this.buildTriggerContext(),
        priority: 'medium',
        metadata: {
          sessionDuration: Math.round(sessionMinutes),
        }
      });
      this.lastBreakSuggestionTime = Date.now();
      return; // Don't emit interval trigger if we suggested a break
    }

    // Regular interval trigger
    this.emitTrigger({
      type: 'interval',
      timestamp: Date.now(),
      context: this.buildTriggerContext(),
      priority: 'low',
    });
  }

  private scheduleEndOfDayCheck(): void {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(this.config.endOfDayHour, 0, 0, 0);

    // If end of day already passed, schedule for tomorrow
    if (now >= endOfDay) {
      endOfDay.setDate(endOfDay.getDate() + 1);
    }

    const msUntilEndOfDay = endOfDay.getTime() - now.getTime();

    this.endOfDayTimer = setTimeout(() => {
      this.handleEndOfDay();
      // Reschedule for next day
      this.scheduleEndOfDayCheck();
    }, msUntilEndOfDay);

    console.log(`[SmartTriggerManager] End of day check scheduled in ${Math.round(msUntilEndOfDay / 60000)} minutes`);
  }

  private handleEndOfDay(): void {
    // Only trigger if user is still active
    const idleMinutes = (Date.now() - this.lastActivityTime) / 60000;
    if (idleMinutes < 30) {
      this.emitTrigger({
        type: 'end_of_day',
        timestamp: Date.now(),
        context: this.buildTriggerContext(),
        priority: 'medium',
        metadata: {
          hour: new Date().getHours(),
        }
      });
    }
  }

  // ===========================================================================
  // Return from Idle Detection
  // ===========================================================================

  detectReturnFromIdle(previousIdleMs: number): void {
    // Called when user becomes active after being idle
    if (previousIdleMs > 5 * 60 * 1000) { // Was idle for more than 5 minutes
      this.emitTrigger({
        type: 'return_from_idle',
        timestamp: Date.now(),
        context: this.buildTriggerContext(),
        priority: 'low',
        metadata: {
          idleDurationMinutes: Math.round(previousIdleMs / 60000),
        }
      });
    }
  }

  // ===========================================================================
  // Trigger Emission with Rate Limiting
  // ===========================================================================

  private emitTrigger(event: TriggerEvent): void {
    // Check rate limiting
    this.checkHourlyReset();

    if (this.triggersThisHour >= this.config.maxTriggersPerHour) {
      log.debug('[SmartTriggerManager] Hourly trigger limit reached, skipping');
      return;
    }

    // Check cooldown
    const timeSinceLastTrigger = Date.now() - this.lastTriggerTime;
    if (timeSinceLastTrigger < this.config.cooldownBetweenTriggersMs) {
      log.debug('[SmartTriggerManager] Trigger cooldown active, skipping');
      return;
    }

    // Emit the trigger
    this.lastTriggerTime = Date.now();
    this.triggersThisHour++;

    console.log(`[SmartTriggerManager] Emitting trigger: ${event.type} (priority: ${event.priority})`);
    this.emit('trigger', event);
  }

  private checkHourlyReset(): void {
    const now = Date.now();
    if (now - this.hourResetTime > 60 * 60 * 1000) {
      this.triggersThisHour = 0;
      this.hourResetTime = now;
    }
  }

  // ===========================================================================
  // Context Building
  // ===========================================================================

  private buildTriggerContext(): TriggerContext {
    const sessionDuration = (Date.now() - this.sessionStartTime) / 60000; // minutes
    const idleDuration = (Date.now() - this.lastActivityTime) / 1000; // seconds

    return {
      previousApplication: this.lastApplication || undefined,
      currentApplication: this.lastContext?.activeWindow?.application,
      previousProject: this.lastProject || undefined,
      currentProject: this.inferProjectFromContext(this.lastContext || { timestamp: Date.now() }) || undefined,
      sessionDuration: Math.round(sessionDuration),
      idleDuration: Math.round(idleDuration),
      moodIndicators: this.inferMoodIndicators(),
    };
  }

  private inferMoodIndicators(): MoodIndicator[] {
    const indicators: MoodIndicator[] = [];
    const sessionMinutes = (Date.now() - this.sessionStartTime) / 60000;
    const idleSeconds = (Date.now() - this.lastActivityTime) / 1000;

    // Long session = focused or possibly stuck
    if (sessionMinutes > 120) {
      indicators.push('focused');
    }

    // Short bursts of activity = might be stuck or frustrated
    if (this.recentApplications.length > 10) {
      const uniqueApps = new Set(this.recentApplications.map(a => a.app));
      if (uniqueApps.size > 5) {
        indicators.push('exploring');
      }
    }

    // Check for late night work
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      indicators.push('rushing');
    }

    // Low activity periods
    if (idleSeconds > 60 && idleSeconds < 300) {
      indicators.push('relaxed');
    }

    return indicators;
  }

  // ===========================================================================
  // Status
  // ===========================================================================

  getStatus(): {
    isRunning: boolean;
    sessionDuration: number;
    triggersThisHour: number;
    lastTriggerTime: number;
    config: SmartTriggerConfig;
  } {
    return {
      isRunning: this.isRunning,
      sessionDuration: Math.round((Date.now() - this.sessionStartTime) / 60000),
      triggersThisHour: this.triggersThisHour,
      lastTriggerTime: this.lastTriggerTime,
      config: this.config,
    };
  }

  // Manual trigger for testing
  triggerManually(type: TriggerType): void {
    this.emitTrigger({
      type,
      timestamp: Date.now(),
      context: this.buildTriggerContext(),
      priority: 'medium',
      metadata: { manual: true },
    });
  }
}

export default SmartTriggerManager;
