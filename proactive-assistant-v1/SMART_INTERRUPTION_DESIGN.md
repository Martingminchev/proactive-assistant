# SMART INTERRUPTION SYSTEM
## A Practical Design for Context-Aware Proactive Assistance

---

## EXECUTIVE SUMMARY

This document defines a production-ready interruption system that balances proactivity with user experience. The system uses multi-signal flow state detection, tiered interruption severity, and robust anti-annoyance safeguards.

**Core Philosophy:** *Interrupt only when the value of interruption exceeds the cost of context switching.*

---

## 1. FLOW STATE DETECTION ENGINE

### 1.1 Signal Collection

The system monitors multiple signals continuously to build a "Flow State Score" (0-100, where 100 = deep flow, 0 = stuck/idle).

#### Signal Matrix

| Signal | Source | Weight | Measurement |
|--------|--------|--------|-------------|
| **Typing Velocity** | Keystroke hook | 20% | Chars/min with variance |
| **Error Rate** | IDE/Editor API | 15% | Errors/min + fix attempts |
| **Task Duration** | Activity tracker | 15% | Time on current context |
| **Tab/Window Switches** | OS API | 10% | Frequency of context switches |
| **Idle Time** | Input monitor | 10% | Seconds since last input |
| **Backspace Patterns** | Keystroke hook | 15% | Backspace ratio + bursts |
| **Scroll Patterns** | Mouse/Trackpad | 10% | Scroll velocity + direction changes |
| **Build/Test Failures** | Dev tool integration | 5% | Consecutive failures |

#### 1.1.1 Typing Velocity Patterns

```typescript
interface TypingPattern {
  charsPerMinute: number;
  variance: number;           // Lower = more consistent = flow
  burstCount: number;         // Short bursts vs sustained
  pauseFrequency: number;     // Pauses per minute
}

// Flow indicators:
// - 40-80 WPM sustained for >5 min
// - Low variance (<15%)
// - Few pauses (<2/min)

// Stuck indicators:
// - <10 WPM for >3 min
// - High variance (>50%)
// - Frequent pauses (>5/min)
```

#### 1.1.2 Error Frustration Detection

```typescript
interface ErrorPattern {
  errorsPerMinute: number;
  fixAttempts: number;        // Quick fixes = learning; No fixes = stuck
  sameErrorRepeated: boolean; // Same error >3 times = stuck
  errorDuration: number;      // How long error persists
}

// Stuck threshold: Same error for >5 minutes with >3 fix attempts
```

#### 1.1.3 Backspace Frustration Index

```typescript
interface BackspacePattern {
  ratio: number;              // Backspaces / total keystrokes
  burstSequences: number;     // 3+ backspaces in quick succession
  rageDeletes: number;        // 10+ backspaces in 2 seconds
}

// Frustration thresholds:
// - ratio > 0.30 for 2+ minutes
// - rageDeletes > 2 in 5 minutes
```

### 1.2 Flow State Calculation

```typescript
interface FlowState {
  score: number;              // 0-100
  confidence: number;         // 0-1, based on data quality
  state: 'deep_flow' | 'flow' | 'neutral' | 'struggling' | 'stuck' | 'idle';
  since: timestamp;
  signals: SignalSnapshot[];
}

// Flow State Score Formula
function calculateFlowState(signals: SignalSnapshot[]): FlowState {
  const weightedScore = signals.reduce((acc, s) => {
    return acc + (s.value * s.weight);
  }, 0);
  
  // Normalize to 0-100
  const normalized = Math.min(100, Math.max(0, weightedScore));
  
  // Determine state category
  let state: FlowState['state'];
  if (normalized >= 80) state = 'deep_flow';
  else if (normalized >= 60) state = 'flow';
  else if (normalized >= 40) state = 'neutral';
  else if (normalized >= 20) state = 'struggling';
  else if (normalized >= 5) state = 'stuck';
  else state = 'idle';
  
  return {
    score: normalized,
    confidence: calculateConfidence(signals),
    state,
    since: Date.now(),
    signals
  };
}
```

### 1.3 State Definitions & Interruption Policy

| State | Score Range | Interruption Policy | Rationale |
|-------|-------------|---------------------|-----------|
| **Deep Flow** | 80-100 | 🚫 NEVER interrupt | User is 5-10x more productive |
| **Flow** | 60-79 | ⚠️ Emergency only | Breaking flow has high cost |
| **Neutral** | 40-59 | ✅ Contextual allowed | Safe interruption window |
| **Struggling** | 20-39 | ✅ Proactive help OK | User needs assistance |
| **Stuck** | 5-19 | ✅ Interrupt encouraged | User is blocked |
| **Idle** | 0-4 | ✅ Gentle nudge OK | User may need re-engagement |

### 1.4 State Transition Detection

Key transition moments (opportunities for interruption):

```typescript
interface StateTransition {
  from: FlowState['state'];
  to: FlowState['state'];
  interruptionOpportunity: boolean;
  urgency: 'low' | 'medium' | 'high';
}

const OPPORTUNE_TRANSITIONS: StateTransition[] = [
  { from: 'deep_flow', to: 'flow', interruptionOpportunity: true, urgency: 'low' },
  { from: 'flow', to: 'neutral', interruptionOpportunity: true, urgency: 'low' },
  { from: 'struggling', to: 'stuck', interruptionOpportunity: true, urgency: 'high' },
  { from: 'deep_flow', to: 'idle', interruptionOpportunity: true, urgency: 'medium' },
  // BAD transitions (never interrupt):
  { from: 'neutral', to: 'flow', interruptionOpportunity: false, urgency: 'low' },
  { from: 'idle', to: 'flow', interruptionOpportunity: false, urgency: 'low' },
];
```

