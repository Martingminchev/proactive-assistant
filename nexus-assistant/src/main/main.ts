// =============================================================================
// NEXUS - Main Process
// Entry point for the Electron application
// =============================================================================

import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, shell, desktopCapturer, screen } from 'electron';
import path from 'path';
import log from 'electron-log';
import Store from 'electron-store';

import { IPC_CHANNELS, DEFAULT_SETTINGS, AppSettings, Conversation, Message, PiecesLtmResponse, ProactiveSuggestion, DEFAULT_PROACTIVE_CONFIG, IndicatorState, DrawerState, AppDisplayMode, PersonalitySettings, DEFAULT_PERSONALITY_SETTINGS, SoulDocument, DEFAULT_SOUL_DOCUMENT, ProactiveAction, ActionType, ActionPermissionLevel, ToolDefinition, SystemContext, ConfirmableActionType, ActionRiskLevel, AssistantMode, FileChangeEvent } from '../shared/types';
import { KimiClient } from './services/kimi-client';
import { PiecesClient } from './services/pieces-client';
import { PiecesMcpClient } from './services/pieces-mcp-client';
import { ContextMonitor } from './services/context-monitor';
import { ContextBridge } from './services/context-bridge';
import { ConversationStore } from './services/conversation-store';
import { ProactiveAgent } from './services/proactive-agent';
import { SoulDocumentStore, getSoulDocumentStore } from './services/soul-document-store';
import { buildCompleteSystemPrompt } from './services/personality-prompt-builder';
import { ActionExecutor, getActionExecutor } from './services/action-executor';
import { ActionConfirmationService, getActionConfirmationService } from './services/action-confirmation-service';
import { ToolRegistry, getToolRegistry, ToolConfirmationHook } from './services/tool-system';
import { ToolExecutor, createToolExecutor } from './services/tool-executor';
import { PiecesContextProvider } from './services/pieces-context-provider';
import { IntentEngine } from './services/intent-engine';
import { PatternRecognition } from './services/pattern-recognition';
import { SmartTriggerManager } from './services/smart-trigger-manager';
import { MemoryStore } from './services/memory-store';
import { ConversationManager, ContextResetProposal } from './services/conversation-manager';
import { ContextSummarizer } from './services/context-summarizer';
import { TaskTracker } from './services/task-tracker';
import { getUserMemoryStore } from './services/user-memory-store';
import { getPreferenceLearner, PreferenceLearner } from './services/preference-learner';

// Phase 1: Continuous Context Loop Services
import { SituationAggregator, SituationSnapshot, StateChangeEvent, WindowChangeEvent } from './services/situation-aggregator';
import { ErrorDetector, DetectedError } from './services/error-detector';
import { InterruptionDecisionEngine, InterruptionContext, InterruptionTrigger, getInterruptionDecisionEngine } from './services/interruption-decision';

// Debug flag for verbose logging
const DEBUG = process.env.NODE_ENV === 'development';

// In CommonJS, __dirname is available directly
// No need for import.meta.url workaround

// Initialize logging
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Initialize settings store with schema validation
const store = new Store<{ settings: AppSettings }>({
  defaults: {
    settings: DEFAULT_SETTINGS,
  },
  // Ensure settings are written to disk immediately
  serialize: (value) => JSON.stringify(value, null, 2),
  deserialize: (text) => JSON.parse(text),
});

// Log the actual config file location
log.info('Settings store path:', store.path);

class NexusApp {
  private mainWindow: BrowserWindow | null = null;
  private drawerWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private indicatorState: IndicatorState = { status: 'idle' };
  private drawerState: DrawerState = { mode: 'full', isLocked: false, isExpanded: false };
  
  // Drawer dimensions
  private readonly INDICATOR_WIDTH = 12;
  private readonly INDICATOR_HEIGHT = 100;
  private readonly DRAWER_DEFAULT_WIDTH = 450;
  private readonly DRAWER_MIN_WIDTH = 280;
  private readonly DRAWER_MAX_WIDTH = 900;
  private kimiClient: KimiClient | null = null;
  private piecesClient: PiecesClient | null = null;
  private piecesMcpClient: PiecesMcpClient | null = null;
  private contextMonitor: ContextMonitor | null = null;
  private contextBridge: ContextBridge | null = null;
  private conversationStore: ConversationStore | null = null;
  private proactiveAgent: ProactiveAgent | null = null;
  private soulDocumentStore: SoulDocumentStore | null = null;
  
  // V2 Actions & Tool System
  private actionExecutor: ActionExecutor | null = null;
  private actionConfirmationService: ActionConfirmationService | null = null;
  private toolRegistry: ToolRegistry | null = null;
  private toolExecutor: ToolExecutor | null = null;

  private memoryStore: MemoryStore | null = null;
  private intentEngine: IntentEngine | null = null;
  private patternRecognition: PatternRecognition | null = null;
  private smartTriggerManager: SmartTriggerManager | null = null;
  private conversationManager: ConversationManager | null = null;
  private contextSummarizer: ContextSummarizer | null = null;
  private taskTracker: TaskTracker | null = null;
  private preferenceLearner: PreferenceLearner | null = null;

  // Phase 1: Continuous Context Loop Services
  private situationAggregator: SituationAggregator | null = null;
  private errorDetector: ErrorDetector | null = null;
  private interruptionDecisionEngine: InterruptionDecisionEngine | null = null;

  private isQuitting = false;
  private currentStreamingRequest: AbortController | null = null;
  private toolAbortController: AbortController | null = null;
  private pendingAskUser = new Map<string, { resolve: (value: string) => void; reject: (reason: Error) => void; timeoutId?: NodeJS.Timeout }>();

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Wait for app ready
    await app.whenReady();
    
    // Initialize conversation store AFTER app is ready (so getPath works)
    this.conversationStore = new ConversationStore();
    this.conversationManager = new ConversationManager(this.conversationStore);
    this.contextSummarizer = new ContextSummarizer();
    this.taskTracker = new TaskTracker();

