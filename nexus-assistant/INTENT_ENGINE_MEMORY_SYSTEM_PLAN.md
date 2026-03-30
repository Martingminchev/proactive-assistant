# NEXUS Intent Engine & Memory System - Implementation Plan

## Executive Summary

This document provides a complete architectural blueprint for implementing the Intent Engine and Memory System in NEXUS. These services will transform NEXUS from a reactive assistant into a truly proactive AI companion that understands user goals, learns from interactions, and anticipates needs.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [IntentEngine Service](#intentengine-service)
3. [MemoryStore Service](#memorystore-service)
4. [Pattern Recognition System](#pattern-recognition-system)
5. [Integration Strategy](#integration-strategy)
6. [Type Definitions](#type-definitions)
7. [Privacy & Security](#privacy--security)

---

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEXUS Architecture                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐        │
│  │ ContextMonitor  │────▶│  IntentEngine   │────▶│  ProactiveAgent │        │
│  │                 │     │                 │     │                 │        │
│  │ - Active Window │     │ - Task Detection│     │ - Suggestion    │        │
│  │ - System State  │     │ - Goal Prediction│    │   Generation    │        │
│  │ - File Changes  │     │ - Struggle Detect│    │ - Action Timing │        │
│  │ - Clipboard     │     │ - Interruption   │    │                 │        │
│  │                 │     │   Scoring        │    │                 │        │
│  └─────────────────┘     └────────┬────────┘     └─────────────────┘        │
│           │                       │                                          │
│           │                       ▼                                          │
│           │              ┌─────────────────┐                                 │
│           │              │   MemoryStore   │                                 │
│           │              │                 │                                 │
│           │              │ - Preferences   │                                 │
│           │              │ - Patterns      │                                 │
│           └─────────────▶│ - Solutions     │                                 │
│                          │ - Work History  │                                 │
│                          │                 │                                 │
│                          └─────────────────┘                                 │
│                                   │                                          │
│                                   ▼                                          │
│                          ┌─────────────────┐                                 │
│                          │  Persistence    │                                 │
│                          │  (JSON Files)   │                                 │
│                          └─────────────────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **ContextMonitor** captures raw system context (window titles, apps, files)
2. **IntentEngine** analyzes context stream to detect intentions and struggles
3. **MemoryStore** provides historical context and learns from interactions
4. **IntentEngine** produces `IntentAnalysis` with confidence scores
5. **ProactiveAgent** uses intent data to generate contextual suggestions
6. **MemoryStore** persists learnings for future interactions

---

## IntentEngine Service

### File: `src/main/services/intent-engine.ts`

```typescript
// =============================================================================
// NEXUS - Intent Engine Service
// Analyzes user context to detect intentions, goals, and struggles
// =============================================================================

import { EventEmitter } from 'events';
import { ContextMonitor } from './context-monitor';
import { MemoryStore } from './memory-store';
import { 
  SystemContext, 
  ActiveWindowInfo,
  PiecesLtmMemory 
} from '../../shared/types';

// =============================================================================
// Intent Detection Types
// =============================================================================

export type IntentType = 
  | 'coding'           // Writing code
  | 'debugging'        // Fixing errors
  | 'researching'      // Reading docs, searching
  | 'writing'          // Documentation, emails
  | 'communicating'    // Slack, email, meetings
  | 'browsing'         // General web browsing
  | 'multitasking'     // Rapid context switching
  | 'stuck'            // Appears blocked
  | 'reviewing'        // Code review, reading
  | 'planning'         // Organization, scheduling
  | 'learning'         // Tutorial, documentation
  | 'deploying';       // CI/CD, releasing

export type TaskState = 
  | 'starting'         // Just begun
  | 'in_progress'      // Actively working
  | 'blocked'          // Stuck on something
  | 'pausing'          // Taking a break
  | 'resuming'         // Coming back
  | 'completing'       // Wrapping up
  | 'abandoned';       // Left unfinished

export interface DetectedIntent {
  type: IntentType;
  confidence: number;           // 0-1 confidence score
  timestamp: number;
  duration: number;             // Duration in ms
  context: {
    application: string;
    windowTitle: string;
    project?: string;
    technologies: string[];
  };
  indicators: IntentIndicator[];
}

export interface IntentIndicator {
  type: string;
  weight: number;               // Contribution to confidence
  evidence: string;
}

export interface GoalPrediction {
  predictedGoal: string;
  confidence: number;
  estimatedCompletionMinutes: number;
  subtasks: string[];
  blockers: string[];
}

export interface StruggleDetection {
  isStruggling: boolean;
  severity: 'mild' | 'moderate' | 'severe';
  indicators: StruggleIndicator[];
  suggestedHelp: string[];
  estimatedStartedAt: number;
}

export interface StruggleIndicator {
  type: 'repetition' | 'rapid_switching' | 'idle' | 'error_pattern' | 'search_spike';
  description: string;
  evidence: string[];
  timestamp: number;
}

export interface InterruptionOpportunity {
  score: number;                // 0-1, higher = better time to interrupt
  reason: string;
  suggestedTiming: 'now' | 'soon' | 'later';
  estimatedWaitMinutes: number;
}

export interface IntentAnalysis {
  currentIntent: DetectedIntent | null;
  intentHistory: DetectedIntent[];
  predictedGoal: GoalPrediction | null;
  struggleDetection: StruggleDetection;
  interruptionOpportunity: InterruptionOpportunity;
  sessionMetrics: SessionMetrics;
  timestamp: number;
}

export interface SessionMetrics {
  sessionStartTime: number;
  totalActiveTime: number;
  contextSwitches: number;
  productiveApps: number;
  distractingApps: number;
  focusScore: number;           // 0-100
}

// =============================================================================
// Intent Engine Configuration
// =============================================================================

export interface IntentEngineConfig {
  enabled: boolean;
  analysisIntervalMs: number;       // How often to analyze
  minContextDurationMs: number;     // Min time before intent detection
  struggleDetectionWindowMs: number; // Time window for struggle detection
  maxIntentHistorySize: number;     // How many intents to remember
  confidenceThreshold: number;      // Min confidence to report intent
}

export const DEFAULT_INTENT_CONFIG: IntentEngineConfig = {
  enabled: true,
  analysisIntervalMs: 5000,         // 5 seconds
  minContextDurationMs: 30000,      // 30 seconds
  struggleDetectionWindowMs: 300000, // 5 minutes
  maxIntentHistorySize: 100,
  confidenceThreshold: 0.6,
};

// =============================================================================
// Technology Detection Patterns
// =============================================================================

const TECHNOLOGY_PATTERNS: Record<string, RegExp[]> = {
  javascript: [/\.js$/, /\.jsx$/, /\.ts$/, /\.tsx$/, /node_modules/, /package\.json/],
  python: [/\.py$/, /requirements\.txt/, /setup\.py/, /Pipfile/, /\.ipynb$/],
  rust: [/\.rs$/, /Cargo\.toml$/, /Cargo\.lock$/],
  go: [/\.go$/, /go\.mod$/, /go\.sum$/],
  java: [/\.java$/, /\.jar$/, /pom\.xml$/, /build\.gradle$/],
  docker: [/Dockerfile/, /docker-compose/, /\.dockerignore$/],
  kubernetes: [/\.yaml$/, /\.yml$/, /k8s/, /helm/, /pod/, /deployment/],
  react: [/react/i, /\.jsx$/, /\.tsx$/, /create-react-app/, /next\.js/],
  vue: [/vue/i, /\.vue$/, /nuxt/],
  angular: [/angular/i, /\.component\.ts$/],
  database: [/\.sql$/, /postgres/i, /mysql/i, /mongodb/i, /redis/i],
  git: [/git/i, /\.git/, /github\.com/, /gitlab/],
};

const PRODUCTIVITY_APPS = [
  'code.exe', 'cursor.exe', 'idea', 'pycharm', 'webstorm',
  'terminal', 'iterm', 'cmd.exe', 'powershell',
  'figma', 'sketch', 'adobe',
  'notion', 'obsidian', 'todoist',
];

const DISTRACTING_APPS = [
  'twitter', 'facebook', 'instagram', 'tiktok',
  'youtube', 'netflix', 'spotify',
  'reddit', 'discord', 'slack', // Slack can be productive but often distracting
];

// =============================================================================
// Intent Engine Class
// =============================================================================

export class IntentEngine extends EventEmitter {
  private config: IntentEngineConfig;
  private contextMonitor: ContextMonitor | null = null;
  private memoryStore: MemoryStore | null = null;
  
  // State
  private isRunning: boolean = false;
  private analysisInterval: NodeJS.Timeout | null = null;
  private contextHistory: SystemContext[] = [];
  private intentHistory: DetectedIntent[] = [];
  private currentIntent: DetectedIntent | null = null;
  private sessionStartTime: number = Date.now();
  private lastActivityTime: number = Date.now();
  
  // Analysis state
  private windowTitleHistory: { title: string; timestamp: number }[] = [];
  private appSwitchHistory: { app: string; timestamp: number }[] = [];
  private errorMentions: { text: string; timestamp: number }[] = [];
  private searchTerms: { term: string; timestamp: number }[] = [];

  constructor(config?: Partial<IntentEngineConfig>) {
    super();
    this.config = { ...DEFAULT_INTENT_CONFIG, ...config };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  initialize(deps: {
    contextMonitor: ContextMonitor;
    memoryStore: MemoryStore;
  }): void {
    this.contextMonitor = deps.contextMonitor;
    this.memoryStore = deps.memoryStore;

    // Listen to context updates
    this.contextMonitor.on('update', (context: SystemContext) => {
      this.handleContextUpdate(context);
    });

    console.log('[IntentEngine] Initialized');
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  start(): void {
    if (this.isRunning || !this.config.enabled) return;

    this.isRunning = true;
    this.sessionStartTime = Date.now();

    // Start analysis loop
    this.analysisInterval = setInterval(() => {
      this.runAnalysis();
    }, this.config.analysisIntervalMs);

    console.log('[IntentEngine] Started');
    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    console.log('[IntentEngine] Stopped');
    this.emit('stopped');
  }

  // ===========================================================================
  // Context Processing
  // ===========================================================================

  private handleContextUpdate(context: SystemContext): void {
    this.lastActivityTime = Date.now();
    
    // Add to history (keep last 100)
    this.contextHistory.push(context);
    if (this.contextHistory.length > 100) {
      this.contextHistory = this.contextHistory.slice(-100);
    }

    // Track window title changes
    const title = context.activeWindow?.title;
    if (title) {
      this.windowTitleHistory.push({ title, timestamp: Date.now() });
      if (this.windowTitleHistory.length > 50) {
        this.windowTitleHistory = this.windowTitleHistory.slice(-50);
      }
    }

    // Track app switches
    const app = context.activeWindow?.application;
    if (app) {
      const lastApp = this.appSwitchHistory[this.appSwitchHistory.length - 1]?.app;
      if (app !== lastApp) {
        this.appSwitchHistory.push({ app, timestamp: Date.now() });
        if (this.appSwitchHistory.length > 50) {
          this.appSwitchHistory = this.appSwitchHistory.slice(-50);
        }
      }
    }

    // Detect error mentions in window titles
    this.detectErrorMentions(context);
  }

  private detectErrorMentions(context: SystemContext): void {
    const title = context.activeWindow?.title?.toLowerCase() || '';
    const errorPatterns = [
      /error/i, /exception/i, /failed/i, /failure/i,
      /crash/i, /bug/i, /fix/i, /debug/i,
      /stackoverflow/i, /github.com\/.*\/issues/i,
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(title)) {
        this.errorMentions.push({ text: title, timestamp: Date.now() });
        // Keep only last 20 error mentions
        if (this.errorMentions.length > 20) {
          this.errorMentions = this.errorMentions.slice(-20);
        }
        break;
      }
    }
  }

  // ===========================================================================
  // Main Analysis Loop
  // ===========================================================================

  private async runAnalysis(): Promise<void> {
    if (this.contextHistory.length < 2) return;

    const latestContext = this.contextHistory[this.contextHistory.length - 1];
    
    // Detect current intent
    const newIntent = this.detectIntent(latestContext);
    
    // Check if intent changed
    if (this.shouldUpdateIntent(newIntent)) {
      this.currentIntent = newIntent;
      this.intentHistory.push(newIntent);
      
      // Keep history size manageable
      if (this.intentHistory.length > this.config.maxIntentHistorySize) {
        this.intentHistory = this.intentHistory.slice(-this.config.maxIntentHistorySize);
      }

      // Store in memory
      await this.memoryStore?.recordIntent(newIntent);
      
      this.emit('intentChange', newIntent);
    }

    // Run comprehensive analysis
    const analysis = await this.performFullAnalysis(latestContext);
    
    // Emit analysis result
    this.emit('analysis', analysis);

    // Check for significant events
    if (analysis.struggleDetection.isStruggling && analysis.struggleDetection.severity === 'severe') {
      this.emit('struggleDetected', analysis.struggleDetection);
    }
  }

  // ===========================================================================
  // Intent Detection Algorithm
  // ===========================================================================

  private detectIntent(context: SystemContext): DetectedIntent {
    const app = context.activeWindow?.application?.toLowerCase() || '';
    const title = context.activeWindow?.title?.toLowerCase() || '';
    const project = this.extractProjectName(title, app);
    const technologies = this.detectTechnologies(title, app, context);

    // Calculate scores for each intent type
    const scores: Record<IntentType, { score: number; indicators: IntentIndicator[] }> = {
      coding: this.scoreCodingIntent(app, title, technologies),
      debugging: this.scoreDebuggingIntent(app, title),
      researching: this.scoreResearchingIntent(app, title),
      writing: this.scoreWritingIntent(app, title),
      communicating: this.scoreCommunicatingIntent(app, title),
      browsing: this.scoreBrowsingIntent(app, title),
      multitasking: this.scoreMultitaskingIntent(),
      stuck: this.scoreStuckIntent(),
      reviewing: this.scoreReviewingIntent(app, title),
      planning: this.scorePlanningIntent(app, title),
      learning: this.scoreLearningIntent(app, title),
      deploying: this.scoreDeployingIntent(app, title),
    };

    // Find highest scoring intent
    let bestIntent: IntentType = 'browsing';
    let bestScore = 0;
    let bestIndicators: IntentIndicator[] = [];

    for (const [intent, data] of Object.entries(scores)) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestIntent = intent as IntentType;
        bestIndicators = data.indicators;
      }
    }

    // Calculate duration if continuing same intent
    const duration = this.currentIntent?.type === bestIntent
      ? Date.now() - this.currentIntent.timestamp
      : 0;

    return {
      type: bestIntent,
      confidence: Math.min(bestScore, 1.0),
      timestamp: Date.now(),
      duration,
      context: {
        application: app,
        windowTitle: title,
        project,
        technologies,
      },
      indicators: bestIndicators,
    };
  }

  private shouldUpdateIntent(newIntent: DetectedIntent): boolean {
    if (!this.currentIntent) return true;
    
    // Update if intent type changed and confidence is high enough
    if (newIntent.type !== this.currentIntent.type && 
        newIntent.confidence >= this.config.confidenceThreshold) {
      return true;
    }

    // Update if same type but much higher confidence
    if (newIntent.type === this.currentIntent.type &&
        newIntent.confidence > this.currentIntent.confidence + 0.2) {
      return true;
    }

    return false;
  }

  // ===========================================================================
  // Intent Scoring Algorithms
  // ===========================================================================

  private scoreCodingIntent(app: string, title: string, technologies: string[]): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    let score = 0;

    // IDE detection
    const idePatterns = ['code.exe', 'cursor.exe', 'idea', 'pycharm', 'webstorm', 'sublime', 'atom', 'vim', 'neovim'];
    if (idePatterns.some(ide => app.includes(ide))) {
      score += 0.5;
      indicators.push({ type: 'ide_usage', weight: 0.5, evidence: `Using ${app}` });
    }

    // File extensions in title
    const codeExtensions = /\.(js|ts|jsx|tsx|py|rs|go|java|cpp|c|h|html|css|json|yaml|sql)$/i;
    if (codeExtensions.test(title)) {
      score += 0.3;
      indicators.push({ type: 'code_file', weight: 0.3, evidence: 'Editing code file' });
    }

    // Technologies detected
    if (technologies.length > 0) {
      score += 0.2;
      indicators.push({ type: 'tech_stack', weight: 0.2, evidence: technologies.join(', ') });
    }

    return { score: Math.min(score, 1.0), indicators };
  }

  private scoreDebuggingIntent(app: string, title: string): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    let score = 0;

    // Error keywords in title
    const errorPatterns = [/error/i, /exception/i, /debug/i, /crash/i, /failed/i, /breakpoint/i, /console/i];
    for (const pattern of errorPatterns) {
      if (pattern.test(title)) {
        score += 0.4;
        indicators.push({ type: 'error_keyword', weight: 0.4, evidence: `Pattern: ${pattern.source}` });
        break;
      }
    }

    // Debug tools
    if (app.includes('debug') || title.includes('devtools') || title.includes('inspector')) {
      score += 0.3;
      indicators.push({ type: 'debug_tool', weight: 0.3, evidence: 'Using debugging tools' });
    }

    // Stack Overflow or GitHub issues
    if (title.includes('stackoverflow') || /github\.com\/.*\/issues/.test(title)) {
      score += 0.3;
      indicators.push({ type: 'help_seeking', weight: 0.3, evidence: 'Looking for solutions online' });
    }

    return { score: Math.min(score, 1.0), indicators };
  }

  private scoreResearchingIntent(app: string, title: string): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    let score = 0;

    // Browser with documentation keywords
    const browserPatterns = ['chrome', 'firefox', 'safari', 'edge', 'brave'];
    const docPatterns = [/docs?\./i, /documentation/i, /api/i, /reference/i, /guide/i, /tutorial/i, /wiki/i];
    
    if (browserPatterns.some(b => app.includes(b))) {
      for (const pattern of docPatterns) {
        if (pattern.test(title)) {
          score += 0.5;
          indicators.push({ type: 'documentation', weight: 0.5, evidence: 'Reading documentation' });
          break;
        }
      }

      // Search patterns
      if (title.includes('google') || title.includes('search') || title.includes('?')) {
        score += 0.3;
        indicators.push({ type: 'searching', weight: 0.3, evidence: 'Performing search' });
      }
    }

    return { score: Math.min(score, 1.0), indicators };
  }

  private scoreStuckIntent(): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    let score = 0;

    const now = Date.now();
    const windowMs = this.config.struggleDetectionWindowMs;

    // Check for rapid app switching
    const recentSwitches = this.appSwitchHistory.filter(
      s => now - s.timestamp < windowMs
    );
    if (recentSwitches.length > 10) {
      score += 0.3;
      indicators.push({ type: 'rapid_switching', weight: 0.3, evidence: `${recentSwitches.length} app switches` });
    }

    // Check for repeated error mentions
    const recentErrors = this.errorMentions.filter(
      e => now - e.timestamp < windowMs
    );
    if (recentErrors.length > 3) {
      score += 0.4;
      indicators.push({ type: 'error_pattern', weight: 0.4, evidence: `${recentErrors.length} error mentions` });
    }

    // Check for repeated window titles (cycling through same files)
    const recentTitles = this.windowTitleHistory.filter(
      t => now - t.timestamp < windowMs
    );
    const uniqueTitles = new Set(recentTitles.map(t => t.title));
    if (recentTitles.length > 10 && uniqueTitles.size < 5) {
      score += 0.3;
      indicators.push({ type: 'repetition', weight: 0.3, evidence: 'Cycling through same content' });
    }

    return { score: Math.min(score, 1.0), indicators };
  }

  private scoreMultitaskingIntent(): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    
    const now = Date.now();
    const recentSwitches = this.appSwitchHistory.filter(
      s => now - s.timestamp < 60000 // Last minute
    );

    if (recentSwitches.length > 5) {
      return {
        score: 0.7,
        indicators: [{ type: 'rapid_context_switch', weight: 0.7, evidence: `${recentSwitches.length} switches in 1 min` }]
      };
    }

    return { score: 0, indicators };
  }

  private scoreWritingIntent(app: string, title: string): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    let score = 0;

    const writingApps = ['notion', 'obsidian', 'word', 'docs.google', 'typora', 'markdown'];
    const writingPatterns = [/\.md$/, /\.txt$/, /\.docx?$/, /draft/i, /blog/i, /write/i];

    if (writingApps.some(wa => app.includes(wa) || title.includes(wa))) {
      score += 0.5;
      indicators.push({ type: 'writing_app', weight: 0.5, evidence: app });
    }

    if (writingPatterns.some(p => p.test(title))) {
      score += 0.3;
      indicators.push({ type: 'writing_context', weight: 0.3, evidence: title });
    }

    return { score: Math.min(score, 1.0), indicators };
  }

  private scoreCommunicatingIntent(app: string, title: string): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    let score = 0;

    const commApps = ['slack', 'teams', 'discord', 'zoom', 'meet', 'telegram', 'whatsapp'];
    
    if (commApps.some(ca => app.includes(ca) || title.includes(ca))) {
      score += 0.7;
      indicators.push({ type: 'communication_app', weight: 0.7, evidence: app });
    }

    return { score: Math.min(score, 1.0), indicators };
  }

  private scoreBrowsingIntent(app: string, title: string): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    
    const browserApps = ['chrome', 'firefox', 'safari', 'edge', 'brave', 'opera'];
    
    if (browserApps.some(ba => app.includes(ba))) {
      // Default to browsing if no other specific intent detected
      return {
        score: 0.3,
        indicators: [{ type: 'browser_usage', weight: 0.3, evidence: 'General browsing' }]
      };
    }

    return { score: 0, indicators };
  }

  private scoreReviewingIntent(app: string, title: string): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    let score = 0;

    if (title.includes('pull request') || title.includes('code review') || title.includes('diff')) {
      score += 0.6;
      indicators.push({ type: 'code_review', weight: 0.6, evidence: 'Reviewing code changes' });
    }

    if (app.includes('github') && title.includes('compare')) {
      score += 0.4;
      indicators.push({ type: 'comparison', weight: 0.4, evidence: 'Comparing changes' });
    }

    return { score: Math.min(score, 1.0), indicators };
  }

  private scorePlanningIntent(app: string, title: string): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    let score = 0;

    const planningApps = ['todoist', 'trello', 'jira', 'notion', 'calendar', 'outlook'];
    const planningKeywords = [/plan/i, /roadmap/i, /schedule/i, /backlog/i, /sprint/i];

    if (planningApps.some(pa => app.includes(pa) || title.includes(pa))) {
      score += 0.4;
      indicators.push({ type: 'planning_app', weight: 0.4, evidence: app });
    }

    if (planningKeywords.some(p => p.test(title))) {
      score += 0.3;
      indicators.push({ type: 'planning_context', weight: 0.3, evidence: title });
    }

    return { score: Math.min(score, 1.0), indicators };
  }

  private scoreLearningIntent(app: string, title: string): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    let score = 0;

    const learningKeywords = [/tutorial/i, /course/i, /learn/i, /lesson/i, /training/i, /getting started/i];
    
    for (const pattern of learningKeywords) {
      if (pattern.test(title)) {
        score += 0.5;
        indicators.push({ type: 'learning_context', weight: 0.5, evidence: title });
        break;
      }
    }

    // YouTube learning
    if (app.includes('chrome') && title.includes('youtube') && 
        (title.includes('tutorial') || title.includes('how to') || title.includes('course'))) {
      score += 0.4;
      indicators.push({ type: 'video_learning', weight: 0.4, evidence: 'Watching educational content' });
    }

    return { score: Math.min(score, 1.0), indicators };
  }

  private scoreDeployingIntent(app: string, title: string): { score: number; indicators: IntentIndicator[] } {
    const indicators: IntentIndicator[] = [];
    let score = 0;

    const deployKeywords = [/deploy/i, /ci\/cd/i, /pipeline/i, /build/i, /release/i, /publish/i];
    const deployApps = ['jenkins', 'github actions', 'gitlab ci', 'circleci', 'travis'];

    if (deployApps.some(da => app.includes(da) || title.includes(da))) {
      score += 0.5;
      indicators.push({ type: 'deploy_tool', weight: 0.5, evidence: app });
    }

    for (const pattern of deployKeywords) {
      if (pattern.test(title)) {
        score += 0.4;
        indicators.push({ type: 'deploy_context', weight: 0.4, evidence: title });
        break;
      }
    }

    // Terminal with git push
    if ((app.includes('terminal') || app.includes('powershell')) && 
        (title.includes('git push') || title.includes('deploy'))) {
      score += 0.3;
      indicators.push({ type: 'terminal_deploy', weight: 0.3, evidence: 'Deploying via terminal' });
    }

    return { score: Math.min(score, 1.0), indicators };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private extractProjectName(title: string, app: string): string | undefined {
    // VS Code / Cursor pattern: "filename - project - Code"
    if (app.toLowerCase().includes('code') || app.toLowerCase().includes('cursor')) {
      const parts = title.split(' - ');
      if (parts.length >= 2) {
        return parts[parts.length - 2];
      }
    }

    // Terminal pattern: look for directory
    if (app.toLowerCase().includes('terminal') || app.toLowerCase().includes('iterm')) {
      const match = title.match(/[\/]([^\/]+)$/);
      if (match) return match[1];
    }

    return undefined;
  }

  private detectTechnologies(title: string, app: string, context: SystemContext): string[] {
    const detected: string[] = [];
    const combinedText = `${title} ${app}`.toLowerCase();

    for (const [tech, patterns] of Object.entries(TECHNOLOGY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(combinedText)) {
          detected.push(tech);
          break;
        }
      }
    }

    return [...new Set(detected)];
  }

  // ===========================================================================
  // Full Analysis
  // ===========================================================================

  private async performFullAnalysis(context: SystemContext): Promise<IntentAnalysis> {
    const struggleDetection = this.detectStruggle();
    const predictedGoal = this.predictGoal();
    const interruptionOpportunity = this.calculateInterruptionOpportunity();
    const sessionMetrics = this.calculateSessionMetrics();

    return {
      currentIntent: this.currentIntent,
      intentHistory: this.intentHistory,
      predictedGoal,
      struggleDetection,
      interruptionOpportunity,
      sessionMetrics,
      timestamp: Date.now(),
    };
  }

  // ===========================================================================
  // Struggle Detection Algorithm
  // ===========================================================================

  private detectStruggle(): StruggleDetection {
    const now = Date.now();
    const windowMs = this.config.struggleDetectionWindowMs;
    const indicators: StruggleIndicator[] = [];

    // Check repetition pattern (same window titles)
    const recentTitles = this.windowTitleHistory.filter(t => now - t.timestamp < windowMs);
    const titleCounts: Record<string, number> = {};
    for (const t of recentTitles) {
      titleCounts[t.title] = (titleCounts[t.title] || 0) + 1;
    }
    const repeatedTitles = Object.entries(titleCounts).filter(([, count]) => count > 3);
    if (repeatedTitles.length > 0) {
      indicators.push({
        type: 'repetition',
        description: 'Repeatedly viewing same content',
        evidence: repeatedTitles.map(([title, count]) => `${title} (${count}x)`),
        timestamp: now,
      });
    }

    // Check rapid app switching
    const recentSwitches = this.appSwitchHistory.filter(s => now - s.timestamp < windowMs);
    if (recentSwitches.length > 15) {
      indicators.push({
        type: 'rapid_switching',
        description: 'Rapid context switching',
        evidence: [`${recentSwitches.length} app switches in ${Math.round(windowMs / 60000)} min`],
        timestamp: now,
      });
    }

    // Check error mentions
    const recentErrors = this.errorMentions.filter(e => now - e.timestamp < windowMs);
    if (recentErrors.length > 2) {
      indicators.push({
        type: 'error_pattern',
        description: 'Multiple error references',
        evidence: recentErrors.slice(-3).map(e => e.text.substring(0, 50)),
        timestamp: now,
      });
    }

    // Check idle time within "active" period
    const timeSinceActivity = now - this.lastActivityTime;
    if (timeSinceActivity > 60000 && timeSinceActivity < 300000) {
      indicators.push({
        type: 'idle',
        description: 'Idle during active session',
        evidence: [`Idle for ${Math.round(timeSinceActivity / 1000)} seconds`],
        timestamp: now,
      });
    }

    // Calculate severity
    let severity: 'mild' | 'moderate' | 'severe' = 'mild';
    const indicatorCount = indicators.length;
    const hasErrorPattern = indicators.some(i => i.type === 'error_pattern');
    const hasRepetition = indicators.some(i => i.type === 'repetition');

    if (indicatorCount >= 3 || (hasErrorPattern && hasRepetition)) {
      severity = 'severe';
    } else if (indicatorCount >= 2) {
      severity = 'moderate';
    }

    // Suggest help based on patterns
    const suggestedHelp: string[] = [];
    if (hasErrorPattern) {
      suggestedHelp.push('Search for error solutions');
      suggestedHelp.push('Review similar past errors');
    }
    if (hasRepetition) {
      suggestedHelp.push('Take a break and revisit with fresh eyes');
      suggestedHelp.push('Try a different approach');
    }
    if (indicators.some(i => i.type === 'rapid_switching')) {
      suggestedHelp.push('Focus on one task at a time');
    }

    return {
      isStruggling: indicators.length > 0,
      severity,
      indicators,
      suggestedHelp,
      estimatedStartedAt: now - windowMs,
    };
  }

  // ===========================================================================
  // Goal Prediction Algorithm
  // ===========================================================================

  private predictGoal(): GoalPrediction | null {
    if (!this.currentIntent) return null;

    const intent = this.currentIntent;
    const memoryPatterns = this.memoryStore?.getPatternsForContext(intent.context) || [];

    // Build prediction based on intent type and historical patterns
    let predictedGoal = '';
    let estimatedMinutes = 30;
    const subtasks: string[] = [];
    const blockers: string[] = [];

    switch (intent.type) {
      case 'coding':
        predictedGoal = `Implement feature/fix in ${intent.context.project || 'current project'}`;
        estimatedMinutes = 45;
        subtasks.push('Write code', 'Test changes', 'Review implementation');
        break;
      case 'debugging':
        predictedGoal = 'Resolve the current error/issue';
        estimatedMinutes = 20;
        subtasks.push('Identify root cause', 'Implement fix', 'Verify solution');
        blockers.push(...this.errorMentions.slice(-3).map(e => e.text.substring(0, 50)));
        break;
      case 'researching':
        predictedGoal = 'Gather information for implementation';
        estimatedMinutes = 15;
        subtasks.push('Find documentation', 'Review examples', 'Take notes');
        break;
      case 'reviewing':
        predictedGoal = 'Review and approve changes';
        estimatedMinutes = 15;
        subtasks.push('Read changes', 'Test functionality', 'Leave feedback');
        break;
      case 'deploying':
        predictedGoal = 'Deploy changes to production/staging';
        estimatedMinutes = 10;
        subtasks.push('Run tests', 'Build artifacts', 'Deploy', 'Verify deployment');
        break;
      default:
        predictedGoal = 'Complete current task';
        estimatedMinutes = 25;
    }

    // Adjust based on memory patterns
    if (memoryPatterns.length > 0) {
      const avgDuration = memoryPatterns.reduce((sum, p) => sum + p.averageDurationMinutes, 0) / memoryPatterns.length;
      estimatedMinutes = Math.round(avgDuration);
    }

    // Calculate confidence based on intent confidence and pattern match
    const confidence = intent.confidence * (memoryPatterns.length > 0 ? 0.9 : 0.7);

    return {
      predictedGoal,
      confidence: Math.min(confidence, 1.0),
      estimatedCompletionMinutes: estimatedMinutes,
      subtasks,
      blockers,
    };
  }

  // ===========================================================================
  // Interruption Opportunity Scoring
  // ===========================================================================

  private calculateInterruptionOpportunity(): InterruptionOpportunity {
    const now = Date.now();
    let score = 0.5; // Start neutral
    let reason = '';

    // Factor 1: Idle time (sweet spot: 30-120 seconds)
    const idleSeconds = (now - this.lastActivityTime) / 1000;
    if (idleSeconds < 10) {
      score -= 0.3;
      reason = 'User is actively working';
    } else if (idleSeconds >= 30 && idleSeconds <= 120) {
      score += 0.2;
      reason = 'User just paused';
    } else if (idleSeconds > 300) {
      score -= 0.2;
      reason = 'User has been away';
    }

    // Factor 2: Intent type
    if (this.currentIntent) {
      switch (this.currentIntent.type) {
        case 'stuck':
          score += 0.3;
          reason = 'User appears stuck';
          break;
        case 'multitasking':
          score += 0.1;
          break;
        case 'coding':
        case 'debugging':
          score -= 0.1;
          break;
        case 'communicating':
          score -= 0.2;
          break;
      }
    }

    // Factor 3: Recent interruptions
    const recentInterruptions = this.intentHistory.filter(
      i => i.type === 'interrupt' && now - i.timestamp < 600000
    ).length;
    score -= recentInterruptions * 0.1;

    // Determine timing
    let suggestedTiming: 'now' | 'soon' | 'later' = 'later';
    let estimatedWaitMinutes = 5;

    if (score >= 0.7) {
      suggestedTiming = 'now';
      estimatedWaitMinutes = 0;
    } else if (score >= 0.5) {
      suggestedTiming = 'soon';
      estimatedWaitMinutes = 2;
    } else {
      suggestedTiming = 'later';
      estimatedWaitMinutes = 10;
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      reason,
      suggestedTiming,
      estimatedWaitMinutes,
    };
  }

  // ===========================================================================
  // Session Metrics
  // ===========================================================================

  private calculateSessionMetrics(): SessionMetrics {
    const now = Date.now();
    const productiveApps = this.appSwitchHistory.filter(
      s => PRODUCTIVITY_APPS.some(pa => s.app.toLowerCase().includes(pa))
    ).length;
    
    const distractingApps = this.appSwitchHistory.filter(
      s => DISTRACTING_APPS.some(da => s.app.toLowerCase().includes(da))
    ).length;

    // Calculate focus score (0-100)
    const totalSwitches = this.appSwitchHistory.length;
    const productivityRatio = totalSwitches > 0 ? productiveApps / totalSwitches : 0.5;
    const distractionPenalty = distractingApps * 5;
    const switchPenalty = Math.min(totalSwitches, 20) * 2;
    
    let focusScore = Math.round((productivityRatio * 100) - distractionPenalty - switchPenalty);
    focusScore = Math.max(0, Math.min(100, focusScore));

    return {
      sessionStartTime: this.sessionStartTime,
      totalActiveTime: now - this.sessionStartTime,
      contextSwitches: totalSwitches,
      productiveApps,
      distractingApps,
      focusScore,
    };
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  getCurrentAnalysis(): IntentAnalysis | null {
    if (!this.currentIntent) return null;
    return {
      currentIntent: this.currentIntent,
      intentHistory: this.intentHistory,
      predictedGoal: this.predictGoal(),
      struggleDetection: this.detectStruggle(),
      interruptionOpportunity: this.calculateInterruptionOpportunity(),
      sessionMetrics: this.calculateSessionMetrics(),
      timestamp: Date.now(),
    };
  }

  getIntentHistory(): DetectedIntent[] {
    return [...this.intentHistory];
  }

  getCurrentIntent(): DetectedIntent | null {
    return this.currentIntent;
  }

  updateConfig(config: Partial<IntentEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default IntentEngine;
```

---

## MemoryStore Service

### File: `src/main/services/memory-store.ts`

```typescript
// =============================================================================
// NEXUS - Memory Store Service
// Persistent storage for user preferences, patterns, and learned knowledge
// =============================================================================

import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';
import { DetectedIntent, IntentType } from './intent-engine';

// =============================================================================
// Memory Data Types
// =============================================================================

export interface UserPreference {
  id: string;
  category: 'communication' | 'workflow' | 'technical' | 'privacy';
  key: string;
  value: any;
  confidence: number;      // How certain we are of this preference (0-1)
  source: 'explicit' | 'inferred' | 'learned'; // How we learned it
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
}

export interface TaskPattern {
  id: string;
  name: string;
  intentType: IntentType;
  technologies: string[];
  applications: string[];
  steps: TaskStep[];
  averageDurationMinutes: number;
  completionRate: number;  // 0-1
  createdAt: number;
  lastExecutedAt: number;
  executionCount: number;
}

export interface TaskStep {
  order: number;
  description: string;
  application?: string;
  estimatedDurationMinutes: number;
  optional: boolean;
}

export interface ErrorSolution {
  id: string;
  errorPattern: string;        // Regex pattern or keyword
  errorHash: string;           // For quick lookup
  technologies: string[];
  solution: string;
  source: 'user_provided' | 'learned' | 'external';
  successRate: number;         // 0-1 based on success reports
  usageCount: number;
  createdAt: number;
  lastUsedAt: number;
  context?: {
    windowTitle?: string;
    application?: string;
    project?: string;
  };
}

export interface WorkContext {
  id: string;
  timestamp: number;
  intent: IntentType;
  application: string;
  project?: string;
  technologies: string[];
  duration: number;
  outcome: 'completed' | 'interrupted' | 'abandoned' | 'ongoing';
  notes?: string;
}

export interface LearnedAssociation {
  id: string;
  triggerType: 'time' | 'application' | 'project' | 'intent';
  triggerValue: string;
  associatedAction: string;
  confidence: number;
  occurrenceCount: number;
  lastOccurredAt: number;
}

export interface DailySummary {
  date: string;              // YYYY-MM-DD
  intents: Record<IntentType, number>;
  applications: Record<string, number>;
  projects: Record<string, number>;
  focusScore: number;
  struggleEvents: number;
  productiveHours: number;
}

// =============================================================================
// Memory Store Data Structure
// =============================================================================

interface MemoryStoreData {
  version: number;
  preferences: UserPreference[];
  taskPatterns: TaskPattern[];
  errorSolutions: ErrorSolution[];
  workHistory: WorkContext[];
  learnedAssociations: LearnedAssociation[];
  dailySummaries: DailySummary[];
  privacySettings: PrivacySettings;
}

interface PrivacySettings {
  retainWorkHistoryDays: number;
  retainErrorSolutions: boolean;
  allowPatternLearning: boolean;
  allowPreferenceLearning: boolean;
  sensitiveApplications: string[];
  sensitiveProjects: string[];
  dataRetentionLevel: 'minimal' | 'balanced' | 'comprehensive';
}

const MEMORY_VERSION = 1;
const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  retainWorkHistoryDays: 30,
  retainErrorSolutions: true,
  allowPatternLearning: true,
  allowPreferenceLearning: true,
  sensitiveApplications: ['1password', 'lastpass', 'keychain', 'bank', 'paypal'],
  sensitiveProjects: [],
  dataRetentionLevel: 'balanced',
};

// =============================================================================
// Memory Store Configuration
// =============================================================================

export interface MemoryStoreConfig {
  autoSaveIntervalMs: number;
  maxWorkHistorySize: number;
  maxErrorSolutions: number;
  maxTaskPatterns: number;
  patternLearningThreshold: number;
}

const DEFAULT_MEMORY_CONFIG: MemoryStoreConfig = {
  autoSaveIntervalMs: 60000,      // 1 minute
  maxWorkHistorySize: 1000,
  maxErrorSolutions: 500,
  maxTaskPatterns: 100,
  patternLearningThreshold: 3,    // Need 3 occurrences to form a pattern
};

// =============================================================================
// Memory Store Class
// =============================================================================

export class MemoryStore extends EventEmitter {
  private data: MemoryStoreData;
  private config: MemoryStoreConfig;
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MemoryStoreConfig>) {
    super();
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    
    this.data = {
      version: MEMORY_VERSION,
      preferences: [],
      taskPatterns: [],
      errorSolutions: [],
      workHistory: [],
      learnedAssociations: [],
      dailySummaries: [],
      privacySettings: { ...DEFAULT_PRIVACY_SETTINGS },
    };

    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'memory-store.json');

    this.load();
    this.startAutoSave();
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  private async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as MemoryStoreData;

      if (parsed.version !== MEMORY_VERSION) {
        console.log(`[MemoryStore] Migrating from version ${parsed.version} to ${MEMORY_VERSION}`);
        this.migrateData(parsed);
      }

      this.data = parsed;
      console.log(`[MemoryStore] Loaded: ${this.data.preferences.length} preferences, ${this.data.taskPatterns.length} patterns`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[MemoryStore] Load error:', error);
      }
      // Use defaults for new store
    }
  }

  private migrateData(oldData: any): void {
    // Handle future migrations here
    oldData.version = MEMORY_VERSION;
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.save();
    }, this.config.autoSaveIntervalMs);
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save();
    }, 1000);
  }

  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Sanitize sensitive data before saving
      const sanitized = this.sanitizeForStorage();
      
      await fs.writeFile(this.filePath, JSON.stringify(sanitized, null, 2), 'utf-8');
      this.emit('saved');
    } catch (error) {
      console.error('[MemoryStore] Save error:', error);
      this.emit('saveError', error);
    }
  }

  private sanitizeForStorage(): MemoryStoreData {
    const sensitiveApps = new Set(this.data.privacySettings.sensitiveApplications.map(a => a.toLowerCase()));
    
    // Filter out sensitive work history
    const filteredHistory = this.data.workHistory.filter(work => {
      return !sensitiveApps.has(work.application.toLowerCase());
    });

    return {
      ...this.data,
      workHistory: filteredHistory,
    };
  }

  stop(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  // ===========================================================================
  // Privacy Controls
  // ===========================================================================

  updatePrivacySettings(settings: Partial<PrivacySettings>): void {
    this.data.privacySettings = { ...this.data.privacySettings, ...settings };
    this.applyPrivacySettings();
    this.scheduleSave();
  }

  getPrivacySettings(): PrivacySettings {
    return { ...this.data.privacySettings };
  }

  private applyPrivacySettings(): void {
    const settings = this.data.privacySettings;

    // Apply retention policy
    const cutoffDate = Date.now() - (settings.retainWorkHistoryDays * 24 * 60 * 60 * 1000);
    this.data.workHistory = this.data.workHistory.filter(w => w.timestamp > cutoffDate);

    // Clear error solutions if disabled
    if (!settings.retainErrorSolutions) {
      this.data.errorSolutions = [];
    }

    // Limit based on retention level
    switch (settings.dataRetentionLevel) {
      case 'minimal':
        this.data.workHistory = this.data.workHistory.slice(-100);
        this.data.taskPatterns = this.data.taskPatterns.slice(-10);
        break;
      case 'balanced':
        this.data.workHistory = this.data.workHistory.slice(-500);
        this.data.taskPatterns = this.data.taskPatterns.slice(-50);
        break;
      case 'comprehensive':
        // Keep all within retention period
        break;
    }
  }

  addSensitiveApplication(appName: string): void {
    if (!this.data.privacySettings.sensitiveApplications.includes(appName)) {
      this.data.privacySettings.sensitiveApplications.push(appName);
      this.scheduleSave();
    }
  }

  removeSensitiveApplication(appName: string): void {
    this.data.privacySettings.sensitiveApplications = 
      this.data.privacySettings.sensitiveApplications.filter(a => a !== appName);
    this.scheduleSave();
  }

  // ===========================================================================
  // User Preferences
  // ===========================================================================

  setPreference(
    category: UserPreference['category'],
    key: string,
    value: any,
    source: UserPreference['source'] = 'inferred',
    confidence: number = 0.5
  ): UserPreference {
    const existingIndex = this.data.preferences.findIndex(
      p => p.category === category && p.key === key
    );

    const preference: UserPreference = {
      id: `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category,
      key,
      value,
      confidence,
      source,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
    };

    if (existingIndex >= 0) {
      const existing = this.data.preferences[existingIndex];
      preference.id = existing.id;
      preference.accessCount = existing.accessCount + 1;
      // Update confidence if new info
      if (source === 'explicit') {
        preference.confidence = 1.0;
      } else {
        // Boost confidence with repeated observations
        preference.confidence = Math.min(0.95, existing.confidence + 0.1);
      }
      this.data.preferences[existingIndex] = preference;
    } else {
      this.data.preferences.push(preference);
    }

    this.scheduleSave();
    this.emit('preferenceUpdated', preference);
    return preference;
  }

  getPreference(category: string, key: string): UserPreference | null {
    const pref = this.data.preferences.find(
      p => p.category === category && p.key === key
    );
    
    if (pref) {
      pref.lastAccessed = Date.now();
      pref.accessCount++;
    }
    
    return pref || null;
  }

  getPreferencesByCategory(category: string): UserPreference[] {
    return this.data.preferences.filter(p => p.category === category);
  }

  getAllPreferences(): UserPreference[] {
    return [...this.data.preferences];
  }

  deletePreference(id: string): boolean {
    const index = this.data.preferences.findIndex(p => p.id === id);
    if (index >= 0) {
      this.data.preferences.splice(index, 1);
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // ===========================================================================
  // Task Patterns
  // ===========================================================================

  recordIntent(intent: DetectedIntent): void {
    // Check if this is a sensitive context
    if (this.isSensitiveContext(intent.context)) {
      return;
    }

    // Record work context
    const workContext: WorkContext = {
      id: `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: intent.timestamp,
      intent: intent.type,
      application: intent.context.application,
      project: intent.context.project,
      technologies: intent.context.technologies,
      duration: intent.duration,
      outcome: 'ongoing',
    };

    // Update previous work context outcome if exists
    if (this.data.workHistory.length > 0) {
      const lastWork = this.data.workHistory[this.data.workHistory.length - 1];
      if (lastWork.outcome === 'ongoing') {
        lastWork.outcome = Date.now() - lastWork.timestamp > 300000 ? 'completed' : 'interrupted';
        lastWork.duration = Date.now() - lastWork.timestamp;
      }
    }

    this.data.workHistory.push(workContext);

    // Enforce size limit
    if (this.data.workHistory.length > this.config.maxWorkHistorySize) {
      this.data.workHistory = this.data.workHistory.slice(-this.config.maxWorkHistorySize);
    }

    // Learn patterns
    if (this.data.privacySettings.allowPatternLearning) {
      this.learnFromIntent(intent);
    }

    this.scheduleSave();
  }

  private isSensitiveContext(context: DetectedIntent['context']): boolean {
    const sensitiveApps = new Set(this.data.privacySettings.sensitiveApplications.map(a => a.toLowerCase()));
    const sensitiveProjects = new Set(this.data.privacySettings.sensitiveProjects.map(p => p.toLowerCase()));

    return sensitiveApps.has(context.application.toLowerCase()) ||
           (context.project && sensitiveProjects.has(context.project.toLowerCase()));
  }

  private learnFromIntent(intent: DetectedIntent): void {
    // Find or create pattern
    const matchingPattern = this.data.taskPatterns.find(p => 
      p.intentType === intent.type &&
      this.arraysOverlap(p.technologies, intent.context.technologies) &&
      p.applications.includes(intent.context.application)
    );

    if (matchingPattern) {
      // Update existing pattern
      matchingPattern.executionCount++;
      matchingPattern.lastExecutedAt = Date.now();
      
      // Adjust average duration
      const currentAvg = matchingPattern.averageDurationMinutes;
      const durationMinutes = intent.duration / 60000;
      matchingPattern.averageDurationMinutes = 
        (currentAvg * (matchingPattern.executionCount - 1) + durationMinutes) / matchingPattern.executionCount;
    } else if (this.data.taskPatterns.length < this.config.maxTaskPatterns) {
      // Create new pattern
      const pattern: TaskPattern = {
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: this.generatePatternName(intent),
        intentType: intent.type,
        technologies: intent.context.technologies,
        applications: [intent.context.application],
        steps: this.inferSteps(intent),
        averageDurationMinutes: 5,
        completionRate: 0.8,
        createdAt: Date.now(),
        lastExecutedAt: Date.now(),
        executionCount: 1,
      };
      this.data.taskPatterns.push(pattern);
    }
  }

  private generatePatternName(intent: DetectedIntent): string {
    const tech = intent.context.technologies[0] || '';
    const app = intent.context.application.split('.')[0] || '';
    return `${intent.type}${tech ? ` in ${tech}` : ''}${app ? ` (${app})` : ''}`;
  }

  private inferSteps(intent: DetectedIntent): TaskStep[] {
    // Basic step inference based on intent type
    const steps: TaskStep[] = [];
    
    switch (intent.type) {
      case 'coding':
        steps.push({ order: 1, description: 'Open/Create file', estimatedDurationMinutes: 2, optional: false });
        steps.push({ order: 2, description: 'Write code', estimatedDurationMinutes: 15, optional: false });
        steps.push({ order: 3, description: 'Test changes', estimatedDurationMinutes: 5, optional: true });
        break;
      case 'debugging':
        steps.push({ order: 1, description: 'Identify error', estimatedDurationMinutes: 5, optional: false });
        steps.push({ order: 2, description: 'Research solution', estimatedDurationMinutes: 10, optional: false });
        steps.push({ order: 3, description: 'Apply fix', estimatedDurationMinutes: 5, optional: false });
        break;
      case 'researching':
        steps.push({ order: 1, description: 'Find resources', estimatedDurationMinutes: 10, optional: false });
        steps.push({ order: 2, description: 'Read/Watch content', estimatedDurationMinutes: 15, optional: false });
        steps.push({ order: 3, description: 'Take notes', estimatedDurationMinutes: 5, optional: true });
        break;
    }

    return steps;
  }

  private arraysOverlap(a: string[], b: string[]): boolean {
    return a.some(item => b.includes(item)) || b.length === 0 || a.length === 0;
  }

  getPatternsForContext(context: {
    application?: string;
    project?: string;
    technologies?: string[];
  }): TaskPattern[] {
    return this.data.taskPatterns.filter(p => {
      if (context.application && p.applications.includes(context.application)) {
        return true;
      }
      if (context.technologies && this.arraysOverlap(p.technologies, context.technologies)) {
        return true;
      }
      return false;
    }).sort((a, b) => b.executionCount - a.executionCount);
  }

  getTaskPatterns(): TaskPattern[] {
    return [...this.data.taskPatterns];
  }

  updatePatternCompletionRate(patternId: string, completed: boolean): void {
    const pattern = this.data.taskPatterns.find(p => p.id === patternId);
    if (pattern) {
      const currentSuccess = pattern.completionRate * pattern.executionCount;
      pattern.completionRate = (currentSuccess + (completed ? 1 : 0)) / (pattern.executionCount + 1);
      this.scheduleSave();
    }
  }

  // ===========================================================================
  // Error Solutions
  // ===========================================================================

  addErrorSolution(
    errorPattern: string,
    solution: string,
    technologies: string[],
    context?: { windowTitle?: string; application?: string; project?: string }
  ): ErrorSolution {
    const hash = this.hashError(errorPattern);
    
    // Check for existing similar solution
    const existing = this.data.errorSolutions.find(es => es.errorHash === hash);
    if (existing) {
      // Update success rate and usage
      existing.usageCount++;
      existing.lastUsedAt = Date.now();
      this.scheduleSave();
      return existing;
    }

    const errorSolution: ErrorSolution = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      errorPattern,
      errorHash: hash,
      technologies,
      solution,
      source: 'user_provided',
      successRate: 1.0,
      usageCount: 1,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      context,
    };

    this.data.errorSolutions.push(errorSolution);

    // Enforce limit
    if (this.data.errorSolutions.length > this.config.maxErrorSolutions) {
      // Remove least used
      this.data.errorSolutions.sort((a, b) => a.usageCount - b.usageCount);
      this.data.errorSolutions = this.data.errorSolutions.slice(-this.config.maxErrorSolutions);
    }

    this.scheduleSave();
    this.emit('errorSolutionAdded', errorSolution);
    return errorSolution;
  }

  findErrorSolutions(errorText: string, technologies?: string[]): ErrorSolution[] {
    const hash = this.hashError(errorText);
    const lowerError = errorText.toLowerCase();

    let solutions = this.data.errorSolutions.filter(es => {
      // Match by hash (exact)
      if (es.errorHash === hash) return true;
      
      // Match by pattern
      if (new RegExp(es.errorPattern, 'i').test(errorText)) return true;
      
      // Match by keyword overlap
      const errorWords = lowerError.split(/\s+/);
      const patternWords = es.errorPattern.toLowerCase().split(/\s+/);
      const overlap = errorWords.filter(w => patternWords.includes(w)).length;
      return overlap >= 3;
    });

    // Filter by technology if provided
    if (technologies && technologies.length > 0) {
      solutions = solutions.filter(es => 
        es.technologies.some(t => technologies.includes(t))
      );
    }

    // Sort by success rate and usage
    return solutions.sort((a, b) => {
      const scoreA = a.successRate * Math.log(a.usageCount + 1);
      const scoreB = b.successRate * Math.log(b.usageCount + 1);
      return scoreB - scoreA;
    });
  }

  reportSolutionSuccess(errorSolutionId: string, success: boolean): void {
    const solution = this.data.errorSolutions.find(es => es.id === errorSolutionId);
    if (solution) {
      const currentSuccess = solution.successRate * solution.usageCount;
      solution.usageCount++;
      solution.successRate = (currentSuccess + (success ? 1 : 0)) / solution.usageCount;
      this.scheduleSave();
    }
  }

  private hashError(errorText: string): string {
    // Simple hash for quick lookup
    let hash = 0;
    const normalized = errorText.toLowerCase().replace(/\s+/g, ' ').trim();
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // ===========================================================================
  // Work History
  // ===========================================================================

  getWorkHistory(limit: number = 100): WorkContext[] {
    return this.data.workHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getWorkHistoryForProject(project: string): WorkContext[] {
    return this.data.workHistory.filter(w => w.project === project);
  }

  getRecentIntents(minutes: number = 60): Record<IntentType, number> {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recent = this.data.workHistory.filter(w => w.timestamp > cutoff);
    
    const counts: Record<string, number> = {};
    for (const work of recent) {
      counts[work.intent] = (counts[work.intent] || 0) + 1;
    }
    
    return counts as Record<IntentType, number>;
  }

  // ===========================================================================
  // Learned Associations
  // ===========================================================================

  recordAssociation(
    triggerType: LearnedAssociation['triggerType'],
    triggerValue: string,
    associatedAction: string
  ): void {
    const existing = this.data.learnedAssociations.find(
      la => la.triggerType === triggerType && 
            la.triggerValue === triggerValue && 
            la.associatedAction === associatedAction
    );

    if (existing) {
      existing.occurrenceCount++;
      existing.lastOccurredAt = Date.now();
      existing.confidence = Math.min(0.95, existing.confidence + 0.05);
    } else {
      this.data.learnedAssociations.push({
        id: `assoc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        triggerType,
        triggerValue,
        associatedAction,
        confidence: 0.3,
        occurrenceCount: 1,
        lastOccurredAt: Date.now(),
      });
    }

    this.scheduleSave();
  }

  getAssociationsForTrigger(
    triggerType: LearnedAssociation['triggerType'],
    triggerValue: string
  ): LearnedAssociation[] {
    return this.data.learnedAssociations
      .filter(la => la.triggerType === triggerType && la.triggerValue === triggerValue)
      .sort((a, b) => b.confidence - a.confidence);
  }

  // ===========================================================================
  // Daily Summaries
  // ===========================================================================

  generateDailySummary(date?: string): DailySummary {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const dayStart = new Date(targetDate).getTime();
    const dayEnd = dayStart + (24 * 60 * 60 * 1000);

    const dayWork = this.data.workHistory.filter(w => 
      w.timestamp >= dayStart && w.timestamp < dayEnd
    );

    const intents: Record<string, number> = {};
    const applications: Record<string, number> = {};
    const projects: Record<string, number> = {};
    let totalDuration = 0;
    let struggleEvents = 0;

    for (const work of dayWork) {
      intents[work.intent] = (intents[work.intent] || 0) + 1;
      applications[work.application] = (applications[work.application] || 0) + 1;
      if (work.project) {
        projects[work.project] = (projects[work.project] || 0) + 1;
      }
      totalDuration += work.duration;
    }

    const productiveHours = totalDuration / (60 * 60 * 1000);
    
    // Calculate focus score
    const appSwitches = Object.keys(applications).length;
    const focusScore = Math.max(0, 100 - (appSwitches * 5));

    const summary: DailySummary = {
      date: targetDate,
      intents: intents as Record<IntentType, number>,
      applications,
      projects,
      focusScore,
      struggleEvents,
      productiveHours,
    };

    // Store or update
    const existingIndex = this.data.dailySummaries.findIndex(s => s.date === targetDate);
    if (existingIndex >= 0) {
      this.data.dailySummaries[existingIndex] = summary;
    } else {
      this.data.dailySummaries.push(summary);
    }

    // Keep only last 90 days
    this.data.dailySummaries = this.data.dailySummaries
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 90);

    this.scheduleSave();
    return summary;
  }

  getDailySummary(date?: string): DailySummary | null {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.data.dailySummaries.find(s => s.date === targetDate) || null;
  }

  getWeeklyTrends(): { date: string; focusScore: number; productiveHours: number }[] {
    return this.data.dailySummaries
      .slice(0, 7)
      .map(s => ({
        date: s.date,
        focusScore: s.focusScore,
        productiveHours: s.productiveHours,
      }));
  }

  // ===========================================================================
  // Statistics & Insights
  // ===========================================================================

  getStats(): {
    totalWorkSessions: number;
    totalPatternsLearned: number;
    totalSolutionsStored: number;
    totalPreferences: number;
    mostCommonIntent: IntentType | null;
    averageFocusScore: number;
  } {
    const intentCounts: Record<string, number> = {};
    let totalFocusScore = 0;

    for (const summary of this.data.dailySummaries) {
      totalFocusScore += summary.focusScore;
      for (const [intent, count] of Object.entries(summary.intents)) {
        intentCounts[intent] = (intentCounts[intent] || 0) + count;
      }
    }

    let mostCommonIntent: IntentType | null = null;
    let maxCount = 0;
    for (const [intent, count] of Object.entries(intentCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonIntent = intent as IntentType;
      }
    }

    return {
      totalWorkSessions: this.data.workHistory.length,
      totalPatternsLearned: this.data.taskPatterns.length,
      totalSolutionsStored: this.data.errorSolutions.length,
      totalPreferences: this.data.preferences.length,
      mostCommonIntent,
      averageFocusScore: this.data.dailySummaries.length > 0 
        ? totalFocusScore / this.data.dailySummaries.length 
        : 0,
    };
  }

  // ===========================================================================
  // Export/Import
  // ===========================================================================

  async exportToFile(filePath: string): Promise<void> {
    const exportData = {
      ...this.data,
      exportedAt: Date.now(),
      version: MEMORY_VERSION,
    };
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
  }

  async importFromFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    
    if (parsed.version !== MEMORY_VERSION) {
      this.migrateData(parsed);
    }

    // Merge instead of replace
    this.data.preferences = [...this.data.preferences, ...parsed.preferences];
    this.data.taskPatterns = [...this.data.taskPatterns, ...parsed.taskPatterns];
    this.data.errorSolutions = [...this.data.errorSolutions, ...parsed.errorSolutions];
    
    this.applyPrivacySettings();
    this.scheduleSave();
  }

  clearAll(): void {
    this.data.preferences = [];
    this.data.taskPatterns = [];
    this.data.errorSolutions = [];
    this.data.workHistory = [];
    this.data.learnedAssociations = [];
    this.data.dailySummaries = [];
    this.scheduleSave();
  }
}

export default MemoryStore;
```

---

## Pattern Recognition System

### File: `src/main/services/pattern-recognition.ts`

```typescript
// =============================================================================
// NEXUS - Pattern Recognition Service
// Identifies recurring patterns in user behavior
// =============================================================================

import { EventEmitter } from 'events';
import { MemoryStore, WorkContext, TaskPattern } from './memory-store';
import { DetectedIntent, IntentType } from './intent-engine';

// =============================================================================
// Pattern Types
// =============================================================================

export interface WorkSessionPattern {
  id: string;
  dayOfWeek: number;        // 0-6
  startHour: number;        // 0-23
  durationMinutes: number;
  primaryIntent: IntentType;
  applications: string[];
  confidence: number;
}

export interface ErrorRecurrencePattern {
  errorSignature: string;
  frequencyPerWeek: number;
  lastOccurredAt: number;
  technologies: string[];
  typicalResolutionTimeMinutes: number;
}

export interface ApplicationUsagePattern {
  application: string;
  totalUsageMinutes: number;
  averageSessionMinutes: number;
  mostActiveHours: number[];
  commonPrecedingApps: string[];
  commonFollowingApps: string[];
}

export interface TimeBasedPattern {
  patternType: 'morning_routine' | 'afternoon_focus' | 'evening_wrapup' | 'late_night';
  timeRange: { start: number; end: number }; // Hours (0-24)
  typicalActivities: IntentType[];
  productivityScore: number;
}

export interface DetectedPattern {
  type: 'session' | 'error' | 'usage' | 'time';
  data: WorkSessionPattern | ErrorRecurrencePattern | ApplicationUsagePattern | TimeBasedPattern;
  confidence: number;
  detectedAt: number;
}

// =============================================================================
// Pattern Recognition Configuration
// =============================================================================

export interface PatternRecognitionConfig {
  minDataPoints: number;        // Minimum data points to form a pattern
  confidenceThreshold: number;  // Minimum confidence to report pattern
  analysisWindowDays: number;   // How many days of history to analyze
  updateIntervalHours: number;  // How often to re-analyze
}

const DEFAULT_PATTERN_CONFIG: PatternRecognitionConfig = {
  minDataPoints: 3,
  confidenceThreshold: 0.6,
  analysisWindowDays: 30,
  updateIntervalHours: 24,
};

// =============================================================================
// Pattern Recognition Service
// =============================================================================

export class PatternRecognition extends EventEmitter {
  private memoryStore: MemoryStore;
  private config: PatternRecognitionConfig;
  private analysisInterval: NodeJS.Timeout | null = null;
  private detectedPatterns: DetectedPattern[] = [];

  constructor(memoryStore: MemoryStore, config?: Partial<PatternRecognitionConfig>) {
    super();
    this.memoryStore = memoryStore;
    this.config = { ...DEFAULT_PATTERN_CONFIG, ...config };
  }

  start(): void {
    // Run initial analysis
    this.runAnalysis();

    // Schedule periodic analysis
    const intervalMs = this.config.updateIntervalHours * 60 * 60 * 1000;
    this.analysisInterval = setInterval(() => {
      this.runAnalysis();
    }, intervalMs);

    console.log('[PatternRecognition] Started');
  }

  stop(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    console.log('[PatternRecognition] Stopped');
  }

  // ===========================================================================
  // Main Analysis
  // ===========================================================================

  async runAnalysis(): Promise<void> {
    console.log('[PatternRecognition] Running pattern analysis...');

    const workHistory = this.memoryStore.getWorkHistory(1000);
    const cutoffDate = Date.now() - (this.config.analysisWindowDays * 24 * 60 * 60 * 1000);
    const recentWork = workHistory.filter(w => w.timestamp > cutoffDate);

    const newPatterns: DetectedPattern[] = [];

    // Run different pattern detection algorithms
    const sessionPatterns = this.detectSessionPatterns(recentWork);
    const errorPatterns = this.detectErrorPatterns(recentWork);
    const usagePatterns = this.detectUsagePatterns(recentWork);
    const timePatterns = this.detectTimePatterns(recentWork);

    newPatterns.push(...sessionPatterns, ...errorPatterns, ...usagePatterns, ...timePatterns);

    // Filter by confidence
    const validPatterns = newPatterns.filter(p => p.confidence >= this.config.confidenceThreshold);

    // Update detected patterns
    this.detectedPatterns = validPatterns;

    // Emit new patterns
    for (const pattern of validPatterns) {
      this.emit('patternDetected', pattern);
    }

    console.log(`[PatternRecognition] Detected ${validPatterns.length} patterns`);
  }

  // ===========================================================================
  // Work Session Pattern Detection
  // ===========================================================================

  private detectSessionPatterns(workHistory: WorkContext[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    
    // Group work by day of week and hour
    const sessionsByTime: Record<string, WorkContext[]> = {};
    
    for (const work of workHistory) {
      const date = new Date(work.timestamp);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      const key = `${dayOfWeek}-${hour}`;
      
      if (!sessionsByTime[key]) {
        sessionsByTime[key] = [];
      }
      sessionsByTime[key].push(work);
    }

    // Find recurring sessions
    for (const [key, sessions] of Object.entries(sessionsByTime)) {
      if (sessions.length >= this.config.minDataPoints) {
        const [dayOfWeek, startHour] = key.split('-').map(Number);
        
        // Calculate average duration
        const avgDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
        
        // Find primary intent
        const intentCounts: Record<string, number> = {};
        for (const s of sessions) {
          intentCounts[s.intent] = (intentCounts[s.intent] || 0) + 1;
        }
        const primaryIntent = Object.entries(intentCounts)
          .sort((a, b) => b[1] - a[1])[0][0] as IntentType;

        // Find common applications
        const appCounts: Record<string, number> = {};
        for (const s of sessions) {
          appCounts[s.application] = (appCounts[s.application] || 0) + 1;
        }
        const commonApps = Object.entries(appCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([app]) => app);

        const confidence = Math.min(0.95, sessions.length * 0.1 + 0.3);

        patterns.push({
          type: 'session',
          data: {
            id: `session_${key}`,
            dayOfWeek,
            startHour,
            durationMinutes: Math.round(avgDuration / 60000),
            primaryIntent,
            applications: commonApps,
            confidence,
          },
          confidence,
          detectedAt: Date.now(),
        });
      }
    }

    return patterns;
  }

  // ===========================================================================
  // Error Recurrence Pattern Detection
  // ===========================================================================

  private detectErrorPatterns(workHistory: WorkContext[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    
    // Get error solutions from memory store
    const errorSolutions = this.findErrorSolutionsFromHistory(workHistory);
    
    for (const error of errorSolutions) {
      // Count occurrences in recent history
      const occurrences = workHistory.filter(w => 
        w.intent === 'debugging' &&
        w.technologies.some(t => error.technologies.includes(t))
      ).length;

      if (occurrences >= this.config.minDataPoints) {
        const frequencyPerWeek = occurrences / (this.config.analysisWindowDays / 7);
        
        patterns.push({
          type: 'error',
          data: {
            errorSignature: error.errorPattern,
            frequencyPerWeek,
            lastOccurredAt: error.lastUsedAt,
            technologies: error.technologies,
            typicalResolutionTimeMinutes: 15, // Default estimate
          },
          confidence: Math.min(0.9, occurrences * 0.1 + 0.3),
          detectedAt: Date.now(),
        });
      }
    }

    return patterns;
  }

  private findErrorSolutionsFromHistory(workHistory: WorkContext[]): Array<{
    errorPattern: string;
    technologies: string[];
    lastUsedAt: number;
  }> {
    // Extract potential error patterns from debugging sessions
    const debuggingSessions = workHistory.filter(w => w.intent === 'debugging');
    
    const errorMap = new Map<string, { technologies: Set<string>; lastUsed: number }>();
    
    for (const session of debuggingSessions) {
      const key = `${session.application}-${session.project || 'unknown'}`;
      const existing = errorMap.get(key);
      
      if (existing) {
        session.technologies.forEach(t => existing.technologies.add(t));
        existing.lastUsed = Math.max(existing.lastUsed, session.timestamp);
      } else {
        errorMap.set(key, {
          technologies: new Set(session.technologies),
          lastUsed: session.timestamp,
        });
      }
    }

    return Array.from(errorMap.entries()).map(([pattern, data]) => ({
      errorPattern: pattern,
      technologies: Array.from(data.technologies),
      lastUsedAt: data.lastUsed,
    }));
  }

  // ===========================================================================
  // Application Usage Pattern Detection
  // ===========================================================================

  private detectUsagePatterns(workHistory: WorkContext[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    
    // Group by application
    const usageByApp: Record<string, WorkContext[]> = {};
    
    for (const work of workHistory) {
      if (!usageByApp[work.application]) {
        usageByApp[work.application] = [];
      }
      usageByApp[work.application].push(work);
    }

    for (const [app, sessions] of Object.entries(usageByApp)) {
      if (sessions.length < this.config.minDataPoints) continue;

      // Calculate metrics
      const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0) / 60000;
      const avgSessionMinutes = totalMinutes / sessions.length;

      // Find most active hours
      const hourCounts: Record<number, number> = {};
      for (const s of sessions) {
        const hour = new Date(s.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
      const mostActiveHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => Number(hour));

      // Find app transitions
      const appTransitions = this.findAppTransitions(app, workHistory);

      patterns.push({
        type: 'usage',
        data: {
          application: app,
          totalUsageMinutes: Math.round(totalMinutes),
          averageSessionMinutes: Math.round(avgSessionMinutes),
          mostActiveHours,
          commonPrecedingApps: appTransitions.preceding,
          commonFollowingApps: appTransitions.following,
        },
        confidence: Math.min(0.9, sessions.length * 0.05 + 0.4),
        detectedAt: Date.now(),
      });
    }

    return patterns;
  }

  private findAppTransitions(
    targetApp: string, 
    workHistory: WorkContext[]
  ): { preceding: string[]; following: string[] } {
    const sortedHistory = [...workHistory].sort((a, b) => a.timestamp - b.timestamp);
    
    const precedingCounts: Record<string, number> = {};
    const followingCounts: Record<string, number> = {};

    for (let i = 0; i < sortedHistory.length; i++) {
      if (sortedHistory[i].application === targetApp) {
        // Check preceding app
        if (i > 0 && sortedHistory[i - 1].application !== targetApp) {
          const prev = sortedHistory[i - 1].application;
          precedingCounts[prev] = (precedingCounts[prev] || 0) + 1;
        }
        // Check following app
        if (i < sortedHistory.length - 1 && sortedHistory[i + 1].application !== targetApp) {
          const next = sortedHistory[i + 1].application;
          followingCounts[next] = (followingCounts[next] || 0) + 1;
        }
      }
    }

    return {
      preceding: Object.entries(precedingCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([app]) => app),
      following: Object.entries(followingCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([app]) => app),
    };
  }

  // ===========================================================================
  // Time-Based Pattern Detection
  // ===========================================================================

  private detectTimePatterns(workHistory: WorkContext[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    
    // Define time ranges
    const timeRanges = [
      { type: 'morning_routine' as const, start: 7, end: 10 },
      { type: 'afternoon_focus' as const, start: 13, end: 17 },
      { type: 'evening_wrapup' as const, start: 17, end: 20 },
      { type: 'late_night' as const, start: 22, end: 2 },
    ];

    for (const range of timeRanges) {
      const rangeWork = workHistory.filter(w => {
        const hour = new Date(w.timestamp).getHours();
        if (range.start < range.end) {
          return hour >= range.start && hour < range.end;
        } else {
          // Wraps around midnight
          return hour >= range.start || hour < range.end;
        }
      });

      if (rangeWork.length >= this.config.minDataPoints) {
        // Calculate typical activities
        const intentCounts: Record<string, number> = {};
        for (const w of rangeWork) {
          intentCounts[w.intent] = (intentCounts[w.intent] || 0) + 1;
        }
        const typicalActivities = Object.entries(intentCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([intent]) => intent as IntentType);

        // Calculate productivity score
        const productiveIntents = ['coding', 'debugging', 'reviewing', 'writing'];
        const productiveWork = rangeWork.filter(w => productiveIntents.includes(w.intent));
        const productivityScore = (productiveWork.length / rangeWork.length) * 100;

        patterns.push({
          type: 'time',
          data: {
            patternType: range.type,
            timeRange: { start: range.start, end: range.end },
            typicalActivities,
            productivityScore: Math.round(productivityScore),
          },
          confidence: Math.min(0.9, rangeWork.length * 0.05 + 0.3),
          detectedAt: Date.now(),
        });
      }
    }

    return patterns;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  getDetectedPatterns(): DetectedPattern[] {
    return [...this.detectedPatterns];
  }

  getPatternsByType(type: DetectedPattern['type']): DetectedPattern[] {
    return this.detectedPatterns.filter(p => p.type === type);
  }

  predictNextSession(): { 
    dayOfWeek: number; 
    startHour: number; 
    confidence: number;
    suggestedPreparation: string[];
  } | null {
    const sessionPatterns = this.getPatternsByType('session');
    if (sessionPatterns.length === 0) return null;

    // Find most consistent pattern
    const bestPattern = sessionPatterns
      .sort((a, b) => b.confidence - a.confidence)[0]
      .data as WorkSessionPattern;

    return {
      dayOfWeek: bestPattern.dayOfWeek,
      startHour: bestPattern.startHour,
      confidence: bestPattern.confidence,
      suggestedPreparation: [
        `Prepare for ${bestPattern.primaryIntent} work`,
        `Open: ${bestPattern.applications.join(', ')}`,
      ],
    };
  }

  getProductiveHours(): { hour: number; productivityScore: number }[] {
    const hourlyProductivity: Record<number, { productive: number; total: number }> = {};
    const workHistory = this.memoryStore.getWorkHistory(1000);

    const productiveIntents = ['coding', 'debugging', 'reviewing', 'writing'];

    for (const work of workHistory) {
      const hour = new Date(work.timestamp).getHours();
      if (!hourlyProductivity[hour]) {
        hourlyProductivity[hour] = { productive: 0, total: 0 };
      }
      hourlyProductivity[hour].total++;
      if (productiveIntents.includes(work.intent)) {
        hourlyProductivity[hour].productive++;
      }
    }

    return Object.entries(hourlyProductivity)
      .map(([hour, data]) => ({
        hour: Number(hour),
        productivityScore: Math.round((data.productive / data.total) * 100),
      }))
      .sort((a, b) => a.hour - b.hour);
  }
}

export default PatternRecognition;
```

---

## Integration Strategy

### Updated `ProactiveAgent` Integration

The `ProactiveAgent` will be enhanced to use the IntentEngine and MemoryStore:

```typescript
// Add to ProactiveAgent dependencies
interface ProactiveAgentDependencies {
  piecesMcpClient: PiecesMcpClient;
  kimiClient: KimiClient;
  contextMonitor: ContextMonitor;
  intentEngine: IntentEngine;      // NEW
  memoryStore: MemoryStore;        // NEW
}

// Updated analysis to use intent data
private async runAnalysisCycle(): Promise<void> {
  // ... existing rate limiting checks ...

  // Get intent analysis
  const intentAnalysis = this.intentEngine?.getCurrentAnalysis();
  
  // Check if we should interrupt based on opportunity score
  if (intentAnalysis?.interruptionOpportunity.score < 0.5) {
    console.log('[ProactiveAgent] Not a good time to interrupt');
    return;
  }

  // Check for struggle and prioritize
  if (intentAnalysis?.struggleDetection.isStruggling && 
      intentAnalysis.struggleDetection.severity === 'severe') {
    // Look for past solutions in memory
    const solutions = this.memoryStore?.findErrorSolutions(
      intentAnalysis.struggleDetection.indicators.map(i => i.description).join(' '),
      intentAnalysis.currentIntent?.context.technologies
    );

    if (solutions && solutions.length > 0) {
      // Generate suggestion based on past solution
      this.generateStruggleSuggestion(intentAnalysis, solutions[0]);
      return;
    }
  }

  // Continue with existing LTM-based analysis
  // ...
}
```

### Service Initialization Order

```typescript
// In main.ts initializeServices():

private initializeServices(): void {
  // 1. Initialize ContextMonitor first (base layer)
  this.contextMonitor = new ContextMonitor({ ... });
  
  // 2. Initialize MemoryStore (persistence layer)
  this.memoryStore = new MemoryStore();
  
  // 3. Initialize IntentEngine (analysis layer)
  this.intentEngine = new IntentEngine();
  this.intentEngine.initialize({
    contextMonitor: this.contextMonitor,
    memoryStore: this.memoryStore,
  });
  
  // 4. Initialize PatternRecognition (pattern layer)
  this.patternRecognition = new PatternRecognition(this.memoryStore);
  
  // 5. Initialize ProactiveAgent (action layer)
  this.proactiveAgent = new ProactiveAgent(proactiveConfig);
  this.proactiveAgent.initialize({
    piecesMcpClient: this.piecesMcpClient,
    kimiClient: this.kimiClient,
    contextMonitor: this.contextMonitor,
    intentEngine: this.intentEngine,
    memoryStore: this.memoryStore,
  });
  
  // Start services
  this.contextMonitor.start();
  this.intentEngine.start();
  this.patternRecognition.start();
  this.proactiveAgent.start();
}
```

---

## Type Definitions

### Updated `src/shared/types.ts` Additions

```typescript
// =============================================================================
// Intent Engine Types
// =============================================================================

export type IntentType = 
  | 'coding' | 'debugging' | 'researching' | 'writing'
  | 'communicating' | 'browsing' | 'multitasking' | 'stuck'
  | 'reviewing' | 'planning' | 'learning' | 'deploying';

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
```

---

## Privacy & Security

### Data Retention Policies

| Data Type | Minimal | Balanced | Comprehensive |
|-----------|---------|----------|---------------|
| Work History | 100 entries | 500 entries | 30 days |
| Error Solutions | 50 | 200 | 500 |
| Task Patterns | 10 | 50 | 100 |
| Daily Summaries | 7 days | 30 days | 90 days |
| Preferences | All | All | All |

### Sensitive Data Handling

```typescript
// Applications that are never tracked
const NEVER_TRACK = [
  '1password', 'lastpass', 'bitwarden', 'keychain',
  'bank', 'paypal', 'venmo', 'crypto',
  ' Signal', 'whatsapp-personal',
];

// Data sanitization before storage
function sanitizeForStorage(data: any, privacySettings: PrivacySettings): any {
  const sensitiveApps = new Set(privacySettings.sensitiveApplications);
  
  // Filter out sensitive application data
  if (data.application && sensitiveApps.has(data.application.toLowerCase())) {
    return null;
  }
  
  // Remove potentially sensitive window titles
  if (data.windowTitle) {
    data.windowTitle = maskSensitiveInfo(data.windowTitle);
  }
  
  return data;
}
```

### User Controls

```typescript
// IPC handlers for privacy settings
ipcMain.handle(IPC_CHANNELS.PRIVACY_SETTINGS_GET, () => {
  return memoryStore.getPrivacySettings();
});

ipcMain.handle(IPC_CHANNELS.PRIVACY_SETTINGS_UPDATE, (_, settings) => {
  memoryStore.updatePrivacySettings(settings);
  return memoryStore.getPrivacySettings();
});

ipcMain.handle(IPC_CHANNELS.MEMORY_EXPORT, async (_, filePath) => {
  await memoryStore.exportToFile(filePath);
});

ipcMain.handle(IPC_CHANNELS.MEMORY_CLEAR, () => {
  memoryStore.clearAll();
});
```

---

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1)
1. Implement MemoryStore with persistence
2. Add privacy controls
3. Create type definitions

### Phase 2: Intent Engine (Week 2)
1. Implement intent detection algorithms
2. Add struggle detection
3. Create interruption scoring

### Phase 3: Pattern Recognition (Week 3)
1. Implement pattern detection algorithms
2. Add trend analysis
3. Create prediction capabilities

### Phase 4: Integration (Week 4)
1. Update ProactiveAgent to use new services
2. Add SmartTriggerManager integration
3. Test and refine

---

## Summary

This implementation plan provides a complete, production-ready architecture for the Intent Engine and Memory System in NEXUS. The design emphasizes:

1. **Modularity**: Each service has clear responsibilities
2. **Privacy**: Built-in controls for sensitive data
3. **Extensibility**: Easy to add new intent types and patterns
4. **Performance**: Efficient algorithms with configurable limits
5. **Persistence**: Reliable storage with migration support

The system learns from user behavior while respecting privacy, enabling truly proactive assistance that anticipates needs without being intrusive.