---

## 2. INTERRUPTION SEVERITY LEVELS

### 2.1 The Four Levels

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INTERRUPTION SEVERITY SCALE                       │
├─────────────┬─────────────┬─────────────┬───────────────────────────┤
│  LEVEL 1    │  LEVEL 2    │  LEVEL 3    │      LEVEL 4              │
│  WHISPER    │  NUDGE      │  TAP        │      EMERGENCY            │
├─────────────┼─────────────┼─────────────┼───────────────────────────┤
│  🌊 Subtle  │  🔔 Notice  │  ⛔ Block   │      🚨 FORCE             │
│  Ambient    │  Banner     │  Modal      │      System-level         │
│  Peripheral │  Dismissible│  Action req │      + Sound              │
└─────────────┴─────────────┴─────────────┴───────────────────────────┘
```

### 2.2 Level 1: Whisper (Ambient)

**Purpose:** Make user aware without breaking focus

**Visual Design:**
- Status bar icon pulse (subtle color shift)
- Tray icon badge (dot only)
- Minimal toast in corner (auto-dismiss 5s)
- Keyboard LED pulse (if supported)

**Trigger Conditions:**
```typescript
const WHISPER_TRIGGERS = {
  // User context
  flowState: ['neutral', 'idle'],
  
  // Suggestion importance
  suggestionPriority: ['low', 'medium'],
  
  // Time since last interruption: >10 min
  cooldownMet: true,
  
  // Not in focus mode / DND
  userAvailability: 'available',
  
  // Examples:
  // - "You have 3 new suggestions"
  // - "Task completed in background"
  // - "New relevant documentation available"
};
```

**Dismissal:** Auto-dismiss or click to acknowledge

### 2.3 Level 2: Nudge (Notification)

**Purpose:** Inform and offer assistance

**Visual Design:**
- Sliding notification banner (top-right)
- Shows preview + action buttons
- Dismiss (X) + "Don't show again" options
- Stays visible until dismissed or timeout (30s)

**Trigger Conditions:**
```typescript
const NUDGE_TRIGGERS = {
  flowState: ['struggling', 'neutral', 'idle'],
  suggestionPriority: ['medium', 'high'],
  cooldownMet: true,
  userAvailability: 'available',
  
  // Specific scenarios:
  scenarios: [
    'error_detected_same_file_5min',
    'stuck_on_task_10min',
    'repeated_failed_builds_3x',
    'meeting_starts_in_5min',
    'suggestion_matches_current_context'
  ]
};
```

**Dismissal:** User action required (click X or take action)

### 2.4 Level 3: Tap (Modal)

**Purpose:** Require user decision

**Visual Design:**
- Centered modal dialog
- Semi-transparent backdrop (dims rest of screen)
- Clear action buttons (primary + secondary)
- Esc to dismiss

**Trigger Conditions:**
```typescript
const TAP_TRIGGERS = {
  flowState: ['stuck', 'struggling'],  // Not deep_flow or flow
  suggestionPriority: ['high', 'critical'],
  cooldownMet: true,
  
  // Specific scenarios:
  scenarios: [
    'stuck_on_error_15min',
    'infinite_loop_detected',
    'security_vulnerability_found',
    'merge_conflict_blocks_commit',
    'critical_test_failure'
  ],
  
  // Requires explicit user permission for non-critical
  userPreferenceCheck: true
};
```

**Dismissal:** Explicit user action (button click)

### 2.5 Level 4: Emergency (Force)

**Purpose:** Critical issues requiring immediate attention

**Visual Design:**
- System notification (bypasses DND)
- Optional sound alert (respects accessibility)
- Flashing taskbar/dock icon
- Cannot be dismissed without viewing

**Trigger Conditions:**
```typescript
const EMERGENCY_TRIGGERS = {
  // Flow state ignored for true emergencies
  
  scenarios: [
    'security_breach_detected',
    'data_loss_imminent',
    'production_deployment_failure',
    'system_resource_exhaustion',
    'deadline_missed_with_dependencies'
  ],
  
  // Max 1 emergency per hour unless different category
  rateLimit: '1/hour per category',
  
  // Requires admin/override to enable
  requiresOptIn: true
};
```

### 2.6 Severity Decision Tree

```
                    ┌─────────────────┐
                    │  Issue Detected │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Critical/       │
                    │ Emergency?      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼ YES                         ▼ NO
    ┌─────────────────┐           ┌─────────────────┐
    │  LEVEL 4        │           │ Check Flow State│
    │  EMERGENCY      │           └────────┬────────┘
    └─────────────────┘                    │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                         Deep Flow     Struggling    Neutral/Idle
                              │            │            │
                              ▼            ▼            ▼
                    ┌──────────────┐ ┌──────────┐ ┌──────────┐
                    │ Queue for    │ │ LEVEL 2  │ │ Check    │
                    │ transition   │ │ or 3     │ │ Priority │
                    └──────────────┘ └──────────┘ └────┬─────┘
                                                       │
                                  ┌────────────────────┼────────────────────┐
                                  ▼                    ▼                    ▼
                             High Priority        Medium Priority      Low Priority
                                  │                    │                    │
                                  ▼                    ▼                    ▼
                            ┌──────────┐        ┌──────────┐        ┌──────────┐
                            │ LEVEL 3  │        │ LEVEL 2  │        │ LEVEL 1  │
                            │   TAP    │        │  NUDGE   │        │ WHISPER  │
                            └──────────┘        └──────────┘        └──────────┘
