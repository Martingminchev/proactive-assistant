# NEXUS Proactive Assistant - Full System Design

## Executive Summary

Based on comprehensive analysis of your existing NEXUS codebase, this document presents a blueprint for evolving from a reactive chat assistant to a **truly proactive AI companion** that can perceive, understand, and act on behalf of the user.

**Current State**: You have a solid Electron-based AI assistant with:
- Kimi API integration with streaming
- Basic context monitoring (active window, resources)
- Proactive suggestion framework (analysis every 5 min)
- Action execution framework (V2 ready but disabled)
- Pieces OS integration for LTM
- Beautiful glassmorphism UI

**The Vision**: Transform NEXUS into an **ambient intelligence** that:
- Continuously understands user context without being intrusive
- Detects struggles and offers help before being asked
- Performs actions to assist workflows
- Learns from user behavior and preferences
- Serves as a true productivity multiplier

---

## Part 1: System Architecture Overview

### 1.1 The Proactive Assistant Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Chat UI    │  │   Dashboard  │  │   Timeline   │  │  Action Bar  │ │
│  │  (existing)  │  │    (new)     │  │    (new)     │  │    (new)     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONTEXT & INTELLIGENCE LAYER                       │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ Context Monitor │  │  Intent Engine  │  │   Memory & Learning     │  │
│  │  (enhanced)     │  │     (new)       │  │      (enhanced)         │  │
│  │                 │  │                 │  │                         │  │
│  │ • Window tracking│  │ • Pattern rec  │  │ • User preferences      │  │
│  │ • File watching │  │ • Predictions  │  │ • Workflow memory       │  │
│  │ • Screen capture│  │ • Stuck detect │  │ • Error solutions       │  │
│  │ • App automation│  │ • Goal infer   │  │ • Long-term patterns    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      ACTION & AUTOMATION LAYER                          │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ Action Executor │  │ Workflow Engine │  │   Error Recovery        │  │
│  │  (enable V2)    │  │     (new)       │  │      (new)              │  │
│  │                 │  │                 │  │                         │  │
│  │ • Open files    │  │ • Record flows  │  │ • Pattern detection     │  │
│  │ • Run commands  │  │ • Replay tasks  │  │ • Auto-fix suggestions  │  │
│  │ • UI automation │  │ • Smart macros  │  │ • Self-healing system   │  │
│  │ • System control│  │ • Conditionals  │  │ • Predictive prevention │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      AI & REASONING LAYER                               │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   LLM Client    │  │  Tool System    │  │   Planning Engine       │  │
│  │  (existing)     │  │   (new)         │  │      (new)              │  │
│  │                 │  │                 │  │                         │  │
│  │ • Kimi K2.5     │  │ • Function call │  │ • Task decomposition    │  │
│  │ • Streaming     │  │ • Tool registry │  │ • Multi-step plans      │  │
│  │ • Context mgmt  │  │ • Validation    │  │ • Error recovery        │  │
│  │ • Multi-model   │  │ • Execution     │  │ • Progress tracking     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Design Principles

1. **Privacy-First**: All sensitive context processed locally when possible
2. **User Control**: Granular permissions, easy opt-out, transparent data usage
3. **Non-Intrusive**: High-value suggestions only; respect focus and flow states
4. **Progressive Enhancement**: Start with simple automation, build to complex workflows
5. **Self-Improving**: Learn from user feedback and behavior patterns

---

## Part 2: The Perception System (What the Assistant Sees)

### 2.1 Enhanced Context Monitoring

Your existing `ContextMonitor` provides a foundation. Here's the enhanced version:

```typescript
interface EnhancedContext {
  // System State (existing)
  system: {
    cpu: SystemStats;
    memory: SystemStats;
    battery: BatteryInfo;
    uptime: number;
  };
  
  // Activity Context (enhanced)
  activity: {
    activeWindow: WindowInfo;
    recentWindows: WindowInfo[];  // Last 5 minutes
    mouseActivity: ActivityLevel; // none, low, medium, high
    keyboardActivity: ActivityLevel;
    idleTime: number;  // Seconds since last input
  };
  
  // Application Context (new)
  application: {
    appName: string;
    processName: string;
    // For supported apps, extract rich context
    details?: VSCodeContext | BrowserContext | TerminalContext;
  };
  
  // Content Context (new)
  content: {
    clipboard: ClipboardItem[];
    selectedText?: string;  // When available via accessibility
    recentFiles: FileActivity[];
    browserUrl?: string;  // Via browser extension
  };
  
  // Temporal Context (new)
  temporal: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: string;
    workdayStatus: 'work' | 'weekend' | 'holiday';
    focusSession?: FocusSession;  // Current focus block
  };
}
```

### 2.2 Screen Understanding Module

New service for visual context:

```typescript
// src/main/services/screen-analyzer.ts
export class ScreenAnalyzer extends EventEmitter {
  // Capture and analyze screen regions
  async captureAndAnalyze(region?: Region): Promise<ScreenAnalysis>;
  
  // Detect UI elements (buttons, inputs, errors)
  async detectUIElements(): Promise<UIElement[]>;
  
  // OCR for text extraction
  async extractText(region: Region): Promise<string>;
  
  // Error pattern detection
  async detectErrorPatterns(): Promise<DetectedError[]>;
  
  // Visual state comparison
  async hasVisualChange(threshold?: number): Promise<boolean>;
}

// Usage for proactive help:
// - Detect error dialogs and offer solutions
// - Recognize forms and offer autofill
// - Identify loading states and wait appropriately
// - Detect success/failure states after actions
```

### 2.3 Windows UI Automation (Windows-specific)

For deeper application integration:

```typescript
// src/main/services/windows-automation.ts
export class WindowsAutomation {
  // Get accessible elements from current window
  async getAccessibleTree(): Promise<AccessibilityNode>;
  
  // Find element by properties
  async findElement(criteria: ElementCriteria): Promise<AccessibilityNode | null>;
  
  // Read element properties safely
  async getElementValue(element: AccessibilityNode): Promise<string>;
  
  // Supported apps for rich context
  getRichContext(): Promise<RichContext | null> {
    // VS Code: Current file, line, errors
    // Browser: URL, page title (via extension)
    // Terminal: Current directory, running process
    // Outlook: Current email, calendar view
  }
}
```

---

## Part 3: The Understanding System (What the Assistant Knows)

### 3.1 Intent Engine

The brain that interprets user behavior:

```typescript
// src/main/services/intent-engine.ts
export class IntentEngine extends EventEmitter {
  private patternDatabase: PatternDatabase;
  private goalTracker: GoalTracker;
  
  // Continuously analyze context for intent
  async analyzeContext(context: EnhancedContext): Promise<IntentAnalysis> {
    return {
      currentTask: this.identifyCurrentTask(context),
      estimatedGoal: this.predictGoal(context),
      struggleIndicators: this.detectStruggle(context),
      interruptionOpportunity: this.findGoodInterruptionPoint(context),
      suggestedActions: this.generateSuggestions(context),
    };
  }
  
  // Task identification from behavior patterns
  private identifyCurrentTask(context: EnhancedContext): Task | null {
    // Pattern matching:
    // - "Switching between browser and code editor" → "Researching implementation"
    // - "Repeated compiles with errors" → "Debugging"
    // - "Copy-pasting between documents" → "Consolidating information"
  }
  
  // Predict what user is trying to achieve
  private predictGoal(context: EnhancedContext): PredictedGoal {
    // Based on:
    // - Recent activity sequence
    // - Time of day patterns
    // - Historical similar sessions
    // - Calendar context
  }
  
  // Detect when user is struggling
  private detectStruggle(context: EnhancedContext): StruggleSignal[] {
    const signals: StruggleSignal[] = [];
    
    // Pattern: Rapid retries
    if (context.activity.errorRate > 0.5) {
      signals.push({
        type: 'rapid_errors',
        confidence: 0.8,
        message: 'Multiple errors in quick succession'
      });
    }
    
    // Pattern: Idle after error
    if (context.activity.idleTime > 120 && this.lastStateHadError()) {
      signals.push({
        type: 'stuck_on_error',
        confidence: 0.7,
        message: 'Idle after encountering error'
      });
    }
    
    // Pattern: Repeated same action
    if (this.detectRepeatedAction(3)) {
      signals.push({
        type: 'repetitive_action',
        confidence: 0.6,
        message: 'Doing the same thing multiple times'
      });
    }
    
    // Pattern: Long session without progress
    if (context.temporal.focusSession?.duration > 7200) {
      signals.push({
        type: 'long_session',
        confidence: 0.5,
        message: 'Working for over 2 hours without break'
      });
    }
    
    return signals;
  }
}
```

