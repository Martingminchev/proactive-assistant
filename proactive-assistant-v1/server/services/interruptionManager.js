const DismissedSuggestion = require('../models/DismissedSuggestion');
const Settings = require('../models/Settings');

/**
 * Smart Interruption Manager
 * 
 * Decides WHEN and HOW to interrupt the user based on their activity.
 * Implements intelligent flow state detection and anti-annoyance rules.
 * 
 * INTERRUPTION LEVELS:
 * - 1 (whisper): Subtle, non-intrusive notifications
 * - 2 (nudge): Gentle popup, can be ignored
 * - 3 (tap): Noticeable notification requiring acknowledgment
 * - 4 (emergency): Critical alert, interrupts immediately
 * 
 * FLOW STATES:
 * - deep_flow: User is in zone, typing steadily for 5+ min - DON'T interrupt
 * - working: Active but not in deep flow - can interrupt with level 1-2
 * - idle: Not actively working - can interrupt with level 1-3
 * - stuck: On error for 20min + high backspace - interrupt with help (level 2-3)
 * - frustrated: High error rate, rapid tab switching - interrupt with level 2-3
 */
class InterruptionManager {
  constructor() {
    // 30-minute rule: max 1 proactive suggestion per 30 min
    this.MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
    
    // State tracking
    this.lastInterruptionTime = null;
    this.interruptionHistory = []; // Track recent interruptions
    this.userActivityBuffer = []; // Recent activity signals
    this.maxBufferSize = 100;
    
    // Thresholds for flow state detection
    this.thresholds = {
      deepFlow: {
        minTypingDuration: 5 * 60 * 1000, // 5 minutes steady typing
        minTypingVelocity: 30, // chars per minute
        maxBackspaceRatio: 0.1 // 10% backspace ratio
      },
      stuck: {
        minErrorDuration: 20 * 60 * 1000, // 20 minutes on error
        minBackspaceRatio: 0.3, // 30% backspace ratio
        maxTypingVelocity: 10 // Very slow typing
      },
      frustrated: {
        minTabSwitchRate: 5, // switches per minute
        maxErrorFrequency: 3, // errors per minute
        velocityDropThreshold: 0.5 // 50% drop from baseline
      },
      idle: {
        maxActivityMs: 60 * 1000 // 1 minute of no activity
      }
    };
    
    // Baseline typing velocity (learned over time)
    this.baselineVelocity = null;
    this.velocitySamples = [];
    this.maxVelocitySamples = 50;
  }

  /**
   * Core method: Decide if we should interrupt the user
   * 
   * @param {Object} userContext - Current user context
   * @param {Object} userContext.signals - Activity signals
   * @param {Object} userContext.suggestion - Suggestion to potentially show
   * @param {String} userContext.userId - User identifier
   * @returns {Object} { should: boolean, level: 1-4, reason: string }
   */
  async shouldInterrupt(userContext) {
    const { signals = {}, suggestion, userId = 'default' } = userContext;
    
    console.log('🧠 InterruptionManager: Evaluating interruption...');
    
    // Step 1: Check anti-annoyance rules first
    const antiAnnoyanceCheck = await this.checkAntiAnnoyanceRules(userId, suggestion);
    if (!antiAnnoyanceCheck.allowed) {
      console.log(`⛔ Interruption blocked: ${antiAnnoyanceCheck.reason}`);
      return {
        should: false,
        level: 0,
        reason: antiAnnoyanceCheck.reason
      };
    }
    
    // Step 2: Calculate flow state
    const flowState = this.calculateFlowState(signals);
    console.log(`  Flow state detected: ${flowState}`);
    
    // Step 3: Determine interruption level based on flow state and context
    const level = this.getInterruptionLevel(flowState, userContext);
    console.log(`  Suggested interruption level: ${level}`);
    
    // Step 4: Check if suggestion type is appropriate for the flow state
    const appropriateness = this.checkSuggestionAppropriateness(suggestion, flowState, level);
    if (!appropriateness.appropriate) {
      console.log(`⛔ Interruption blocked: ${appropriateness.reason}`);
      return {
        should: false,
        level: 0,
        reason: appropriateness.reason,
        flowState
      };
    }
    
    // Step 5: Check if this specific suggestion has been dismissed too many times
    if (suggestion) {
      const isBlacklisted = await DismissedSuggestion.isBlacklisted(suggestion, userId);
      if (isBlacklisted) {
        console.log(`⛔ Interruption blocked: Suggestion blacklisted (3 strikes)`);
        return {
          should: false,
          level: 0,
          reason: 'Suggestion type blacklisted due to multiple dismissals',
          flowState
        };
      }
    }
    
    // Step 6: Final decision
    const shouldInterrupt = this.makeFinalDecision(flowState, level, signals);
    
    const result = {
      should: shouldInterrupt,
      level: shouldInterrupt ? level : 0,
      reason: shouldInterrupt ? 'Interruption approved' : 'User in protected flow state',
      flowState
    };
    
    if (shouldInterrupt) {
      this.recordInterruption(userContext, result);
    }
    
    console.log(`  Decision: ${shouldInterrupt ? '✅ INTERRUPT' : '❌ WAIT'} (level ${result.level})`);
    
    return result;
  }