```

---

## 3. CONTEXTUAL INTELLIGENCE

### 3.1 Context Dimensions

```typescript
interface InterruptionContext {
  // Temporal Context
  time: {
    hour: number;                    // 0-23
    dayOfWeek: number;               // 0-6
    isWorkHours: boolean;            // Configurable
    timeSinceWorkdayStart: minutes;
    timeUntilWorkdayEnd: minutes;
  };
  
  // User Activity Context
  activity: {
    currentApp: string;
    currentFile: string;
    currentTask: string;
    taskDuration: minutes;
    recentApps: string[];            // Last 5
    recentFiles: string[];           // Last 10
  };
  
  // Calendar Context
  calendar: {
    nextEvent: CalendarEvent | null;
    timeUntilNextEvent: minutes;
    currentEvent: CalendarEvent | null;
    isInMeeting: boolean;
    focusTimeBlock: boolean;
  };
  
  // Historical Context
  history: {
    interruptionsToday: number;
    lastInterruptionTime: timestamp;
    timeSinceLastInterruption: minutes;
    dismissedSuggestions: string[];  // Track repeats
    acceptedSuggestions: string[];   // Learn preferences
    currentSessionDuration: minutes;
  };
  
  // System Context
  system: {
    cpuLoad: percentage;
    memoryPressure: boolean;
    batteryLevel: percentage;
    isOnBattery: boolean;
    screenLocked: boolean;
    screensaverActive: boolean;
  };
  
  // User Preference Context
  preferences: {
    interruptionMode: 'minimal' | 'balanced' | 'proactive';
    focusHours: TimeRange[];
    doNotDisturb: boolean;
    preferredChannels: string[];     // 'banner', 'sound', 'toast'
  };
}
```

### 3.2 Context Scoring

Each context factor contributes to an "Interruption Appropriateness Score" (0-100):

```typescript
function calculateContextScore(ctx: InterruptionContext): number {
  let score = 50; // Start neutral
  
  // Time adjustments
  if (ctx.time.isWorkHours) score += 10;
  if (ctx.time.hour < 8 || ctx.time.hour > 20) score -= 20; // Off hours
  if (ctx.time.timeUntilWorkdayEnd < 30) score -= 15; // End of day
  
  // Activity adjustments
  if (ctx.activity.currentApp === 'zoom' || 
      ctx.activity.currentApp === 'teams') score -= 40;
  if (ctx.activity.currentApp === 'vscode' && 
      ctx.activity.taskDuration > 60) score += 10; // Deep work
  
  // Calendar adjustments
  if (ctx.calendar.isInMeeting) score -= 50;
  if (ctx.calendar.focusTimeBlock) score -= 30;
  if (ctx.calendar.timeUntilNextEvent < 5) score -= 20; // About to switch
  if (ctx.calendar.timeUntilNextEvent > 5 && 
      ctx.calendar.timeUntilNextEvent < 15) score += 10; // Good window
  
  // History adjustments
  if (ctx.history.interruptionsToday > 10) score -= 20; // Fatigue
  if (ctx.history.timeSinceLastInterruption < 5) score -= 30; // Cooldown
  if (ctx.history.timeSinceLastInterruption > 30) score += 10; // Fresh
  
  // System adjustments
  if (ctx.system.screenLocked) score -= 100; // Can't interrupt
  if (ctx.system.memoryPressure) score -= 10; // System stressed
  
  return Math.max(0, Math.min(100, score));
}
```

### 3.3 Smart Cooldown System

```typescript
interface CooldownRules {
  // Base cooldowns by level
  baseCooldowns: {
    whisper: 5;      // minutes
    nudge: 15;       // minutes
    tap: 30;         // minutes
    emergency: 60;   // minutes
  };
  
  // Multipliers based on context
  multipliers: {
    afterDeepFlow: 2.0,        // Double cooldown after flow state
    afterDismissed: 1.5,       // 1.5x if last was dismissed
    afterAccepted: 0.5,        // Half cooldown if last was accepted
    duringWorkHours: 1.0,
    outsideWorkHours: 3.0,
  };
}

function calculateCooldown(
  level: InterruptionLevel,
  context: InterruptionContext,
  lastInterruption: InterruptionRecord
): minutes {
  let cooldown = COOLDOWNS.base[level];
  
  // Apply multipliers
  if (lastInterruption.wasDismissed) cooldown *= 1.5;
  if (lastInterruption.wasAccepted) cooldown *= 0.5;
  if (context.time.isWorkHours) cooldown *= 1.0;
  else cooldown *= 3.0;
  
  // Cap maximum
  return Math.min(cooldown, 120); // Max 2 hour cooldown
}
```

---

## 4. THE INTERRUPTION FLOW

### 4.1 Complete Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTERRUPTION LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────────────────┘

  DETECTION          EVALUATION           DELIVERY            FEEDBACK
     │                  │                   │                  │
     ▼                  ▼                   ▼                  ▼
┌─────────┐      ┌─────────────┐      ┌──────────┐      ┌─────────────┐
│ Signal  │      │ Flow State  │      │ Channel  │      │ Track       │
│ Monitor │─────▶│ Assessment  │─────▶│ Selector │─────▶│ Response    │
│         │      │             │      │          │      │             │
└─────────┘      └─────────────┘      └──────────┘      └─────────────┘
     │                  │                   │                  │
     ▼                  ▼                   ▼                  ▼
┌─────────┐      ┌─────────────┐      ┌──────────┐      ┌─────────────┐
• Keystrokes     • Score calc    • Level 1-4     • Dismissed?   
• Errors         • Confidence    • Channel       • Accepted?
• Duration       • Context score   priority      • Ignored?
• App switches   • Cooldown      • Timing        • Time to
• Idle time        check           optimization    response
• Build status   • User prefs                    • Follow-up
                                                               needed?
```