### 3.2 Memory & Learning System

```typescript
// src/main/services/memory-store.ts
interface UserMemory {
  // Preferences learned over time
  preferences: {
    workHours: TimeRange;
    focusPreferences: FocusPreference[];
    notificationPreferences: NotificationPreference;
    commonWorkflows: Workflow[];
    preferredTools: string[];
  };
  
  // Task patterns
  taskPatterns: {
    [taskType: string]: {
      typicalSteps: string[];
      commonErrors: ErrorSolution[];
      estimatedDuration: number;
      relatedResources: string[];
    };
  };
  
  // Error solutions learned
  errorSolutions: {
    [errorSignature: string]: {
      solution: string;
      successRate: number;
      lastApplied: Date;
      context: string;
    };
  };
  
  // Workflow history
  workflows: Workflow[];
}
```

---

## Part 4: The Action System (What the Assistant Does)

### 4.1 Enable and Expand V2 Actions

Your existing ActionExecutor has a V2 framework. Enable and expand:

```typescript
// src/main/services/action-executor.ts
interface ActionRegistry {
  // V1 Actions (existing - suggestions only)
  suggest: (params: SuggestParams) => Promise<void>;
  notify: (params: NotifyParams) => Promise<void>;
  ask: (params: AskParams) => Promise<void>;
  remind: (params: RemindParams) => Promise<void>;
  
  // V2 Actions (enable these)
  open_file: (params: OpenFileParams) => Promise<void>;
  open_url: (params: OpenUrlParams) => Promise<void>;
  create_file: (params: CreateFileParams) => Promise<void>;
  run_command: (params: RunCommandParams) => Promise<CommandResult>;
  take_screenshot: (params: ScreenshotParams) => Promise<string>;
  clipboard_copy: (params: ClipboardParams) => Promise<void>;
  
  // V3 Actions (new capabilities)
  control_application: (params: AppControlParams) => Promise<void>;
  // - "focus VS Code"
  // - "close Chrome tab"
  // - "minimize all windows"
  
  manage_windows: (params: WindowManageParams) => Promise<void>;
  // - "arrange windows side by side"
  // - "snap window to right"
  
  send_input: (params: SendInputParams) => Promise<void>;
  // - "type 'npm install' in terminal"
  // - "press Ctrl+S in active window"
  
  schedule_action: (params: ScheduleParams) => Promise<string>; // returns jobId
  // - "remind me in 30 minutes"
  // - "run this script at 5pm"
  
  search_system: (params: SearchParams) => Promise<SearchResult>;
  // - "find all PDFs modified today"
  // - "search for 'TODO' in open files"
}
```

### 4.2 Workflow Engine

Record and replay common tasks:

