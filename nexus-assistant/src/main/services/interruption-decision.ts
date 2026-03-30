// =============================================================================
// NEXUS - Interruption Decision Engine
// Decides WHEN and HOW to interrupt the user based on multiple factors:
// - User need (stuck, errors, repeated patterns)
// - Breakpoint quality (app switch, idle, micro-task completion)
// - Value assessment (relevance, criticality)
// - Fatigue (recent interruptions, acceptance rate)
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { UserMemoryStore, getUserMemoryStore } from './user-memory-store';
import { SystemContext, IntentAnalysis, DetectedIntent } from '../../shared/types';

// =============================================================================
// Interruption Types
// =============================================================================

export type InterruptionTriggerType =
  | 'struggle_detected'     // User appears stuck
  | 'error_pattern'         // Multiple errors detected
  | 'activity_stop'         // Sudden stop after high activity
  | 'repeated_search'       // Searching for same thing
  | 'context_switch'        // User switched apps/projects
  | 'idle_window'           // User has been idle
  | 'micro_task_complete'   // Just finished a small task
  | 'scheduled'             // Time-based check
  | 'insight_available'     // New insight to share
  | 'reminder';             // Scheduled reminder

export type InterruptionTiming = 'now' | 'wait_breakpoint' | 'later';
export type InterruptionMode = 'indicator' | 'toast' | 'drawer' | 'popup';
export type InterruptionPriority = 'low' | 'medium' | 'high' | 'critical';

export interface InterruptionTrigger {
  type: InterruptionTriggerType;
  data: Record<string, unknown>;
  priority: InterruptionPriority;
  timestamp: number;
}

export interface InterruptionDecision {
  shouldInterrupt: boolean;
  timing: InterruptionTiming;
  mode: InterruptionMode;
  priority: InterruptionPriority;
  reason: string;
  content?: {
    title?: string;
    message?: string;
    actions?: string[];
  };
  scores: {
    needScore: number;
    breakpointScore: number;
    valueScore: number;
    fatigueScore: number;
    finalScore: number;
  };
  deferUntil?: number;
}

export interface InterruptionContext {
  // Current state
  currentApp: string | null;
  currentWindowTitle: string | null;
  currentProject: string | null;
  
  // Intent analysis
  currentIntent: DetectedIntent | null;
  isStruggling: boolean;
  struggleSeverity: 'mild' | 'moderate' | 'severe' | null;
  
  // Activity patterns
  idleSeconds: number;
  sessionDurationMinutes: number;
  recentAppSwitches: number;
  recentErrors: number;
  
  // Time context
  timestamp: number;
  hourOfDay: number;
  isQuietHours: boolean;
  
  // Trigger info
  trigger: InterruptionTrigger;
}

export interface InterruptionHistoryEntry {
  timestamp: number;
  trigger: InterruptionTrigger;
  decision: InterruptionDecision;
  outcome?: 'accepted' | 'dismissed' | 'snoozed' | 'ignored';
}

// =============================================================================
// Configuration
// =============================================================================

export interface InterruptionDecisionConfig {
  enabled: boolean;
  
  // Need thresholds
  struggleSeverityWeights: {
    mild: number;
    moderate: number;
    severe: number;
  };
  errorCountThreshold: number;
  repeatedSearchThreshold: number;
  activityStopThresholdSeconds: number;
  
  // Breakpoint thresholds
  goodIdleWindowMinSeconds: number;
  goodIdleWindowMaxSeconds: number;
  appSwitchWindowMs: number;
  deepFocusMinMinutes: number;
  
  // Value thresholds
  minRelevanceScore: number;
  criticalErrorBoost: number;
  previousHelpBoost: number;
  
  // Fatigue thresholds
  minInterruptionGapMs: number;
  maxInterruptionsPerHour: number;
  maxInterruptionsPerSession: number;
  lowAcceptanceRatePenalty: number;
  
  // Decision thresholds
  minScoreToInterrupt: number;
  minScoreForImmediate: number;
  minScoreForDrawer: number;
  minScoreForPopup: number;
}

