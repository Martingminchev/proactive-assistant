// =============================================================================
// NEXUS - Intent Engine Service
// Analyzes user context to detect intentions, goals, and struggles.
//
// This service is initialized and started in main.ts. It emits events:
// - 'struggleDetected': When user appears stuck (triggers proactive help)
// - 'intentChange': When user's detected activity changes
// - 'analysis': Periodic full analysis of user state
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
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
  | 'deploying'        // CI/CD, releasing
  | 'interrupt';       // Interruption event

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
  'reddit', 'discord', 'slack',
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

    log.info('[IntentEngine] Initialized');
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  start(): void {
    if (this.isRunning || !this.config.enabled) return;

    this.isRunning = true;
    this.sessionStartTime = Date.now();

    // Start analysis loop
    this.analysisInterval = setInterval(async () => {
      try {
        await this.runAnalysis();
      } catch (error) {
        log.error('[IntentEngine] Analysis loop error:', error);
      }
    }, this.config.analysisIntervalMs);

    log.info('[IntentEngine] Started');
    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    log.info('[IntentEngine] Stopped');
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
      interrupt: { score: 0, indicators: [] },
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

  getStatus(): {
    isRunning: boolean;
    currentIntent: IntentType | null;
    intentHistoryCount: number;
    config: IntentEngineConfig;
  } {
    return {
      isRunning: this.isRunning,
      currentIntent: this.currentIntent?.type || null,
      intentHistoryCount: this.intentHistory.length,
      config: { ...this.config },
    };
  }
}

export default IntentEngine;