```typescript
// src/main/services/workflow-engine.ts
export class WorkflowEngine {
  // Record a workflow
  async startRecording(name: string): Promise<void>;
  async stopRecording(): Promise<Workflow>;
  
  // Replay a workflow
  async executeWorkflow(workflowId: string, params?: any): Promise<void>;
  
  // Smart workflows with conditions
  async createSmartWorkflow(definition: SmartWorkflow): Promise<void>;
}

// Example workflows to suggest:
const commonWorkflows = {
  'Start Work Session': [
    { action: 'open_url', params: { url: 'https://calendar.google.com' } },
    { action: 'open_file', params: { path: '~/Projects/current' } },
    { action: 'control_application', params: { app: 'Slack', action: 'focus' } },
  ],
  
  'Code Review Setup': [
    { action: 'open_url', params: { url: '${prUrl}' } },
    { action: 'run_command', params: { command: 'git fetch origin' } },
    { action: 'create_file', params: { name: 'review-notes.md', template: 'review-template' } },
  ],
  
  'End of Day': [
    { action: 'run_command', params: { command: 'git status' } },
    { action: 'notify', params: { message: 'Don\'t forget to commit!' } },
    { action: 'schedule_action', params: { action: 'backup_workspace', time: '+1h' } },
  ],
};
```

### 4.3 Error Recovery System

```typescript
// src/main/services/error-recovery.ts
export class ErrorRecoverySystem extends EventEmitter {
  // Monitor for errors across the system
  async monitorForErrors(): Promise<void> {
    // Watch for:
    // - Application crashes
    // - Error dialogs
    // - Terminal error outputs
    // - Browser console errors (via extension)
    // - Build/compile failures
  }
  
  // When error detected, try to help
  async onErrorDetected(error: DetectedError): Promise<void> {
    // 1. Check if we've seen this error before
    const knownSolution = await this.memoryStore.getSolution(error.signature);
    
    if (knownSolution && knownSolution.successRate > 0.7) {
      // Offer known solution
      this.actionExecutor.execute('suggest', {
        title: `Fix: ${error.title}`,
        content: knownSolution.solution,
        actions: ['Apply Fix', 'Show Details', 'Dismiss'],
      });
    } else {
      // Analyze with AI for new solution
      const analysis = await this.analyzeErrorWithAI(error);
      
      // Offer to help
      this.actionExecutor.execute('suggest', {
        title: `Error in ${error.source}`,
        content: analysis.explanation,
        actions: ['Try Fix', 'Search Help', 'Copy Error', 'Dismiss'],
      });
    }
  }
  
  // Apply a fix automatically or with confirmation
  async applyFix(error: DetectedError, fix: ErrorFix): Promise<boolean> {
    // Execute fix steps
    // Track success/failure
    // Update solution success rate
  }
}
```

---

## Part 5: The UI/UX Layer

### 5.1 New Interface Components

#### Dashboard View (Ambient Awareness)

```typescript
// New component: DashboardPanel
// Accessible via sidebar or hotkey
// Shows:
// - Current context (what you're working on)
// - Recent activity timeline
// - Active suggestions
// - Quick actions based on context
// - Focus session timer
```

**Visual mockup:**
```
┌─────────────────────────────────────────────────────────────┐
│  NEXUS Dashboard                                    [≡] [×] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Currently Working On                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💻 Project: nexus-assistant                        │   │
│  │     File: src/main/services/context-monitor.ts      │   │
│  │     Duration: 45 minutes    Status: In Flow         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Timeline (Last Hour)                                       │
│  ├─ 14:32  Opened context-monitor.ts                        │
│  ├─ 14:45  Switched to browser (Stack Overflow)             │
│  ├─ 15:02  Returned to VS Code                              │
│  └─ 15:15  🟡 Error detected: "Module not found"            │
│                                                             │
│  Active Suggestions                      [View All]         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💡 npm package missing? Run 'npm install'          │   │
│  │     [Run] [Show Details] [Dismiss]                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Quick Actions                                              │
│  [📸 Screenshot] [🔍 Search Files] [⏱️ Start Focus]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Timeline View (Activity History)

```typescript
// New component: TimelineView
// Chronological view of:
// - Applications used
// - Files accessed
// - Errors encountered
// - Suggestions offered
// - Actions taken
// 
// Allows:
// - Search/filter
// - Jump to specific time
// - See patterns over time
```

#### Action Bar (Quick Access)

```typescript
// New component: ActionBar
// Floating or docked bar with:
// - Most-used actions for current context
// - Voice input button
// - Screenshot button
// - Current status indicator
```

### 5.2 Enhanced Chat Interface

Add to existing ChatArea:

```typescript
// New features for ChatArea:
interface EnhancedChatFeatures {
  // Tool use display
  toolCalls: ToolCall[];  // Show when AI uses tools
  
