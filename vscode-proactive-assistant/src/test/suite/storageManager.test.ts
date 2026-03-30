import * as assert from 'assert';
import { StorageManager } from '../../services/storageManager';
import { createMockExtensionContext, createMockLogger } from '../utils/testHelpers';

describe('StorageManager', () => {
  let manager: StorageManager;
  let mockContext: ReturnType<typeof createMockExtensionContext>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    mockContext = createMockExtensionContext();
    mockLogger = createMockLogger();
    manager = new StorageManager(mockContext, mockLogger);
    await manager.initialize();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with correct name', () => {
      assert.strictEqual(manager.name, 'StorageManager');
    });

    it('should detect first run', async () => {
      const isFirstRun = await manager.isFirstRun();
      assert.strictEqual(isFirstRun, false);
    });

    it('should set install date on first run', async () => {
      const installDate = await manager.getInstallDate();
      
      assert.ok(installDate instanceof Date);
      assert.ok(installDate.getTime() <= Date.now());
    });

    it('should initialize default values', async () => {
      const settings = await manager.getSettings();
      const stats = await manager.getStats();
      const patterns = await manager.getPatterns();
      
      assert.ok(settings);
      assert.strictEqual(settings.enabled, true);
      assert.ok(stats);
      assert.ok(patterns);
    });
  });

  describe('Generic CRUD Operations', () => {
    it('should set and get values', async () => {
      await manager.set('dismissals', [{ suggestionId: 'test', timestamp: Date.now() }]);
      
      const value = await manager.get('dismissals');
      
      assert.ok(Array.isArray(value));
      assert.strictEqual(value.length, 1);
    });

    it('should return undefined for unset keys', async () => {
      await manager.delete('dismissals');
      
      const value = await manager.get('dismissals');
      
      assert.deepStrictEqual(value, []);
    });

    it('should check if key exists', async () => {
      assert.strictEqual(await manager.has('settings'), true);
      
      await manager.delete('sessionCount');
      assert.strictEqual(await manager.has('sessionCount'), false);
    });

    it('should delete values', async () => {
      await manager.set('sessionCount', 5);
      assert.strictEqual(await manager.get('sessionCount'), 5);
      
      await manager.delete('sessionCount');
      assert.strictEqual(await manager.get('sessionCount'), undefined);
    });

    it('should clear all storage', async () => {
      await manager.set('sessionCount', 5);
      await manager.clear();
      
      const keys = ['dismissals', 'settings', 'stats'];
      for (const key of keys) {
        const value = await manager.get(key as any);
        if (key === 'settings') {
          assert.ok(value);
        }
      }
    });
  });

  describe('Dismissals', () => {
    it('should record a dismissal', async () => {
      await manager.recordDismissal('suggestion-1', 'not helpful', 'test context');
      
      const dismissals = await manager.getDismissals();
      
      assert.strictEqual(dismissals.length, 1);
      assert.strictEqual(dismissals[0].suggestionId, 'suggestion-1');
      assert.strictEqual(dismissals[0].reason, 'not helpful');
      assert.strictEqual(dismissals[0].context, 'test context');
    });

    it('should limit dismissals to 1000 entries', async () => {
      for (let i = 0; i < 1005; i++) {
        await manager.recordDismissal(`suggestion-${i}`);
      }
      
      const dismissals = await manager.getDismissals();
      
      assert.strictEqual(dismissals.length, 1000);
    });

    it('should track dismissal counts', async () => {
      await manager.recordDismissal('suggestion-a');
      await manager.recordDismissal('suggestion-a');
      await manager.recordDismissal('suggestion-b');
      
      const countA = await manager.getDismissalCount('suggestion-a');
      const countB = await manager.getDismissalCount('suggestion-b');
      const allCounts = await manager.getAllDismissalCounts();
      
      assert.strictEqual(countA, 2);
      assert.strictEqual(countB, 1);
      assert.strictEqual(allCounts['suggestion-a'], 2);
      assert.strictEqual(allCounts['suggestion-b'], 1);
    });

    it('should clear dismissals for specific suggestion', async () => {
      await manager.recordDismissal('suggestion-a');
      await manager.recordDismissal('suggestion-a');
      await manager.recordDismissal('suggestion-b');
      
      await manager.clearDismissals('suggestion-a');
      
      const dismissals = await manager.getDismissals();
      const countA = await manager.getDismissalCount('suggestion-a');
      
      assert.strictEqual(dismissals.length, 1);
      assert.strictEqual(dismissals[0].suggestionId, 'suggestion-b');
      assert.strictEqual(countA, 0);
    });

    it('should clear all dismissals', async () => {
      await manager.recordDismissal('suggestion-a');
      await manager.recordDismissal('suggestion-b');
      
      await manager.clearDismissals();
      
      const dismissals = await manager.getDismissals();
      const counts = await manager.getAllDismissalCounts();
      
      assert.strictEqual(dismissals.length, 0);
      assert.deepStrictEqual(counts, {});
    });
  });

  describe('Settings', () => {
    it('should get settings with defaults', async () => {
      const settings = await manager.getSettings();
      
      assert.strictEqual(settings.enabled, true);
      assert.strictEqual(settings.focusMode, false);
      assert.strictEqual(settings.interruptionThreshold, 0.7);
      assert.strictEqual(settings.snoozeDuration, 30);
    });

    it('should get specific setting', async () => {
      const enabled = await manager.getSetting('enabled');
      const threshold = await manager.getSetting('interruptionThreshold');
      
      assert.strictEqual(enabled, true);
      assert.strictEqual(threshold, 0.7);
    });

    it('should update all settings', async () => {
      const newSettings = {
        enabled: false,
        focusMode: true,
        quietHours: {
          enabled: true,
          start: '21:00',
          end: '07:00'
        },
        interruptionThreshold: 0.5,
        snoozeDuration: 60,
        piecesOs: {
          enabled: false,
          host: 'remote',
          port: 8080
        },
        logging: {
          level: 'debug' as const
        },
        activityTracking: {
          enabled: false,
          sampleInterval: 10000
        }
      };
      
      await manager.updateSettings(newSettings);
      
      const settings = await manager.getSettings();
      
      assert.strictEqual(settings.enabled, false);
      assert.strictEqual(settings.focusMode, true);
      assert.strictEqual(settings.interruptionThreshold, 0.5);
    });

    it('should update specific setting', async () => {
      await manager.updateSetting('enabled', false);
      await manager.updateSetting('interruptionThreshold', 0.9);
      
      const settings = await manager.getSettings();
      
      assert.strictEqual(settings.enabled, false);
      assert.strictEqual(settings.interruptionThreshold, 0.9);
      assert.strictEqual(settings.focusMode, false);
    });

    it('should reset settings to defaults', async () => {
      await manager.updateSetting('enabled', false);
      await manager.updateSetting('interruptionThreshold', 0.9);
      
      await manager.resetSettings();
      
      const settings = await manager.getSettings();
      
      assert.strictEqual(settings.enabled, true);
      assert.strictEqual(settings.interruptionThreshold, 0.7);
    });
  });

  describe('Statistics', () => {
    it('should get stats with defaults', async () => {
      const stats = await manager.getStats();
      
      assert.strictEqual(stats.totalTime, 0);
      assert.strictEqual(stats.filesWorked, 0);
      assert.strictEqual(stats.suggestionsShown, 0);
      assert.strictEqual(stats.suggestionsAccepted, 0);
      assert.ok(stats.sessionStart instanceof Date);
    });

    it('should update stats', async () => {
      const newStats = {
        totalTime: 3600000,
        flowStateTime: {
          idle: 600000,
          working: 1800000,
          deep_flow: 1200000,
          stuck: 0,
          frustrated: 0
        },
        filesWorked: 5,
        suggestionsShown: 10,
        suggestionsAccepted: 7,
        topErrors: [{ message: 'Type error', count: 3 }],
        sessionStart: new Date()
      };
      
      await manager.updateStats(newStats);
      
      const stats = await manager.getStats();
      
      assert.strictEqual(stats.totalTime, 3600000);
      assert.strictEqual(stats.filesWorked, 5);
      assert.strictEqual(stats.suggestionsShown, 10);
    });

    it('should increment stat counters', async () => {
      await manager.incrementStat('suggestionsShown', 5);
      await manager.incrementStat('suggestionsShown', 3);
      
      const stats = await manager.getStats();
      
      assert.strictEqual(stats.suggestionsShown, 8);
    });

    it('should add flow state time', async () => {
      await manager.addFlowStateTime('deep_flow', 600000);
      await manager.addFlowStateTime('deep_flow', 300000);
      
      const stats = await manager.getStats();
      
      assert.strictEqual(stats.flowStateTime.deep_flow, 900000);
    });

    it('should record suggestion shown', async () => {
      await manager.recordSuggestionShown();
      await manager.recordSuggestionShown();
      
      const stats = await manager.getStats();
      
      assert.strictEqual(stats.suggestionsShown, 2);
    });

    it('should record suggestion accepted', async () => {
      await manager.recordSuggestionAccepted();
      
      const stats = await manager.getStats();
      
      assert.strictEqual(stats.suggestionsAccepted, 1);
    });

    it('should reset stats', async () => {
      await manager.incrementStat('suggestionsShown', 10);
      await manager.addFlowStateTime('working', 60000);
      
      await manager.resetStats();
      
      const stats = await manager.getStats();
      
      assert.strictEqual(stats.suggestionsShown, 0);
      assert.strictEqual(stats.flowStateTime.working, 0);
    });
  });

  describe('Patterns', () => {
    it('should get patterns with defaults', async () => {
      const patterns = await manager.getPatterns();
      
      assert.deepStrictEqual(patterns.mostActiveHours, []);
      assert.deepStrictEqual(patterns.preferredSuggestionTypes, []);
      assert.deepStrictEqual(patterns.commonErrors, []);
      assert.deepStrictEqual(patterns.fileTypesWorked, []);
      assert.strictEqual(patterns.averageSessionDuration, 0);
    });

    it('should update patterns', async () => {
      await manager.updatePatterns({
        mostActiveHours: [9, 10, 14, 15],
        averageSessionDuration: 3600000
      });
      
      const patterns = await manager.getPatterns();
      
      assert.deepStrictEqual(patterns.mostActiveHours, [9, 10, 14, 15]);
      assert.strictEqual(patterns.averageSessionDuration, 3600000);
    });

    it('should record file type', async () => {
      await manager.recordFileType('typescript');
      await manager.recordFileType('typescript');
      await manager.recordFileType('javascript');
      
      const patterns = await manager.getPatterns();
      
      assert.deepStrictEqual(patterns.fileTypesWorked, ['typescript', 'javascript']);
    });

    it('should record active hour', async () => {
      await manager.recordActiveHour(9);
      await manager.recordActiveHour(9);
      await manager.recordActiveHour(14);
      
      const patterns = await manager.getPatterns();
      
      assert.deepStrictEqual(patterns.mostActiveHours, [9, 14]);
    });
  });

  describe('Session Management', () => {
    it('should get session count', async () => {
      const count = await manager.getSessionCount();
      
      assert.strictEqual(count, 0);
    });

    it('should increment session count', async () => {
      const count1 = await manager.incrementSessionCount();
      const count2 = await manager.incrementSessionCount();
      
      assert.strictEqual(count1, 1);
      assert.strictEqual(count2, 2);
      
      const stored = await manager.getSessionCount();
      assert.strictEqual(stored, 2);
    });
  });

  describe('Change Listeners', () => {
    it('should notify listeners on change', async () => {
      const changes: any[] = [];
      
      const disposable = manager.onChange('settings', (value) => {
        changes.push(value);
      });
      
      await manager.updateSetting('enabled', false);
      
      assert.strictEqual(changes.length, 1);
      assert.strictEqual(changes[0].enabled, false);
      
      disposable.dispose();
    });

    it('should stop notifying after disposal', async () => {
      let changeCount = 0;
      
      const disposable = manager.onChange('settings', () => {
        changeCount++;
      });
      
      await manager.updateSetting('enabled', false);
      disposable.dispose();
      await manager.updateSetting('enabled', true);
      
      assert.strictEqual(changeCount, 1);
    });

    it('should handle multiple listeners', async () => {
      const changes1: any[] = [];
      const changes2: any[] = [];
      
      const disposable1 = manager.onChange('stats', (value) => changes1.push(value));
      const disposable2 = manager.onChange('stats', (value) => changes2.push(value));
      
      await manager.incrementStat('suggestionsShown', 1);
      
      assert.strictEqual(changes1.length, 1);
      assert.strictEqual(changes2.length, 1);
      
      disposable1.dispose();
      disposable2.dispose();
    });
  });

  describe('Import/Export', () => {
    it('should export all data', async () => {
      await manager.updateSetting('enabled', false);
      await manager.incrementStat('suggestionsShown', 5);
      
      const data = await manager.exportAll();
      
      assert.ok(data.settings);
      assert.strictEqual(data.settings.enabled, false);
      assert.ok(data.stats);
      assert.strictEqual((data.stats as any).suggestionsShown, 5);
    });

    it('should import data', async () => {
      const data = {
        settings: {
          enabled: false,
          focusMode: true,
          quietHours: { enabled: false, start: '22:00', end: '08:00' },
          interruptionThreshold: 0.5,
          snoozeDuration: 60,
          piecesOs: { enabled: true, host: 'localhost', port: 5323 },
          logging: { level: 'debug' },
          activityTracking: { enabled: true, sampleInterval: 5000 }
        },
        stats: {
          totalTime: 1000000,
          flowStateTime: { idle: 0, working: 1000000, deep_flow: 0, stuck: 0, frustrated: 0 },
          filesWorked: 10,
          suggestionsShown: 20,
          suggestionsAccepted: 15,
          topErrors: [],
          sessionStart: new Date()
        }
      };
      
      const result = await manager.importAll(data);
      
      assert.strictEqual(result.success, true);
      
      const settings = await manager.getSettings();
      const stats = await manager.getStats();
      
      assert.strictEqual(settings.enabled, false);
      assert.strictEqual(settings.interruptionThreshold, 0.5);
      assert.strictEqual(stats.totalTime, 1000000);
      assert.strictEqual(stats.filesWorked, 10);
    });

    it('should handle import errors', async () => {
      const result = await manager.importAll(null as any);
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error);
      }
    });
  });

  describe('Memory Cache', () => {
    it('should cache values in memory', async () => {
      await manager.set('sessionCount', 42);
      
      await manager.get('sessionCount');
      
      const cached = (manager as any).memoryCache.get('sessionCount');
      assert.strictEqual(cached, 42);
    });

    it('should update cache on set', async () => {
      await manager.set('sessionCount', 10);
      await manager.set('sessionCount', 20);
      
      const cached = (manager as any).memoryCache.get('sessionCount');
      assert.strictEqual(cached, 20);
    });

    it('should clear cache on delete', async () => {
      await manager.set('sessionCount', 10);
      await manager.delete('sessionCount');
      
      const cached = (manager as any).memoryCache.get('sessionCount');
      assert.strictEqual(cached, undefined);
    });

    it('should clear all cache on clear', async () => {
      await manager.set('sessionCount', 10);
      await manager.set('settings', {} as any);
      
      await manager.clear();
      
      assert.strictEqual((manager as any).memoryCache.size, 0);
    });
  });

  describe('Disposal', () => {
    it('should dispose without errors', () => {
      assert.doesNotThrow(() => {
        manager.dispose();
      });
    });

    it('should clear listeners on dispose', () => {
      manager.onChange('settings', () => {});
      
      manager.dispose();
      
      assert.strictEqual((manager as any).changeListeners.size, 0);
    });

    it('should clear cache on dispose', async () => {
      await manager.set('sessionCount', 10);
      
      manager.dispose();
      
      assert.strictEqual((manager as any).memoryCache.size, 0);
    });
  });
});