export const DEFAULT_INTERRUPTION_CONFIG: InterruptionDecisionConfig = {
  enabled: true,
  
  // Need thresholds
  struggleSeverityWeights: {
    mild: 0.3,
    moderate: 0.6,
    severe: 0.9,
  },
  errorCountThreshold: 3,
  repeatedSearchThreshold: 3,
  activityStopThresholdSeconds: 120,
  
  // Breakpoint thresholds
  goodIdleWindowMinSeconds: 10,
  goodIdleWindowMaxSeconds: 60,
  appSwitchWindowMs: 5000,
  deepFocusMinMinutes: 30,
  
  // Value thresholds
  minRelevanceScore: 0.5,
  criticalErrorBoost: 0.3,
  previousHelpBoost: 0.2,
  
  // Fatigue thresholds
  minInterruptionGapMs: 120000, // 2 minutes minimum between interruptions
  maxInterruptionsPerHour: 6,
  maxInterruptionsPerSession: 20,
  lowAcceptanceRatePenalty: 0.3,
  
  // Decision thresholds
  minScoreToInterrupt: 0.4,
  minScoreForImmediate: 0.7,
  minScoreForDrawer: 0.5,
  minScoreForPopup: 0.8,
};

// =============================================================================
// Interruption Decision Engine
// =============================================================================

export class InterruptionDecisionEngine extends EventEmitter {
  private config: InterruptionDecisionConfig;
  private userMemoryStore: UserMemoryStore | null = null;
  
  // State tracking
  private interruptionHistory: InterruptionHistoryEntry[] = [];
  private sessionStartTime: number = Date.now();
  private lastInterruptionTime: number = 0;
  private interruptionsThisHour: number = 0;
  private interruptionsThisSession: number = 0;
  private hourResetTime: number = Date.now();
  
  // Context tracking for patterns
  private lastAppSwitchTime: number = 0;
  private lastActivityTime: number = Date.now();
  private recentDecisions: InterruptionDecision[] = [];
  private pendingTriggers: InterruptionTrigger[] = [];