  // Inline suggestions
  inlineSuggestions: InlineSuggestion[];  // Context-aware prompts
  
  // Message actions
  messageActions: {
    bookmark: () => void;
    createSnippet: () => void;
    addToKnowledge: () => void;
    scheduleReminder: () => void;
  };
  
  // Context display
  contextPanel: {
    visible: boolean;
    currentContext: EnhancedContext;
  };
}
```

### 5.3 Proactive Notification System

Evolve from simple toasts to rich interactions:

```typescript
interface ProactiveNotification {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'suggestion' | 'alert' | 'insight' | 'reminder' | 'offer';
  
  // Content
  title: string;
  message: string;
  icon?: string;
  
  // Actions
  primaryAction?: {
    label: string;
    action: () => Promise<void>;
    dangerous?: boolean;
  };
  secondaryActions?: Array<{
    label: string;
    action: () => Promise<void>;
  }>;
  
  // Display options
  displayMode: 'indicator' | 'toast' | 'notification' | 'modal';
  duration?: number;
  sticky?: boolean;
  
  // Feedback
  onDismiss?: (reason: 'clicked' | 'timeout' | 'swiped') => void;
  onFeedback?: (feedback: 'helpful' | 'not_helpful') => void;
}
```

---

## Part 6: Tool System (AI Capabilities)

### 6.1 Function Calling Implementation

Enable the LLM to use tools:

```typescript
// src/main/services/tool-system.ts
export class ToolSystem {
  private tools: Map<string, Tool> = new Map();
  
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }
  
  async executeTool(name: string, params: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    
    // Validate params
    const validated = tool.schema.parse(params);
    
    // Execute with logging
    const startTime = Date.now();
    try {
      const result = await tool.execute(validated);
      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }
  
  getToolsForLLM(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.schema,
    }));
  }
}

// Built-in tools
const builtInTools: Tool[] = [
  {
    name: 'get_current_context',
    description: 'Get the current system and activity context',
    schema: z.object({}),
    execute: async () => contextMonitor.getCurrentContext(),
  },
  {
    name: 'search_conversations',
    description: 'Search through conversation history',
    schema: z.object({ query: z.string(), limit: z.number().optional() }),
    execute: async (params) => conversationStore.search(params.query, params.limit),
  },
  {
    name: 'open_file',
    description: 'Open a file in the default application',
    schema: z.object({ path: z.string() }),
    execute: async (params) => actionExecutor.execute('open_file', params),
  },
  {
    name: 'run_command',
    description: 'Execute a shell command',
    schema: z.object({ command: z.string(), cwd: z.string().optional() }),
    execute: async (params) => actionExecutor.execute('run_command', params),
  },
  {
    name: 'take_screenshot',
    description: 'Capture the screen or a region',
    schema: z.object({ region: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional() }),
    execute: async (params) => screenAnalyzer.captureAndAnalyze(params.region),
  },
  {
    name: 'set_reminder',
    description: 'Set a reminder for later',
    schema: z.object({ message: z.string(), when: z.string() }), // "in 30 minutes", "at 5pm"
    execute: async (params) => actionExecutor.execute('schedule_action', {
      action: 'notify',
      params: { message: params.message },
      when: params.when,
    }),
  },
  {
    name: 'search_files',
    description: 'Search for files on the system',
    schema: z.object({ query: z.string(), directory: z.string().optional() }),
    execute: async (params) => searchSystem.searchFiles(params.query, params.directory),
  },
  {
    name: 'get_clipboard_history',
    description: 'Get recent clipboard items',
    schema: z.object({ limit: z.number().optional() }),
    execute: async (params) => contextMonitor.getClipboardHistory(params.limit),
  },
];
```

### 6.2 Planning Engine

For complex multi-step tasks:

```typescript
// src/main/services/planning-engine.ts
export class PlanningEngine {
  async createPlan(goal: string, context: EnhancedContext): Promise<Plan> {
    // Ask LLM to break down goal into steps
    const plan = await this.llm.generatePlan(goal, this.toolSystem.getToolsForLLM());
    
    return {
      goal,
      steps: plan.steps.map((step, index) => ({
        id: `step-${index}`,
        description: step.description,
        tool: step.tool,
        params: step.params,
        dependencies: step.dependencies,
        status: 'pending',
      })),
      currentStep: 0,
    };
  }
  