    this.conversationManager.on('agent-message', (data: { conversationId: string; message: import('../shared/types').Message; conversation: import('../shared/types').Conversation }) => {
      this.broadcastToRenderers(IPC_CHANNELS.AGENT_MESSAGE, data);
      this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, { type: 'agent_message', ...data });
    });
    this.conversationManager.on('context-reset-proposed', (proposal: ContextResetProposal) => {
      this.broadcastToRenderers(IPC_CHANNELS.CONTEXT_RESET_PROPOSED, proposal);
    });
    
    log.info('Nexus initializing...');
    
    // Initialize services
    this.initializeServices();
    
    // Create window
    this.createMainWindow();
    
    // Create drawer window (starts hidden, shown when user switches to always-on mode)
    this.createDrawerWindow();
    
    // Create tray
    this.createTray();
    
    // Register shortcuts
    this.registerShortcuts();
    
    // Setup IPC handlers
    this.setupIpcHandlers();
    
    // Start context monitoring
    this.startContextMonitoring();
    
    // App event handlers
    this.setupAppEvents();
    
    log.info('Nexus initialized successfully');
  }

  private initializeServices(): void {
    const settings = store.get('settings');
    
    log.info('Initializing services with settings:', {
      baseUrl: settings.kimiBaseUrl,
      hasApiKey: !!settings.kimiApiKey,
      defaultModel: settings.defaultModel,
    });
    
    // Initialize Kimi client if API key is set
    if (settings.kimiApiKey) {
      this.kimiClient = new KimiClient({
        apiKey: settings.kimiApiKey,
        baseUrl: settings.kimiBaseUrl,
      });
      this.contextSummarizer?.setKimiClient(this.kimiClient);
      log.info('Kimi client initialized with baseUrl:', settings.kimiBaseUrl);
    } else {
      log.warn('No API key found, Kimi client not initialized');
    }
    
    // Initialize Pieces client if enabled
    if (settings.piecesEnabled) {
      this.piecesClient = new PiecesClient({
        port: settings.piecesPort,
      });
      log.info('Pieces client initialized');
      
      // Initialize Pieces MCP client for LTM access
      this.piecesMcpClient = new PiecesMcpClient({
        port: settings.piecesPort,
      });
      
      // Start proactive agent when MCP connects (including late connection)
      this.piecesMcpClient.on('connected', () => {
        log.info('Pieces MCP client connected - LTM available');
        this.tryStartProactiveAgent();
      });
      // Connect to MCP server (async, non-blocking)
      this.piecesMcpClient.connect().then(connected => {
        if (connected) {
          log.info('Pieces MCP client connected - LTM available');
        } else {
          log.warn('Pieces MCP client failed to connect - LTM unavailable');
        }
      }).catch(err => {
        log.warn('Pieces MCP connection error:', err);
      });
    }
    
    // Initialize context bridge for renderer subscriptions
    this.contextBridge = new ContextBridge();

    // Initialize memory store for intent/pattern learning
    this.memoryStore = new MemoryStore();

    // Initialize context monitor
    this.contextMonitor = new ContextMonitor({
      trackActiveWindow: settings.trackActiveWindow,
      trackFileChanges: settings.trackFileChanges,
      trackClipboard: settings.trackClipboard,
      trackedDirectories: settings.trackedDirectories,
    });
    
    // Initialize soul document store
    this.soulDocumentStore = getSoulDocumentStore();
    
    // Initialize intelligence services (IntentEngine, PatternRecognition, SmartTriggerManager)
    if (this.contextMonitor && this.memoryStore) {
      this.intentEngine = new IntentEngine();
      this.intentEngine.initialize({
        contextMonitor: this.contextMonitor,
        memoryStore: this.memoryStore,
      });
      this.intentEngine.start();
      log.info('IntentEngine started');

      this.intentEngine.on('struggleDetected', (struggle: import('./services/intent-engine').StruggleDetection) => {
        log.info('[NexusApp] Struggle detected:', struggle.indicators.map(i => i.type));
        if ((struggle.severity === 'severe' || struggle.severity === 'moderate') && this.proactiveAgent) {
          const indicatorDescriptions = struggle.indicators.map(i => i.description).filter(Boolean);
          const content = indicatorDescriptions.length > 0
            ? `I noticed: ${indicatorDescriptions.slice(0, 3).join(', ')}. Want help?`
            : 'Looks like you might be stuck. Want help?';
          this.proactiveAgent.createLocalSuggestion({
            type: 'help',
            priority: struggle.severity === 'severe' ? 'high' : 'medium',
            title: 'Looks like you might be stuck',
            content,
          });
        }
      });

      this.patternRecognition = new PatternRecognition(this.memoryStore);
      this.patternRecognition.start();
      log.info('PatternRecognition started');

      this.patternRecognition.on('patternDetected', (pattern: import('./services/pattern-recognition').DetectedPattern) => {
        log.info('[NexusApp] Pattern detected:', pattern.type, pattern.confidence);
        if (!this.proactiveAgent) return;
        if (pattern.type === 'error' || pattern.type === 'session') {
          const data = pattern.data as { errorSignature?: string; frequencyPerWeek?: number } | { primaryIntent?: string; applications?: string[] };
          const summary = 'errorSignature' in data
            ? `Recurring error pattern (${(data as { frequencyPerWeek?: number }).frequencyPerWeek ?? 0}/week)`
            : 'error' in data
              ? 'Error pattern detected'
              : 'Work session pattern detected';
          const details = 'errorSignature' in data ? (data as { errorSignature?: string }).errorSignature : '';
          this.proactiveAgent.createLocalSuggestion({
            type: pattern.type === 'error' ? 'help' : 'insight',
            priority: pattern.confidence > 0.8 ? 'high' : 'medium',
            title: summary,
            content: details || 'I noticed a pattern in your work. Want to discuss?',
          });
        }
      });

      this.smartTriggerManager = new SmartTriggerManager();
      if (this.piecesMcpClient) {
        this.smartTriggerManager.initialize({
          contextMonitor: this.contextMonitor,
          piecesMcpClient: this.piecesMcpClient,
        });
        this.smartTriggerManager.start();
        this.smartTriggerManager.on('trigger', (event) => {
          log.debug('SmartTriggerManager trigger:', event.type);
          this.proactiveAgent?.triggerManualAnalysis();
        });
        log.info('SmartTriggerManager started');
      }

      // Initialize preference learner for auto-learning user preferences
      this.preferenceLearner = getPreferenceLearner();
      this.preferenceLearner.start();
      log.info('PreferenceLearner started');

      // Initialize Phase 1: Continuous Context Loop Services
      this.initializeContextLoopServices();
    }

    // Initialize proactive agent with persisted settings
    const proactiveConfig = {
      enabled: settings.proactiveEnabled ?? DEFAULT_PROACTIVE_CONFIG.enabled,
      intervalMinutes: settings.proactiveIntervalMinutes ?? DEFAULT_PROACTIVE_CONFIG.intervalMinutes,
      minIdleSeconds: settings.proactiveMinIdleSeconds ?? DEFAULT_PROACTIVE_CONFIG.minIdleSeconds,
      maxIdleSeconds: settings.proactiveMaxIdleSeconds ?? DEFAULT_PROACTIVE_CONFIG.maxIdleSeconds,
      maxSuggestionsPerHour: settings.proactiveMaxSuggestionsPerHour ?? DEFAULT_PROACTIVE_CONFIG.maxSuggestionsPerHour,
      priorityThreshold: settings.proactivePriorityThreshold ?? DEFAULT_PROACTIVE_CONFIG.priorityThreshold,
      defaultMode: (settings as any).sidebarAssistantMode ?? DEFAULT_PROACTIVE_CONFIG.defaultMode,
    };
    this.proactiveAgent = new ProactiveAgent(proactiveConfig);
    
    // Initialize V2 Action Executor
    this.actionExecutor = getActionExecutor();
    this.actionExecutor.updateConfig({
      enabled: settings.actionsEnabled ?? true,
      enableV2Actions: true,
    });
    this.setupActionExecutorListeners();
    log.info('Action executor initialized with V2 actions enabled');
    
    // Initialize Action Confirmation Service
    this.actionConfirmationService = getActionConfirmationService();
    log.info('Action confirmation service initialized');
    
    // Initialize Tool System
    this.toolRegistry = getToolRegistry();
    log.info('Tool registry initialized with', this.toolRegistry.getAllTools().length, 'tools');
    
    // Wire tool confirmation hook for run_command and open_file
    this.toolRegistry.setConfirmationHook(this.createToolConfirmationHook());

    // Wire Pieces context provider for request_extra_context tool
    if (this.piecesClient || this.piecesMcpClient) {
      const provider = new PiecesContextProvider(this.piecesClient, this.piecesMcpClient);
      this.toolRegistry.setPiecesContextProvider(provider);
    }
    
    // Initialize Tool Executor if Kimi client is available
    if (this.kimiClient) {
      this.toolExecutor = createToolExecutor(this.toolRegistry, this.kimiClient, {
        defaultModel: settings.defaultModel,
      });
      log.info('Tool executor initialized');
    }
    
    // Set up proactive agent event listeners (agent is initialized in tryStartProactiveAgent when deps are ready)
    this.proactiveAgent.on('suggestion', (suggestion: ProactiveSuggestion) => {
      log.info('Proactive suggestion:', suggestion.title);
      if ((this.mainWindow && !this.mainWindow.isDestroyed()) || (this.drawerWindow && !this.drawerWindow.isDestroyed())) {
        this.broadcastToRenderers('proactive:suggestion', suggestion);
      }
      this.showProactiveNotification(suggestion);
      this.updateIndicatorState({
        status: 'suggestion',
        message: suggestion.title,
        suggestionId: suggestion.id,
      });
    });
  }

  /**
   * Initialize the Phase 1 Continuous Context Loop services.
   * These services provide real-time context awareness and smart interruption decisions.
   */
  private initializeContextLoopServices(): void {
    if (!this.contextMonitor || !this.intentEngine || !this.taskTracker) {
      log.warn('[NexusApp] Cannot initialize context loop - missing dependencies');
      return;
    }

    // 1. Initialize SituationAggregator - aggregates context into unified snapshots
    this.situationAggregator = new SituationAggregator({
      snapshotIntervalMs: 2000,  // Generate snapshots every 2 seconds
    });
    this.situationAggregator.initialize({
      contextMonitor: this.contextMonitor,
      intentEngine: this.intentEngine,
      taskTracker: this.taskTracker,
    });
    this.situationAggregator.start();
    log.info('[NexusApp] SituationAggregator started');

    // 2. Initialize ErrorDetector - monitors for errors in window titles, clipboard
    this.errorDetector = new ErrorDetector({
      clipboardPollingIntervalMs: 2000,
    });
    this.errorDetector.start();
    log.info('[NexusApp] ErrorDetector started');

    // 3. Initialize InterruptionDecisionEngine - decides when/how to interrupt
    this.interruptionDecisionEngine = getInterruptionDecisionEngine();
    this.interruptionDecisionEngine.initialize({
      userMemoryStore: getUserMemoryStore(),
    });
    log.info('[NexusApp] InterruptionDecisionEngine initialized');

    // Wire up event handlers between services
    this.wireContextLoopEvents();
  }

  /**
   * Wire up event handlers for the Continuous Context Loop.
   * This creates the reactive data flow between services.
   */
  private wireContextLoopEvents(): void {
    if (!this.situationAggregator || !this.errorDetector || !this.interruptionDecisionEngine) {
      return;
    }

    // --- SituationAggregator Events ---
    
    // When user state changes (focused -> stuck, idle -> active, etc.)
    this.situationAggregator.on('stateChange', (event: StateChangeEvent) => {
      log.debug('[NexusApp] User state changed:', event.previous, '->', event.current, '- Reason:', event.reason);
      
      // If user becomes stuck, consider triggering proactive help
      if (event.current === 'stuck' || event.current === 'error') {
        this.handleUserStruggling(event);
      }
      
      // If user becomes idle after activity, might be good time for suggestions
      if (event.current === 'idle' && event.previous !== 'idle') {
        this.handleUserBecameIdle(event);
      }
    });

    // When window changes (for app switch detection and error detection)
    this.situationAggregator.on('windowChange', (event: WindowChangeEvent) => {
      // Update interruption engine about app switches
      this.interruptionDecisionEngine?.onAppSwitch();
      
      // Check window title for errors
      if (event.current) {
        const detectedError = this.errorDetector?.detectFromWindowTitle(
          event.current.title,
          event.current.application
        );
        if (detectedError) {
          this.handleDetectedError(detectedError);
        }
      }
    });

    // Periodic snapshots for monitoring
    this.situationAggregator.on('snapshot', (snapshot: SituationSnapshot) => {
      // Log at debug level - these happen every 2 seconds
      if (snapshot.flags.needsHelp) {
        log.debug('[NexusApp] Snapshot indicates user needs help:', {
          state: snapshot.userState,
          struggling: snapshot.isStruggling,
          severity: snapshot.struggleSeverity,
        });
      }
    });

    // --- ErrorDetector Events ---
    
    // When an error is detected from any source
    this.errorDetector.on('errorDetected', (error: DetectedError) => {
      log.info('[NexusApp] Error detected:', error.type, '- Severity:', error.severity, '- Source:', error.source);
      this.handleDetectedError(error);
    });

    // --- InterruptionDecisionEngine Events ---
    
    // When a decision is made (for logging/analytics)
    this.interruptionDecisionEngine.on('decision', ({ trigger, decision }) => {
      log.debug('[NexusApp] Interruption decision:', {
        trigger: trigger.type,
        shouldInterrupt: decision.shouldInterrupt,
        timing: decision.timing,
        mode: decision.mode,
        finalScore: decision.scores.finalScore.toFixed(2),
      });
    });

    log.info('[NexusApp] Context loop events wired');
  }

  /**
   * Handle when user appears to be struggling (stuck or error state)
   */
  private handleUserStruggling(event: StateChangeEvent): void {
    if (!this.proactiveAgent || !this.interruptionDecisionEngine) return;

    const snapshot = this.situationAggregator?.getCurrentSnapshot();
    if (!snapshot) return;

    // Build interruption context
    const context: InterruptionContext = {
      currentApp: snapshot.activeWindow?.application ?? null,
      currentWindowTitle: snapshot.activeWindow?.title ?? null,
      currentProject: snapshot.currentTask?.project ?? null,
      currentIntent: snapshot.currentIntent,
      isStruggling: snapshot.isStruggling,
      struggleSeverity: snapshot.struggleSeverity === 'none' ? null : snapshot.struggleSeverity,
      idleSeconds: snapshot.idleTimeMs / 1000,
      sessionDurationMinutes: 0, // TODO: Track session duration
      recentAppSwitches: snapshot.recentAppSwitchCount,
      recentErrors: this.errorDetector?.getRecentCriticalErrors(300000).length ?? 0,
      timestamp: Date.now(),
      hourOfDay: new Date().getHours(),
      isQuietHours: false, // TODO: Get from user preferences
      trigger: {
        type: 'struggle_detected',
        data: {
          previousState: event.previous,
          reason: event.reason,
          indicators: snapshot.struggleIndicators,
        },
        priority: snapshot.struggleSeverity === 'severe' ? 'high' : 'medium',
        timestamp: Date.now(),
      },
    };

    // Evaluate whether to interrupt
    const decision = this.interruptionDecisionEngine.evaluate(context);

    if (decision.shouldInterrupt && decision.timing === 'now') {
      // Create a proactive suggestion through the existing system
      this.proactiveAgent.createLocalSuggestion({
        type: 'help',
        priority: decision.priority === 'critical' ? 'high' : decision.priority,
        title: 'Need help?',
        content: snapshot.struggleIndicators.length > 0
          ? `I noticed: ${snapshot.struggleIndicators.slice(0, 2).join(', ')}. Want me to help?`
          : 'You seem to be stuck. Want me to take a look?',
      });
    } else if (decision.shouldInterrupt && decision.timing === 'wait_breakpoint') {
      // Add to pending triggers - will be evaluated on next app switch or idle
      this.interruptionDecisionEngine.addPendingTrigger(context.trigger);
    }
  }

  /**
   * Handle when user becomes idle after being active
   */
  private handleUserBecameIdle(event: StateChangeEvent): void {
    if (!this.interruptionDecisionEngine) return;

    // Check for pending triggers that were waiting for a breakpoint
    const pendingTriggers = this.interruptionDecisionEngine.getPendingTriggers();
    
    for (const trigger of pendingTriggers) {
      const snapshot = this.situationAggregator?.getCurrentSnapshot();
      if (!snapshot) continue;

      const context: InterruptionContext = {
        currentApp: snapshot.activeWindow?.application ?? null,
        currentWindowTitle: snapshot.activeWindow?.title ?? null,
        currentProject: snapshot.currentTask?.project ?? null,
        currentIntent: snapshot.currentIntent,
        isStruggling: snapshot.isStruggling,
        struggleSeverity: snapshot.struggleSeverity === 'none' ? null : snapshot.struggleSeverity,
        idleSeconds: snapshot.idleTimeMs / 1000,
        sessionDurationMinutes: 0,
        recentAppSwitches: snapshot.recentAppSwitchCount,
        recentErrors: this.errorDetector?.getRecentCriticalErrors(300000).length ?? 0,
        timestamp: Date.now(),
        hourOfDay: new Date().getHours(),
        isQuietHours: false,
        trigger,
      };

      // Re-evaluate with current idle state (better breakpoint score)
      const decision = this.interruptionDecisionEngine.evaluate(context);

      if (decision.shouldInterrupt && decision.timing === 'now') {
        // Now is a good time - create the suggestion
        this.proactiveAgent?.createLocalSuggestion({
          type: 'help',
          priority: decision.priority === 'critical' ? 'high' : decision.priority,
          title: 'Quick thought',
          content: trigger.data.message as string || 'I have something that might help.',
        });

        // Clear the pending trigger
        this.interruptionDecisionEngine.clearPendingTrigger(trigger.timestamp);
      }
    }
  }

  /**
   * Handle a detected error from ErrorDetector
   */
  private handleDetectedError(error: DetectedError): void {
    if (!this.proactiveAgent || !this.interruptionDecisionEngine) return;

    const snapshot = this.situationAggregator?.getCurrentSnapshot();
    
    // Build interruption context for error
    const context: InterruptionContext = {
      currentApp: snapshot?.activeWindow?.application ?? error.context.application ?? null,
      currentWindowTitle: snapshot?.activeWindow?.title ?? error.context.windowTitle ?? null,
      currentProject: snapshot?.currentTask?.project ?? null,
      currentIntent: snapshot?.currentIntent ?? null,
      isStruggling: snapshot?.isStruggling ?? false,
      struggleSeverity: snapshot?.struggleSeverity === 'none' ? null : (snapshot?.struggleSeverity ?? null),
      idleSeconds: snapshot ? snapshot.idleTimeMs / 1000 : 0,
      sessionDurationMinutes: 0,
      recentAppSwitches: snapshot?.recentAppSwitchCount ?? 0,
      recentErrors: this.errorDetector?.getRecentCriticalErrors(300000).length ?? 1,
      timestamp: Date.now(),
      hourOfDay: new Date().getHours(),
      isQuietHours: false,
      trigger: {
        type: 'error_pattern',
        data: {
          errorType: error.type,
          errorMessage: error.message,
          severity: error.severity,
          category: error.category,
          technology: error.context.technology,
          filePath: error.context.filePath,
          isCritical: error.severity === 'critical' || error.severity === 'high',
        },
        priority: error.severity === 'critical' ? 'critical' : 
                  error.severity === 'high' ? 'high' : 'medium',
        timestamp: Date.now(),
      },
    };

    // Only high/critical errors warrant proactive help
    if (error.severity !== 'high' && error.severity !== 'critical') {
      log.debug('[NexusApp] Skipping low-severity error:', error.type);
      return;
    }

    // Evaluate whether to interrupt
    const decision = this.interruptionDecisionEngine.evaluate(context);

    if (decision.shouldInterrupt && decision.timing === 'now') {
      // Create error-specific suggestion
      const techPrefix = error.context.technology ? `[${error.context.technology}] ` : '';
      
      this.proactiveAgent.createLocalSuggestion({
        type: 'help',
        priority: error.severity === 'critical' ? 'high' : 'medium',
        title: `${techPrefix}${error.type} detected`,
        content: this.formatErrorHelpContent(error),
      });
    } else if (decision.shouldInterrupt && decision.timing === 'wait_breakpoint') {
      // Store for later
      this.interruptionDecisionEngine.addPendingTrigger(context.trigger);
    }
  }

  /**
   * Format error information into a helpful message
   */
  private formatErrorHelpContent(error: DetectedError): string {
    const parts: string[] = [];

    // Add error message (truncated)
    const msg = error.message.length > 100 ? error.message.slice(0, 100) + '...' : error.message;
    parts.push(msg);

    // Add location if available
    if (error.context.filePath) {
      const file = error.context.filePath.split(/[/\\]/).pop();
      const loc = error.context.lineNumber ? `${file}:${error.context.lineNumber}` : file;
      parts.push(`in ${loc}`);
    }

    return parts.join(' ') + ' — Want help debugging?';
  }
  
  private setupActionExecutorListeners(): void {
    if (!this.actionExecutor) return;
    
    // Handle action execution events
    this.actionExecutor.on('action-executing', (action: ProactiveAction) => {
      this.broadcastToRenderers(IPC_CHANNELS.ACTION_EXECUTING, action);
    });
    
    this.actionExecutor.on('action-completed', (action: ProactiveAction) => {
      this.broadcastToRenderers(IPC_CHANNELS.ACTION_COMPLETED, action);
    });
    
    this.actionExecutor.on('action-failed', (action: ProactiveAction, error: any) => {
      this.broadcastToRenderers(IPC_CHANNELS.ACTION_FAILED, { action, error: error?.message || 'Unknown error' });
    });
    
    this.actionExecutor.on('action-cancelled', (action: ProactiveAction, reason: string) => {
      this.broadcastToRenderers(IPC_CHANNELS.ACTION_CANCELLED, { action, reason });
    });
    
    this.actionExecutor.on('confirmation-required', (action: ProactiveAction) => {
      this.broadcastToRenderers(IPC_CHANNELS.ACTION_CONFIRMATION_REQUIRED, action);
    });
    
    // Handle screenshot requests from action executor
    this.actionExecutor.on('take-screenshot', async () => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 }
        });
        
        if (sources.length > 0) {
          const base64 = sources[0].thumbnail.toDataURL();
          this.broadcastToRenderers('action:screenshot-captured', { imageData: base64 });
        }
      } catch (error) {
        log.error('Screenshot capture error:', error);
      }
    });
    
    // Bridge ActionExecutor with ActionConfirmationService for modal confirmations
    this.actionExecutor.on('confirmation-required', async (action: ProactiveAction) => {
      if (!this.actionConfirmationService) return;
      
      // Map action to confirmation request
      const riskLevel = this.getActionRiskLevel(action.type);
      const title = this.getActionConfirmationTitle(action);
      const description = this.getActionConfirmationDescription(action);
      
      const approved = await this.actionConfirmationService.requestConfirmation(
        action.type as any,
        riskLevel,
        title,
        description,
        action.payload,
        { timeoutMs: 30000 }
      );
      
      if (approved) {
        this.actionExecutor?.confirmAction(action.id);
      } else {
        this.actionExecutor?.denyAction(action.id);
      }
    });
  }
  
  private getActionRiskLevel(actionType: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (actionType) {
      case 'run_command':
      case 'delete_file':
        return 'high';
      case 'open_file':
      case 'open_url':
        return 'medium';
      case 'clipboard_copy':
      case 'take_screenshot':
        return 'low';
      default:
        return 'medium';
    }
  }
  
  private getActionConfirmationTitle(action: ProactiveAction): string {
    switch (action.type) {
      case 'open_file':
        return `Open file: ${action.payload.filePath || 'Unknown'}`;
      case 'open_url':
        return `Open URL: ${action.payload.url || 'Unknown'}`;
      case 'run_command':
        return `Execute command: ${action.payload.command || 'Unknown'}`;
      case 'create_file':
        return `Create file: ${action.payload.filePath || 'Unknown'}`;
      default:
        return `Execute action: ${action.type}`;
    }
  }
  
  private getActionConfirmationDescription(action: ProactiveAction): string {
    switch (action.type) {
      case 'open_file':
        return `Allow NEXUS to open "${action.payload.filePath}"?`;
      case 'open_url':
        return `Allow NEXUS to open "${action.payload.url}" in your browser?`;
      case 'run_command':
        return `Allow NEXUS to execute the command "${action.payload.command}"?`;
      case 'create_file':
        return `Allow NEXUS to create a file at "${action.payload.filePath}"?`;
      default:
        return `Allow NEXUS to perform this action: ${action.type}?`;
    }
  }
  
  private createToolConfirmationHook(): ToolConfirmationHook {
    return async (toolName: string, args: Record<string, unknown>) => {
      if (!this.actionConfirmationService) return true;

      type Mapping = { actionType: ConfirmableActionType; riskLevel: ActionRiskLevel; payload: Record<string, unknown>; title: string; description: string };
      const mapping: Mapping | null = (() => {
        if (toolName === 'run_command') {
          const command = String(args.command ?? '');
          return {
            actionType: 'command:execute',
            riskLevel: 'high' as ActionRiskLevel,
            payload: { command, workingDirectory: args.workingDirectory },
            title: `Execute command: ${command || 'Unknown'}`,
            description: `Allow NEXUS to run: "${command}"?`,
          };
        }
        if (toolName === 'open_file') {
          const filePath = String(args.filePath ?? '');
          return {
            actionType: 'file:read',
            riskLevel: 'medium' as ActionRiskLevel,
            payload: { filePath, path: filePath },
            title: `Open file: ${filePath || 'Unknown'}`,
            description: `Allow NEXUS to open "${filePath}"?`,
          };
        }
        if (toolName === 'write_file') {
          const pathArg = String(args.path ?? args.filePath ?? '');
          const content = args.content != null ? String(args.content) : '';
          const preview = content.length > 200 ? content.slice(0, 200) + '...' : content;
          return {
            actionType: 'file:write',
            riskLevel: 'high' as ActionRiskLevel,
            payload: { path: pathArg, filePath: pathArg, content, contentPreview: preview },
            title: `Write file: ${pathArg || 'Unknown'}`,
            description: `Allow NEXUS to create or overwrite "${pathArg}"?`,
          };
        }
        if (toolName === 'edit_file') {
          const pathArg = String(args.path ?? '');
          const search = String(args.search ?? '');
          const replace = String(args.replace ?? '');
          return {
            actionType: 'file:write',
            riskLevel: 'high' as ActionRiskLevel,
            payload: { path: pathArg, filePath: pathArg, search, replace, tool: 'edit_file' },
            title: `Edit file: ${pathArg || 'Unknown'}`,
            description: `Allow NEXUS to replace "${search.slice(0, 40)}${search.length > 40 ? '...' : ''}" in "${pathArg}"?`,
          };
        }
        if (toolName === 'fetch_url') {
          const url = String(args.url ?? '');
          return {
            actionType: 'api:external',
            riskLevel: 'medium' as ActionRiskLevel,
            payload: { url, method: args.method ?? 'GET' },
            title: `Fetch URL: ${url || 'Unknown'}`,
            description: `Allow NEXUS to request "${url}"?`,
          };
        }
        if (toolName === 'open_browser_tab') {
          const url = String(args.url ?? '');
          return {
            actionType: 'browser:open',
            riskLevel: 'medium' as ActionRiskLevel,
            payload: { url },
            title: `Open in browser: ${url || 'Unknown'}`,
            description: `Allow NEXUS to open "${url}" in your browser?`,
          };
        }
        if (toolName === 'copy_to_clipboard') {
          const text = args.text != null ? String(args.text) : '';
          const preview = text.length > 80 ? text.slice(0, 80) + '...' : text;
          return {
            actionType: 'clipboard:write',
            riskLevel: 'low' as ActionRiskLevel,
            payload: { text, textPreview: preview },
            title: 'Copy to clipboard',
            description: `Allow NEXUS to copy ${text.length} character(s) to clipboard?`,
          };
        }
        return null;
      })();

      if (!mapping) return true;

      return this.actionConfirmationService.requestConfirmation(
        mapping.actionType,
        mapping.riskLevel,
        mapping.title,
        mapping.description,
        mapping.payload,
        { timeoutMs: 30000, source: 'agent' }
      );
    };
  }
  
  private showProactiveNotification(suggestion: ProactiveSuggestion): void {
    if (!this.mainWindow) return;
    
    const { Notification } = require('electron');
    
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: `NEXUS: ${suggestion.title}`,
        body: suggestion.content.substring(0, 100),
        icon: path.join(__dirname, '../../assets/icon.png'),
        silent: false,
      });
      
      notification.on('click', () => {
        this.showWindow();
        // Send the suggestion to the renderer to display
        if ((this.mainWindow && !this.mainWindow.isDestroyed()) || (this.drawerWindow && !this.drawerWindow.isDestroyed())) {
          this.broadcastToRenderers('proactive:show-suggestion', suggestion);
        }
      });
      
      notification.show();
    }
  }
  
  // Reinitialize Kimi client with new settings
  private reinitializeKimiClient(settings: AppSettings): void {
    if (settings.kimiApiKey) {
      log.info('Reinitializing Kimi client with new settings:', {
        baseUrl: settings.kimiBaseUrl,
        keyPrefix: settings.kimiApiKey.slice(0, 5),
      });
      
      this.kimiClient = new KimiClient({
        apiKey: settings.kimiApiKey,
        baseUrl: settings.kimiBaseUrl,
      });
      this.contextSummarizer?.setKimiClient(this.kimiClient);
      
      // Reinitialize tool executor with new client
      if (this.toolRegistry) {
        this.toolExecutor = createToolExecutor(this.toolRegistry, this.kimiClient, {
          defaultModel: settings.defaultModel,
        });
      }
    } else {
      log.info('No API key, clearing Kimi client');
      this.kimiClient = null;
      this.toolExecutor = null;
      this.contextSummarizer?.setKimiClient(null);
    }
  }

  private reinitializePiecesClient(settings: AppSettings): void {
    // Stop existing clients if any
    if (this.piecesClient) {
      this.piecesClient.stop();
      this.piecesClient = null;
    }
    if (this.piecesMcpClient) {
      this.piecesMcpClient.stop();
      this.piecesMcpClient = null;
    }
    
    if (settings.piecesEnabled) {
      log.info('Reinitializing Pieces clients with new settings:', {
        port: settings.piecesPort,
      });
      
      // HTTP API client for assets
      this.piecesClient = new PiecesClient({
        port: settings.piecesPort,
      });
      
      // MCP client for LTM
      this.piecesMcpClient = new PiecesMcpClient({
        port: settings.piecesPort,
      });
      this.piecesMcpClient.on('connected', () => {
        log.info('Pieces MCP client reconnected - LTM available');
        this.tryStartProactiveAgent();
      });
      // Connect MCP client (async, non-blocking)
      this.piecesMcpClient.connect().then(connected => {
        if (connected) {
          log.info('Pieces MCP client reconnected - LTM available');
        }
      }).catch(err => {
        log.warn('Pieces MCP reconnection error:', err);
      });

      const provider = new PiecesContextProvider(this.piecesClient, this.piecesMcpClient);
      this.toolRegistry?.setPiecesContextProvider(provider);
    } else {
      log.info('Pieces integration disabled');
      this.toolRegistry?.setPiecesContextProvider(null);
    }
  }

  private createMainWindow(): void {
    const settings = store.get('settings');
    
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'NEXUS',
      show: false, // Show after ready
      frame: false, // Custom title bar
      transparent: settings.transparencyEnabled,
      backgroundColor: '#00000000',
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 15, y: 15 },
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false,
      },
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Show when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      this.mainWindow?.focus();
    });
    
    // Set main window for action confirmation service
    this.actionConfirmationService?.setMainWindow(this.mainWindow);

    // Handle window close
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting && settings.minimizeToTray) {
        event.preventDefault();
        this.mainWindow?.hide();
        log.info('Window hidden to tray');
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private createDrawerWindow(): void {
    const settings = store.get('settings');
    
    if (!settings.indicatorEnabled) {
      log.info('Drawer window disabled in settings');
      return;
    }
    
    // Get primary display dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    // Start as collapsed indicator
    const isRight = settings.indicatorPosition === 'right';
    const x = isRight ? screenWidth - this.INDICATOR_WIDTH : 0;
    const y = Math.floor((screenHeight - this.INDICATOR_HEIGHT) / 2);
    
    this.drawerWindow = new BrowserWindow({
      width: this.INDICATOR_WIDTH,
      height: this.INDICATOR_HEIGHT,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: true, // Need focusable for input in drawer
      hasShadow: false,
      type: 'toolbar',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false,
      },
    });

    this.drawerWindow.setAlwaysOnTop(true, 'screen-saver');
    
    // Load the drawer/indicator HTML
    if (process.env.NODE_ENV === 'development') {
      this.drawerWindow.loadURL('http://localhost:3000/indicator.html');
    } else {
      this.drawerWindow.loadFile(path.join(__dirname, '../renderer/indicator.html'));
    }

    // Initially hidden - shown when user switches to always-on mode
    this.drawerWindow.once('ready-to-show', () => {
      // Don't show immediately - wait for user to enable always-on mode
      log.info('Drawer window created (hidden until always-on mode enabled)');
    });

    this.drawerWindow.on('closed', () => {
      this.drawerWindow = null;
    });
    
    this.drawerWindow.setIgnoreMouseEvents(false);
  }
  
  private updateIndicatorState(newState: Partial<IndicatorState>): void {
    this.indicatorState = { ...this.indicatorState, ...newState };
    
    if (this.drawerWindow && !this.drawerWindow.isDestroyed()) {
      this.drawerWindow.webContents.send(IPC_CHANNELS.INDICATOR_STATE_UPDATE, this.indicatorState);
    }
  }
  
  private updateDrawerState(newState: Partial<DrawerState>): void {
    this.drawerState = { ...this.drawerState, ...newState };
    
    if (this.drawerWindow && !this.drawerWindow.isDestroyed()) {
      this.drawerWindow.webContents.send(IPC_CHANNELS.DRAWER_STATE_UPDATE, this.drawerState);
    }
  }
  
  private setAppMode(mode: AppDisplayMode): void {
    log.info(`Setting app mode to: ${mode}`);
    
    if (mode === 'full') {
      // Show main window, hide drawer
      this.showWindow();
      this.drawerWindow?.hide();
      this.updateDrawerState({ mode: 'full', isExpanded: false });
    } else if (mode === 'indicator') {
      // Hide main window, show drawer as collapsed indicator
      this.mainWindow?.hide();
      this.collapseDrawer();
      this.drawerWindow?.showInactive();
      this.updateDrawerState({ mode: 'indicator', isExpanded: false });
    } else if (mode === 'drawer') {
      // Hide main window, show expanded drawer
      this.mainWindow?.hide();
      this.expandDrawer();
      this.updateDrawerState({ mode: 'drawer', isExpanded: true });
    }
  }
  
  private drawerResizeTimeout: NodeJS.Timeout | null = null;
  private drawerResizeHandler: (() => void) | null = null;

  private expandDrawer(): void {
    if (!this.drawerWindow || this.drawerWindow.isDestroyed()) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const settings = store.get('settings');
    const isRight = settings.indicatorPosition === 'right';
    const width = Math.min(
      this.DRAWER_MAX_WIDTH,
      Math.max(this.DRAWER_MIN_WIDTH, settings.drawerWidth ?? this.DRAWER_DEFAULT_WIDTH)
    );

    const x = isRight ? screenWidth - width : 0;
    const y = 0;

    this.drawerWindow.setBounds({ x, y, width, height: screenHeight });
    this.drawerWindow.setResizable(true);
    this.applyDrawerSizeConstraints();

    if (this.drawerResizeHandler) {
      this.drawerWindow.off('resize', this.drawerResizeHandler);
    }
    this.drawerResizeHandler = () => {
      if (this.drawerResizeTimeout) clearTimeout(this.drawerResizeTimeout);
      this.drawerResizeTimeout = setTimeout(() => {
        this.drawerResizeTimeout = null;
        const win = this.drawerWindow;
        if (win && !win.isDestroyed() && this.drawerState.isExpanded) {
          const [w] = win.getSize();
          const clamped = Math.min(this.DRAWER_MAX_WIDTH, Math.max(this.DRAWER_MIN_WIDTH, w));
          store.set('settings', { ...store.get('settings'), drawerWidth: clamped });
        }
      }, 150);
    };
    this.drawerWindow.on('resize', this.drawerResizeHandler);

    this.drawerWindow.setFocusable(true);
    this.drawerWindow.show();
    this.updateDrawerState({ isExpanded: true, mode: 'drawer' });

    log.info('Drawer expanded');
  }

  private applyDrawerSizeConstraints(): void {
    if (!this.drawerWindow || this.drawerWindow.isDestroyed() || !this.drawerState.isExpanded) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const settings = store.get('settings');
    const heightLocked = settings.drawerHeightLocked ?? true;

    if (heightLocked) {
      this.drawerWindow.setMinimumSize(this.DRAWER_MIN_WIDTH, screenHeight);
      this.drawerWindow.setMaximumSize(this.DRAWER_MAX_WIDTH, screenHeight);
    } else {
      this.drawerWindow.setMinimumSize(this.DRAWER_MIN_WIDTH, 400);
      this.drawerWindow.setMaximumSize(this.DRAWER_MAX_WIDTH, screenHeight);
    }
  }
  
  private collapseDrawer(): void {
    if (!this.drawerWindow || this.drawerWindow.isDestroyed()) return;

    if (this.drawerResizeTimeout) {
      clearTimeout(this.drawerResizeTimeout);
      this.drawerResizeTimeout = null;
    }
    if (this.drawerResizeHandler) {
      this.drawerWindow.off('resize', this.drawerResizeHandler);
      this.drawerResizeHandler = null;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const settings = store.get('settings');
    const isRight = settings.indicatorPosition === 'right';

    const x = isRight ? screenWidth - this.INDICATOR_WIDTH : 0;
    const y = Math.floor((screenHeight - this.INDICATOR_HEIGHT) / 2);

    this.drawerWindow.setResizable(false);
    this.drawerWindow.setBounds({
      x,
      y,
      width: this.INDICATOR_WIDTH,
      height: this.INDICATOR_HEIGHT,
    });

    this.drawerWindow.setFocusable(false);
    this.updateDrawerState({ isExpanded: false, mode: 'indicator' });

    log.info('Drawer collapsed');
  }
  
  private openFullView(): void {
    log.info('Opening full view');
    this.setAppMode('full');
  }
  
  // Helper to send events to all renderer windows
  private broadcastToRenderers(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
    if (this.drawerWindow && !this.drawerWindow.isDestroyed()) {
      this.drawerWindow.webContents.send(channel, data);
    }
  }

  private createTray(): void {
    // Create tray icon (using a simple colored square for now)
    const icon = nativeImage.createFromDataURL(this.getTrayIcon());
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Nexus',
        click: () => this.showWindow(),
      },
      {
        label: 'New Conversation',
        click: () => {
          this.showWindow();
          this.mainWindow?.webContents.send(IPC_CHANNELS.CONVERSATION_CREATE);
        },
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          this.showWindow();
          this.mainWindow?.webContents.send(IPC_CHANNELS.APP_OPEN_SETTINGS);
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.quit(),
      },
    ]);

    this.tray.setToolTip('NEXUS - AI Assistant');
    this.tray.setContextMenu(contextMenu);
    
    this.tray.on('click', () => {
      this.toggleWindow();
    });
    
    this.tray.on('double-click', () => {
      this.showWindow();
    });
  }

  private getTrayIcon(): string {
    // Simple SVG icon as data URL (cyan circle with glow)
    return `data:image/svg+xml;base64,${Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#00f0ff" stop-opacity="1"/>
            <stop offset="70%" stop-color="#00f0ff" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#00f0ff" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="16" cy="16" r="14" fill="url(#glow)"/>
        <circle cx="16" cy="16" r="6" fill="#00f0ff"/>
      </svg>
    `).toString('base64')}`;
  }

  private registerShortcuts(): void {
    const settings = store.get('settings');
    
    // Register global shortcut
    const shortcut = settings.globalHotkey || 'CommandOrControl+Shift+Space';
    const registered = globalShortcut.register(shortcut, () => {
      this.toggleWindow();
    });
    
    if (registered) {
      log.info(`Global shortcut registered: ${shortcut}`);
    } else {
      log.warn(`Failed to register global shortcut: ${shortcut}`);
    }
  }

  private setupIpcHandlers(): void {
    // Helper to wrap IPC handlers with logging
    const wrapHandler = <T>(channel: string, handler: () => Promise<T> | T): Promise<T> => {
      log.debug(`[IPC] ${channel} called`);
      const startTime = Date.now();
      try {
        const result = handler();
        if (result instanceof Promise) {
          return result
            .then((value) => {
              log.debug(`[IPC] ${channel} completed in ${Date.now() - startTime}ms`);
              return value;
            })
            .catch((error) => {
              log.error(`[IPC] ${channel} failed after ${Date.now() - startTime}ms:`, error);
              throw error;
            });
        }
        log.debug(`[IPC] ${channel} completed in ${Date.now() - startTime}ms`);
        return Promise.resolve(result);
      } catch (error) {
        log.error(`[IPC] ${channel} failed after ${Date.now() - startTime}ms:`, error);
        throw error;
      }
    };

    // Window controls
    ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => wrapHandler('WINDOW_MINIMIZE', () => {
      this.mainWindow?.minimize();
    }));
    
    ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => wrapHandler('WINDOW_MAXIMIZE', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow?.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    }));
    
    ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => wrapHandler('WINDOW_CLOSE', () => {
      this.mainWindow?.hide();
    }));
    
    ipcMain.handle(IPC_CHANNELS.WINDOW_HIDE, () => wrapHandler('WINDOW_HIDE', () => {
      this.mainWindow?.hide();
    }));
    
    ipcMain.handle(IPC_CHANNELS.WINDOW_SHOW, () => wrapHandler('WINDOW_SHOW', () => {
      this.showWindow();
    }));
    
    ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE, () => wrapHandler('WINDOW_TOGGLE', () => {
      this.toggleWindow();
    }));

    // App controls
    ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => wrapHandler('APP_QUIT', () => {
      this.quit();
    }));
    
    ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => wrapHandler('APP_VERSION', () => {
      return app.getVersion();
    }));
    
    ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, (_, url: string) => wrapHandler('APP_OPEN_EXTERNAL', () => {
      shell.openExternal(url);
    }));

    // Settings
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => wrapHandler('SETTINGS_GET', () => {
      try {
        const stored = store.get('settings');
        const settings = { ...DEFAULT_SETTINGS, ...stored } as AppSettings;
        log.info('Settings loaded from store:', {
          baseUrl: settings.kimiBaseUrl,
          hasApiKey: !!settings.kimiApiKey,
          defaultModel: settings.defaultModel,
        });
        return settings;
      } catch (error) {
        log.error('Failed to load settings:', error);
        return DEFAULT_SETTINGS;
      }
    }));
    
    ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_, newSettings: Partial<AppSettings>) => wrapHandler('SETTINGS_UPDATE', () => {
      try {
        const current = store.get('settings');
        const updated = { ...current, ...newSettings };
        
        log.info('Saving settings:', {
          baseUrl: updated.kimiBaseUrl,
          hasApiKey: !!updated.kimiApiKey,
          defaultModel: updated.defaultModel,
        });
        
        store.set('settings', updated);
        
        // Verify the settings were saved
        const saved = store.get('settings');
        log.info('Settings verified after save:', {
          baseUrl: saved.kimiBaseUrl,
          hasApiKey: !!saved.kimiApiKey,
        });
        
        // Reinitialize KimiClient with the new settings
        this.reinitializeKimiClient(updated);
        
        // Reinitialize Pieces client if settings changed
        if (newSettings.piecesEnabled !== undefined || newSettings.piecesPort !== undefined) {
          this.reinitializePiecesClient(updated);
        }
        
        // Update action executor config if settings changed
        if (newSettings.actionsEnabled !== undefined && this.actionExecutor) {
          this.actionExecutor.updateConfig({ enabled: newSettings.actionsEnabled });
        }
        
        return updated;
      } catch (error) {
        log.error('Failed to save settings:', error);
        throw error;
      }
    }));
    
    ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, () => wrapHandler('SETTINGS_RESET', () => {
      try {
        store.set('settings', DEFAULT_SETTINGS);
        this.kimiClient = null;
        log.info('Settings reset to defaults');
        return DEFAULT_SETTINGS;
      } catch (error) {
        log.error('Failed to reset settings:', error);
        throw error;
      }
    }));

    // API Key Validation
    ipcMain.handle(IPC_CHANNELS.API_VALIDATE_KEY, (_, apiKey: string, baseUrl?: string) => wrapHandler('API_VALIDATE_KEY', async () => {
      log.info(`Validating API key (length: ${apiKey?.length || 0})...`);
      
      if (!apiKey) {
        log.warn('API key validation failed: empty key');
        return { valid: false, error: 'API key is empty' };
      }

      // Determine provider from key prefix
      const isSynthetic = apiKey.startsWith('syn_');
      const isMoonshot = apiKey.startsWith('sk-');
      
      if (!isSynthetic && !isMoonshot) {
        log.warn('API key validation failed: invalid format');
        return { valid: false, error: 'Invalid API key format. Expected: sk-... (Moonshot) or syn_... (Synthetic)' };
      }

      // Use provided baseUrl or fall back to settings
      const url = baseUrl || store.get('settings').kimiBaseUrl;
      log.info(`Creating KimiClient with baseUrl: ${url}`);
      
      // Validate baseUrl matches key type
      if (isSynthetic && !url.includes('synthetic')) {
        log.warn('Synthetic key detected but baseUrl is not synthetic.new');
        return { valid: false, error: 'Synthetic API key requires https://api.synthetic.new/v1 as base URL' };
      }
      
      if (isMoonshot && url.includes('synthetic')) {
        log.warn('Moonshot key detected but baseUrl is synthetic.new');
        return { valid: false, error: 'Moonshot API key cannot be used with Synthetic base URL. Please select a Moonshot provider.' };
      }

      try {
        const tempClient = new KimiClient({
          apiKey,
          baseUrl: url,
        });
        
        const result = await tempClient.validateApiKey();
        log.info(`API key validation result: ${result.valid ? 'valid' : 'invalid'}`);
        if (!result.valid) {
          log.warn('API key validation error:', result.error);
        }
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('API key validation error:', errorMessage);
        return { valid: false, error: errorMessage };
      }
    }));

    // Conversations
    ipcMain.handle(IPC_CHANNELS.CONVERSATION_GET_ALL, () => wrapHandler('CONVERSATION_GET_ALL', () => {
      return this.conversationStore?.getAll() || [];
    }));
    
    ipcMain.handle(IPC_CHANNELS.CONVERSATION_GET, (_, id: string) => wrapHandler('CONVERSATION_GET', () => {
      return this.conversationStore?.get(id) || null;
    }));
    
    ipcMain.handle(IPC_CHANNELS.CONVERSATION_CREATE, () => wrapHandler('CONVERSATION_CREATE', () => {
      const conversation = this.conversationStore?.create();
      return conversation || null;
    }));
    
    ipcMain.handle(IPC_CHANNELS.CONVERSATION_DELETE, (_, id: string) => wrapHandler('CONVERSATION_DELETE', () => {
      const result = this.conversationStore?.delete(id);
      if (!result) {
        throw new Error(`Conversation not found: ${id}`);
      }
      return true;
    }));
    
    ipcMain.handle(IPC_CHANNELS.CONVERSATION_UPDATE, (_, conversation: Conversation) => wrapHandler('CONVERSATION_UPDATE', () => {
      this.conversationStore?.update(conversation);
      return conversation;
    }));

    ipcMain.handle(IPC_CHANNELS.CONVERSATION_AGENT_MESSAGE, (_, content: string, options?: { createNewThread?: boolean; threadTitle?: string; priority?: 'low' | 'normal' | 'high'; conversationId?: string }) => wrapHandler('CONVERSATION_AGENT_MESSAGE', () => {
      return this.conversationManager?.agentMessage(content, options) ?? null;
    }));

    ipcMain.handle(IPC_CHANNELS.CONVERSATION_IS_CONTEXT_CLUTTERED, (_, conversationId?: string) => wrapHandler('CONVERSATION_IS_CONTEXT_CLUTTERED', () => {
      return this.conversationManager?.isContextCluttered(conversationId) ?? false;
    }));

    ipcMain.handle(IPC_CHANNELS.CONVERSATION_PROPOSE_CONTEXT_RESET, (_, conversationId?: string) => wrapHandler('CONVERSATION_PROPOSE_CONTEXT_RESET', () => {
      return this.conversationManager?.proposeContextReset(conversationId) ?? Promise.resolve(false);
    }));

    ipcMain.handle(IPC_CHANNELS.CONVERSATION_CONTEXT_RESET_RESPOND, (_, proposalId: string, accepted: boolean) => wrapHandler('CONVERSATION_CONTEXT_RESET_RESPOND', () => {
      this.conversationManager?.respondToContextResetProposal(proposalId, accepted);
      return true;
    }));

    // Chat
    ipcMain.handle(IPC_CHANNELS.CHAT_SEND, (_, { 
      conversationId, 
      message,
      model,
      useTools,
      chatContext = 'main',
    }: { 
      conversationId: string; 
      message: Message;
      model: string;
      useTools?: boolean;
      chatContext?: 'sidebar' | 'main';
    }) => wrapHandler('CHAT_SEND', () => this.handleChatSend(conversationId, message, model, useTools, chatContext)));
    
    ipcMain.handle(IPC_CHANNELS.CHAT_CANCEL, () => wrapHandler('CHAT_CANCEL', () => {
      this.currentStreamingRequest?.abort();
      this.currentStreamingRequest = null;
      
      // Also cancel any tool execution
      if (this.toolAbortController) {
        this.toolAbortController.abort();
        this.toolAbortController = null;
      }
    }));

    ipcMain.handle(IPC_CHANNELS.AGENT_ASK_USER_RESPOND, (_, requestId: string, answer: string) => {
      const pending = this.pendingAskUser.get(requestId);
      if (pending) {
        if (pending.timeoutId) clearTimeout(pending.timeoutId);
        this.pendingAskUser.delete(requestId);
        pending.resolve(answer ?? '');
      }
      return { ok: true };
    });

    // Context
    ipcMain.handle(IPC_CHANNELS.CONTEXT_GET, () => wrapHandler('CONTEXT_GET', () => {
      return this.contextMonitor?.getCurrentContext();
    }));

    ipcMain.on(IPC_CHANNELS.CONTEXT_SUBSCRIBE, (event) => {
      const wc = event.sender;
      if (wc && !wc.isDestroyed()) {
        this.contextBridge?.subscribe(wc);
      }
    });

    ipcMain.on(IPC_CHANNELS.CONTEXT_UNSUBSCRIBE, (event) => {
      const wc = event.sender;
      if (wc) {
        this.contextBridge?.unsubscribe(wc);
      }
    });

    // Sidebar / Assistant Mode
    ipcMain.handle(IPC_CHANNELS.SIDEBAR_SET_MODE, (_, mode: AssistantMode) => wrapHandler('SIDEBAR_SET_MODE', () => {
      const current = store.get('settings');
      const updated = { ...current, sidebarAssistantMode: mode };
      store.set('settings', updated);
      this.proactiveAgent?.updateConfig({ defaultMode: mode });
      this.broadcastToRenderers(IPC_CHANNELS.MODE_CHANGED, mode);
      return undefined;
    }));

    ipcMain.handle(IPC_CHANNELS.SIDEBAR_GET_MODE, () => wrapHandler('SIDEBAR_GET_MODE', () => {
      const settings = store.get('settings');
      return (settings as any).sidebarAssistantMode ?? DEFAULT_SETTINGS.sidebarAssistantMode;
    }));

    // Pieces OS
    ipcMain.handle(IPC_CHANNELS.PIECES_STATUS, () => wrapHandler('PIECES_STATUS', async () => {
      if (!this.piecesClient) return { available: false };
      return this.piecesClient.checkStatus();
    }));
    
    ipcMain.handle(IPC_CHANNELS.PIECES_SEARCH, (_, query: string, limit?: number) => wrapHandler('PIECES_SEARCH', async () => {
      if (!this.piecesClient) return [];
      return this.piecesClient.searchAssets(query, limit || 10);
    }));
    
    ipcMain.handle(IPC_CHANNELS.PIECES_GET_ASSET, (_, id: string) => wrapHandler('PIECES_GET_ASSET', async () => {
      if (!this.piecesClient) return null;
      return this.piecesClient.getAsset(id);
    }));
    
    ipcMain.handle(IPC_CHANNELS.PIECES_GET_ALL, () => wrapHandler('PIECES_GET_ALL', async () => {
      if (!this.piecesClient) return [];
      return this.piecesClient.getAllAssets();
    }));
    
    ipcMain.handle(IPC_CHANNELS.PIECES_RELEVANT, (_, query: string, maxAssets?: number) => wrapHandler('PIECES_RELEVANT', async () => {
      if (!this.piecesClient) return [];
      return this.piecesClient.getRelevantAssetsForQuery(query, maxAssets || 5);
    }));
    
    // Pieces LTM (Long-Term Memory via MCP)
    ipcMain.handle(IPC_CHANNELS.PIECES_LTM_STATUS, () => wrapHandler('PIECES_LTM_STATUS', async () => {
      if (!this.piecesMcpClient) {
        return { connected: false, error: 'MCP client not initialized' };
      }
      return this.piecesMcpClient.checkStatus();
    }));
    
    ipcMain.handle(IPC_CHANNELS.PIECES_LTM_QUERY, (_, question: string, options?: any) => wrapHandler('PIECES_LTM_QUERY', async () => {
      if (!this.piecesMcpClient) {
        return { memories: [], query: question, success: false, error: 'MCP client not initialized' };
      }
      return this.piecesMcpClient.askPiecesLtm(question, options);
    }));
    
    // Pieces LTM targeted queries
    ipcMain.handle(IPC_CHANNELS.PIECES_LTM_TOPIC, (_, topic: string) => wrapHandler('PIECES_LTM_TOPIC', async () => {
      if (!this.piecesMcpClient) {
        return { memories: [], query: topic, success: false, error: 'MCP client not initialized' };
      }
      return this.piecesMcpClient.askPiecesLtm(`Tell me about my recent work on: ${topic}`);
    }));
    
    ipcMain.handle(IPC_CHANNELS.PIECES_LTM_CODING, (_, hoursBack?: number) => wrapHandler('PIECES_LTM_CODING', async () => {
      if (!this.piecesMcpClient) {
        return { memories: [], query: 'coding activity', success: false, error: 'MCP client not initialized' };
      }
      const hours = hoursBack || 24;
      return this.piecesMcpClient.askPiecesLtm(`What coding work have I done in the last ${hours} hours?`, {
        applicationSources: ['Code.exe', 'Cursor.exe', 'vim', 'neovim', 'WindowsTerminal.exe']
      });
    }));
    
    ipcMain.handle(IPC_CHANNELS.PIECES_LTM_BROWSING, () => wrapHandler('PIECES_LTM_BROWSING', async () => {
      if (!this.piecesMcpClient) {
        return { memories: [], query: 'browsing', success: false, error: 'MCP client not initialized' };
      }
      return this.piecesMcpClient.askPiecesLtm('What have I been researching or reading in my browser?', {
        applicationSources: ['chrome.exe', 'firefox.exe', 'msedge.exe', 'safari']
      });
    }));
    
    // Proactive Agent
    ipcMain.handle(IPC_CHANNELS.PROACTIVE_GET_SUGGESTIONS, () => wrapHandler('PROACTIVE_GET_SUGGESTIONS', () => {
      return this.proactiveAgent?.getSuggestions() || [];
    }));
    
    ipcMain.handle(IPC_CHANNELS.PROACTIVE_DISMISS, (_, id: string) => wrapHandler('PROACTIVE_DISMISS', () => {
      this.proactiveAgent?.recordExplicitUserActivity();
      const suggestion = this.proactiveAgent?.getSuggestionById(id);
      const result = this.proactiveAgent?.dismissSuggestion(id) || false;
      if (result && suggestion) {
        getUserMemoryStore().recordSuggestion('dismissed');
        getUserMemoryStore().recordSuggestionTypeOutcome(suggestion.type, false);
      }
      return result;
    }));
    
    ipcMain.handle(IPC_CHANNELS.PROACTIVE_SNOOZE, (_, id: string, minutes?: number) => wrapHandler('PROACTIVE_SNOOZE', () => {
      this.proactiveAgent?.recordExplicitUserActivity();
      const suggestion = this.proactiveAgent?.getSuggestionById(id);
      const result = this.proactiveAgent?.snoozeSuggestion(id, minutes || 30) || false;
      if (result && suggestion) {
        getUserMemoryStore().recordSuggestion('snoozed');
        getUserMemoryStore().recordSuggestionTypeOutcome(suggestion.type, false);
      }
      return result;
    }));
    
    ipcMain.handle(IPC_CHANNELS.PROACTIVE_ACCEPT, (_, id: string) => wrapHandler('PROACTIVE_ACCEPT', () => {
      this.proactiveAgent?.recordExplicitUserActivity();
      const suggestion = this.proactiveAgent?.acceptSuggestion(id);
      if (suggestion) {
        getUserMemoryStore().recordSuggestion('accepted');
        getUserMemoryStore().recordSuggestionTypeOutcome(suggestion.type, true);
      }
      return suggestion ?? null;
    }));
    
    ipcMain.handle(IPC_CHANNELS.PROACTIVE_TRIGGER_ANALYSIS, () => wrapHandler('PROACTIVE_TRIGGER_ANALYSIS', async () => {
      if (!this.proactiveAgent) {
        return null;
      }
      return this.proactiveAgent.triggerManualAnalysis();
    }));
    
    ipcMain.handle(IPC_CHANNELS.PROACTIVE_CONFIG_GET, () => wrapHandler('PROACTIVE_CONFIG_GET', () => {
      return this.proactiveAgent?.getStatus().config || DEFAULT_PROACTIVE_CONFIG;
    }));
    
    ipcMain.handle(IPC_CHANNELS.PROACTIVE_CONFIG_UPDATE, (_, config: Partial<typeof DEFAULT_PROACTIVE_CONFIG>) => wrapHandler('PROACTIVE_CONFIG_UPDATE', async () => {
      this.proactiveAgent?.updateConfig(config);
      
      // Also persist to settings
      const currentSettings = store.get('settings');
      const updatedSettings = {
        ...currentSettings,
        proactiveEnabled: config.enabled ?? currentSettings.proactiveEnabled,
        proactiveIntervalMinutes: config.intervalMinutes ?? currentSettings.proactiveIntervalMinutes,
        proactiveMinIdleSeconds: config.minIdleSeconds ?? currentSettings.proactiveMinIdleSeconds,
        proactiveMaxIdleSeconds: config.maxIdleSeconds ?? currentSettings.proactiveMaxIdleSeconds ?? DEFAULT_PROACTIVE_CONFIG.maxIdleSeconds,
        proactiveMaxSuggestionsPerHour: config.maxSuggestionsPerHour ?? currentSettings.proactiveMaxSuggestionsPerHour,
        proactivePriorityThreshold: config.priorityThreshold ?? currentSettings.proactivePriorityThreshold,
      };
      store.set('settings', updatedSettings);
      
      return this.proactiveAgent?.getStatus().config || DEFAULT_PROACTIVE_CONFIG;
    }));
    
    // Personality Settings
    ipcMain.handle(IPC_CHANNELS.PERSONALITY_GET, () => wrapHandler('PERSONALITY_GET', () => {
      const settings = store.get('settings');
      return settings.personality || DEFAULT_PERSONALITY_SETTINGS;
    }));
    
    ipcMain.handle(IPC_CHANNELS.PERSONALITY_UPDATE, (_, personality: Partial<PersonalitySettings>) => wrapHandler('PERSONALITY_UPDATE', () => {
      const currentSettings = store.get('settings');
      const updatedPersonality = {
        ...DEFAULT_PERSONALITY_SETTINGS,
        ...currentSettings.personality,
        ...personality,
      };
      store.set('settings', {
        ...currentSettings,
        personality: updatedPersonality,
      });
      return updatedPersonality;
    }));
    
    // Soul Document
    ipcMain.handle(IPC_CHANNELS.SOUL_DOCUMENT_GET, () => wrapHandler('SOUL_DOCUMENT_GET', () => {
      return this.soulDocumentStore?.getDocument() || DEFAULT_SOUL_DOCUMENT;
    }));
    
    ipcMain.handle(IPC_CHANNELS.SOUL_DOCUMENT_UPDATE, (_, content: string) => wrapHandler('SOUL_DOCUMENT_UPDATE', () => {
      return this.soulDocumentStore?.updateDocument(content, 'user') || DEFAULT_SOUL_DOCUMENT;
    }));
    
    ipcMain.handle(IPC_CHANNELS.SOUL_DOCUMENT_RESET, () => wrapHandler('SOUL_DOCUMENT_RESET', () => {
      return this.soulDocumentStore?.reset() || DEFAULT_SOUL_DOCUMENT;
    }));
    
    ipcMain.handle(IPC_CHANNELS.SOUL_DOCUMENT_AI_UPDATE, (_, data: { section: string; content: string }) => wrapHandler('SOUL_DOCUMENT_AI_UPDATE', () => {
      return this.soulDocumentStore?.updateSection(data.section, data.content, 'ai') || DEFAULT_SOUL_DOCUMENT;
    }));
    
    // Screenshot
    ipcMain.handle(IPC_CHANNELS.SCREENSHOT_CAPTURE, () => wrapHandler('SCREENSHOT_CAPTURE', async () => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 }
        });
        
        if (sources.length === 0) {
          log.warn('No screen sources found for screenshot');
          return null;
        }
        
        // Get the primary display
        const primarySource = sources[0];
        const thumbnail = primarySource.thumbnail;
        
        // Convert to base64
        const base64 = thumbnail.toDataURL();
        log.info('Screenshot captured successfully');
        
        return base64;
      } catch (error) {
        log.error('Screenshot capture error:', error);
        return null;
      }
    }));
    
    ipcMain.handle(IPC_CHANNELS.SCREENSHOT_ANALYZE, (_, base64Image: string) => wrapHandler('SCREENSHOT_ANALYZE', async () => {
      if (!this.kimiClient) {
        return 'Error: AI client not initialized';
      }
      if (!base64Image || typeof base64Image !== 'string') {
        return 'Error: No image data provided';
      }
      try {
        const response = await this.kimiClient.chatWithContent([
          {
            role: 'system',
            content: 'You are analyzing a screenshot of the user\'s screen. Describe what you see concisely, focusing on the main application and content visible. If there are any issues, errors, or things that might need help, mention them.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Please analyze this screenshot and tell me what you see.' },
              { type: 'image_url', image_url: { url: base64Image } },
            ],
          },
        ], {
          model: 'kimi-k2-turbo-preview',
          max_tokens: 500,
        });
        return response;
      } catch (error) {
        log.error('Screenshot analysis error:', error);
        return 'Error analyzing screenshot';
      }
    }));
    
    // Indicator
    ipcMain.handle(IPC_CHANNELS.INDICATOR_GET_STATE, () => wrapHandler('INDICATOR_GET_STATE', () => {
      return this.indicatorState;
    }));
    
    ipcMain.handle(IPC_CHANNELS.INDICATOR_CLICKED, () => wrapHandler('INDICATOR_CLICKED', () => {
      log.info('Indicator clicked - showing main window');
      this.showWindow();
      
      // If there's a suggestion, show it
      if (this.indicatorState.status === 'suggestion' && this.indicatorState.suggestionId) {
        const suggestion = this.proactiveAgent?.getSuggestions().find(s => s.id === this.indicatorState.suggestionId);
        if (suggestion && ((this.mainWindow && !this.mainWindow.isDestroyed()) || (this.drawerWindow && !this.drawerWindow.isDestroyed()))) {
          this.broadcastToRenderers('proactive:show-suggestion', suggestion);
        }
      }
      
      // Reset indicator to idle after click
      this.updateIndicatorState({ status: 'idle', message: undefined, suggestionId: undefined, count: undefined });
    }));
    
    ipcMain.handle(IPC_CHANNELS.INDICATOR_DISMISS, () => wrapHandler('INDICATOR_DISMISS', () => {
      log.info('Indicator dismissed');
      
      // Dismiss the current suggestion if there is one
      if (this.indicatorState.suggestionId) {
        this.proactiveAgent?.dismissSuggestion(this.indicatorState.suggestionId);
      }
      
      // Reset indicator to idle
      this.updateIndicatorState({ status: 'idle', message: undefined, suggestionId: undefined, count: undefined });
    }));
    
    // Drawer / Display Mode
    ipcMain.handle(IPC_CHANNELS.DRAWER_GET_STATE, () => wrapHandler('DRAWER_GET_STATE', () => {
      return this.drawerState;
    }));
    
    ipcMain.handle(IPC_CHANNELS.DRAWER_SET_MODE, (_, mode: AppDisplayMode) => wrapHandler('DRAWER_SET_MODE', () => {
      this.setAppMode(mode);
      return this.drawerState;
    }));
    
    ipcMain.handle(IPC_CHANNELS.DRAWER_EXPAND, () => wrapHandler('DRAWER_EXPAND', () => {
      this.expandDrawer();
      return this.drawerState;
    }));
    
    ipcMain.handle(IPC_CHANNELS.DRAWER_COLLAPSE, () => wrapHandler('DRAWER_COLLAPSE', () => {
      this.collapseDrawer();
      return this.drawerState;
    }));
    
    ipcMain.handle(IPC_CHANNELS.DRAWER_LOCK, (_, locked: boolean) => wrapHandler('DRAWER_LOCK', () => {
      this.updateDrawerState({ isLocked: locked });
      log.info(`Drawer ${locked ? 'locked' : 'unlocked'}`);
      return this.drawerState;
    }));
    
    ipcMain.handle(IPC_CHANNELS.DRAWER_OPEN_FULL, () => wrapHandler('DRAWER_OPEN_FULL', () => {
      this.openFullView();
      return this.drawerState;
    }));

    ipcMain.handle(IPC_CHANNELS.DRAWER_SET_HEIGHT_LOCKED, (_, locked: boolean) => wrapHandler('DRAWER_SET_HEIGHT_LOCKED', () => {
      store.set('settings', { ...store.get('settings'), drawerHeightLocked: locked });
      this.applyDrawerSizeConstraints();
      return this.drawerState;
    }));

    // V2 Actions
    ipcMain.handle(IPC_CHANNELS.ACTION_EXECUTE, (_, action: ProactiveAction) => wrapHandler('ACTION_EXECUTE', async () => {
      if (!this.actionExecutor) {
        return { success: false, error: 'Action executor not initialized' };
      }
      return this.actionExecutor.execute(action);
    }));
    
    ipcMain.handle(IPC_CHANNELS.ACTION_GET_STATUS, () => wrapHandler('ACTION_GET_STATUS', () => {
      return this.actionExecutor?.getStatus() || { enabled: false, pendingCount: 0, historyCount: 0, v2Enabled: false };
    }));
    
    ipcMain.handle(IPC_CHANNELS.ACTION_GET_HISTORY, (_, limit?: number) => wrapHandler('ACTION_GET_HISTORY', () => {
      return this.actionExecutor?.getActionHistory(limit) || [];
    }));
    
    ipcMain.handle(IPC_CHANNELS.ACTION_GET_PENDING, () => wrapHandler('ACTION_GET_PENDING', () => {
      return this.actionExecutor?.getPendingActions() || [];
    }));
    
    ipcMain.handle(IPC_CHANNELS.ACTION_CONFIRM, (_, actionId: string) => wrapHandler('ACTION_CONFIRM', async () => {
      if (!this.actionExecutor) {
        return { success: false, error: 'Action executor not initialized' };
      }
      return this.actionExecutor.confirmAction(actionId);
    }));
    
    ipcMain.handle(IPC_CHANNELS.ACTION_DENY, (_, actionId: string) => wrapHandler('ACTION_DENY', () => {
      if (!this.actionExecutor) {
        return { success: false, error: 'Action executor not initialized' };
      }
      return this.actionExecutor.denyAction(actionId);
    }));
    
    ipcMain.handle(IPC_CHANNELS.ACTION_UPDATE_CONFIG, (_, config: any) => wrapHandler('ACTION_UPDATE_CONFIG', () => {
      this.actionExecutor?.updateConfig(config);
      return this.actionExecutor?.getStatus();
    }));
    
    ipcMain.handle(IPC_CHANNELS.ACTION_SET_PERMISSION, (_, type: ActionType, level: ActionPermissionLevel) => wrapHandler('ACTION_SET_PERMISSION', () => {
      this.actionExecutor?.setPermission(type, level);
      return { success: true };
    }));
    
    // Tool System
    ipcMain.handle(IPC_CHANNELS.TOOL_EXECUTE, (_, { 
      conversationId, 
      messages, 
      systemContext 
    }: { 
      conversationId: string; 
      messages: Message[]; 
      systemContext?: SystemContext;
    }) => wrapHandler('TOOL_EXECUTE', async () => {
      if (!this.toolExecutor) {
        throw new Error('Tool executor not initialized');
      }
      
      this.toolAbortController = new AbortController();
      
      const result = await this.toolExecutor.executeWithTools(
        conversationId,
        messages,
        systemContext,
        {
          onToolStart: (toolName, toolCallId, args) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'tool_start',
              toolName,
              toolCallId,
              args,
              conversationId,
            });
          },
          onToolComplete: (toolName, toolCallId, result) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'tool_complete',
              toolName,
              toolCallId,
              result,
              conversationId,
            });
          },
          onToolError: (toolName, toolCallId, error) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'tool_error',
              toolName,
              toolCallId,
              error,
              conversationId,
            });
          },
          onContent: (content) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'content',
              content,
              conversationId,
            });
          },
          onThinking: (thinking) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'thinking',
              content: thinking,
              conversationId,
            });
          },
          onComplete: (message) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'complete',
              message,
              conversationId,
            });
          },
          onError: (error) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'error',
              error,
              conversationId,
            });
          },
          onDisplayMessage: (message, title, messageType) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'display_message',
              message,
              title,
              messageType,
              conversationId,
            });
          },
          onAskUser: (question, options, inputType) => {
            const requestId = `ask_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
            return new Promise<string>((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                const pending = this.pendingAskUser.get(requestId);
                if (pending) {
                  this.pendingAskUser.delete(requestId);
                  pending.reject(new Error('User did not respond in time'));
                }
              }, 300000);
              this.pendingAskUser.set(requestId, { resolve, reject, timeoutId });
              this.broadcastToRenderers(IPC_CHANNELS.AGENT_ASK_USER_REQUEST, {
                requestId,
                question,
                options: options ?? [],
                inputType: inputType ?? 'text',
                conversationId,
              });
            });
          },
        },
        this.toolAbortController.signal
      );
      
      return result;
    }));
    
    ipcMain.handle(IPC_CHANNELS.TOOL_CANCEL, () => wrapHandler('TOOL_CANCEL', () => {
      if (this.toolAbortController) {
        this.toolAbortController.abort();
        this.toolAbortController = null;
        return { success: true };
      }
      return { success: false, error: 'No active tool execution' };
    }));
    
    // Search
    ipcMain.handle(IPC_CHANNELS.CONVERSATION_SEARCH, (_, options) => wrapHandler('CONVERSATION_SEARCH', () => {
      // Simple search implementation - search in conversation titles and messages
      const conversations = this.conversationStore?.getAll() || [];
      const query = options.query.toLowerCase();
      const results: any[] = [];
      
      for (const conversation of conversations) {
        const titleMatches: any[] = [];
        const messageMatches: any[] = [];
        
        // Check title
        if (conversation.title.toLowerCase().includes(query)) {
          const index = conversation.title.toLowerCase().indexOf(query);
          titleMatches.push({ start: index, end: index + query.length });
        }
        
        // Check messages
        for (const message of conversation.messages) {
          const content = typeof message.content === 'string' 
            ? message.content 
            : JSON.stringify(message.content);
          
          if (content.toLowerCase().includes(query)) {
            const index = content.toLowerCase().indexOf(query);
            const contextStart = Math.max(0, index - 50);
            const contextEnd = Math.min(content.length, index + query.length + 50);
            
            messageMatches.push({
              messageId: message.id,
              role: message.role,
              context: content.substring(contextStart, contextEnd),
              matches: [{ start: index - contextStart, end: index - contextStart + query.length }],
            });
          }
        }
        
        if (titleMatches.length > 0 || messageMatches.length > 0) {
          results.push({
            conversationId: conversation.id,
            title: conversation.title,
            titleMatches,
            messageMatches: messageMatches.slice(0, 5), // Limit to 5 matches per conversation
            messageCount: conversation.messages.length,
            updatedAt: conversation.updatedAt,
          });
        }
      }
      
      return results.slice(0, options.limit || 20);
    }));
    
    // Action Confirmation
    ipcMain.handle(IPC_CHANNELS.ACTION_CONFIRMATION_RESPONSE, (_, response) => wrapHandler('ACTION_CONFIRMATION_RESPONSE', () => {
      this.actionConfirmationService?.handleResponse(response);
      return true;
    }));
    
    ipcMain.handle(IPC_CHANNELS.ACTION_PERMISSION_GET, () => wrapHandler('ACTION_PERMISSION_GET', () => {
      return this.actionConfirmationService?.getPermissions() || [];
    }));
    
    ipcMain.handle(IPC_CHANNELS.ACTION_PERMISSION_CLEAR, (_, actionType: string, pattern?: string) => wrapHandler('ACTION_PERMISSION_CLEAR', () => {
      this.actionConfirmationService?.clearPermission(actionType as any, pattern);
      return true;
    }));
    
    // Register shortcut handler for opening search
    ipcMain.on('register-search-shortcut', () => {
      // This is handled by the global shortcut registered in registerShortcuts
      log.info('Search shortcut registered');
    });
  }

  private async handleChatSend(
    conversationId: string, 
    userMessage: Message,
    model: string,
    useTools?: boolean,
    chatContext: 'sidebar' | 'main' = 'main'
  ): Promise<void> {
    this.proactiveAgent?.recordExplicitUserActivity();

    if (DEBUG) {
      log.info(`Starting chat send for conversation: ${conversationId}`);
      log.info(`KimiClient status: ${this.kimiClient ? 'initialized' : 'null'}`);
      log.info(`Tool execution: ${useTools ? 'enabled' : 'disabled'}`);
    }
    
    if (!this.kimiClient) {
      log.error('Kimi API key not configured - kimiclient is null');
      // Try to reinitialize from settings
      const settings = store.get('settings');
      if (settings.kimiApiKey) {
        if (DEBUG) {
          log.info('Attempting to reinitialize KimiClient from settings...');
        }
        this.kimiClient = new KimiClient({
          apiKey: settings.kimiApiKey,
          baseUrl: settings.kimiBaseUrl,
        });
        if (DEBUG) {
          log.info('KimiClient reinitialized successfully');
        }
        
        // Also reinitialize tool executor
        if (this.toolRegistry) {
          this.toolExecutor = createToolExecutor(this.toolRegistry, this.kimiClient, {
            defaultModel: settings.defaultModel,
          });
        }
      } else {
        log.error('No API key found in settings');
        this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
          type: 'error',
          error: 'Kimi API key not configured. Please add your API key in settings.',
          conversationId,
        });
        return;
      }
    }

    const conversation = this.conversationStore?.get(conversationId);
    if (!conversation) {
      log.error(`Conversation not found: ${conversationId}`);
      this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
        type: 'error',
        error: 'Conversation not found. Please try creating a new conversation.',
        conversationId,
      });
      return;
    }

    // Add user message to conversation
    conversation.messages.push(userMessage);
    conversation.updatedAt = Date.now();
    conversation.isStreaming = true;
    this.conversationStore?.update(conversation);
    
    if (DEBUG) {
      log.info(`Added user message, starting stream with model: ${model}`);
    }

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model,
    };

    // Send initial stream event
    this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
      type: 'start',
      messageId: assistantMessage.id,
      conversationId,
    });

    // If tools are enabled and this is a tool-enabled request, use tool executor
    if (useTools && this.toolExecutor) {
      await this.handleToolBasedChat(conversation, assistantMessage, conversationId, model, chatContext);
    } else {
      await this.handleStandardChat(conversation, assistantMessage, conversationId, model, chatContext);
    }
  }
  
  private async handleToolBasedChat(
    conversation: Conversation,
    assistantMessage: Message,
    conversationId: string,
    model: string,
    chatContext: 'sidebar' | 'main' = 'main'
  ): Promise<void> {
    if (!this.toolExecutor) return;
    
    try {
      this.toolAbortController = new AbortController();
      
      // Prepare context (same as standard chat: system + Pieces assets + LTM when enabled)
      const systemContext = this.contextMonitor?.getCurrentContext();
      let piecesAssets: any[] = [];
      let ltmContext: PiecesLtmResponse | null = null;
      const settings = store.get('settings');
      
      if (settings.piecesEnabled) {
        const lastMsg = conversation.messages[conversation.messages.length - 1];
        const content = typeof lastMsg.content === 'string'
          ? lastMsg.content
          : JSON.stringify(lastMsg.content);
        if (this.piecesClient?.isAvailable()) {
          try {
            piecesAssets = await this.piecesClient.getRelevantAssetsForQuery(content, 3);
          } catch (error) {
            log.warn('Failed to get Pieces assets for tool chat:', error);
          }
        }
        if (this.piecesMcpClient?.isConnected()) {
          try {
            ltmContext = await this.piecesMcpClient.getRelevantContext(content);
          } catch (error) {
            log.warn('Failed to get Pieces LTM context for tool chat:', error);
          }
        }
      }
      
      const contextPrompt = this.buildContextPrompt(systemContext, piecesAssets, ltmContext, chatContext);
      
      // Prepare messages for tool execution
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: contextPrompt,
        timestamp: Date.now(),
      };
      const messages: Message[] = [
        systemMessage,
        ...conversation.messages.slice(-12),
      ];
      
      const result = await this.toolExecutor.executeWithTools(
        conversationId,
        messages,
        systemContext,
        {
          onToolStart: (toolName, toolCallId, args) => {
            let statusMessage: string | undefined;
            if (toolName === 'request_extra_context' && args) {
              try {
                const parsed = typeof args === 'string' ? JSON.parse(args) : args;
                const t = parsed.type || 'ltm';
                const map: Record<string, string> = {
                  qgpt: 'Asking Pieces for insights...',
                  ltm: 'Gathering workflow context...',
                  ltm_debug: 'Checking debugging history...',
                  ltm_browsing: 'Checking browsing context...',
                  ltm_topic: 'Searching for topic-related context...',
                  ltm_coding: 'Gathering coding activity...',
                  pieces_assets: 'Searching your saved snippets...',
                };
                statusMessage = map[t] || 'Gathering context...';
              } catch {
                statusMessage = 'Gathering context...';
              }
            }
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'tool_start',
              toolName,
              toolCallId,
              args,
              conversationId,
              statusMessage,
            });
          },
          onToolComplete: (toolName, toolCallId, result) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'tool_complete',
              toolName,
              toolCallId,
              result,
              conversationId,
            });
          },
          onToolError: (toolName, toolCallId, error) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'tool_error',
              toolName,
              toolCallId,
              error,
              conversationId,
            });
          },
          onContent: (content) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'content',
              content,
              messageId: assistantMessage.id,
              conversationId,
            });
          },
          onThinking: (thinking) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'thinking',
              content: thinking,
              messageId: assistantMessage.id,
              conversationId,
            });
          },
          onDisplayMessage: (message, title, messageType) => {
            this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
              type: 'display_message',
              message,
              title,
              messageType,
              conversationId,
            });
          },
          onAskUser: (question, options, inputType) => {
            const requestId = `ask_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
            return new Promise<string>((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                const pending = this.pendingAskUser.get(requestId);
                if (pending) {
                  this.pendingAskUser.delete(requestId);
                  pending.reject(new Error('User did not respond in time'));
                }
              }, 300000);
              this.pendingAskUser.set(requestId, { resolve, reject, timeoutId });
              this.broadcastToRenderers(IPC_CHANNELS.AGENT_ASK_USER_REQUEST, {
                requestId,
                question,
                options: options ?? [],
                inputType: inputType ?? 'text',
                conversationId,
              });
            });
          },
        },
        this.toolAbortController.signal
      );
      
      // Finalize message
      assistantMessage.content = typeof result.content === 'string' ? result.content : 'No response received';
      assistantMessage.tool_calls = result.tool_calls;
      if (result.metadata?.thinking) {
        assistantMessage.metadata = { thinking: result.metadata.thinking };
      }
      
      conversation.messages.push(assistantMessage);
      conversation.isStreaming = false;
      this.conversationStore?.update(conversation);
      
      // Send end event
      this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
        type: 'end',
        messageId: assistantMessage.id,
        conversationId,
        conversation,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log.error('Tool-based chat error:', errorMessage);
      
      conversation.isStreaming = false;
      this.conversationStore?.update(conversation);
      
      this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
        type: 'error',
        error: errorMessage,
        conversationId,
      });
    } finally {
      this.toolAbortController = null;
    }
  }
  
  private async handleStandardChat(
    conversation: Conversation,
    assistantMessage: Message,
    conversationId: string,
    model: string,
    chatContext: 'sidebar' | 'main' = 'main'
  ): Promise<void> {
    // Prepare context
    const systemContext = this.contextMonitor?.getCurrentContext();
    
    // Get relevant Pieces assets if enabled
    let piecesAssets: any[] = [];
    let ltmContext: PiecesLtmResponse | null = null;
    const settings = store.get('settings');
    
    if (settings.piecesEnabled) {
      const content = typeof conversation.messages[conversation.messages.length - 1].content === 'string' 
        ? conversation.messages[conversation.messages.length - 1].content as string
        : JSON.stringify(conversation.messages[conversation.messages.length - 1].content);
      
      // Get traditional Pieces assets (saved snippets)
      if (this.piecesClient?.isAvailable()) {
        try {
          piecesAssets = await this.piecesClient.getRelevantAssetsForQuery(content, 3);
        } catch (error) {
          log.warn('Failed to get Pieces assets:', error);
        }
      }
      
      // Get LTM context via MCP (rich workflow memories)
      if (this.piecesMcpClient?.isConnected()) {
        try {
          ltmContext = await this.piecesMcpClient.getRelevantContext(content);
          if (ltmContext.success && ltmContext.memories.length > 0) {
            log.info(`Retrieved ${ltmContext.memories.length} LTM memories for context`);
          }
        } catch (error) {
          log.warn('Failed to get Pieces LTM context:', error);
        }
      }
    }
    
    const contextPrompt = this.buildContextPrompt(systemContext, piecesAssets, ltmContext, chatContext);

    // Prepare messages for API
    const messages = [
      { role: 'system' as const, content: contextPrompt },
      ...conversation.messages.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Start streaming
    this.currentStreamingRequest = new AbortController();
    
    let hasReceivedContent = false;
    
    try {
      if (DEBUG) {
        log.info('Initiating Kimi stream...');
      }
      const stream = this.kimiClient!.streamChatCompletion({
        model,
        messages,
        max_tokens: 4096,
      });

      let fullContent = '';
      let thinking = '';

      for await (const chunk of stream) {
        if (this.currentStreamingRequest?.signal.aborted) {
          if (DEBUG) {
            log.info('Stream aborted by user');
          }
          break;
        }

        const delta = chunk.choices[0]?.delta;
        
        if (delta?.reasoning_content) {
          thinking += delta.reasoning_content;
          this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
            type: 'thinking',
            content: delta.reasoning_content,
            messageId: assistantMessage.id,
            conversationId,
          });
        }
        
        if (delta?.content) {
          hasReceivedContent = true;
          fullContent += delta.content;
          this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
            type: 'content',
            content: delta.content,
            messageId: assistantMessage.id,
            conversationId,
          });
        }

        if (chunk.usage) {
          assistantMessage.tokens = {
            prompt: chunk.usage.prompt_tokens,
            completion: chunk.usage.completion_tokens,
            total: chunk.usage.total_tokens,
          };
        }
      }
      
      if (DEBUG) {
        log.info(`Stream completed. Content length: ${fullContent.length}, Has thinking: ${thinking.length > 0}`);
      }

      // Finalize message
      assistantMessage.content = fullContent || 'No response received';
      if (thinking) {
        assistantMessage.metadata = { thinking };
      }
      conversation.messages.push(assistantMessage);
      conversation.isStreaming = false;
      this.conversationStore?.update(conversation);

      if (DEBUG) {
        log.info(`Message finalized. Total messages in conversation: ${conversation.messages.length}`);
      }

      // Update indicator if window is not visible or focused
      if (this.mainWindow && (!this.mainWindow.isVisible() || !this.mainWindow.isFocused())) {
        this.updateIndicatorState({
          status: 'message',
          message: 'New response available',
        });
      }

      // Send end event
      this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
        type: 'end',
        messageId: assistantMessage.id,
        conversationId,
        conversation,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log.error('Chat stream error:', errorMessage);
      
      // Update conversation to reflect error state
      conversation.isStreaming = false;
      this.conversationStore?.update(conversation);
      
      // Categorize errors for better user feedback
      let userErrorMessage = errorMessage;
      
      if (errorMessage.includes('401') || errorMessage.includes('403')) {
        userErrorMessage = 'Invalid API key. Please check your Kimi API key in settings.';
      } else if (errorMessage.includes('429')) {
        userErrorMessage = 'Rate limit exceeded. Please wait a moment before sending another message.';
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
        userErrorMessage = 'Kimi API server error. Please try again later.';
      } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
        userErrorMessage = 'Network error. Please check your internet connection.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        userErrorMessage = 'Request timed out. Please try again.';
      }
      
      // Send error to renderer
      this.broadcastToRenderers(IPC_CHANNELS.CHAT_STREAM, {
        type: 'error',
        error: userErrorMessage,
        originalError: errorMessage, // Keep original for debugging
        messageId: assistantMessage.id,
        conversationId,
      });
    } finally {
      this.currentStreamingRequest = null;
    }
  }

  private buildContextPrompt(
    systemContext: any, 
    piecesAssets?: any[], 
    ltmContext?: PiecesLtmResponse | null,
    chatContext: 'sidebar' | 'main' = 'main'
  ): string {
    if (chatContext === 'sidebar') {
      return this.buildSidebarContextPrompt(systemContext);
    }

    // Get personality settings from stored settings
    const settings = store.get('settings');
    const personalitySettings = settings.personality || DEFAULT_PERSONALITY_SETTINGS;
    
    // Use the new personality-aware prompt builder with soul document integration
    try {
      const prompt = buildCompleteSystemPrompt({
        settings: personalitySettings,
        systemContext,
        ltmContext,
        piecesAssets,
        includeSoulDocument: true,
      });
      return prompt;
    } catch (error) {
      log.error('[NexusApp] Failed to build personality prompt, using fallback:', error);
      // Fallback to basic prompt if personality builder fails
      return this.buildFallbackPrompt(systemContext, piecesAssets, ltmContext);
    }
  }

  private buildSidebarContextPrompt(systemContext: SystemContext | undefined): string {
    let prompt = `You are NEXUS in sidebar mode. Be direct and action-oriented.

## Current context
`;
    if (systemContext?.activeWindow) {
      prompt += `- Active: ${systemContext.activeWindow.application} — "${systemContext.activeWindow.title}"\n`;
    }
    if (systemContext?.systemResources) {
      const { cpu, memory, battery } = systemContext.systemResources;
      prompt += `- CPU: ${cpu.usage}% | Memory: ${memory.percentage}%`;
      if (battery?.hasBattery) {
        prompt += ` | Battery: ${battery.percent}%${battery.isCharging ? ' (charging)' : ''}`;
      }
      prompt += '\n';
    }
    const latestClip = systemContext?.clipboardHistory?.[0];
    if (latestClip && latestClip.type === 'text' && typeof latestClip.content === 'string') {
      const preview = latestClip.content.length > 150 ? latestClip.content.slice(0, 150) + '...' : latestClip.content;
      prompt += `- Clipboard (latest): ${preview}\n`;
    }
    prompt += `
## What you can do
Use tools when needed: get_current_context, take_screenshot, search_files, run_command, open_file, get_clipboard_history, set_reminder, request_extra_context.

## What you don't have
- Browser tab/URL or page content — only the active window title (e.g. "Chrome"). If they ask "what am I looking at in my browser?", say you don't have browser access and suggest they paste the URL or describe the page.
- Screenshot image content — take_screenshot returns dimensions only (image omitted for context). To "see" the screen they must paste an image or describe it.
- Real-time file changes or git status unless the user runs a command or you use search_files.

## Response rules
- Maximum 2 sentences, plain text, no markdown.
- Action-oriented: suggest the next step, don't explain.
- If they ask for deep analysis or long answers, suggest opening main chat.
`;
    return prompt;
  }

  private buildFallbackPrompt(
    systemContext: any, 
    piecesAssets?: any[], 
    ltmContext?: PiecesLtmResponse | null
  ): string {
    let prompt = `# NEXUS

You are NEXUS — a desktop companion with access to the user's system context and workflow memory.

You help by being useful, not by performing helpfulness. Skip the filler phrases. Use what you know. Be direct.

## Critical Rules

**Do NOT:**
- Start with "Great question!" or "Absolutely!" or "I'd be happy to help!"
- Use excessive exclamation marks or emojis
- Apologize repeatedly for not knowing something
- Over-explain things the user clearly understands
- Add filler phrases to seem more helpful

**Do:**
- Be direct. Say what you mean.
- Be concise by default. Expand only when the topic warrants it.
- Use what you know from context. Don't ask for information you already have.
- When uncertain, say so directly.
`;

    if (systemContext?.activeWindow) {
      prompt += `\n## Current Context\n`;
      prompt += `- Active: ${systemContext.activeWindow.application} - "${systemContext.activeWindow.title}"\n`;
    }

    if (systemContext?.systemResources) {
      const { cpu, memory, battery } = systemContext.systemResources;
      if (!prompt.includes('## Current Context')) {
        prompt += `\n## Current Context\n`;
      }
      prompt += `- CPU: ${cpu.usage}% | Memory: ${memory.percentage}%`;
      if (battery?.hasBattery) {
        prompt += ` | Battery: ${battery.percent}%${battery.isCharging ? ' (charging)' : ''}`;
      }
      prompt += '\n';
    }

    // Include Pieces LTM context (rich workflow memories; full content first, single cap)
    if (ltmContext?.success && ltmContext.memories && ltmContext.memories.length > 0) {
      const ltmCap = 1000;
      prompt += `\n## Workflow Memory\n`;
      ltmContext.memories.slice(0, 12).forEach((memory, index) => {
        const raw = memory.content || memory.summary || '';
        const content = raw.length > ltmCap ? raw.substring(0, ltmCap) + '...' : raw;
        const source = memory.application ? `[${memory.application}]` : '';
        const timestamp = memory.timestamp ? `(${memory.timestamp})` : '';
        prompt += `\n${source} ${timestamp}\n${content}\n`;
      });
    }

    // Include Pieces saved assets
    if (piecesAssets && piecesAssets.length > 0) {
      prompt += `\n## Saved Snippets\n`;
      piecesAssets.slice(0, 3).forEach((asset, index) => {
        prompt += `\n[${asset.name}]\n${asset.content.substring(0, 400)}${asset.content.length > 400 ? '...' : ''}\n`;
      });
    }

    prompt += `\n## Remember

- You have context about their work. Use it when relevant, skip it when it's not.
- Technical questions get technical answers. Simple questions get simple answers.
- If you don't know something, say so. Don't make things up.
- Help, don't perform helpfulness.
`;

    return prompt;
  }

  private async findRelevantResourcesForProactive(query: string): Promise<string> {
    try {
      const fetch = (await import('node-fetch')).default as typeof import('node-fetch').default;
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        Abstract?: string;
        AbstractText?: string;
        RelatedTopics?: Array<{ Text?: string }>;
        Answer?: string;
      };
      const abstract = data.Abstract ?? data.AbstractText ?? data.Answer ?? '';
      const related = (data.RelatedTopics ?? []).slice(0, 5).map((t: { Text?: string }) => t.Text).filter(Boolean) as string[];
      const parts: string[] = [];
      if (abstract) parts.push(abstract);
      if (related.length) parts.push('Related: ' + related.join('; '));
      return parts.length ? parts.join('\n') : '';
    } catch (e) {
      log.debug('[NexusApp] Web search for proactive failed:', e);
      return '';
    }
  }

  private askUserForProactive(question: string, options?: string[], inputType?: 'text' | 'choice' | 'confirm'): Promise<string> {
    const requestId = `ask_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    return new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const pending = this.pendingAskUser.get(requestId);
        if (pending) {
          this.pendingAskUser.delete(requestId);
          pending.reject(new Error('User did not respond in time'));
        }
      }, 120000);
      this.pendingAskUser.set(requestId, { resolve, reject, timeoutId });
      this.broadcastToRenderers(IPC_CHANNELS.AGENT_ASK_USER_REQUEST, {
        requestId,
        question,
        options: options ?? [],
        inputType: inputType ?? 'text',
        conversationId: '',
      });
    });
  }

  private tryStartProactiveAgent(): void {
    const hasMinimalDeps = this.proactiveAgent && this.kimiClient && this.contextMonitor && this.taskTracker;
    if (!hasMinimalDeps) {
      log.info('Proactive agent not started - waiting for dependencies (kimi, context, taskTracker)');
      return;
    }
    if (!this.proactiveAgent!.getStatus().config.enabled) {
      log.debug('Proactive agent disabled by config');
      return;
    }
    this.proactiveAgent!.initialize({
      piecesMcpClient: this.piecesMcpClient?.isConnected() ? this.piecesMcpClient : null,
      kimiClient: this.kimiClient!,
      contextMonitor: this.contextMonitor!,
      taskTracker: this.taskTracker!,
      askUser: (question, options, inputType) => this.askUserForProactive(question, options, inputType),
      findRelevantResources: (query) => this.findRelevantResourcesForProactive(query),
    });
    this.proactiveAgent!.start();
    log.info('Proactive agent started', this.piecesMcpClient?.isConnected() ? '(with LTM)' : '(local-only)');
  }

  private startContextMonitoring(): void {
    const settings = store.get('settings');
    if (settings.contextGatheringEnabled && this.contextMonitor) {
      this.contextMonitor.start();

      if (this.contextBridge) {
        this.contextMonitor.on('update', (context: SystemContext) => {
          this.contextBridge!.onContextUpdate(context);
        });
        this.contextMonitor.on('clipboardChange', (item: import('../shared/types').ClipboardItem) => {
          this.contextBridge!.onClipboardChange(item);
        });
        this.contextMonitor.on('fileChange', (change: FileChangeEvent) => {
          const ctx = this.contextMonitor!.getCurrentContext();
          this.contextBridge!.onFileChange(change, ctx.recentFiles || []);
        });
      }

      log.info('Context monitoring started');
    }
    // Start proactive agent when MCP connects (handled in piecesMcpClient.on('connected'))
    setTimeout(() => this.tryStartProactiveAgent(), 8000);

    // Periodic context clutter check (every 30 min)
    setInterval(() => {
      if (this.conversationManager?.isContextCluttered()) {
        this.conversationManager.proposeContextReset().then((accepted) => {
          if (accepted && this.contextSummarizer && this.kimiClient && this.conversationStore) {
            const all = this.conversationStore.getAll();
            const conv = all[0];
            if (conv && conv.messages.length > 0) {
              this.contextSummarizer.summarize(conv).then((summary) => {
                const formatted = this.contextSummarizer!.formatForNewConversation(summary);
                const newConv = this.conversationStore!.create();
                newConv.title = `Fresh start (from ${conv.title})`;
                const systemMsg: Message = {
                  id: `msg_${Date.now()}`,
                  role: 'assistant',
                  content: `Started fresh. Here's what I remember:\n\n${formatted}`,
                  timestamp: Date.now(),
                  metadata: { source: 'context_reset' },
                };
                newConv.messages.push(systemMsg);
                this.conversationStore!.update(newConv);
                this.conversationManager!.agentMessage(`Started fresh. Here's what I remember:\n\n${formatted}`, {
                  conversationId: newConv.id,
                  priority: 'normal',
                });
                log.info('[Nexus] Context reset completed, new conversation created');
              });
            }
          }
        });
      }
    }, 30 * 60 * 1000);
  }

  private showWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
      
      // Reset indicator to idle when main window is shown
      if (this.indicatorState.status !== 'idle') {
        this.updateIndicatorState({ status: 'idle', message: undefined, suggestionId: undefined, count: undefined });
      }
    }
  }

  private hideWindow(): void {
    this.mainWindow?.hide();
  }

  private toggleWindow(): void {
    if (this.mainWindow?.isVisible() && this.mainWindow.isFocused()) {
      this.hideWindow();
    } else {
      this.showWindow();
    }
  }

  private setupAppEvents(): void {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (this.mainWindow === null) {
        this.createMainWindow();
      } else {
        this.showWindow();
      }
    });

    app.on('before-quit', () => {
      this.isQuitting = true;
    });

    // macOS: Prevent window close on red button
    app.on('activate', () => {
      this.showWindow();
    });
  }

  private quit(): void {
    this.isQuitting = true;
    globalShortcut.unregisterAll();
    this.intentEngine?.stop();
    this.patternRecognition?.stop();
    this.smartTriggerManager?.stop();
    this.contextMonitor?.stop();
    this.piecesClient?.stop();
    this.piecesMcpClient?.stop();
    
    // Cleanup V2 Actions & Tool System
    this.actionExecutor?.removeAllListeners();
    this.actionConfirmationService?.cancelAll();
    this.actionConfirmationService?.removeAllListeners();
    this.toolExecutor?.cleanup();
    this.toolRegistry?.cleanup();
    
    // Destroy drawer window
    if (this.drawerWindow && !this.drawerWindow.isDestroyed()) {
      this.drawerWindow.destroy();
      this.drawerWindow = null;
    }
    
    app.quit();
  }
}

// Start the app
new NexusApp();