### 4.2 Phase 1: Detection

```typescript
class SignalMonitor {
  private subscribers: SignalSubscriber[] = [];
  private buffer: SignalEvent[] = [];
  private readonly BUFFER_WINDOW = 5000; // 5 second rolling window
  
  start() {
    // Initialize all signal sources
    this.initKeystrokeMonitor();
    this.initErrorMonitor();
    this.initActivityMonitor();
    this.initCalendarMonitor();
    
    // Start aggregation loop
    setInterval(() => this.aggregateSignals(), 1000);
  }
  
  private aggregateSignals() {
    const now = Date.now();
    // Clean old events
    this.buffer = this.buffer.filter(e => now - e.timestamp < this.BUFFER_WINDOW);
    
    // Calculate metrics
    const metrics = this.calculateMetrics(this.buffer);
    
    // Notify subscribers
    this.subscribers.forEach(s => s.onSignals(metrics));
  }
}
```

### 4.3 Phase 2: Evaluation

```typescript
class InterruptionEvaluator {
  async evaluate(
    opportunity: InterruptionOpportunity,
    context: InterruptionContext
  ): Promise<EvaluationResult> {
    
    // Step 1: Check hard blocks
    if (this.isHardBlocked(context)) {
      return { decision: 'BLOCKED', reason: 'Hard block in effect' };
    }
    
    // Step 2: Calculate flow state
    const flowState = calculateFlowState(context.signals);
    
    // Step 3: Calculate context score
    const contextScore = calculateContextScore(context);
    
    // Step 4: Determine appropriate level
    const level = this.determineLevel(opportunity, flowState, contextScore);
    
    // Step 5: Check cooldown
    const cooldown = this.checkCooldown(level, context);
    if (!cooldown.cleared) {
      return { 
        decision: 'COOLED', 
        reason: `Cooldown: ${cooldown.remaining}min remaining`,
        queueFor: cooldown.clearTime 
      };
    }
    
    // Step 6: Calculate optimal timing
    const timing = this.calculateOptimalTiming(flowState, context);
    
    return {
      decision: 'APPROVED',
      level,
      timing,
      confidence: this.calculateConfidence(flowState, contextScore)
    };
  }
  
  private isHardBlocked(ctx: InterruptionContext): boolean {
    return (
      ctx.system.screenLocked ||
      ctx.calendar.isInMeeting ||
      ctx.preferences.doNotDisturb ||
      ctx.activity.currentApp === 'fullscreen_presentation' ||
      ctx.history.interruptionsToday > 20 // Daily cap
    );
  }
}
```

### 4.4 Phase 3: Delivery

```typescript
class InterruptionDelivery {
  async deliver(
    interruption: ApprovedInterruption,
    context: InterruptionContext
  ): Promise<DeliveryResult> {
    
    // Select channel based on level and context
    const channel = this.selectChannel(interruption.level, context);
    
    // Prepare message
    const message = this.craftMessage(interruption, context);
    
    // Wait for optimal timing if needed
    if (interruption.timing.delay > 0) {
      await this.waitFor(interruption.timing.delay);
      
      // Re-check context after delay
      const freshContext = await this.refreshContext();
      if (this.isStillAppropriate(interruption, freshContext)) {
        return this.executeDelivery(channel, message);
      } else {
        return { status: 'CANCELLED', reason: 'Context changed' };
      }
    }
    
    return this.executeDelivery(channel, message);
  }
  
  private selectChannel(level: InterruptionLevel, ctx: InterruptionContext): Channel {
    const channels: Record<InterruptionLevel, Channel[]> = {
      whisper: ['tray_icon', 'status_bar', 'auto_toast'],
      nudge: ['notification_banner', 'toast', 'tray_popup'],
      tap: ['modal', 'center_dialog'],
      emergency: ['system_notification', 'sound', 'taskbar_flash']
    };
    
    // Filter by user preferences
    return channels[level].find(c => ctx.preferences.preferredChannels.includes(c)) 
      || channels[level][0];
  }
}
```

### 4.5 Phase 4: Feedback & Learning

```typescript
class InterruptionFeedback {
  private feedbackStore: FeedbackStore;
  
  async trackResponse(
    interruption: DeliveredInterruption,
    response: UserResponse
  ): Promise<void> {
    
    const record: FeedbackRecord = {
      interruptionId: interruption.id,
      timestamp: Date.now(),
      level: interruption.level,
      flowStateAtDelivery: interruption.flowState,
      contextAtDelivery: interruption.context,
      response: response.type, // 'dismissed' | 'accepted' | 'ignored' | 'snoozed'
      responseTime: response.timeToRespond,
      followUpAction: response.action
    };
    
    await this.feedbackStore.save(record);
    
    // Update user preference model
    await this.updatePreferenceModel(record);
    
    // Adjust future thresholds if needed
    this.adaptThresholds(record);
  }
  
  private adaptThresholds(record: FeedbackRecord) {
    // If consistently dismissed, raise thresholds
    const recent = this.feedbackStore.getRecent(10);
    const dismissalRate = recent.filter(r => r.response === 'dismissed').length / recent.length;
    
    if (dismissalRate > 0.7) {
      // User is annoyed - raise the bar
      ThresholdManager.increaseBaseThreshold(5);
      ThresholdManager.increaseCooldownMultiplier(0.2);
    } else if (dismissalRate < 0.2) {
      // User appreciates help - can be more proactive
      ThresholdManager.decreaseBaseThreshold(3);
    }
  }
}
```