  async executePlan(plan: Plan): Promise<PlanResult> {
    for (const step of plan.steps) {
      step.status = 'in_progress';
      
      try {
        const result = await this.toolSystem.executeTool(step.tool, step.params);
        step.result = result;
        step.status = result.success ? 'completed' : 'failed';
        
        if (!result.success && step.critical) {
          // Ask user how to proceed
          const decision = await this.askUserForDecision(step, result);
          if (decision === 'abort') break;
          if (decision === 'retry') {
            // Retry with modified params
          }
        }
      } catch (error) {
        step.status = 'failed';
        step.error = error.message;
      }
    }
    
    return {
      success: plan.steps.every(s => s.status === 'completed'),
      completedSteps: plan.steps.filter(s => s.status === 'completed').length,
      failedSteps: plan.steps.filter(s => s.status === 'failed').map(s => s.id),
      results: plan.steps.map(s => s.result),
    };
  }
}
```

---

## Part 7: Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2) ✅ Low Risk

**Goal**: Enable existing capabilities and fix gaps

| Task | Effort | Impact |
|------|--------|--------|
| Enable V2 Actions | 2 days | High |
| Add tool system foundation | 3 days | High |
| Implement conversation search | 2 days | Medium |
| Add message actions (bookmark, copy) | 1 day | Low |
| Fix IPC gaps from review | 2 days | Medium |
| Add error pattern detection | 2 days | Medium |

**Deliverable**: Assistant can now open files, run safe commands, and has basic error awareness

### Phase 2: Perception (Weeks 3-4) 🟡 Medium Risk

**Goal**: Richer context understanding

| Task | Effort | Impact |
|------|--------|--------|
| Screen analyzer service | 4 days | High |
| Windows automation module | 4 days | High |
| Enhanced context gathering | 3 days | Medium |
| Browser extension (basic) | 3 days | Medium |
| Dashboard UI | 3 days | Medium |

**Deliverable**: Assistant can "see" screen content and understand application state

### Phase 3: Intelligence (Weeks 5-6) 🟡 Medium Risk

**Goal**: Intent understanding and proactive suggestions

| Task | Effort | Impact |
|------|--------|--------|
| Intent engine | 4 days | High |
| Memory & learning system | 4 days | High |
| Enhanced proactive agent | 3 days | High |
| Workflow recording | 3 days | Medium |
| Smart triggers v2 | 2 days | Medium |

**Deliverable**: Assistant understands what you're doing and can predict needs

### Phase 4: Autonomy (Weeks 7-8) 🔴 Higher Risk

**Goal**: Execute multi-step tasks and self-heal

| Task | Effort | Impact |
|------|--------|--------|
| Planning engine | 4 days | High |
| Workflow engine | 3 days | Medium |
| Error recovery system | 4 days | High |
| Self-healing capabilities | 3 days | Medium |
| Advanced tool use | 3 days | High |

**Deliverable**: Assistant can execute complex workflows and recover from errors

### Phase 5: Polish (Weeks 9-10) ✅ Low Risk

**Goal**: Production-ready experience

| Task | Effort | Impact |
|------|--------|--------|
| Timeline view | 3 days | Low |
| Action bar | 2 days | Medium |
| Notification system v2 | 3 days | Medium |
| Performance optimization | 3 days | Medium |
| Privacy controls UI | 2 days | High |
| Documentation | 2 days | Medium |

**Deliverable**: Complete, polished proactive assistant experience

---

## Part 8: Key Implementation Details

### 8.1 Enabling V2 Actions (Immediate Win)

```typescript
// In src/main/main.ts, line ~180
const actionExecutor = new ActionExecutor({
  enableV2Actions: true,  // Enable this!
  defaultPermissionLevel: 'confirm',  // Safe default
});