  /**
   * Calculate the user's current flow state based on activity signals
   * 
   * @param {Object} signals - Activity signals
   * @param {Number} signals.timeOnCurrentTask - Time in ms on current task
   * @param {Number} signals.errorFrequency - Errors per minute
   * @param {Number} signals.backspaceRatio - Ratio of backspaces to keystrokes (0-1)
   * @param {Number} signals.typingVelocity - Current typing velocity (chars/min)
   * @param {Number} signals.tabSwitchRate - Tab switches per minute
   * @param {Number} signals.idleTime - Time since last activity in ms
   * @param {Array} signals.recentKeystrokes - Array of keystroke timestamps
   * @returns {String} Flow state: 'deep_flow' | 'working' | 'idle' | 'stuck' | 'frustrated'
   */
  calculateFlowState(signals) {
    const {
      timeOnCurrentTask = 0,
      errorFrequency = 0,
      backspaceRatio = 0,
      typingVelocity = 0,
      tabSwitchRate = 0,
      idleTime = 0,
      recentKeystrokes = []
    } = signals;
    
    // Update velocity baseline for learning
    this.updateBaselineVelocity(typingVelocity);
    
    // Store in buffer for pattern analysis
    this.userActivityBuffer.push({
      timestamp: Date.now(),
      signals: { ...signals }
    });
    if (this.userActivityBuffer.length > this.maxBufferSize) {
      this.userActivityBuffer.shift();
    }
    
    // Check for idle state first
    if (idleTime > this.thresholds.idle.maxActivityMs) {
      return 'idle';
    }
    
    // Check for frustrated state (high tab switching + errors)
    if (tabSwitchRate >= this.thresholds.frustrated.minTabSwitchRate &&
        errorFrequency >= this.thresholds.frustrated.maxErrorFrequency) {
      return 'frustrated';
    }
    
    // Check for frustrated state (velocity drop)
    const velocityDrop = this.baselineVelocity 
      ? (this.baselineVelocity - typingVelocity) / this.baselineVelocity 
      : 0;
    if (velocityDrop >= this.thresholds.frustrated.velocityDropThreshold && 
        backspaceRatio > this.thresholds.deepFlow.maxBackspaceRatio) {
      return 'frustrated';
    }
    
    // Check for stuck state (long time on error + high backspace)
    if (timeOnCurrentTask >= this.thresholds.stuck.minErrorDuration &&
        backspaceRatio >= this.thresholds.stuck.minBackspaceRatio &&
        typingVelocity <= this.thresholds.stuck.maxTypingVelocity) {
      return 'stuck';
    }
    
    // Check for deep flow state
    const steadyTypingDuration = this.calculateSteadyTypingDuration(recentKeystrokes);
    if (steadyTypingDuration >= this.thresholds.deepFlow.minTypingDuration &&
        typingVelocity >= this.thresholds.deepFlow.minTypingVelocity &&
        backspaceRatio <= this.thresholds.deepFlow.maxBackspaceRatio &&
        tabSwitchRate < 2) { // Low tab switching indicates focus
      return 'deep_flow';
    }
    
    // Default to working state
    return 'working';
  }