  constructor(config?: Partial<InterruptionDecisionConfig>) {
    super();
    this.config = { ...DEFAULT_INTERRUPTION_CONFIG, ...config };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  initialize(deps?: {
    userMemoryStore?: UserMemoryStore;
  }): void {
    this.userMemoryStore = deps?.userMemoryStore || getUserMemoryStore();
    log.info('[InterruptionDecision] Initialized');
  }

  // ===========================================================================
  // Main Evaluation Method
  // ===========================================================================

  evaluate(
    context: InterruptionContext
  ): InterruptionDecision {
    log.debug('[InterruptionDecision] Evaluating trigger:', context.trigger.type);
    
    // Reset hourly counter if needed
    this.checkHourlyReset();
    
    // Calculate individual scores
    const needScore = this.scoreUserNeed(context);
    const breakpointScore = this.scoreBreakpoint(context);
    const valueScore = this.scoreValue(context);
    const fatigueScore = this.scoreFatigue(context);
    
    // Calculate final score with weighted combination
    // Need and value are positive factors, fatigue is negative
    // Breakpoint acts as a multiplier for timing
    const baseScore = (needScore * 0.35) + (valueScore * 0.35) + (breakpointScore * 0.3);
    const fatigueAdjustedScore = baseScore * (1 - fatigueScore * 0.5);
    const finalScore = Math.max(0, Math.min(1, fatigueAdjustedScore));
    
    // Determine if we should interrupt
    const shouldInterrupt = this.shouldInterrupt(finalScore, context);
    
    // Determine timing
    const timing = this.determineTiming(finalScore, breakpointScore, context);
    
    // Determine mode based on priority and score
    const mode = this.determineMode(finalScore, context);
    
    // Build decision
    const decision: InterruptionDecision = {
      shouldInterrupt,
      timing,
      mode,
      priority: this.adjustPriority(context.trigger.priority, finalScore),
      reason: this.buildReason(context, { needScore, breakpointScore, valueScore, fatigueScore }),
      scores: {
        needScore,
        breakpointScore,
        valueScore,
        fatigueScore,
        finalScore,
      },
    };
    
    // Calculate defer time if not interrupting now
    if (shouldInterrupt && timing !== 'now') {
      decision.deferUntil = this.calculateDeferTime(timing, context);
    }
    
    // Record the decision
    this.recordDecision(context.trigger, decision);
    
    log.debug('[InterruptionDecision] Decision:', {
      shouldInterrupt,
      timing,
      mode,
      scores: decision.scores,
      reason: decision.reason,
    });
    
    return decision;
  }

  // ===========================================================================
  // User Need Scoring
  // ===========================================================================

  private scoreUserNeed(context: InterruptionContext): number {
    let score = 0;
    const indicators: string[] = [];
    
    // Factor 1: Is user stuck?
    if (context.isStruggling && context.struggleSeverity) {
      const struggleWeight = this.config.struggleSeverityWeights[context.struggleSeverity];
      score += struggleWeight;
      indicators.push(`struggling_${context.struggleSeverity}`);
    }
    
    // Factor 2: Multiple errors detected
    if (context.recentErrors >= this.config.errorCountThreshold) {
      const errorScore = Math.min(0.4, context.recentErrors * 0.1);
      score += errorScore;
      indicators.push(`errors_${context.recentErrors}`);
    }
    
    // Factor 3: Sudden stop after high activity
    if (context.trigger.type === 'activity_stop') {
      const stopDuration = context.trigger.data.stopDurationSeconds as number || 0;
      if (stopDuration >= this.config.activityStopThresholdSeconds) {
        score += 0.3;
        indicators.push('activity_stop');
      }
    }
    
    // Factor 4: Repeated searches
    if (context.trigger.type === 'repeated_search') {
      const searchCount = context.trigger.data.count as number || 0;
      if (searchCount >= this.config.repeatedSearchThreshold) {
        score += 0.35;
        indicators.push(`repeated_search_${searchCount}`);
      }
    }
    
    // Factor 5: Long session without progress (inferred from struggling + time)
    if (context.sessionDurationMinutes > 60 && context.isStruggling) {
      score += 0.15;
      indicators.push('long_session_struggling');
    }
    
    // Factor 6: Same context for too long
    const sameContextTooLong = context.trigger.data.sameContextMinutes as number || 0;
    if (sameContextTooLong > 20 && context.recentErrors > 0) {
      score += 0.2;
      indicators.push('stuck_same_context');
    }
    
    log.debug('[InterruptionDecision] Need score:', { score, indicators });
    return Math.min(1, score);
  }

  // ===========================================================================
  // Breakpoint Scoring
  // ===========================================================================

  private scoreBreakpoint(context: InterruptionContext): number {
    let score = 0.5; // Start neutral
    const indicators: string[] = [];
    
    // Factor 1: User just switched apps (good time)
    const timeSinceAppSwitch = Date.now() - this.lastAppSwitchTime;
    if (context.trigger.type === 'context_switch' || timeSinceAppSwitch < this.config.appSwitchWindowMs) {
      score += 0.25;
      indicators.push('recent_app_switch');
    }
    
    // Factor 2: Idle window (sweet spot: 10-60 seconds)
    if (
      context.idleSeconds >= this.config.goodIdleWindowMinSeconds &&
      context.idleSeconds <= this.config.goodIdleWindowMaxSeconds
    ) {
      score += 0.3;
      indicators.push('good_idle_window');
    } else if (context.idleSeconds < this.config.goodIdleWindowMinSeconds) {
      // User is actively working - bad time
      score -= 0.3;
      indicators.push('actively_working');
    } else if (context.idleSeconds > this.config.goodIdleWindowMaxSeconds) {
      // User might be away or reading - neutral
      score -= 0.1;
      indicators.push('possibly_away');
    }
    
    // Factor 3: Deep focus detection (bad time)
    if (
      context.currentIntent?.type === 'coding' ||
      context.currentIntent?.type === 'writing'
    ) {
      const intentDuration = context.currentIntent.duration / 60000; // minutes
      if (intentDuration >= this.config.deepFocusMinMinutes) {
        score -= 0.4;
        indicators.push('deep_focus');
      }
    }
    
    // Factor 4: Micro-task completion (good time)
    if (context.trigger.type === 'micro_task_complete') {
      score += 0.35;
      indicators.push('micro_task_complete');
    }
    
    // Factor 5: Communication app active (bad time)
    const commApps = ['slack', 'teams', 'discord', 'zoom', 'meet'];
    if (context.currentApp && commApps.some(app => context.currentApp!.toLowerCase().includes(app))) {
      score -= 0.25;
      indicators.push('in_communication');
    }
    
    // Factor 6: Browser on video/entertainment (maybe not best time)
    const distractionPatterns = ['youtube', 'netflix', 'twitch', 'spotify'];
    if (context.currentWindowTitle) {
      const titleLower = context.currentWindowTitle.toLowerCase();
      if (distractionPatterns.some(p => titleLower.includes(p))) {
        score -= 0.15;
        indicators.push('entertainment_active');
      }
    }
    
    // Factor 7: Rapid app switching (user exploring, might be good time)
    if (context.recentAppSwitches > 5) {
      score += 0.15;
      indicators.push('exploring_apps');
    }
    
    log.debug('[InterruptionDecision] Breakpoint score:', { score, indicators });
    return Math.max(0, Math.min(1, score));
  }

  // ===========================================================================
  // Value Scoring
  // ===========================================================================

  private scoreValue(context: InterruptionContext): number {
    let score = 0.5; // Start neutral
    const indicators: string[] = [];
    const trigger = context.trigger;
    
    // Factor 1: Base relevance from trigger priority
    const priorityScores: Record<InterruptionPriority, number> = {
      low: 0.2,
      medium: 0.4,
      high: 0.7,
      critical: 1.0,
    };
    score = priorityScores[trigger.priority];
    indicators.push(`priority_${trigger.priority}`);
    
    // Factor 2: Critical error boost
    if (trigger.type === 'error_pattern') {
      const isCritical = trigger.data.isCritical as boolean;
      if (isCritical) {
        score += this.config.criticalErrorBoost;
        indicators.push('critical_error');
      }
    }
    
    // Factor 3: Have we helped with this before?
    if (trigger.data.previouslyHelped) {
      score += this.config.previousHelpBoost;
      indicators.push('previous_help_success');
    }
    
    // Factor 4: Context relevance
    if (trigger.data.relevanceScore) {
      const relevance = trigger.data.relevanceScore as number;
      if (relevance >= this.config.minRelevanceScore) {
        score += relevance * 0.2;
        indicators.push('relevant_context');
      } else {
        score -= 0.1;
        indicators.push('low_relevance');
      }
    }
    
    // Factor 5: User-requested topic
    const userContext = this.userMemoryStore?.getUserContext();
    if (userContext && trigger.data.topic) {
      const preferredTopics = userContext.preferredTopics || [];
      if (preferredTopics.includes(trigger.data.topic as string)) {
        score += 0.15;
        indicators.push('preferred_topic');
      }
    }
    
    // Factor 6: Struggle help is valuable
    if (context.isStruggling && trigger.type === 'struggle_detected') {
      score += 0.2;
      indicators.push('struggle_help');
    }
    
    // Factor 7: Reminder always has base value
    if (trigger.type === 'reminder') {
      score = Math.max(score, 0.6);
      indicators.push('reminder_base_value');
    }
    
    log.debug('[InterruptionDecision] Value score:', { score, indicators });
    return Math.min(1, score);
  }

  // ===========================================================================
  // Fatigue Scoring (higher = more fatigued = less likely to interrupt)
  // ===========================================================================

  private scoreFatigue(context: InterruptionContext): number {
    let score = 0;
    const indicators: string[] = [];
    
    // Factor 1: Time since last interruption
    const timeSinceLastMs = Date.now() - this.lastInterruptionTime;
    if (timeSinceLastMs < this.config.minInterruptionGapMs) {
      // Very recent interruption - high fatigue
      score += 0.5;
      indicators.push('very_recent_interruption');
    } else if (timeSinceLastMs < this.config.minInterruptionGapMs * 2) {
      score += 0.2;
      indicators.push('recent_interruption');
    }
    
    // Factor 2: Interruptions this hour
    const hourlyRatio = this.interruptionsThisHour / this.config.maxInterruptionsPerHour;
    if (hourlyRatio >= 1) {
      score += 0.4;
      indicators.push('hourly_limit_reached');
    } else if (hourlyRatio >= 0.7) {
      score += 0.2;
      indicators.push('hourly_limit_approaching');
    }
    
    // Factor 3: Interruptions this session
    const sessionRatio = this.interruptionsThisSession / this.config.maxInterruptionsPerSession;
    if (sessionRatio >= 1) {
      score += 0.3;
      indicators.push('session_limit_reached');
    } else if (sessionRatio >= 0.7) {
      score += 0.15;
      indicators.push('session_limit_approaching');
    }
    
    // Factor 4: User's acceptance rate
    const acceptanceRate = this.userMemoryStore?.getAcceptanceRate() ?? 0.5;
    if (acceptanceRate < 0.3) {
      score += this.config.lowAcceptanceRatePenalty;
      indicators.push('low_acceptance_rate');
    } else if (acceptanceRate > 0.7) {
      score -= 0.1; // User likes our suggestions
      indicators.push('high_acceptance_rate');
    }
    
    // Factor 5: Quiet hours
    if (context.isQuietHours) {
      score += 0.4;
      indicators.push('quiet_hours');
    }
    
    // Factor 6: Recent dismissals
    const recentDismissals = this.interruptionHistory
      .filter(h => Date.now() - h.timestamp < 30 * 60 * 1000) // Last 30 minutes
      .filter(h => h.outcome === 'dismissed')
      .length;
    if (recentDismissals >= 2) {
      score += 0.25;
      indicators.push('recent_dismissals');
    }
    
    // Factor 7: Late night / weekend modifier
    const hour = context.hourOfDay;
    if (hour >= 22 || hour < 7) {
      score += 0.15;
      indicators.push('late_hours');
    }
    
    log.debug('[InterruptionDecision] Fatigue score:', { score, indicators });
    return Math.min(1, Math.max(0, score));
  }

  // ===========================================================================
  // Decision Helpers
  // ===========================================================================

  private shouldInterrupt(finalScore: number, context: InterruptionContext): boolean {
    // Never interrupt if disabled
    if (!this.config.enabled) {
      return false;
    }
    
    // Critical triggers always interrupt (unless in quiet hours)
    if (context.trigger.priority === 'critical' && !context.isQuietHours) {
      return true;
    }
    
    // Check minimum score threshold
    if (finalScore < this.config.minScoreToInterrupt) {
      return false;
    }
    
    // Don't interrupt if hourly limit exceeded (unless critical)
    if (this.interruptionsThisHour >= this.config.maxInterruptionsPerHour) {
      log.debug('[InterruptionDecision] Hourly limit exceeded');
      return false;
    }
    
    return true;
  }

  private determineTiming(
    finalScore: number,
    breakpointScore: number,
    context: InterruptionContext
  ): InterruptionTiming {
    // Critical priority = now
    if (context.trigger.priority === 'critical') {
      return 'now';
    }
    
    // High final score with good breakpoint = now
    if (finalScore >= this.config.minScoreForImmediate && breakpointScore >= 0.5) {
      return 'now';
    }
    
    // Good score but bad breakpoint = wait for better time
    if (finalScore >= this.config.minScoreToInterrupt && breakpointScore < 0.4) {
      return 'wait_breakpoint';
    }
    
    // Medium score = wait for breakpoint
    if (finalScore >= this.config.minScoreToInterrupt) {
      return breakpointScore >= 0.5 ? 'now' : 'wait_breakpoint';
    }
    
    // Low score but still want to show = later
    return 'later';
  }

  private determineMode(
    finalScore: number,
    context: InterruptionContext
  ): InterruptionMode {
    // Critical = popup
    if (context.trigger.priority === 'critical') {
      return 'popup';
    }
    
    // High score = drawer or popup
    if (finalScore >= this.config.minScoreForPopup) {
      return 'popup';
    }
    
    if (finalScore >= this.config.minScoreForDrawer) {
      return 'drawer';
    }
    
    // Medium score = toast
    if (finalScore >= this.config.minScoreToInterrupt) {
      return 'toast';
    }
    
    // Low score = indicator only
    return 'indicator';
  }

  private adjustPriority(
    originalPriority: InterruptionPriority,
    finalScore: number
  ): InterruptionPriority {
    // Score can boost priority
    if (finalScore >= 0.8 && originalPriority !== 'critical') {
      return 'high';
    }
    
    // Score can reduce priority
    if (finalScore < 0.4 && originalPriority === 'high') {
      return 'medium';
    }
    
    return originalPriority;
  }

  private buildReason(
    context: InterruptionContext,
    scores: { needScore: number; breakpointScore: number; valueScore: number; fatigueScore: number }
  ): string {
    const reasons: string[] = [];
    
    if (scores.needScore >= 0.6) {
      if (context.isStruggling) {
        reasons.push('User appears stuck');
      } else if (context.recentErrors > 2) {
        reasons.push('Multiple errors detected');
      }
    }
    
    if (scores.breakpointScore >= 0.6) {
      reasons.push('Good time to interrupt');
    } else if (scores.breakpointScore < 0.4) {
      reasons.push('User is focused');
    }
    
    if (scores.valueScore >= 0.7) {
      reasons.push('High-value suggestion');
    }
    
    if (scores.fatigueScore >= 0.5) {
      reasons.push('User may be fatigued');
    }
    
    return reasons.length > 0 ? reasons.join('; ') : 'Standard evaluation';
  }

  private calculateDeferTime(timing: InterruptionTiming, context: InterruptionContext): number {
    if (timing === 'now') {
      return Date.now();
    }
    
    if (timing === 'wait_breakpoint') {
      // Wait for up to 2 minutes for a breakpoint
      return Date.now() + 2 * 60 * 1000;
    }
    
    // 'later' - wait 5-10 minutes
    return Date.now() + 5 * 60 * 1000;
  }

  // ===========================================================================
  // History & State Management
  // ===========================================================================

  private recordDecision(trigger: InterruptionTrigger, decision: InterruptionDecision): void {
    if (decision.shouldInterrupt && decision.timing === 'now') {
      this.lastInterruptionTime = Date.now();
      this.interruptionsThisHour++;
      this.interruptionsThisSession++;
    }
    
    this.interruptionHistory.push({
      timestamp: Date.now(),
      trigger,
      decision,
    });
    
    // Keep history manageable
    if (this.interruptionHistory.length > 100) {
      this.interruptionHistory = this.interruptionHistory.slice(-100);
    }
    
    // Track recent decisions
    this.recentDecisions.push(decision);
    if (this.recentDecisions.length > 20) {
      this.recentDecisions = this.recentDecisions.slice(-20);
    }
    
    this.emit('decision', { trigger, decision });
  }

  recordOutcome(
    triggerId: string | number,
    outcome: 'accepted' | 'dismissed' | 'snoozed' | 'ignored'
  ): void {
    // Find the most recent entry matching the trigger
    const entry = this.interruptionHistory
      .slice()
      .reverse()
      .find(h => h.trigger.timestamp === triggerId || h.timestamp === triggerId);
    
    if (entry) {
      entry.outcome = outcome;
      
      // Update user memory store with feedback
      if (this.userMemoryStore) {
        const action = outcome === 'accepted' ? 'accepted' : 
                       outcome === 'snoozed' ? 'snoozed' : 'dismissed';
        this.userMemoryStore.recordSuggestion(action);
      }
      
      this.emit('outcome', { entry, outcome });
      log.debug('[InterruptionDecision] Recorded outcome:', outcome);
    }
  }

  private checkHourlyReset(): void {
    const now = Date.now();
    if (now - this.hourResetTime > 60 * 60 * 1000) {
      this.interruptionsThisHour = 0;
      this.hourResetTime = now;
      log.debug('[InterruptionDecision] Hourly counter reset');
    }
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  onAppSwitch(): void {
    this.lastAppSwitchTime = Date.now();
  }

  onActivity(): void {
    this.lastActivityTime = Date.now();
  }

  // ===========================================================================
  // Pending Triggers
  // ===========================================================================

  addPendingTrigger(trigger: InterruptionTrigger): void {
    this.pendingTriggers.push(trigger);
    this.emit('pending-trigger', trigger);
  }

  getPendingTriggers(): InterruptionTrigger[] {
    return [...this.pendingTriggers];
  }

  clearPendingTrigger(timestamp: number): void {
    this.pendingTriggers = this.pendingTriggers.filter(t => t.timestamp !== timestamp);
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  updateConfig(config: Partial<InterruptionDecisionConfig>): void {
    this.config = { ...this.config, ...config };
    log.debug('[InterruptionDecision] Config updated:', this.config);
  }

  getConfig(): InterruptionDecisionConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // Status & History
  // ===========================================================================

  getStatus(): {
    enabled: boolean;
    interruptionsThisHour: number;
    interruptionsThisSession: number;
    lastInterruptionTime: number;
    pendingTriggers: number;
    recentAcceptanceRate: number;
  } {
    const recentWithOutcomes = this.interruptionHistory
      .filter(h => h.outcome && Date.now() - h.timestamp < 60 * 60 * 1000);
    const accepted = recentWithOutcomes.filter(h => h.outcome === 'accepted').length;
    const total = recentWithOutcomes.length;
    
    return {
      enabled: this.config.enabled,
      interruptionsThisHour: this.interruptionsThisHour,
      interruptionsThisSession: this.interruptionsThisSession,
      lastInterruptionTime: this.lastInterruptionTime,
      pendingTriggers: this.pendingTriggers.length,
      recentAcceptanceRate: total > 0 ? accepted / total : 0.5,
    };
  }

  getHistory(limit: number = 20): InterruptionHistoryEntry[] {
    return this.interruptionHistory.slice(-limit);
  }

  resetSession(): void {
    this.sessionStartTime = Date.now();
    this.interruptionsThisSession = 0;
    this.pendingTriggers = [];
    log.info('[InterruptionDecision] Session reset');
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let engineInstance: InterruptionDecisionEngine | null = null;

export function getInterruptionDecisionEngine(): InterruptionDecisionEngine {
  if (!engineInstance) {
    engineInstance = new InterruptionDecisionEngine();
  }
  return engineInstance;
}

export default InterruptionDecisionEngine;