// Add UI for action confirmation in renderer
// src/renderer/components/ActionConfirmationModal.tsx
interface ActionConfirmationModalProps {
  action: Action;
  onConfirm: () => void;
  onDeny: () => void;
  onAlwaysAllow: () => void;  // Remember choice
}
```

### 8.2 Screen Capture Setup

```typescript
// Install dependencies
// npm install screenshot-desktop tesseract.js

// src/main/services/screen-analyzer.ts
import screenshot from 'screenshot-desktop';
import { createWorker } from 'tesseract.js';

export class ScreenAnalyzer {
  private ocrWorker: Tesseract.Worker | null = null;
  
  async initialize(): Promise<void> {
    this.ocrWorker = await createWorker('eng');
  }
  
  async captureScreen(): Promise<Buffer> {
    return await screenshot({ format: 'png' });
  }
  
  async extractText(image: Buffer): Promise<string> {
    if (!this.ocrWorker) await this.initialize();
    const result = await this.ocrWorker!.recognize(image);
    return result.data.text;
  }
  
  // Detect error dialogs
  async detectErrors(): Promise<DetectedError[]> {
    const screenshot = await this.captureScreen();
    const text = await this.extractText(screenshot);
    
    // Pattern matching for common error formats
    const errorPatterns = [
      /Error:\s*(.+)/i,
      /Exception:\s*(.+)/i,
      /Failed to\s*(.+)/i,
      /\[ERROR\]\s*(.+)/i,
      /npm ERR!\s*(.+)/i,
    ];
    
    const errors: DetectedError[] = [];
    for (const pattern of errorPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        errors.push({
          type: 'detected',
          message: matches[1],
          source: 'screen',
          timestamp: Date.now(),
        });
      }
    }
    
    return errors;
  }
}
```

### 8.3 Windows UI Automation Setup

```typescript
// Install: npm install ffi-napi ref-napi
// Note: These are native modules requiring build tools

// src/main/services/windows-automation.ts
import ffi from 'ffi-napi';
import ref from 'ref-napi';

// Load Windows UI Automation DLL
const uiautomation = ffi.Library('UIAutomationCore', {
  // Windows UIA functions
});

export class WindowsAutomation {
  async getActiveWindowElements(): Promise<UIElement[]> {
    // Use Windows UI Automation API to get accessible elements
    // from the currently focused window
  }
  
  async getVSCodeContext(): Promise<VSCodeContext | null> {
    // If active window is VS Code:
    // - Get current file path from window title or accessibility
    // - Get cursor position, selected text
    // - Detect if there's an error in problems panel
  }
}
```

### 8.4 Privacy-First Context Storage

```typescript
// src/main/services/privacy-manager.ts
interface PrivacySettings {
  // Retention policies
  contextRetentionHours: number;
  screenshotRetention: 'none' | 'analysis-only' | 'temporary';
  conversationRetentionDays: number;
  
  // Collection controls
  allowScreenCapture: boolean;
  allowAppAutomation: boolean;
  allowClipboardHistory: boolean;
  allowFileWatching: boolean;
  
  // Sensitive app exclusions
  excludedApps: string[];  // e.g., '1Password', 'banking-app'
  excludedPaths: string[]; // e.g., '/private', '.ssh'
  
