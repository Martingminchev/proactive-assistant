import * as vscode from 'vscode';
import { 
  FlowState, 
  ActivityContext, 
  ILogger,
  IInterruptionManager,
  InterruptionLevel,
  InterruptionStats,
  InterruptionDecision
} from '../types';
import { INTERRUPTION_MANAGER_CONFIG } from '../config/settings';

interface InterruptionConfig {
  minInterruptionIntervalMs: number;  // 30 minutes
  maxDismissalsBeforeBlacklist: number;  // 3 strikes
  quietHoursStart: string;  // 22:00
  quietHoursEnd: string;    // 08:00
  respectDeepFlow: boolean;
  focusModeDurationMs: number;
}

const DEFAULT_CONFIG: InterruptionConfig = {
  minInterruptionIntervalMs: INTERRUPTION_MANAGER_CONFIG.MIN_INTERRUPTION_INTERVAL_MS,
  maxDismissalsBeforeBlacklist: INTERRUPTION_MANAGER_CONFIG.MAX_DISMISSALS_BEFORE_BLACKLIST,
  quietHoursStart: INTERRUPTION_MANAGER_CONFIG.QUIET_HOURS_START,
  quietHoursEnd: INTERRUPTION_MANAGER_CONFIG.QUIET_HOURS_END,
  respectDeepFlow: INTERRUPTION_MANAGER_CONFIG.RESPECT_DEEP_FLOW,
  focusModeDurationMs: INTERRUPTION_MANAGER_CONFIG.FOCUS_MODE_DURATION_MS,
};

const STORAGE_KEYS = {
  DISMISSALS: 'interruption.dismissals',
  STATS: 'interruption.stats',
  BLACKLIST: 'interruption.blacklist',
  FOCUS_MODE_END: 'interruption.focusModeEnd'
};

export class InterruptionManager implements IInterruptionManager {
  public readonly name = 'InterruptionManager';

  // Events
  private readonly _onInterruptionDecision = new vscode.EventEmitter<InterruptionDecision>();
  public readonly onInterruptionDecision = this._onInterruptionDecision.event;

  private readonly _onStatsUpdated = new vscode.EventEmitter<InterruptionStats>();
  public readonly onStatsUpdated = this._onStatsUpdated.event;

  // State
  private config: InterruptionConfig;
  private stats: InterruptionStats;
  private dismissalHistory: Map<string, number[]> = new Map();
  private blacklist: Set<string> = new Set();
  private focusModeEnd: number = 0;
  private lastInterruptionTime: number = 0;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: ILogger,
    config?: Partial<InterruptionConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize stats
    this.stats = {
      totalSuggestions: 0,
      totalDismissals: 0,
      totalAcceptances: 0,
      blacklistedSuggestions: [],
      lastInterruptionTime: null,
      currentFocusModeEnd: null,
      dismissalHistory: new Map()
    };

    this.logger.info('InterruptionManager initialized');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing InterruptionManager...');
    
    // Load persisted state
    await this.loadState();
    
