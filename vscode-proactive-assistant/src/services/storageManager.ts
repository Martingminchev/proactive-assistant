import * as vscode from 'vscode';
import { 
  UserSettings,
  ActivityStats,
  ILogger,
  IStorageManager,
  Result,
  ok,
  err,
  DismissalRecord,
  UsagePatterns,
  StorageKey
} from '../types';

interface StorageSchema {
  // Dismissals
  'dismissals': DismissalRecord[];
  'dismissalCounts': Record<string, number>;
  
  // Settings
  'settings': UserSettings;
  
  // Stats
  'stats': ActivityStats;
  'sessionCount': number;
  
  // Patterns
  'patterns': UsagePatterns;
  
  // Extension state
  'firstRun': boolean;
  'installDate': number;
  'lastVersion': string;
}

const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  focusMode: false,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00'
  },
  interruptionThreshold: 0.7,
  snoozeDuration: 30,
  piecesOs: {
    enabled: true,
    host: 'localhost',
    port: 5323
  },
  logging: {
    level: 'info'
  },
  activityTracking: {
    enabled: true,
    sampleInterval: 5000
  }
};

const DEFAULT_STATS: ActivityStats = {
  totalTime: 0,
  flowStateTime: {
    idle: 0,
    working: 0,
    deep_flow: 0,
    stuck: 0,
    frustrated: 0
  },
  filesWorked: 0,
  suggestionsShown: 0,
  suggestionsAccepted: 0,
  topErrors: [],
  sessionStart: new Date()
};

const DEFAULT_PATTERNS: UsagePatterns = {
  mostActiveHours: [],
  preferredSuggestionTypes: [],
  commonErrors: [],
  fileTypesWorked: [],
  averageSessionDuration: 0
};

export class StorageManager implements IStorageManager {
  public readonly name = 'StorageManager';