  // Learning controls
  allowBehavioralLearning: boolean;
  allowErrorTracking: boolean;
  allowWorkflowLearning: boolean;
}

// Data retention enforcement
class PrivacyManager {
  async enforceRetentionPolicies(): Promise<void> {
    const settings = await this.getPrivacySettings();
    
    // Delete old context data
    const cutoffTime = Date.now() - (settings.contextRetentionHours * 3600000);
    await this.contextStore.deleteOlderThan(cutoffTime);
    
    // Delete old screenshots if retention is limited
    if (settings.screenshotRetention === 'analysis-only') {
      await this.screenAnalyzer.deleteAllScreenshots();
    }
  }
}
```

---

## Part 9: Everyday Use Cases

### 9.1 Developer Scenarios

| Scenario | How NEXUS Helps |
|----------|-----------------|
| **Debugging Loop** | Detects repeated compile errors, suggests fixes from memory, offers to open relevant documentation |
| **Code Review** | Recognizes GitHub PR page, offers to open in IDE, suggests checklist, prepares review template |
| **Learning New Tech** | Sees Stack Overflow visits, offers to save snippets, suggests creating a learning note |
| **Long Coding Session** | Detects 2+ hours of focus, suggests break, offers to commit current work |
| **Environment Issues** | Detects "Module not found" errors, runs `npm install`, verifies fix |

### 9.2 General Productivity

| Scenario | How NEXUS Helps |
|----------|-----------------|
| **Meeting Preparation** | Calendar integration, opens relevant docs, summarizes unread messages |
| **Research Task** | Tracks browser tabs, offers to save findings, creates summary document |
| **Distraction Recovery** | Detects social media during focus time, gently redirects, logs distraction |
| **End of Day** | Suggests committing work, summarizes accomplishments, prepares todo for tomorrow |
| **File Organization** | Detects downloaded files, suggests organization, offers quick move actions |

### 9.3 Error Recovery

| Error Type | Detection | Response |
|------------|-----------|----------|
| **Build Fail** | Terminal output monitoring | Analyze error, suggest fix, offer to run command |
| **App Crash** | Process monitoring | Capture state, suggest restart, check logs |
| **Network Error** | Connection monitoring | Detect outage, suggest offline work, retry when back |
| **Disk Full** | System monitoring | Warn early, suggest cleanup, find large files |
| **Conflicts** | Git status monitoring | Detect merge conflicts, suggest resolution, open editor |

---

## Part 10: Success Metrics

### 10.1 User Value Metrics

- **Suggestion Acceptance Rate**: % of proactive suggestions user acts on
- **Task Completion Time**: Time saved on common workflows
- **Error Recovery Rate**: % of errors resolved with AI help
- **User Engagement**: Daily active usage, conversation depth
- **Feature Discovery**: % of users enabling advanced features

### 10.2 System Health Metrics

- **False Positive Rate**: Suggestions offered when not needed
- **Action Success Rate**: % of automated actions completing successfully
- **Privacy Score**: User retention vs. privacy settings
- **Performance Impact**: CPU/memory overhead of monitoring

---

## Conclusion

Your NEXUS project has **excellent bones**. The architecture is clean, the proactive foundation exists, and the UI is polished. The path to a truly proactive assistant involves:

1. **Enable what you have** (V2 actions, fix IPC gaps)
2. **Add perception** (screen capture, app automation)
3. **Build intelligence** (intent engine, learning)
4. **Enable autonomy** (workflows, error recovery)
5. **Polish** (dashboard, timeline, controls)

The key differentiator for NEXUS will be the **balance of helpfulness and respect** - being there when needed without being intrusive. Your existing "bar for surfacing" prompt engineering is exactly the right mindset.

**Recommended next step**: Start with Phase 1 - enable V2 actions and add the tool system. This alone transforms NEXUS from a chatbot into an assistant that can actually *do* things.
