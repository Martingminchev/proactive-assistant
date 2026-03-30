import * as assert from 'assert';
import { InterruptionManager, InterruptionDecision } from '../../services/interruptionManager';
import { createMockExtensionContext, createMockLogger, createMockActivityContext } from '../utils/testHelpers';
import type { ActivityContext } from '../../types';

describe('InterruptionManager', () => {
  let manager: InterruptionManager;
  let mockContext: ReturnType<typeof createMockExtensionContext>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockContext = createMockExtensionContext();
    mockLogger = createMockLogger();
    manager = new InterruptionManager(mockContext, mockLogger);
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('30-Minute Rule', () => {
    it('should allow interruption after 30 minutes', () => {
      (manager as any).lastInterruptionTime = Date.now() - 31 * 60 * 1000;
      
      const context = createMockActivityContext();
      const decision = manager.shouldInterrupt(context, 'working');
      
      assert.strictEqual(decision.shouldInterrupt, true);
    });

    it('should block interruption within 30 minutes', () => {
      (manager as any).lastInterruptionTime = Date.now() - 5 * 60 * 1000;
      
      const context = createMockActivityContext();
      const decision = manager.shouldInterrupt(context, 'working');
      
      assert.strictEqual(decision.shouldInterrupt, false);
      assert.ok(decision.reason.includes('Minimum interruption interval'));
      assert.ok(decision.waitTimeMs !== undefined);
      assert.ok(decision.waitTimeMs! > 0);
    });

    it('should report time until next interruption correctly', () => {
      const lastInterruption = Date.now() - 10 * 60 * 1000;
      (manager as any).lastInterruptionTime = lastInterruption;
      
      const waitTime = manager.getTimeUntilNextInterruption();
      
      assert.ok(waitTime >= 19 * 60 * 1000 && waitTime <= 21 * 60 * 1000,
        `Expected ~20 minutes, got ${waitTime}ms`);
    });

    it('should record interruption timestamp', async () => {
      const beforeTime = Date.now();
      
      await manager.recordInterruption('test-suggestion');
      
      const afterTime = Date.now();
      const lastTime = (manager as any).lastInterruptionTime;
      
      assert.ok(lastTime >= beforeTime && lastTime <= afterTime);
    });
  });

  describe('3-Strike Dismissal Rule', () => {
    it('should add suggestion to blacklist after 3 dismissals', async () => {
      const suggestionId = 'test-suggestion';
      
      await manager.recordDismissal(suggestionId);
      await manager.recordDismissal(suggestionId);
      await manager.recordDismissal(suggestionId);
      
      assert.strictEqual(manager.isBlacklisted(suggestionId), true);
    });

    it('should block blacklisted suggestions', async () => {
      const suggestionId = 'blacklisted-suggestion';
      (manager as any).blacklist.add(suggestionId);
      
      const context = createMockActivityContext();
      const decision = manager.shouldInterrupt(context, 'working', suggestionId);
      
      assert.strictEqual(decision.shouldInterrupt, false);
      assert.ok(decision.reason.includes('blacklisted'));
    });

    it('should not blacklist after 2 dismissals', async () => {
      const suggestionId = 'almost-blacklisted';
      
      await manager.recordDismissal(suggestionId);
      await manager.recordDismissal(suggestionId);
      
      assert.strictEqual(manager.isBlacklisted(suggestionId), false);
    });

    it('should clear blacklist for specific suggestion', async () => {
      const suggestionId = 'clear-me';
      (manager as any).blacklist.add(suggestionId);
      (manager as any).dismissalHistory.set(suggestionId, [Date.now()]);
      
      await manager.clearBlacklist(suggestionId);
      
      assert.strictEqual(manager.isBlacklisted(suggestionId), false);
      assert.strictEqual((manager as any).dismissalHistory.has(suggestionId), false);
    });

    it('should clear entire blacklist when no suggestion specified', async () => {
      (manager as any).blacklist.add('suggestion-1');
      (manager as any).blacklist.add('suggestion-2');
      (manager as any).dismissalHistory.set('suggestion-1', [Date.now()]);
      (manager as any).dismissalHistory.set('suggestion-2', [Date.now()]);
      
      await manager.clearBlacklist();
      
      assert.strictEqual((manager as any).blacklist.size, 0);
      assert.strictEqual((manager as any).dismissalHistory.size, 0);
    });

    it('should remove old dismissals older than 30 days', async () => {
      const suggestionId = 'old-dismissals';
      const now = Date.now();
      const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;
      
      (manager as any).dismissalHistory.set(suggestionId, [
        thirtyOneDaysAgo,
        thirtyOneDaysAgo + 1000,
        now
      ]);
      
      await manager.recordDismissal(suggestionId);
      
      const dismissals = (manager as any).dismissalHistory.get(suggestionId);
      assert.strictEqual(dismissals.length, 1);
    });

    it('should clear dismissals on acceptance', async () => {
      const suggestionId = 'accepted-suggestion';
      (manager as any).dismissalHistory.set(suggestionId, [Date.now(), Date.now()]);
      
      await manager.recordAcceptance(suggestionId);
      
      assert.strictEqual((manager as any).dismissalHistory.has(suggestionId), false);
    });
  });

  describe('Focus Mode Blocking', () => {
    it('should block interruptions when focus mode is active', async () => {
      await manager.enableFocusMode(60);
      
      const context = createMockActivityContext();
      const decision = manager.shouldInterrupt(context, 'working');
      
      assert.strictEqual(decision.shouldInterrupt, false);
      assert.ok(decision.reason.includes('Focus mode'));
    });

    it('should allow interruptions after focus mode expires', async () => {
      await manager.enableFocusMode(1);
      
      (manager as any).focusModeEnd = Date.now() - 1000;
      
      const context = createMockActivityContext();
      const decision = manager.shouldInterrupt(context, 'working');
      
      assert.strictEqual(decision.shouldInterrupt, true);
    });

    it('should report focus mode status correctly', async () => {
      assert.strictEqual(manager.isFocusModeActive(), false);
      
      await manager.enableFocusMode(30);
      
      assert.strictEqual(manager.isFocusModeActive(), true);
    });

    it('should report remaining focus mode time', async () => {
      await manager.enableFocusMode(30);
      
      const remaining = manager.getFocusModeRemainingMinutes();
      
      assert.ok(remaining >= 29 && remaining <= 30);
    });

    it('should return 0 remaining when focus mode inactive', () => {
      assert.strictEqual(manager.getFocusModeRemainingMinutes(), 0);
    });

    it('should disable focus mode on request', async () => {
      await manager.enableFocusMode(60);
      assert.strictEqual(manager.isFocusModeActive(), true);
      
      await manager.disableFocusMode();
      assert.strictEqual(manager.isFocusModeActive(), false);
    });

    it('should use default duration when not specified', async () => {
      const defaultDuration = (manager as any).config.focusModeDurationMs;
      
      await manager.enableFocusMode();
      
      const endTime = (manager as any).focusModeEnd;
      const expectedEnd = Date.now() + defaultDuration;
      
      assert.ok(endTime >= expectedEnd - 1000 && endTime <= expectedEnd + 1000);
    });
  });

  describe('Quiet Hours', () => {
    it('should block interruptions during quiet hours', () => {
      const originalMethod = (manager as any).isInQuietHours;
      (manager as any).isInQuietHours = () => true;
      
      const context = createMockActivityContext();
      const decision = manager.shouldInterrupt(context, 'working');
      
      (manager as any).isInQuietHours = originalMethod;
      
      assert.strictEqual(decision.shouldInterrupt, false);
      assert.ok(decision.reason.includes('quiet hours'));
    });

    it('should allow interruptions outside quiet hours', () => {
      const context = createMockActivityContext();
      const decision = manager.shouldInterrupt(context, 'working');
      
      assert.strictEqual(decision.shouldInterrupt, true);
    });
  });

  describe('Flow State Respect', () => {
    it('should respect deep flow by blocking non-urgent interruptions', () => {
      const context = createMockActivityContext();
      const decision = manager.shouldInterrupt(context, 'deep_flow');
      
      assert.strictEqual(decision.shouldInterrupt, false);
      assert.ok(decision.reason.includes('deep flow'));
    });

    it('should allow urgent interruptions even in deep flow', () => {
      const customManager = new InterruptionManager(mockContext, mockLogger, {
        respectDeepFlow: false
      });
      
      const context = createMockActivityContext();
      const decision = customManager.shouldInterrupt(context, 'deep_flow');
      
      assert.strictEqual(decision.shouldInterrupt, true);
      
      customManager.dispose();
    });

    it('should calculate appropriate interruption level for idle', () => {
      const context = createMockActivityContext();
      const level = manager.calculateInterruptionLevel('idle', context);
      
      assert.strictEqual(level, 3);
    });

    it('should calculate appropriate interruption level for stuck', () => {
      const context = createMockActivityContext();
      const level = manager.calculateInterruptionLevel('stuck', context);
      
      assert.strictEqual(level, 4);
    });

    it('should calculate appropriate interruption level for frustrated', () => {
      const context = createMockActivityContext();
      const level = manager.calculateInterruptionLevel('frustrated', context);
      
      assert.strictEqual(level, 4);
    });

    it('should increase level for critical errors', () => {
      const context = createMockActivityContext({
        errors: [{ message: 'SyntaxError: Unexpected token', severity: 'error', line: 10, column: 0 }]
      });
      const level = manager.calculateInterruptionLevel('working', context);
      
      assert.strictEqual(level, 3);
    });
  });

  describe('Statistics', () => {
    it('should track total suggestions shown', async () => {
      await manager.recordInterruption('suggestion-1');
      await manager.recordInterruption('suggestion-2');
      
      const stats = manager.getStats();
      assert.strictEqual(stats.totalSuggestions, 2);
    });

    it('should track total dismissals', async () => {
      await manager.recordDismissal('suggestion-1');
      await manager.recordDismissal('suggestion-1');
      await manager.recordDismissal('suggestion-2');
      
      const stats = manager.getStats();
      assert.strictEqual(stats.totalDismissals, 3);
    });

    it('should track total acceptances', async () => {
      await manager.recordAcceptance('suggestion-1');
      await manager.recordAcceptance('suggestion-2');
      
      const stats = manager.getStats();
      assert.strictEqual(stats.totalAcceptances, 2);
    });

    it('should include blacklisted suggestions in stats', async () => {
      (manager as any).blacklist.add('blocked-1');
      (manager as any).blacklist.add('blocked-2');
      
      const stats = manager.getStats();
      assert.deepStrictEqual(stats.blacklistedSuggestions, ['blocked-1', 'blocked-2']);
    });

    it('should report current focus mode end in stats', async () => {
      await manager.enableFocusMode(30);
      
      const stats = manager.getStats();
      
      assert.ok(stats.currentFocusModeEnd !== null);
      assert.ok(stats.currentFocusModeEnd! > Date.now());
    });

    it('should report last interruption time in stats', async () => {
      const before = Date.now();
      await manager.recordInterruption('test');
      const after = Date.now();
      
      const stats = manager.getStats();
      
      assert.ok(stats.lastInterruptionTime !== null);
      assert.ok(stats.lastInterruptionTime! >= before);
      assert.ok(stats.lastInterruptionTime! <= after);
    });
  });

  describe('Events', () => {
    it('should emit interruption decision events', (done) => {
      manager.onInterruptionDecision((decision: InterruptionDecision) => {
        assert.ok(decision);
        done();
      });

      const context = createMockActivityContext();
      manager.shouldInterrupt(context, 'working');
    });

    it('should emit stats updated events', (done) => {
      manager.onStatsUpdated((stats) => {
        assert.ok(stats);
        done();
      });

      manager.recordDismissal('test-suggestion');
    });
  });

  describe('Disposal', () => {
    it('should dispose without errors', () => {
      assert.doesNotThrow(() => {
        manager.dispose();
      });
    });
  });
});