  private disposables: vscode.Disposable[] = [];
  private changeListeners: Map<string, Array<(value: unknown) => void>> = new Map();
  private memoryCache: Map<string, unknown> = new Map();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: ILogger
  ) {
    this.logger.info('StorageManager initialized');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing StorageManager...');

    // Check first run
    const isFirstRun = await this.get<boolean>('firstRun') ?? true;
    if (isFirstRun) {
      await this.set('firstRun', false);
      await this.set('installDate', Date.now());
      await this.set('lastVersion', this.getExtensionVersion());
      this.logger.info('First run detected - initialized default state');
    }

    // Initialize defaults if not set
    await this.initializeDefaults();
  }

  private async initializeDefaults(): Promise<void> {
    const defaults: Partial<StorageSchema> = {
      'dismissals': [],
      'dismissalCounts': {},
      'settings': DEFAULT_SETTINGS,
      'stats': DEFAULT_STATS,
      'sessionCount': 0,
      'patterns': DEFAULT_PATTERNS
    };

    for (const [key, value] of Object.entries(defaults)) {
      const existing = await this.get(key as StorageKey);
      if (existing === undefined) {
        await this.set(key as StorageKey, value);
      }
    }
  }

  private getExtensionVersion(): string {
    const extension = vscode.extensions.getExtension('proactive-assistant.proactive-ai-assistant');
    return extension?.packageJSON?.version || '0.1.0';
  }

  async getDismissals(): Promise<DismissalRecord[]> {
    return (await this.get<DismissalRecord[]>('dismissals')) ?? [];
  }

  async recordDismissal(
    suggestionId: string, 
    reason?: string, 
    context?: string
  ): Promise<void> {
    const dismissals = await this.getDismissals();
    
    const record: DismissalRecord = {
      suggestionId,
      timestamp: Date.now(),
      reason,
      context
    };

    dismissals.push(record);

    // Keep only last 1000 dismissals
    if (dismissals.length > 1000) {
      dismissals.shift();
    }

    await this.set('dismissals', dismissals);

    // Update dismissal counts
    const counts = await this.get<Record<string, number>>('dismissalCounts') ?? {};
    counts[suggestionId] = (counts[suggestionId] || 0) + 1;
    await this.set('dismissalCounts', counts);

    this.logger.debug(`Recorded dismissal for ${suggestionId}`);
  }

  async getDismissalCount(suggestionId: string): Promise<number> {
    const counts = await this.get<Record<string, number>>('dismissalCounts') ?? {};
    return counts[suggestionId] || 0;
  }

  async getAllDismissalCounts(): Promise<Record<string, number>> {
    return (await this.get<Record<string, number>>('dismissalCounts')) ?? {};
  }

  async clearDismissals(suggestionId?: string): Promise<void> {
    if (suggestionId) {
      // Clear specific suggestion
      const dismissals = await this.getDismissals();
      const filtered = dismissals.filter(d => d.suggestionId !== suggestionId);
      await this.set('dismissals', filtered);

      const counts = await this.get<Record<string, number>>('dismissalCounts') ?? {};
      delete counts[suggestionId];
      await this.set('dismissalCounts', counts);
    } else {
      // Clear all
      await this.set('dismissals', []);
      await this.set('dismissalCounts', {});
    }
  }

  async getSettings(): Promise<UserSettings> {
    return (await this.get<UserSettings>('settings')) ?? DEFAULT_SETTINGS;
  }

  async getSetting<K extends keyof UserSettings>(
    key: K
  ): Promise<UserSettings[K]> {
    const settings = await this.getSettings();
    return settings[key];
  }

  async updateSettings(settings: UserSettings): Promise<void> {
    await this.set('settings', settings);
    this.logger.info('Settings updated');
  }

  async updateSetting<K extends keyof UserSettings>(
    key: K, 
    value: UserSettings[K]
  ): Promise<void> {
    const settings = await this.getSettings();
    settings[key] = value;
    await this.set('settings', settings);
    this.logger.debug(`Setting ${key} updated`);
  }

  async resetSettings(): Promise<void> {
    await this.set('settings', DEFAULT_SETTINGS);
    this.logger.info('Settings reset to defaults');
  }

  async getStats(): Promise<ActivityStats> {
    return (await this.get<ActivityStats>('stats')) ?? DEFAULT_STATS;
  }

  async updateStats(stats: ActivityStats): Promise<void> {
    await this.set('stats', stats);
  }

  async incrementStat<K extends keyof ActivityStats>(
    key: K,
    increment: ActivityStats[K] extends number ? number : never
  ): Promise<void> {
    const stats = await this.getStats();
    if (typeof stats[key] === 'number') {
      (stats[key] as number) += increment;
      await this.set('stats', stats);
    }
  }

  async addFlowStateTime(
    state: keyof ActivityStats['flowStateTime'],
    timeMs: number
  ): Promise<void> {
    const stats = await this.getStats();
    stats.flowStateTime[state] += timeMs;
    await this.set('stats', stats);
  }

  async recordSuggestionShown(): Promise<void> {
    await this.incrementStat('suggestionsShown', 1);
  }

  async recordSuggestionAccepted(): Promise<void> {
    await this.incrementStat('suggestionsAccepted', 1);
  }

  async resetStats(): Promise<void> {
    await this.set('stats', {
      ...DEFAULT_STATS,
      sessionStart: new Date()
    });
    this.logger.info('Statistics reset');
  }

  async getPatterns(): Promise<UsagePatterns> {
    return (await this.get<UsagePatterns>('patterns')) ?? DEFAULT_PATTERNS;
  }

  async updatePatterns(patterns: Partial<UsagePatterns>): Promise<void> {
    const current = await this.getPatterns();
    await this.set('patterns', { ...current, ...patterns });
  }

  async recordFileType(fileType: string): Promise<void> {
    const patterns = await this.getPatterns();
    if (!patterns.fileTypesWorked.includes(fileType)) {
      patterns.fileTypesWorked.push(fileType);
      await this.set('patterns', patterns);
    }
  }

  async recordActiveHour(hour: number): Promise<void> {
    const patterns = await this.getPatterns();
    if (!patterns.mostActiveHours.includes(hour)) {
      patterns.mostActiveHours.push(hour);
      await this.set('patterns', patterns);
    }
  }

  async getSessionCount(): Promise<number> {
    return (await this.get<number>('sessionCount')) ?? 0;
  }

  async incrementSessionCount(): Promise<number> {
    const count = await this.getSessionCount();
    const newCount = count + 1;
    await this.set('sessionCount', newCount);
    return newCount;
  }

  async getInstallDate(): Promise<Date | null> {
    const timestamp = await this.get<number>('installDate');
    return timestamp ? new Date(timestamp) : null;
  }

  async isFirstRun(): Promise<boolean> {
    return (await this.get<boolean>('firstRun')) ?? true;
  }

  async get<T>(key: StorageKey): Promise<T | undefined> {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T;
    }

    const value = this.context.globalState.get<T>(key);
    if (value !== undefined) {
      this.memoryCache.set(key, value);
    }
    return value;
  }

  async set<T>(key: StorageKey, value: T): Promise<void> {
    this.memoryCache.set(key, value);
    await this.context.globalState.update(key, value);
    
    // Notify listeners
    this.notifyListeners(key, value);
  }

  async delete(key: StorageKey): Promise<void> {
    this.memoryCache.delete(key);
    await this.context.globalState.update(key, undefined);
  }

  async has(key: StorageKey): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    // Clear all known keys
    const keys: StorageKey[] = [
      'dismissals', 'dismissalCounts', 'settings', 
      'stats', 'sessionCount', 'patterns'
    ];
    
    for (const key of keys) {
      await this.context.globalState.update(key, undefined);
    }

    this.logger.info('Storage cleared');
  }

  onChange<T>(
    key: StorageKey, 
    callback: (value: T) => void
  ): vscode.Disposable {
    const listeners = this.changeListeners.get(key) || [];
    listeners.push(callback as (value: unknown) => void);
    this.changeListeners.set(key, listeners);

    return {
      dispose: () => {
        const current = this.changeListeners.get(key) || [];
        const index = current.indexOf(callback as (value: unknown) => void);
        if (index > -1) {
          current.splice(index, 1);
        }
      }
    };
  }

  private notifyListeners(key: string, value: unknown): void {
    const listeners = this.changeListeners.get(key) || [];
    for (const listener of listeners) {
      try {
        listener(value);
      } catch (error) {
        this.logger.error(`Error in storage listener for ${key}`, error as Error);
      }
    }
  }

  async exportAll(): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = {};
    
    const keys: StorageKey[] = [
      'dismissals', 'dismissalCounts', 'settings', 
      'stats', 'sessionCount', 'patterns', 'firstRun', 
      'installDate', 'lastVersion'
    ];

    for (const key of keys) {
      data[key] = await this.get(key);
    }

    return data;
  }

  async importAll(data: Record<string, unknown>): Promise<Result<void>> {
    try {
      for (const [key, value] of Object.entries(data)) {
        await this.set(key as StorageKey, value);
      }
      this.logger.info('Data imported successfully');
      return ok(undefined);
    } catch (error) {
      this.logger.error('Failed to import data', error as Error);
      return err(error as Error);
    }
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.changeListeners.clear();
    this.memoryCache.clear();
  }
}

export default StorageManager;