---

## 5. ANTI-ANNOYANCE SAFEGUARDS

### 5.1 The Annoyance Prevention Framework

```typescript
interface AntiAnnoyanceRules {
  // Rate Limiting
  dailyCap: {
    total: 20;                    // Max interruptions per day
    byLevel: {
      whisper: 15;
      nudge: 8;
      tap: 4;
      emergency: 3;
    }
  };
  
  // Time-based Rules
  timeRules: {
    minInterval: 3;               // Minutes between any interruptions
    noInterruptionBefore: 8;      // AM
    noInterruptionAfter: 20;      // PM (unless emergency)
    lunchWindow: { start: 12, end: 13, allowed: false };
  };
  
  // Context Rules
  contextRules: {
    noInterruptDuring: [
      'fullscreen_app',
      'screen_sharing',
      'video_call',
      'presentation_mode',
      'gaming'
    ];
    noInterruptApps: [
      'zoom',
      'teams',
      'slack_call',
      'obs',
      'powerpoint_fullscreen'
    ];
  };
  
  // Smart Deduplication
  deduplication: {
    sameSuggestionWindow: 30;     // Minutes before showing same suggestion
    similarSuggestionWindow: 15;  // Minutes for related suggestions
    maxRepeats: 2;                // Times to show same suggestion ever
  };
}
```

### 5.2 Debugging-Aware Detection

One of the most common false positives is interrupting during debugging (when the user is *thinking*, not stuck).

```typescript
class DebuggingDetector {
  isProbablyDebugging(context: InterruptionContext): boolean {
    const signals = context.signals;
    
    // Debug mode indicators
    const indicators = {
      // Paused in debugger
      debuggerPaused: signals.hasActiveDebuggerBreak,
      
      // Recently hit breakpoint
      recentBreakpoint: signals.lastBreakpointHit < 60000, // 1 min
      
      // Reading stack trace / variables
      staticCursor: signals.cursorStationaryFor > 30000 && // 30s
                    signals.activeApp === 'vscode' &&
                    signals.currentFile.includes('debug'),
      
      // Stepping pattern
      steppingPattern: this.detectSteppingPattern(signals.recentActions),
      
      // Console focused with no input
      consoleReading: signals.consoleFocused && 
                      signals.typingVelocity === 0 &&
                      signals.scrollActivity > 0
    };
    
    // Weighted score
    const debugScore = Object.values(indicators).filter(Boolean).length;
    return debugScore >= 2; // 2+ indicators = probably debugging
  }
  
  private detectSteppingPattern(actions: Action[]): boolean {
    // Look for F10/F11 (step over/into) patterns
    const stepKeys = ['F10', 'F11', 'F5', 'Shift+F11'];
    const recent = actions.slice(-10);
    
    return recent.filter(a => stepKeys.includes(a.key)).length >= 3;
  }
}

// Usage in evaluator
if (debuggingDetector.isProbablyDebugging(context)) {
  // Extend "stuck" threshold from 5min to 15min
  thresholds.stuckDuration *= 3;
  // Suppress non-urgent interruptions
  maxAllowedLevel = 'whisper';
}
```

### 5.3 Meeting & Focus Time Protection

```typescript
class FocusProtection {
  async shouldBlock(context: InterruptionContext): Promise<boolean> {
    // Direct calendar integration
    if (context.calendar.isInMeeting) return true;
    if (context.calendar.focusTimeBlock) return true;
    
    // Detect screen sharing (Zoom, Teams, etc.)
    if (await this.isScreenSharing()) return true;
    
    // Detect presentation mode
    if (this.isPresentationMode(context)) return true;
    
    // Detect fullscreen video
    if (this.isFullscreenVideo(context)) return true;
    
    return false;
  }
  
  private async isScreenSharing(): Promise<boolean> {
    // Platform-specific detection
    if (process.platform === 'darwin') {
      // Check for ScreenCaptureKit indicators
      return checkMacOSScreenSharing();
    } else if (process.platform === 'win32') {
      // Check for DXGI desktop duplication
      return checkWindowsScreenSharing();
    }
    return false;
  }
}
```

### 5.4 Suggestion Deduplication

```typescript
class SuggestionDeduplicator {
  private suggestionHistory: Map<string, SuggestionRecord> = new Map();
  
  shouldSuppress(suggestion: Suggestion): boolean {
    const key = this.hashSuggestion(suggestion);
    const record = this.suggestionHistory.get(key);
    
    if (!record) return false;
    
    // Check repeat count
    if (record.shownCount >= ANNOYANCE_RULES.deduplication.maxRepeats) {
      return true;
    }
    
    // Check time window
    const timeSinceLast = Date.now() - record.lastShown;
    const windowMs = ANNOYANCE_RULES.deduplication.sameSuggestionWindow * 60000;
    
    if (timeSinceLast < windowMs) {
      return true;
    }
    
    // Check if dismissed with "don't show again"
    if (record.dismissedForever) {
      return true;
    }
    
    return false;
  }
  
  private hashSuggestion(s: Suggestion): string {
    // Create hash based on suggestion type and target
    return `${s.type}:${s.targetFile}:${s.issueCategory}`;
  }
}
```

