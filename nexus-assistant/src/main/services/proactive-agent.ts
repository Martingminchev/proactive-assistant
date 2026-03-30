// =============================================================================
// NEXUS - Proactive Agent Service
// Background analysis loop that monitors user activity and generates suggestions
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';
import {
  ProactiveSuggestion,
  ProactiveSuggestionType,
  ProactivePriority,
  ProactiveAgentConfig,
  DEFAULT_PROACTIVE_CONFIG,
  PiecesLtmResponse,
  PiecesLtmMemory,
  SystemContext,
} from '../../shared/types';
import { PiecesMcpClient } from './pieces-mcp-client';
import { KimiClient } from './kimi-client';
import { ContextMonitor } from './context-monitor';
import { TaskTracker } from './task-tracker';
import { getUserMemoryStore } from './user-memory-store';

export type AskUserFn = (question: string, options?: string[], inputType?: 'text' | 'choice' | 'confirm') => Promise<string>;

export type FindRelevantResourcesFn = (query: string) => Promise<string>;

interface ProactiveAgentDependencies {
  piecesMcpClient?: PiecesMcpClient | null;
  kimiClient: KimiClient;
  contextMonitor: ContextMonitor;
  taskTracker: TaskTracker;
  askUser?: AskUserFn;
  findRelevantResources?: FindRelevantResourcesFn;
}

export class ProactiveAgent extends EventEmitter {
  private config: ProactiveAgentConfig;
  private piecesMcpClient: PiecesMcpClient | null = null;
  private kimiClient: KimiClient | null = null;
  private contextMonitor: ContextMonitor | null = null;
  private taskTracker: TaskTracker | null = null;
  private askUser: AskUserFn | null = null;
  private findRelevantResources: FindRelevantResourcesFn | null = null;

  private analysisInterval: NodeJS.Timeout | null = null;
  private suggestions: Map<string, ProactiveSuggestion> = new Map();
  private suggestionHistory: ProactiveSuggestion[] = [];
  private lastAnalysisTime: number = 0;
  private suggestionsThisHour: number = 0;
  private hourResetTime: number = Date.now();
  
  private isRunning: boolean = false;
  private isAnalyzing: boolean = false;
  /** Timestamp of last *explicit* user action (chat send, suggestion accept/dismiss). Not reset by context polling. */
  private lastExplicitUserActivityTime: number = 0;