    // Setup configuration change listener
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('proactiveAssistant')) {
          this.updateConfigFromSettings();
        }
      })
    );

    this.updateConfigFromSettings();
  }

  private updateConfigFromSettings(): void {
    const config = vscode.workspace.getConfiguration('proactiveAssistant');
    
    const quietHours = config.get<{ enabled: boolean; start: string; end: string }>('quietHours');
    if (quietHours) {
      this.config.quietHoursStart = quietHours.start;
      this.config.quietHoursEnd = quietHours.end;
    }

    const snoozeDuration = config.get<number>('snoozeDuration');
    if (snoozeDuration) {
      this.config.focusModeDurationMs = snoozeDuration * 60 * 1000;
    }
  }

  private async loadState(): Promise<void> {
    // Load dismissal history
    const savedDismissals = this.context.globalState.get<Record<string, number[]>>(STORAGE_KEYS.DISMISSALS, {});
    this.dismissalHistory = new Map(Object.entries(savedDismissals));

    // Load blacklist
    const savedBlacklist = this.context.globalState.get<string[]>(STORAGE_KEYS.BLACKLIST, []);
    this.blacklist = new Set(savedBlacklist);

    // Load focus mode end time
    this.focusModeEnd = this.context.globalState.get<number>(STORAGE_KEYS.FOCUS_MODE_END, 0);

    // Load last interruption time
    this.lastInterruptionTime = this.context.globalState.get<number>('lastInterruptionTime', 0);

    // Calculate stats
    this.calculateStats();

    this.logger.info('Loaded interruption state', {
      blacklistSize: this.blacklist.size,
      dismissalCount: this.dismissalHistory.size
    });
  }

  private async saveState(): Promise<void> {
    // Save dismissal history
    const dismissalsObj = Object.fromEntries(this.dismissalHistory);
    await this.context.globalState.update(STORAGE_KEYS.DISMISSALS, dismissalsObj);

    // Save blacklist
    await this.context.globalState.update(STORAGE_KEYS.BLACKLIST, Array.from(this.blacklist));

    // Save focus mode end
    await this.context.globalState.update(STORAGE_KEYS.FOCUS_MODE_END, this.focusModeEnd);

    // Save last interruption time
    await this.context.globalState.update('lastInterruptionTime', this.lastInterruptionTime);

    // Update and emit stats
    this.calculateStats();
    this._onStatsUpdated.fire(this.stats);
  }

  private calculateStats(): void {
    let totalDismissals = 0;
    for (const times of this.dismissalHistory.values()) {
      totalDismissals += times.length;
    }

    this.stats = {
      totalSuggestions: this.stats.totalSuggestions,
      totalDismissals,
      totalAcceptances: this.stats.totalAcceptances,
      blacklistedSuggestions: Array.from(this.blacklist),
      lastInterruptionTime: this.lastInterruptionTime || null,
      currentFocusModeEnd: this.focusModeEnd > Date.now() ? this.focusModeEnd : null,
      dismissalHistory: new Map(this.dismissalHistory)
    };
  }

  shouldInterrupt(context: ActivityContext, flowState: FlowState, suggestionId?: string): InterruptionDecision {
    const now = Date.now();

    // Check if suggestion is blacklisted
    if (suggestionId && this.blacklist.has(suggestionId)) {
      return {
        shouldInterrupt: false,
        level: 1,
        reason: 'Suggestion is blacklisted (3 dismissals)'
      };
    }

    // Check focus mode
    if (now < this.focusModeEnd) {
      return {
        shouldInterrupt: false,
        level: 1,
        reason: 'Focus mode is active',
        waitTimeMs: this.focusModeEnd - now
      };
    }

    // Check quiet hours
    if (this.isInQuietHours()) {
      return {
        shouldInterrupt: false,
        level: 1,
        reason: 'Currently in quiet hours'
      };
    }

    // Check 30-minute rule
    const timeSinceLastInterruption = now - this.lastInterruptionTime;
    if (timeSinceLastInterruption < this.config.minInterruptionIntervalMs) {
      return {
        shouldInterrupt: false,
        level: 1,
        reason: 'Minimum interruption interval not met',
        waitTimeMs: this.config.minInterruptionIntervalMs - timeSinceLastInterruption
      };
    }

    // Calculate interruption level based on flow state
    const level = this.calculateInterruptionLevel(flowState, context);

    // Check deep flow respect
    if (flowState === 'deep_flow' && this.config.respectDeepFlow) {
      return {
        shouldInterrupt: false,
        level,
        reason: 'User is in deep flow state - respecting focus'
      };
    }

    // Allow interruption
    return {
      shouldInterrupt: true,
      level,
      reason: `Interruption allowed at level ${level}`
    };
  }

  calculateInterruptionLevel(flowState: FlowState, context: ActivityContext): InterruptionLevel {
    let baseLevel: InterruptionLevel = 2;

    // Adjust based on flow state
    switch (flowState) {
      case 'idle':
        baseLevel = 3;  // Good time to interrupt
        break;
      case 'working':
        baseLevel = 2;  // Moderate interruption OK
        break;
      case 'deep_flow':
        baseLevel = 1;  // Minimize interruption
        break;
      case 'stuck':
        baseLevel = 4;  // Urgent - user needs help
        break;
      case 'frustrated':
        baseLevel = 4;  // Urgent - user is frustrated
        break;
    }

    // Adjust based on error severity
    if (context.errors && context.errors.length > 0) {
      const hasCriticalErrors = context.errors.some(e => 
        e.severity === 'error' && 
        (e.message.includes('SyntaxError') || e.message.includes('ReferenceError'))
      );
      if (hasCriticalErrors) {
        baseLevel = Math.min(4, baseLevel + 1) as InterruptionLevel;
      }
    }

    // Adjust based on idle time
    if (context.duration && context.duration > INTERRUPTION_MANAGER_CONFIG.IDLE_DURATION_THRESHOLD_MS) { // > 10 min idle
      baseLevel = Math.min(4, baseLevel + 1) as InterruptionLevel;
    }

    return baseLevel;
  }

  private isInQuietHours(): boolean {
    const config = vscode.workspace.getConfiguration('proactiveAssistant');
    const quietHoursEnabled = config.get<boolean>('quietHours.enabled', false);
    
    if (!quietHoursEnabled) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const startParts = this.config.quietHoursStart.split(':').map(Number);
    const endParts = this.config.quietHoursEnd.split(':').map(Number);
    
    const startHour = startParts[0] ?? 22;
    const startMinute = startParts[1] ?? 0;
    const endHour = endParts[0] ?? 8;
    const endMinute = endParts[1] ?? 0;
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime <= endTime) {
      // Simple case: 22:00 - 08:00 doesn't cross midnight
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Complex case: 22:00 - 08:00 crosses midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  async recordDismissal(suggestionId: string): Promise<void> {
    const now = Date.now();
    
    // Get existing dismissals for this suggestion
    const existing = this.dismissalHistory.get(suggestionId) || [];
    existing.push(now);
    
    // Keep only last 30 days of dismissals
    const retentionMs = INTERRUPTION_MANAGER_CONFIG.DISMISSAL_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - retentionMs;
    const recentDismissals = existing.filter(t => t > thirtyDaysAgo);
    
    this.dismissalHistory.set(suggestionId, recentDismissals);
    
    // Check for blacklist (3 strikes)
    if (recentDismissals.length >= this.config.maxDismissalsBeforeBlacklist) {
      this.blacklist.add(suggestionId);
      this.logger.info(`Suggestion ${suggestionId} added to blacklist`);
    }

    this.stats.totalDismissals++;
    
    await this.saveState();
  }

  async recordAcceptance(suggestionId: string): Promise<void> {
    this.stats.totalAcceptances++;
    
    // Clear dismissals for this suggestion (user accepted it)
    this.dismissalHistory.delete(suggestionId);
    
    await this.saveState();
  }

  async recordInterruption(_suggestionId: string): Promise<void> {
    this.lastInterruptionTime = Date.now();
    this.stats.totalSuggestions++;
    
    await this.saveState();
  }

  async enableFocusMode(durationMinutes?: number): Promise<void> {
    const duration = durationMinutes 
      ? durationMinutes * 60 * 1000 
      : this.config.focusModeDurationMs;
    
    this.focusModeEnd = Date.now() + duration;
    
    this.logger.info(`Focus mode enabled until ${new Date(this.focusModeEnd).toISOString()}`);
    
    await this.saveState();
  }

  async disableFocusMode(): Promise<void> {
    this.focusModeEnd = 0;
    
    this.logger.info('Focus mode disabled');
    
    await this.saveState();
  }

  isFocusModeActive(): boolean {
    return Date.now() < this.focusModeEnd;
  }

  getFocusModeRemainingMinutes(): number {
    if (!this.isFocusModeActive()) {
      return 0;
    }
    return Math.ceil((this.focusModeEnd - Date.now()) / 60000);
  }

  getStats(): InterruptionStats {
    this.calculateStats();
    return { ...this.stats };
  }

  isBlacklisted(suggestionId: string): boolean {
    return this.blacklist.has(suggestionId);
  }

  async clearBlacklist(suggestionId?: string): Promise<void> {
    if (suggestionId) {
      this.blacklist.delete(suggestionId);
      this.dismissalHistory.delete(suggestionId);
    } else {
      // Clear all
      this.blacklist.clear();
      this.dismissalHistory.clear();
    }
    
    await this.saveState();
  }

  getTimeUntilNextInterruption(): number {
    const now = Date.now();
    
    // Check focus mode
    if (now < this.focusModeEnd) {
      return this.focusModeEnd - now;
    }
    
    // Check minimum interval
    const timeSinceLast = now - this.lastInterruptionTime;
    if (timeSinceLast < this.config.minInterruptionIntervalMs) {
      return this.config.minInterruptionIntervalMs - timeSinceLast;
    }
    
    return 0;
  }

  dispose(): void {
    this._onInterruptionDecision.dispose();
    this._onStatsUpdated.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

export default InterruptionManager;