### 5.5 User Annoyance Feedback Loop

```typescript
class AnnoyanceMonitor {
  private annoyanceScore: number = 0; // 0-100
  
  onInterruptionDelivered(interruption: Interruption) {
    // Base annoyance increase
    this.annoyanceScore += INTERRUPTION_COST[interruption.level];
  }
  
  onUserResponse(response: UserResponse) {
    switch (response.type) {
      case 'dismissed_quickly':
        // Dismissed in <2s = very annoyed
        this.annoyanceScore += 15;
        break;
      case 'dismissed':
        this.annoyanceScore += 5;
        break;
      case 'snoozed':
        this.annoyanceScore += 3;
        break;
      case 'accepted':
        // Helpful interruptions reduce annoyance
        this.annoyanceScore = Math.max(0, this.annoyanceScore - 10);
        break;
    }
    
    // Decay over time
    this.decayAnnoyance();
    
    // Take action if too annoyed
    if (this.annoyanceScore > 70) {
      this.triggerBackOffMode();
    }
  }
  
  private triggerBackOffMode() {
    // Enter minimal interruption mode
    InterruptionManager.setMode('minimal');
    
    // Double all cooldowns
    CooldownManager.applyMultiplier(2.0);
    
    // Reset after 1 hour or user-initiated action
    setTimeout(() => this.resetBackOff(), 60 * 60 * 1000);
  }
}
```

---

## 6. IMPLEMENTATION ARCHITECTURE

### 6.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SMART INTERRUPTION SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Signal      │  │   Context    │  │ Interruption │  │   Delivery   │    │
│  │  Collection  │──│   Engine     │──│   Decision   │──│   Manager    │    │
│  │   Layer      │  │              │  │   Engine     │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                 │                 │                 │             │
│         ▼                 ▼                 ▼                 ▼             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Core Services                                │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Flow     │ │ Calendar │ │ Anti-    │ │ User     │ │ Learning │  │   │
│  │  │ State    │ │ Service  │ │ Annoyance│ │ Profile  │ │ Engine   │  │   │
│  │  │ Detector │ │          │ │ Guard    │ │ Service  │ │          │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Data Storage Layer                              │   │
│  │         (SQLite/LocalDB for privacy, optional cloud sync)            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Core Classes

```typescript
// Main orchestrator
class SmartInterruptionManager {
  private signalMonitor: SignalMonitor;
  private flowDetector: FlowStateDetector;
  private contextEngine: ContextEngine;
  private decisionEngine: DecisionEngine;
  private deliveryManager: DeliveryManager;
  private antiAnnoyanceGuard: AntiAnnoyanceGuard;
  private feedbackLoop: FeedbackLoop;
  
  constructor(config: InterruptionConfig) {
    this.signalMonitor = new SignalMonitor();
    this.flowDetector = new FlowStateDetector();
    this.contextEngine = new ContextEngine();
    this.decisionEngine = new DecisionEngine(config);
    this.deliveryManager = new DeliveryManager();
    this.antiAnnoyanceGuard = new AntiAnnoyanceGuard();
    this.feedbackLoop = new FeedbackLoop();
    
    this.setupPipeline();
  }
  
  private setupPipeline() {
    // Signal → Flow State
    this.signalMonitor.onSignals((signals) => {
      const flowState = this.flowDetector.update(signals);
      this.contextEngine.updateFlowState(flowState);
    });
    
    // Opportunity → Decision → Delivery
    this.decisionEngine.onOpportunity(async (opportunity) => {
      const context = await this.contextEngine.getCurrentContext();
      
      // Anti-annoyance check
      if (this.antiAnnoyanceGuard.shouldBlock(opportunity, context)) {
        return;
      }
      
      // Evaluate and deliver
      const decision = await this.decisionEngine.evaluate(opportunity, context);
      if (decision.approved) {
        const result = await this.deliveryManager.deliver(decision, context);
        this.feedbackLoop.trackDelivery(result);
      }
    });
  }
  
  start() {
    this.signalMonitor.start();
    this.contextEngine.start();
  }
}

// Configuration
interface InterruptionConfig {
  // User preferences
  mode: 'minimal' | 'balanced' | 'proactive';
  
  // Thresholds (all in minutes unless noted)
  thresholds: {
    stuckDuration: number;           // Default: 5
    strugglingDuration: number;      // Default: 10
    idleDuration: number;            // Default: 3
    minInterruptionInterval: number; // Default: 3
    maxDailyInterruptions: number;   // Default: 20
  };
  
  // Features
  features: {
    calendarIntegration: boolean;
    debuggingDetection: boolean;
    learningEnabled: boolean;
    soundEnabled: boolean;
  };
  
  // Channels
  channels: {
    whisper: boolean;
    nudge: boolean;
    tap: boolean;
    emergency: boolean;
  };
}
```

### 6.3 Configuration Presets