  constructor(config?: Partial<ProactiveAgentConfig>) {
    super();
    this.config = { ...DEFAULT_PROACTIVE_CONFIG, ...config };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  initialize(deps: ProactiveAgentDependencies): void {
    this.piecesMcpClient = deps.piecesMcpClient ?? null;
    this.kimiClient = deps.kimiClient;
    this.contextMonitor = deps.contextMonitor;
    this.taskTracker = deps.taskTracker;
    this.askUser = deps.askUser ?? null;
    this.findRelevantResources = deps.findRelevantResources ?? null;
    // ContextMonitor updates every 5s are NOT treated as user activity.
    // Only explicit actions (chat send, suggestion accept/dismiss) reset the idle timer via recordExplicitUserActivity().

    log.debug('[ProactiveAgent] Initialized with config:', this.config);
  }

  /**
   * Call when the user performs an explicit action (e.g. sends chat, accepts/dismisses suggestion).
   * Used for the minIdleSeconds gate so we don't interrupt active work.
   */
  recordExplicitUserActivity(): void {
    this.lastExplicitUserActivityTime = Date.now();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  start(): void {
    if (this.isRunning) {
      log.debug('[ProactiveAgent] Already running');
      return;
    }

    if (!this.config.enabled) {
      log.debug('[ProactiveAgent] Disabled by config');
      return;
    }

    this.isRunning = true;
    const mode = this.config.defaultMode ?? 'suggestions';
    const intervalMinutes = mode === 'cowork' ? 2 : (this.config.intervalMinutes ?? 5);
    const intervalMs = intervalMinutes * 60 * 1000;

    log.debug(`[ProactiveAgent] Starting with ${intervalMinutes} minute interval (mode: ${mode})`);

    // Start the analysis loop
    this.analysisInterval = setInterval(() => {
      this.runAnalysisCycle();
    }, intervalMs);

    // Run initial analysis after a short delay
    setTimeout(() => {
      this.runAnalysisCycle();
    }, 10000); // 10 seconds after start

    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    log.debug('[ProactiveAgent] Stopped');
    this.emit('stopped');
  }

  updateConfig(config: Partial<ProactiveAgentConfig>): void {
    const wasEnabled = this.config.enabled;
    const wasInterval = this.config.intervalMinutes;
    const wasMode = this.config.defaultMode;

    this.config = { ...this.config, ...config };

    // Handle enable/disable
    if (wasEnabled && !this.config.enabled) {
      this.stop();
    } else if (!wasEnabled && this.config.enabled) {
      this.start();
    }

    // Handle interval or mode change (cowork uses different interval)
    if ((wasInterval !== this.config.intervalMinutes || wasMode !== this.config.defaultMode) && this.isRunning) {
      this.stop();
      this.start();
    }

    log.debug('[ProactiveAgent] Config updated:', this.config);
  }

  // ===========================================================================
  // Analysis Loop
  // ===========================================================================

  private async runAnalysisCycle(): Promise<void> {
    if (this.isAnalyzing) {
      log.debug('[ProactiveAgent] Analysis already in progress, skipping');
      return;
    }

    // Check rate limiting
    this.checkHourlyReset();
    if (this.suggestionsThisHour >= this.config.maxSuggestionsPerHour) {
      log.debug('[ProactiveAgent] Hourly suggestion limit reached');
      return;
    }

    // Use explicit user activity for idle check (context monitor ticks every 5s - we ignore those)
    const lastExplicit = this.lastExplicitUserActivityTime || 0;
    const idleSeconds = lastExplicit === 0
      ? this.config.minIdleSeconds + 1
      : (Date.now() - lastExplicit) / 1000;

    if (idleSeconds > this.config.maxIdleSeconds) {
      log.debug('[ProactiveAgent] User appears idle, skipping analysis');
      return;
    }

    const mode = this.config.defaultMode ?? 'suggestions';
    const minIdle = mode === 'cowork' ? Math.max(15, this.config.minIdleSeconds - 15) : this.config.minIdleSeconds;
    if (idleSeconds < minIdle) {
      log.debug('[ProactiveAgent] User is actively working, skipping analysis');
      return;
    }

    this.isAnalyzing = true;
    this.lastAnalysisTime = Date.now();

    try {
      log.debug('[ProactiveAgent] Running analysis cycle...');

      // Gather context from Pieces LTM (optional - works without Pieces)
      const ltmContext = await this.gatherContext();
      const hasLtm = ltmContext?.memories && ltmContext.memories.length > 0;
      const systemContext = this.contextMonitor?.getCurrentContext();
      const hasLocalContext = !!(systemContext?.activeWindow || (systemContext?.clipboardHistory?.length ?? 0));

      if (!hasLtm && !hasLocalContext) {
        log.debug('[ProactiveAgent] No context available (no LTM and no local context)');
        this.isAnalyzing = false;
        return;
      }

      // Get real-time system context
      const taskContext = this.getTaskContext(systemContext);
      const userIntent = (!taskContext || taskContext.confidence < 0.5) ? await this.gatherUserIntent() : null;
      const webSummary = await this.fetchRelevantWebSummary(taskContext, userIntent);

      // Analyze with AI to generate suggestions (LTM optional)
      const effectiveLtm: PiecesLtmResponse = ltmContext ?? { memories: [], success: false, query: '' };
      const suggestion = await this.analyzeAndGenerateSuggestion(effectiveLtm, systemContext, userIntent, webSummary);

      if (suggestion) {
        this.addSuggestion(suggestion);
      }

    } catch (error) {
      log.error('[ProactiveAgent] Analysis error:', error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  async triggerManualAnalysis(): Promise<ProactiveSuggestion | null> {
    log.debug('[ProactiveAgent] Manual analysis triggered');

    try {
      const ltmContext = await this.gatherContext();
      const systemContext = this.contextMonitor?.getCurrentContext();
      const hasLtm = (ltmContext?.memories?.length ?? 0) > 0;
      const hasLocalContext = !!(systemContext?.activeWindow || (systemContext?.clipboardHistory?.length ?? 0));

      if (!hasLtm && !hasLocalContext) {
        return null;
      }

      const effectiveLtm: PiecesLtmResponse = ltmContext ?? { memories: [], success: false, query: '' };
      const taskContext = this.getTaskContext(systemContext);
      const userIntent = (!taskContext || taskContext.confidence < 0.5) ? await this.gatherUserIntent() : null;
      const webSummary = await this.fetchRelevantWebSummary(taskContext, userIntent);
      const suggestion = await this.analyzeAndGenerateSuggestion(effectiveLtm, systemContext, userIntent, webSummary);

      if (suggestion) {
        this.addSuggestion(suggestion);
      }
      return suggestion;
    } catch (error) {
      log.error('[ProactiveAgent] Manual analysis error:', error);
      return null;
    }
  }

  // ===========================================================================
  // Context Gathering
  // ===========================================================================

  private async gatherContext(): Promise<PiecesLtmResponse | null> {
    if (!this.piecesMcpClient?.isConnected()) {
      return null;
    }

    try {
      // Get recent work context (last 1 hour for fresher, up-to-date context)
      const recentContext = await this.piecesMcpClient.getRecentWorkContext(1);
      return recentContext;
    } catch (error) {
      log.error('[ProactiveAgent] Failed to gather context:', error);
      return null;
    }
  }

  /**
   * Ask the user what they're working on when task is unknown. Returns null if askUser not available or user dismisses.
   */
  async gatherUserIntent(): Promise<string | null> {
    if (!this.askUser) return null;
    try {
      const answer = await this.askUser('What are you trying to accomplish right now?', undefined, 'text');
      return answer?.trim() || null;
    } catch {
      return null;
    }
  }

  private async fetchRelevantWebSummary(
    taskContext: { description: string; project?: string; keywords: string[] } | null,
    userIntent: string | null
  ): Promise<string | null> {
    if (!this.findRelevantResources) return null;
    const parts: string[] = [];
    if (taskContext?.project) parts.push(taskContext.project);
    if (taskContext?.description) parts.push(taskContext.description);
    if (taskContext?.keywords?.length) parts.push(taskContext.keywords.slice(0, 3).join(' '));
    if (userIntent) parts.push(userIntent);
    const query = parts.join(' ').trim();
    if (!query) return null;
    try {
      return await this.findRelevantResources(query);
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // AI Analysis
  // ===========================================================================

  private async analyzeAndGenerateSuggestion(
    ltmContext: PiecesLtmResponse,
    systemContext?: SystemContext,
    userIntent?: string | null,
    webSummary?: string | null
  ): Promise<ProactiveSuggestion | null> {
    if (!this.kimiClient) {
      log.debug('[ProactiveAgent] Kimi client not available');
      return null;
    }

    // Build analysis prompt
    const prompt = this.buildAnalysisPrompt(ltmContext, systemContext, userIntent ?? undefined, webSummary ?? undefined);

    try {
      // Use a simple completion (not streaming) for analysis
      const response = await this.kimiClient.chat([
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt }
      ], {
        model: 'kimi-k2-turbo-preview',
        temperature: 0.7,
        max_tokens: 500
      });

      if (!response || response.trim() === '') {
        log.debug('[ProactiveAgent] AI returned empty response');
        return null;
      }

      // Parse the AI response to extract suggestion
      const memories = ltmContext?.memories ?? [];
      return this.parseAiResponse(response, memories);

    } catch (error) {
      log.error('[ProactiveAgent] AI analysis error:', error);
      return null;
    }
  }

  private getSystemPrompt(): string {
    return (
      `You are NEXUS's proactive awareness engine.

## The Bar for Surfacing

Before suggesting anything, ask yourself:
1. Would I genuinely want to be interrupted for this right now?
2. Is this actionable — can they do something with it immediately?
3. Am I adding value or just creating noise?

If any answer is "no" — respond with NO_SUGGESTION.

## What Justifies Surfacing

HIGH VALUE (surface these):
- Stuck on same error 15+ minutes
- About to repeat a mistake you've seen
- Forgot something important
- Long session without break (2+ hours)

LOW VALUE (stay silent):
- Generic productivity tips
- Obvious observations
- Things they clearly know
- Anything that feels like nagging

## Tone

Be brief. Be direct. No preamble.

Bad: "I noticed you've been working for a while and I wanted to suggest..."
Good: "2 hours in — break time?"

Bad: "Based on my analysis of your recent activity..."
Good: "Same error 4 times — want help?"

## Response Format

If genuinely valuable:
\`\`\`json
{
  "type": "help|reminder|insight|workflow",
  "priority": "low|medium|high",
  "title": "Brief (max 50 chars)",
  "content": "Direct message (max 200 chars)"
}
\`\`\`

If nothing valuable:
NO_SUGGESTION`
    );
  }

  private getTaskContext(systemContext?: SystemContext): { description: string; project?: string; confidence: number; keywords: string[] } | null {
    const current = this.taskTracker?.getCurrentTask();
    if (current) {
      return {
        description: current.description,
        project: current.project,
        confidence: 1,
        keywords: current.context?.keywords ?? [],
      };
    }
    if (systemContext && this.taskTracker) {
      const inferred = this.taskTracker.inferTask(systemContext);
      return {
        description: inferred.description,
        project: inferred.project,
        confidence: inferred.confidence,
        keywords: inferred.keywords ?? [],
      };
    }
    return null;
  }

  private buildAnalysisPrompt(ltmContext: PiecesLtmResponse, systemContext?: SystemContext, userIntent?: string, webSummary?: string): string {
    let prompt = '';

    const memoryStore = getUserMemoryStore();
    const dislikedTypes = memoryStore.getUserContext().dislikedSuggestionTypes ?? [];
    if (dislikedTypes.length) {
      prompt += `## Learned Preferences (avoid these suggestion types - user often dismisses)\n\n- Avoid types: ${dislikedTypes.join(', ')}\n\n`;
    }

    if (userIntent) {
      prompt += `## User Said (What They're Working On)\n\n${userIntent}\n\n`;
    }

    if (webSummary) {
      prompt += `## Relevant Web Results (use to make suggestions more actionable)\n\n${webSummary}\n\n`;
    }

    const taskContext = this.getTaskContext(systemContext);
    if (taskContext) {
      prompt += `## Inferred Task\n\n`;
      prompt += `- Task: ${taskContext.description}\n`;
      if (taskContext.project) prompt += `- Project: ${taskContext.project}\n`;
      prompt += `- Confidence: ${(taskContext.confidence * 100).toFixed(0)}%\n`;
      if (taskContext.keywords.length) prompt += `- Keywords: ${taskContext.keywords.join(', ')}\n`;
      prompt += '\n';
    }

    // Real-time context (active window, clipboard)
    if (systemContext && (systemContext.activeWindow || systemContext.clipboardHistory?.length)) {
      prompt += `## Current Context\n\n`;
      if (systemContext.activeWindow) {
        prompt += `- Active: ${systemContext.activeWindow.application} - "${systemContext.activeWindow.title}"\n`;
      }
      if (systemContext.clipboardHistory?.length) {
        const items = systemContext.clipboardHistory.slice(0, 2);
        for (const item of items) {
          const content = typeof item.content === 'string'
            ? (item.content.length > 100 ? item.content.substring(0, 100) + '...' : item.content)
            : '[non-text]';
          prompt += `- Clipboard: ${content}\n`;
        }
      }
      prompt += '\n';
    }

    prompt += `## Recent Work Context\n\n`;

    const memories = ltmContext?.memories ?? [];
    if (memories.length > 0) {
      const perMemoryCap = 1200;
      for (const memory of memories.slice(0, 8)) {
        const raw = memory.content || memory.summary || '';
        const content = raw.length > perMemoryCap ? raw.substring(0, perMemoryCap) + '...' : raw;
        const app = memory.application ? `[${memory.application}]` : '';
        const time = memory.timestamp ? `(${memory.timestamp})` : '';
        if (content.trim()) {
          prompt += `${app} ${time}\n${content}\n\n`;
        }
      }
    } else {
      prompt += '(No LTM workflow memory - using active window and clipboard only)\n\n';
    }

    prompt += `## Analysis

Look at the context above. Is there something genuinely worth interrupting them for?

Consider:
- Are they stuck? (Same error, same problem, going in circles)
- Long session? (2+ hours = suggest break)
- Forgotten work? (Started something, never finished)
- Pattern that could help?

If nothing meets the bar, respond: NO_SUGGESTION

If something does, provide the JSON response. Keep it brief and direct.`;

    return prompt;
  }

  private parseAiResponse(
    response: string,
    memories: PiecesLtmMemory[]
  ): ProactiveSuggestion | null {
    const trimmed = response.trim();

    if (trimmed === 'NO_SUGGESTION' || trimmed.includes('NO_SUGGESTION')) {
      log.debug('[ProactiveAgent] AI determined no suggestion needed');
      return null;
    }

    try {
      // Extract JSON from response
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log.debug('[ProactiveAgent] No JSON found in response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const priority = this.validatePriority(parsed.priority);
      const riskScore = typeof parsed.riskScore === 'number' ? parsed.riskScore : (priority === 'high' ? 0.8 : priority === 'medium' ? 0.5 : 0.3);
      const mode = this.config.defaultMode ?? 'suggestions';
      const interrupt = mode === 'supervise' ? priority === 'high' && riskScore > 0.7 : mode === 'cowork';

      const suggestion: ProactiveSuggestion = {
        id: uuidv4(),
        type: this.validateType(parsed.type),
        priority,
        title: String(parsed.title || 'Suggestion').substring(0, 50),
        content: String(parsed.content || '').substring(0, 300),
        timestamp: Date.now(),
        riskScore,
        interrupt,
        actions: [
          { id: 'accept', label: 'Tell me more', action: 'accept' },
          { id: 'dismiss', label: 'Dismiss', action: 'dismiss' },
          { id: 'later', label: 'Later', action: 'later' }
        ],
        context: {
          source: memories.length > 0 ? 'pieces_ltm' : 'context_monitor',
          relatedMemories: memories.slice(0, 3)
        }
      };

      // Check priority threshold
      if (!this.meetsPriorityThreshold(suggestion.priority)) {
        log.debug('[ProactiveAgent] Suggestion below priority threshold');
        return null;
      }

      return suggestion;

    } catch (error) {
      log.error('[ProactiveAgent] Failed to parse AI response:', error);
      return null;
    }
  }

  private validateType(type: string): ProactiveSuggestionType {
    const validTypes: ProactiveSuggestionType[] = ['reminder', 'insight', 'help', 'question', 'workflow'];
    return validTypes.includes(type as ProactiveSuggestionType) 
      ? type as ProactiveSuggestionType 
      : 'insight';
  }

  private validatePriority(priority: string): ProactivePriority {
    const validPriorities: ProactivePriority[] = ['low', 'medium', 'high'];
    return validPriorities.includes(priority as ProactivePriority)
      ? priority as ProactivePriority
      : 'medium';
  }

  private meetsPriorityThreshold(priority: ProactivePriority): boolean {
    const levels = { low: 1, medium: 2, high: 3 };
    return levels[priority] >= levels[this.config.priorityThreshold];
  }

  // ===========================================================================
  // Suggestion Management
  // ===========================================================================

  /**
   * Create and surface a suggestion from local pattern/intent detection (no AI/LTM required).
   * Used when PatternRecognition or IntentEngine detect stuck patterns.
   */
  createLocalSuggestion(params: {
    type: ProactiveSuggestionType;
    priority: ProactivePriority;
    title: string;
    content: string;
  }): ProactiveSuggestion | null {
    if (!this.config.enabled || !this.isRunning) return null;

    this.checkHourlyReset();
    if (this.suggestionsThisHour >= this.config.maxSuggestionsPerHour) {
      log.debug('[ProactiveAgent] Hourly suggestion limit reached, skipping local suggestion');
      return null;
    }

    if (!this.meetsPriorityThreshold(params.priority)) {
      return null;
    }

    const suggestion: ProactiveSuggestion = {
      id: uuidv4(),
      type: params.type,
      priority: params.priority,
      title: params.title.substring(0, 50),
      content: params.content.substring(0, 300),
      timestamp: Date.now(),
      riskScore: params.priority === 'high' ? 0.8 : params.priority === 'medium' ? 0.5 : 0.3,
      interrupt: params.priority === 'high',
      actions: [
        { id: 'accept', label: 'Tell me more', action: 'accept' },
        { id: 'dismiss', label: 'Dismiss', action: 'dismiss' },
        { id: 'later', label: 'Later', action: 'later' }
      ],
      context: { source: 'user_activity' }
    };

    this.addSuggestion(suggestion);
    return suggestion;
  }

  private addSuggestion(suggestion: ProactiveSuggestion): void {
    const memoryStore = getUserMemoryStore();
    const acceptRate = memoryStore.getSuggestionTypePreference(suggestion.type);
    const disliked = memoryStore.getUserContext().dislikedSuggestionTypes ?? [];
    if (acceptRate < 0.3 || disliked.includes(suggestion.type)) {
      log.debug('[ProactiveAgent] Skipping suggestion type', suggestion.type, '- user preference (acceptRate:', acceptRate, ', disliked:', disliked.includes(suggestion.type), ')');
      return;
    }

    this.suggestions.set(suggestion.id, suggestion);
    this.suggestionHistory.push(suggestion);
    this.suggestionsThisHour++;

    log.debug('[ProactiveAgent] New suggestion:', suggestion.title);
    this.emit('suggestion', suggestion);
  }

  getSuggestions(): ProactiveSuggestion[] {
    return Array.from(this.suggestions.values())
      .filter(s => !s.dismissed && (!s.snoozedUntil || s.snoozedUntil < Date.now()))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getSuggestionById(id: string): ProactiveSuggestion | undefined {
    return this.suggestions.get(id);
  }

  dismissSuggestion(id: string): boolean {
    const suggestion = this.suggestions.get(id);
    if (suggestion) {
      suggestion.dismissed = true;
      this.emit('dismissed', suggestion);
      return true;
    }
    return false;
  }

  snoozeSuggestion(id: string, minutes: number = 30): boolean {
    const suggestion = this.suggestions.get(id);
    if (suggestion) {
      suggestion.snoozedUntil = Date.now() + (minutes * 60 * 1000);
      this.emit('snoozed', suggestion);
      return true;
    }
    return false;
  }

  acceptSuggestion(id: string): ProactiveSuggestion | null {
    const suggestion = this.suggestions.get(id);
    if (suggestion) {
      this.emit('accepted', suggestion);
      return suggestion;
    }
    return null;
  }

  clearSuggestions(): void {
    this.suggestions.clear();
    this.emit('cleared');
  }

  // ===========================================================================
  // Rate Limiting
  // ===========================================================================

  private checkHourlyReset(): void {
    const now = Date.now();
    if (now - this.hourResetTime > 60 * 60 * 1000) {
      this.suggestionsThisHour = 0;
      this.hourResetTime = now;
    }
  }

  // ===========================================================================
  // Status
  // ===========================================================================

  getStatus(): {
    isRunning: boolean;
    isAnalyzing: boolean;
    lastAnalysis: number;
    suggestionsCount: number;
    suggestionsThisHour: number;
    config: ProactiveAgentConfig;
  } {
    return {
      isRunning: this.isRunning,
      isAnalyzing: this.isAnalyzing,
      lastAnalysis: this.lastAnalysisTime,
      suggestionsCount: this.suggestions.size,
      suggestionsThisHour: this.suggestionsThisHour,
      config: this.config
    };
  }
}

export default ProactiveAgent;