  /**
   * Get the appropriate interruption level based on flow state and context
   * 
   * @param {String} flowState - Current flow state
   * @param {Object} context - Additional context
   * @param {Object} context.suggestion - Suggestion to show
   * @param {Number} context.suggestion.priority - Suggestion priority (1-10)
   * @param {String} context.suggestion.type - Suggestion type
   * @returns {Number} Interruption level: 1-4
   */
  getInterruptionLevel(flowState, context = {}) {
    const { suggestion = {} } = context;
    const priority = suggestion.priority || 5;
    const type = suggestion.type || 'tip';
    
    // Base level by flow state
    const baseLevels = {
      deep_flow: 0,     // No interruption
      working: 1,       // Whisper only
      idle: 2,          // Nudge acceptable
      stuck: 3,         // Tap (they need help)
      frustrated: 3     // Tap (they need help)
    };
    
    let level = baseLevels[flowState] || 1;
    
    // Adjust based on suggestion priority
    if (priority >= 9) level += 1;      // High priority can bump up one level
    if (priority >= 10) level += 1;     // Critical can bump up two levels
    if (priority <= 3) level -= 1;      // Low priority can drop down
    
    // Adjust based on suggestion type
    const typeModifiers = {
      warning: 1,      // Warnings are important
      action: 0,       // Actions are neutral
      insight: 0,      // Insights are neutral
      tip: -1,         // Tips can be more subtle
      reminder: 0      // Reminders are neutral
    };
    level += (typeModifiers[type] || 0);
    
    // Clamp to valid range
    level = Math.max(1, Math.min(4, level));
    
    // Never interrupt deep flow unless emergency
    if (flowState === 'deep_flow' && priority < 10) {
      level = 0;
    }
    
    return level;
  }

  /**
   * Check if the suggestion is appropriate for the current state
   */
  checkSuggestionAppropriateness(suggestion, flowState, level) {
    if (!suggestion) {
      return { appropriate: true };
    }
    
    const { category, type } = suggestion;
    
    // Don't show health tips during deep flow
    if (flowState === 'deep_flow' && category === 'health') {
      return {
        appropriate: false,
        reason: 'Health tips blocked during deep flow state'
      };
    }
    
    // Don't show learning tips when stuck (they need solutions)
    if (flowState === 'stuck' && category === 'learning') {
      return {
        appropriate: false,
        reason: 'Learning tips inappropriate when user is stuck'
      };
    }
    
    // Don't show productivity tips when frustrated
    if (flowState === 'frustrated' && category === 'productivity') {
      return {
        appropriate: false,
        reason: 'Productivity tips may worsen frustration'
      };
    }
    
    // Warnings are always appropriate
    if (type === 'warning') {
      return { appropriate: true };
    }
    
    return { appropriate: true };
  }