```typescript
const PRESETS = {
  minimal: {
    mode: 'minimal' as const,
    thresholds: {
      stuckDuration: 10,
      strugglingDuration: 20,
      idleDuration: 10,
      minInterruptionInterval: 10,
      maxDailyInterruptions: 10
    },
    channels: {
      whisper: true,
      nudge: false,
      tap: true,      // Only critical
      emergency: true
    }
  },
  
  balanced: {
    mode: 'balanced' as const,
    thresholds: {
      stuckDuration: 5,
      strugglingDuration: 10,
      idleDuration: 3,
      minInterruptionInterval: 5,
      maxDailyInterruptions: 20
    },
    channels: {
      whisper: true,
      nudge: true,
      tap: true,
      emergency: true
    }
  },
  
  proactive: {
    mode: 'proactive' as const,
    thresholds: {
      stuckDuration: 3,
      strugglingDuration: 5,
      idleDuration: 1,
      minInterruptionInterval: 2,
      maxDailyInterruptions: 30
    },
    channels: {
      whisper: true,
      nudge: true,
      tap: true,
      emergency: true
    }
  }
};
```

---

## 7. THRESHOLD REFERENCE TABLES

### 7.1 Flow State Thresholds

| Metric | Deep Flow | Flow | Neutral | Struggling | Stuck | Idle |
|--------|-----------|------|---------|------------|-------|------|
| **Typing (WPM)** | 50-80 | 30-50 | 20-30 | 10-20 | <10 | 0 |
| **Typing Variance** | <10% | 10-20% | 20-40% | 40-60% | >60% | N/A |
| **Backspace Ratio** | <5% | 5-15% | 15-25% | 25-40% | >40% | N/A |
| **Error Duration** | 0 | <1min | 1-3min | 3-10min | >10min | N/A |
| **Idle Time** | 0 | <30s | 30s-2min | 2-5min | 5-10min | >10min |
| **Tab Switches/min** | 0 | <1 | 1-3 | 3-5 | >5 | N/A |

### 7.2 Interruption Decision Matrix

| User State | Low Priority | Medium Priority | High Priority | Critical |
|------------|--------------|-----------------|---------------|----------|
| **Deep Flow** | ❌ Queue | ❌ Queue | ⚠️ Whisper | ✅ Emergency |
| **Flow** | ❌ Queue | ⚠️ Whisper | ⚠️ Nudge | ✅ Emergency |
| **Neutral** | ⚠️ Whisper | ✅ Nudge | ✅ Nudge | ✅ Emergency |
| **Struggling** | ⚠️ Whisper | ✅ Nudge | ✅ Tap | ✅ Emergency |
| **Stuck** | ✅ Nudge | ✅ Tap | ✅ Tap | ✅ Emergency |
| **Idle** | ✅ Whisper | ✅ Nudge | ✅ Tap | ✅ Emergency |

### 7.3 Context Multipliers

| Context Factor | Score Impact |
|----------------|--------------|
| In meeting | -50 |
| Focus time block | -30 |
| Screen sharing | -40 |
| After 6 PM | -15 |
| Before 8 AM | -20 |
| Weekend | -20 |
| Lunch time | -25 |
| First hour of work | +10 |
| Between meetings (5-15min) | +15 |
| Recently accepted help | +10 |
| Recently dismissed | -20 |
| High annoyance score | -30 |

---

## 8. MONITORING & METRICS

### 8.1 Key Performance Indicators

```typescript
interface InterruptionMetrics {
  // Effectiveness
  acceptanceRate: number;        // % of interruptions that helped
  dismissalRate: number;         // % dismissed without action
  ignoreRate: number;            // % ignored entirely
  
  // Timing
  avgResponseTime: number;       // Time to user response
  interruptionsPerDay: number;
  interruptionsByLevel: Record<InterruptionLevel, number>;
  
  // User Experience
  annoyanceScore: number;        // 0-100
  flowInterruptionCount: number; // Times we interrupted flow (bad)
  stuckHelpCount: number;        // Times we helped when stuck (good)
  
  // Learning
  thresholdAdjustments: number;  // How much we've adapted
  preferenceAccuracy: number;    // How well we predict preferences
}
```

### 8.2 Health Dashboard Indicators

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Acceptance Rate | >60% | 40-60% | <40% |
| Annoyance Score | <30 | 30-60 | >60 |
| Flow Interruptions | 0 | 1-2 | >2/day |
| Avg Response Time | <10s | 10-30s | >30s |
| Daily Interruptions | <15 | 15-25 | >25 |

---

## 9. PRIVACY & SECURITY CONSIDERATIONS

### 9.1 Data Handling

```typescript
interface PrivacyConfig {
  // All signal processing is local-only
  localProcessingOnly: true;
  
  // No keystroke logging (only patterns)
  keystrokeStorage: 'never';
  
  // Anonymized metrics only
  telemetry: {
    enabled: boolean;
    anonymized: true;
    excludes: ['keystrokes', 'file_contents', 'error_messages'];
  };
  
  // User controls
  userControls: {
    canDeleteHistory: true;
    canExportData: true;
    canPauseMonitoring: true;
    granularControls: true;  // Per-app, per-signal
  };
}
```

### 9.2 Signal Privacy

| Signal | Stored | Used For |
|--------|--------|----------|
| Keystrokes | ❌ Never | Real-time pattern only |
| App names | ✅ Yes | Context detection |
| File names | ✅ Yes | Task tracking |
| Error messages | ❌ Never | Count only |
| Calendar | ✅ Yes | Availability |
| Idle time | ✅ Yes | Flow detection |

---

## 10. API DEFINITION

### 10.1 Public Interface