  /**
   * Check anti-annoyance rules
   * - 30-minute rule: Max 1 proactive suggestion per 30 min
   * - 3-strike rule: Handled via DismissedSuggestion model
   * - Focus mode: Complete suppression
   */
  async checkAntiAnnoyanceRules(userId = 'default', suggestion) {
    // Check focus mode
    const settings = await Settings.getSettings();
    if (settings.focusMode) {
      return {
        allowed: false,
        reason: 'Focus mode is enabled'
      };
    }
    
    // Check 30-minute rule
    if (this.lastInterruptionTime) {
      const timeSinceLast = Date.now() - this.lastInterruptionTime;
      if (timeSinceLast < this.MIN_INTERVAL_MS) {
        const minutesLeft = Math.ceil((this.MIN_INTERVAL_MS - timeSinceLast) / 60000);
        return {
          allowed: false,
          reason: `30-minute rule: ${minutesLeft} minutes remaining`
        };
      }
    }
    
    // Check if suggestion is blacklisted
    if (suggestion) {
      const isBlacklisted = await DismissedSuggestion.isBlacklisted(suggestion, userId);
      if (isBlacklisted) {
        return {
          allowed: false,
          reason: 'Suggestion type has been dismissed 3+ times today'
        };
      }
    }
    
    // Check daily interruption limit (max 10 per day)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayInterruptions = this.interruptionHistory.filter(
      i => i.timestamp >= todayStart.getTime()
    );
    if (todayInterruptions.length >= 10) {
      return {
        allowed: false,
        reason: 'Daily interruption limit reached (10)'
      };
    }
    
    return { allowed: true };
  }

  /**
   * Record a dismissal for learning (3-strike rule)
   * 
   * @param {Object} suggestion - The dismissed suggestion
   * @param {String} userId - User identifier
   * @param {Object} context - Context at time of dismissal
   */
  async recordDismissal(suggestion, userId = 'default', context = {}) {
    console.log(`📝 Recording dismissal for suggestion: ${suggestion.title || 'unknown'}`);
    
    const dismissed = await DismissedSuggestion.recordDismissal(suggestion, {
      userId,
      ...context
    });
    
    console.log(`  Dismissal count: ${dismissed.dismissalCount}/3`);
    
    if (dismissed.dismissalCount >= 3) {
      console.log(`  ⚠️ Suggestion type blacklisted for the day`);
    }
    
    return dismissed;
  }

  /**
   * Make final decision on whether to interrupt
   */
  makeFinalDecision(flowState, level, signals) {
    // Never interrupt deep flow unless emergency
    if (flowState === 'deep_flow' && level < 4) {
      return false;
    }
    
    // Always help if stuck (but respect level)
    if (flowState === 'stuck' && level >= 2) {
      return true;
    }
    
    // Help if frustrated (but respect level)
    if (flowState === 'frustrated' && level >= 2) {
      return true;
    }
    
    // Interrupt if idle and we have something to show
    if (flowState === 'idle' && level >= 1) {
      return true;
    }
    
    // For working state, only interrupt at level 1
    if (flowState === 'working' && level === 1) {
      return true;
    }
    
    // Default: don't interrupt
    return false;
  }

  /**
   * Record an interruption for history tracking
   */
  recordInterruption(userContext, decision) {
    const now = Date.now();
    this.lastInterruptionTime = now;
    
    this.interruptionHistory.push({
      timestamp: now,
      suggestion: userContext.suggestion?.title || 'unknown',
      level: decision.level,
      flowState: decision.flowState
    });
    
    // Keep only last 100 interruptions
    if (this.interruptionHistory.length > 100) {
      this.interruptionHistory.shift();
    }
  }

  /**
   * Calculate how long the user has been typing steadily
   */
  calculateSteadyTypingDuration(recentKeystrokes) {
    if (!recentKeystrokes || recentKeystrokes.length < 2) {
      return 0;
    }
    
    const now = Date.now();
    const windowStart = now - 10 * 60 * 1000; // 10 minute window
    
    // Filter to recent keystrokes only
    const recent = recentKeystrokes.filter(k => k >= windowStart);
    
    if (recent.length < 10) {
      return 0;
    }
    
    // Calculate continuous typing duration
    // Look for gaps > 5 seconds to determine breaks
    let maxContinuous = 0;
    let currentContinuous = 0;
    let segmentStart = recent[0];
    
    for (let i = 1; i < recent.length; i++) {
      const gap = recent[i] - recent[i - 1];
      
      if (gap > 5000) { // 5 second gap = break
        const segmentDuration = recent[i - 1] - segmentStart;
        if (segmentDuration > maxContinuous) {
          maxContinuous = segmentDuration;
        }
        segmentStart = recent[i];
        currentContinuous = 0;
      } else {
        currentContinuous = recent[i] - segmentStart;
      }
    }
    
    // Check final segment
    if (currentContinuous > maxContinuous) {
      maxContinuous = currentContinuous;
    }
    
    return maxContinuous;
  }

  /**
   * Update baseline typing velocity for comparison
   */
  updateBaselineVelocity(currentVelocity) {
    if (currentVelocity <= 0) return;
    
    this.velocitySamples.push(currentVelocity);
    if (this.velocitySamples.length > this.maxVelocitySamples) {
      this.velocitySamples.shift();
    }
    
    // Calculate median velocity
    const sorted = [...this.velocitySamples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    this.baselineVelocity = sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Get current status for monitoring/debugging
   */
  getStatus() {
    const now = Date.now();
    const timeSinceLast = this.lastInterruptionTime 
      ? now - this.lastInterruptionTime 
      : null;
    
    return {
      lastInterruptionTime: this.lastInterruptionTime,
      timeSinceLastMs: timeSinceLast,
      timeSinceLastMin: timeSinceLast ? Math.floor(timeSinceLast / 60000) : null,
      nextInterruptionAvailable: timeSinceLast 
        ? new Date(this.lastInterruptionTime + this.MIN_INTERVAL_MS).toISOString()
        : 'now',
      interruptionCountToday: this.interruptionHistory.filter(
        i => i.timestamp >= new Date().setHours(0, 0, 0, 0)
      ).length,
      baselineVelocity: this.baselineVelocity,
      velocitySamples: this.velocitySamples.length,
      bufferSize: this.userActivityBuffer.length
    };
  }

  /**
   * Force reset the interruption timer (for testing or user override)
   */
  resetInterruptionTimer() {
    this.lastInterruptionTime = null;
    console.log('⏰ Interruption timer reset');
  }

  /**
   * Check if a specific suggestion should be shown now
   * Convenience method for the proactive job
   */
  async canShowSuggestion(suggestion, signals, userId = 'default') {
    const result = await this.shouldInterrupt({
      signals,
      suggestion,
      userId
    });
    
    return result;
  }

  /**
   * Get suggestions filtered by appropriateness for current state
   */
  async filterAppropriateSuggestions(suggestions, signals, userId = 'default') {
    const flowState = this.calculateFlowState(signals);
    const blacklistedHashes = await DismissedSuggestion.getBlacklistedHashes(userId);
    
    const filtered = [];
    
    for (const suggestion of suggestions) {
      // Skip blacklisted
      const hash = DismissedSuggestion.generateHash(suggestion);
      if (blacklistedHashes.includes(hash)) {
        continue;
      }
      
      // Check flow state appropriateness
      const level = this.getInterruptionLevel(flowState, { suggestion });
      const appropriateness = this.checkSuggestionAppropriateness(suggestion, flowState, level);
      
      if (appropriateness.appropriate) {
        filtered.push({
          ...suggestion,
          _interruptionLevel: level,
          _flowState: flowState
        });
      }
    }
    
    return filtered;
  }

  /**
   * Enable focus mode (suppress all interruptions)
   */
  async enableFocusMode() {
    await Settings.updateSettings({ focusMode: true });
    console.log('🔒 Focus mode enabled - all interruptions suppressed');
  }

  /**
   * Disable focus mode
   */
  async disableFocusMode() {
    await Settings.updateSettings({ focusMode: false });
    console.log('🔓 Focus mode disabled');
  }

  /**
   * Check if focus mode is enabled
   */
  async isFocusModeEnabled() {
    const settings = await Settings.getSettings();
    return !!settings.focusMode;
  }
}

// Export singleton instance
module.exports = new InterruptionManager();