```typescript
// Main API for application integration
class InterruptionAPI {
  // Initialize
  static initialize(config: InterruptionConfig): SmartInterruptionManager;
  
  // Register an interruption opportunity
  static suggest(
    opportunity: InterruptionOpportunity,
    priority: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<InterruptionResult>;
  
  // Check if now is a good time (for manual checks)
  static async isGoodTime(): Promise<TimeAssessment>;
  
  // Get current flow state
  static getCurrentFlowState(): FlowState;
  
  // User feedback
  static reportFeedback(
    interruptionId: string,
    feedback: UserFeedback
  ): Promise<void>;
  
  // Temporarily suppress interruptions
  static async suppress(duration: minutes): Promise<void>;
  
  // Set focus mode
  static async setFocusMode(
    enabled: boolean,
    duration?: minutes
  ): Promise<void>;
}

// Usage example
const manager = InterruptionAPI.initialize(PRESETS.balanced);

// AI detects an issue
const issue = await ai.detectIssue();
if (issue) {
  const result = await InterruptionAPI.suggest({
    type: 'error_fix',
    title: 'Potential fix for TypeError',
    description: 'It looks like you\'re passing a string where a number is expected.',
    action: () => ai.applyFix(issue)
  }, 'high');
  
  if (result.delivered) {
    console.log('Suggestion delivered at level:', result.level);
  } else {
    console.log('Suppressed:', result.reason);
  }
}
```

---

## 11. FUTURE ENHANCEMENTS

### 11.1 Advanced Features

1. **Biometric Integration**: Heart rate variability for stress detection
2. **Eye Tracking**: Gaze patterns for attention detection
3. **Voice Analysis**: Tone detection for frustration
4. **Cross-Device Sync**: Seamless interruption state across devices
5. **Team Coordination**: Don't interrupt when teammates are in flow
6. **Predictive Scheduling**: Queue interruptions for optimal times

### 11.2 ML Enhancements

```typescript
// Future: Personalized flow prediction
class MLFlowPredictor {
  // Train on user's specific patterns
  async train(userHistory: InterruptionHistory[]): Promise<Model>;
  
  // Predict if user is about to enter flow
  async predictFlowEntry(context: Context): Promise<Probability>;
  
  // Predict optimal interruption windows
  async predictOptimalWindows(
    daySchedule: Schedule
  ): Promise<TimeWindow[]>;
}
```

---

## 12. IMPLEMENTATION CHECKLIST

### Phase 1: Foundation
- [ ] Signal monitoring infrastructure
- [ ] Flow state calculation engine
- [ ] Basic context collection
- [ ] Simple threshold-based decisions

### Phase 2: Core Features
- [ ] Four-level interruption system
- [ ] Anti-annoyance guards
- [ ] Calendar integration
- [ ] Feedback loop

### Phase 3: Intelligence
- [ ] Debugging detection
- [ ] Adaptive thresholds
- [ ] Learning from feedback
- [ ] Personalized presets

### Phase 4: Polish
- [ ] Performance optimization
- [ ] Privacy audit
- [ ] Accessibility review
- [ ] Documentation

---

## APPENDIX: DECISION FLOWCHART (TEXT)

```
START: AI detects opportunity to help
│
├─► Check: Is this critical/emergency?
│   ├─► YES ──► Bypass flow checks ──► LEVEL 4 (Emergency)
│   └─► NO ──► Continue
│
├─► Check: Are hard blocks active?
│   ├─► Screen locked? ──► QUEUE
│   ├─► In meeting? ──► QUEUE
│   ├─► DND enabled? ──► QUEUE  
│   ├─► Screen sharing? ──► QUEUE
│   └─► Daily cap reached? ──► QUEUE
│
├─► Calculate: Flow State
│   ├─► Collect signals
│   ├─► Calculate score (0-100)
│   └─► Determine state (deep_flow → idle)
│
├─► Check: Probably debugging?
│   ├─► YES ──► Double "stuck" threshold ──► Max level = Whisper
│   └─► NO ──► Continue
│
├─► Calculate: Context Score
│   ├─► Time of day
│   ├─► Calendar state
│   ├─► System state
│   └─► Recent interruption history
│
├─► Check: Cooldown
│   ├─► Calculate dynamic cooldown
│   ├─► Compare to last interruption
│   ├─► Too recent? ──► QUEUE for later
│   └─► Clear ──► Continue
│
├─► Determine: Severity Level
│   ├─► Deep Flow + Any ──► Queue or Whisper max
│   ├─► Flow + High ──► Whisper/Nudge max
│   ├─► Neutral + Low ──► Whisper
│   ├─► Neutral + Medium ──► Nudge
│   ├─► Struggling + Any ──► Nudge/Tap
│   ├─► Stuck + Any ──► Nudge/Tap
│   └─► Idle + Any ──► Based on priority
│
├─► Check: Deduplication
│   ├─► Same suggestion recently? ──► SUPPRESS
│   ├─► User dismissed before? ──► SUPPRESS or escalate
│   └─► Clear ──► Continue
│
├─► Calculate: Optimal Timing
│   ├─► Wait for state transition?
│   ├─► Wait for next gap?
│   └─► Deliver immediately?
│
├─► DELIVER interruption
│
└─► TRACK response
    ├─► Ignored ──► Note for future
    ├─► Dismissed quickly ──► Increase annoyance score
    ├─► Dismissed ──► Update cooldowns
    ├─► Snoozed ──► Queue for later
    └─► Accepted ──► Reduce cooldowns, positive reinforcement

END
```

---

*Document Version: 1.0*
*Last Updated: 2026-01-29*
*Status: Design Complete - Ready for Implementation*
