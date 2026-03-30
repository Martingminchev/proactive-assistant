import * as assert from 'assert';
import { ActivityMonitor } from '../../services/activityMonitor';
import { createMockExtensionContext, createMockLogger, createMockActivityContext } from '../utils/testHelpers';
import type { FlowState, ActivityContext } from '../../types';

describe('ActivityMonitor', () => {
  let monitor: ActivityMonitor;
  let mockContext: ReturnType<typeof createMockExtensionContext>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockContext = createMockExtensionContext();
    mockLogger = createMockLogger();
    monitor = new ActivityMonitor(mockContext, mockLogger);
  });

  afterEach(() => {
    monitor.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with correct name', () => {
      assert.strictEqual(monitor.name, 'ActivityMonitor');
    });

    it('should start in idle state', () => {
      assert.strictEqual(monitor.currentFlowState, 'idle');
    });

    it('should have empty context initially', () => {
      const context = monitor.getCurrentContext();
      assert.strictEqual(context.errors?.length, 0);
      assert.strictEqual(context.warnings?.length, 0);
      assert.ok(context.capturedAt instanceof Date);
    });

    it('should apply custom configuration', () => {
      const customMonitor = new ActivityMonitor(mockContext, mockLogger, {
        idleThresholdMs: 10000,
        minTypingVelocity: 100
      });
      
      const config = (customMonitor as any).config;
      assert.strictEqual(config.idleThresholdMs, 10000);
      assert.strictEqual(config.minTypingVelocity, 100);
      
      customMonitor.dispose();
    });
  });

  describe('Typing Velocity Calculation', () => {
    it('should calculate zero velocity initially', () => {
      assert.strictEqual(monitor.getTypingVelocity(), 0);
    });

    it('should calculate typing velocity correctly', () => {
      const typingMetrics = (monitor as any).typingMetrics;
      typingMetrics.characterCount = 60;
      typingMetrics.startTime = Date.now() - 60000;
      
      (monitor as any).sampleActivity();
      
      const velocity = monitor.getTypingVelocity();
      assert.ok(velocity >= 55 && velocity <= 65, `Expected ~60, got ${velocity}`);
    });

    it('should reset typing metrics after idle period', async () => {
      const typingMetrics = (monitor as any).typingMetrics;
      typingMetrics.characterCount = 100;
      typingMetrics.backspaceCount = 10;
      typingMetrics.startTime = Date.now() - 30000;
      typingMetrics.lastActivityTime = Date.now() - 70000;
      
      (monitor as any).sampleActivity();
      
      assert.strictEqual(typingMetrics.characterCount, 0);
      assert.strictEqual(typingMetrics.backspaceCount, 0);
    });

    it('should track backspace count for frustration detection', () => {
      const typingMetrics = (monitor as any).typingMetrics;
      
      typingMetrics.backspaceCount = 30;
      typingMetrics.characterCount = 70;
      
      const total = typingMetrics.characterCount + typingMetrics.backspaceCount;
      const backspaceRatio = typingMetrics.backspaceCount / total;
      
      assert.strictEqual(backspaceRatio, 0.3);
    });
  });

  describe('Flow State Detection', () => {
    it('should detect idle state after no activity', () => {
      (monitor as any).typingMetrics.lastActivityTime = Date.now() - 6 * 60 * 1000;
      
      const newState = (monitor as any).calculateFlowState();
      
      assert.strictEqual(newState, 'idle');
    });

    it('should detect working state during normal activity', () => {
      (monitor as any).typingMetrics.lastActivityTime = Date.now() - 1000;
      (monitor as any).lastTypingVelocity = 30;
      (monitor as any).currentContext.errors = [];
      
      const newState = (monitor as any).calculateFlowState();
      
      assert.strictEqual(newState, 'working');
    });

    it('should detect deep_flow state with sustained typing', () => {
      const now = Date.now();
      
      (monitor as any).typingMetrics.lastActivityTime = now;
      (monitor as any).lastTypingVelocity = 100;
      (monitor as any).currentContext.errors = [];
      (monitor as any).stateChangeTime = now - 6 * 60 * 1000;
      
      const newState = (monitor as any).calculateFlowState();
      
      assert.strictEqual(newState, 'deep_flow');
    });

    it('should detect stuck state with persistent errors', () => {
      const now = Date.now();
      
      (monitor as any).errorTracking.set('file.ts:10:error', {
        diagnostics: new Map(),
        firstSeen: now - 25 * 60 * 1000,
        count: 5
      });
      
      (monitor as any).typingMetrics.lastActivityTime = now;
      
      const newState = (monitor as any).calculateFlowState();
      
      assert.strictEqual(newState, 'stuck');
    });

    it('should detect frustrated state with high backspace ratio', () => {
      (monitor as any).typingMetrics.characterCount = 10;
      (monitor as any).typingMetrics.backspaceCount = 10;
      
      const newState = (monitor as any).calculateFlowState();
      
      assert.strictEqual(newState, 'frustrated');
    });

    it('should emit flow state change events', (done) => {
      monitor.onFlowStateChanged((newState: FlowState) => {
        assert.strictEqual(newState, 'working');
        done();
      });

      (monitor as any).typingMetrics.lastActivityTime = Date.now();
      (monitor as any).updateFlowState();
    });

    it('should not change state if conditions remain the same', () => {
      let eventCount = 0;
      monitor.onFlowStateChanged(() => {
        eventCount++;
      });

      (monitor as any).updateFlowState();
      (monitor as any).updateFlowState();
      
      assert.strictEqual(eventCount, 1);
    });
  });

  describe('Error Persistence Tracking', () => {
    it('should track errors by file and line', () => {
      const now = Date.now();
      const errorKey = '/test/file.ts:10:Type error';
      
      (monitor as any).errorTracking.set(errorKey, {
        diagnostics: new Map([['/test/file.ts', {
          message: 'Type error',
          line: 10,
          column: 0,
          severity: 'error'
        }]]),
        firstSeen: now,
        count: 1
      });
      
      const tracking = (monitor as any).errorTracking.get(errorKey);
      assert.ok(tracking);
      assert.strictEqual(tracking.count, 1);
    });

    it('should increment error count on repeated errors', () => {
      const errorKey = '/test/file.ts:10:Type error';
      
      (monitor as any).errorTracking.set(errorKey, {
        diagnostics: new Map(),
        firstSeen: Date.now(),
        count: 1
      });
      
      const tracking = (monitor as any).errorTracking.get(errorKey);
      tracking.count++;
      
      assert.strictEqual(tracking.count, 2);
    });

    it('should clear error tracking when file errors are resolved', () => {
      const filePath = '/test/file.ts';
      
      (monitor as any).errorTracking.set(`${filePath}:10:error`, {
        diagnostics: new Map([[filePath, { message: 'error', line: 10, column: 0, severity: 'error' }]]),
        firstSeen: Date.now(),
        count: 1
      });
      
      (monitor as any).errorTracking.delete(filePath);
      
      assert.strictEqual((monitor as any).errorTracking.has(filePath), false);
    });
  });

  describe('Idle Time Detection', () => {
    it('should return zero idle time during active typing', () => {
      (monitor as any).typingMetrics.lastActivityTime = Date.now();
      
      const idleTime = monitor.getIdleTime();
      
      assert.ok(idleTime < 100);
    });

    it('should calculate idle time correctly', () => {
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
      (monitor as any).typingMetrics.lastActivityTime = twoMinutesAgo;
      
      const idleTime = monitor.getIdleTime();
      
      assert.ok(idleTime >= 119000 && idleTime <= 121000, 
        `Expected ~120000ms, got ${idleTime}`);
    });

    it('should record idle activity event after threshold', () => {
      let idleEvent: any = null;
      
      monitor.onActivityRecorded((event) => {
        if (event.type === 'idle') {
          idleEvent = event;
        }
      });
      
      (monitor as any).typingMetrics.lastActivityTime = Date.now() - 6 * 60 * 1000;
      
      (monitor as any).sampleActivity();
      
      assert.strictEqual(typeof idleEvent, 'object');
    });
  });

  describe('Activity Recording', () => {
    it('should record activity events', (done) => {
      monitor.onActivityRecorded((event) => {
        assert.strictEqual(event.type, 'edit');
        done();
      });

      (monitor as any).recordActivity('edit', { file: 'test.ts' });
    });

    it('should limit activity history to 1000 events', () => {
      for (let i = 0; i < 1005; i++) {
        (monitor as any).activityHistory.push({
          type: 'edit',
          timestamp: new Date(),
          file: 'test.ts'
        });
      }
      
      (monitor as any).recordActivity('edit');
      
      assert.strictEqual((monitor as any).activityHistory.length, 1000);
    });

    it('should get recent events with limit', () => {
      for (let i = 0; i < 10; i++) {
        (monitor as any).activityHistory.push({
          type: 'edit',
          timestamp: new Date(),
          file: `test${i}.ts`
        });
      }
      
      const recent = monitor.getRecentEvents(5);
      
      assert.strictEqual(recent.length, 5);
    });
  });

  describe('Statistics', () => {
    it('should calculate total time from session start', () => {
      const stats = monitor.getStats();
      
      assert.ok(stats.totalTime >= 0);
      assert.ok(stats.sessionStart instanceof Date);
    });

    it('should count unique files worked', () => {
      (monitor as any).activityHistory.push(
        { type: 'file_open', file: '/test/file1.ts', timestamp: new Date() },
        { type: 'file_open', file: '/test/file2.ts', timestamp: new Date() },
        { type: 'edit', file: '/test/file1.ts', timestamp: new Date() }
      );
      
      const stats = monitor.getStats();
      
      assert.strictEqual(stats.filesWorked, 2);
    });

    it('should track top errors', () => {
      (monitor as any).errorTracking.set('key1', {
        diagnostics: new Map([['file.ts', { message: 'Error A', severity: 'error' }]]),
        firstSeen: Date.now(),
        count: 5
      });
      (monitor as any).errorTracking.set('key2', {
        diagnostics: new Map([['file.ts', { message: 'Error B', severity: 'error' }]]),
        firstSeen: Date.now(),
        count: 3
      });
      
      const stats = monitor.getStats();
      
      assert.ok(stats.topErrors.length > 0);
      assert.strictEqual(stats.topErrors[0].message, 'Error A');
    });
  });

  describe('Context Management', () => {
    it('should update context from editor', () => {
      const mockEditor = {
        document: {
          fileName: '/test/file.ts',
          languageId: 'typescript',
          lineCount: 100,
          getText: () => 'const x = 1;'
        },
        selection: {
          active: { line: 10, character: 5 }
        }
      };
      
      (monitor as any).updateContextFromEditor(mockEditor as any);
      
      const context = monitor.getCurrentContext();
      assert.strictEqual(context.file, '/test/file.ts');
      assert.strictEqual(context.language, 'typescript');
      assert.strictEqual(context.line, 10);
    });

    it('should track previous file on switch', () => {
      (monitor as any).currentContext.file = '/test/file1.ts';
      
      (monitor as any).handleActiveEditorChange({
        document: {
          fileName: '/test/file2.ts',
          languageId: 'typescript'
        }
      } as any);
      
      const context = monitor.getCurrentContext();
      assert.strictEqual(context.file, '/test/file2.ts');
      assert.strictEqual(context.previousFile, '/test/file1.ts');
    });

    it('should emit context change events', (done) => {
      monitor.onContextChanged((context: ActivityContext) => {
        assert.ok(context);
        done();
      });

      (monitor as any).handleActiveEditorChange({
        document: { fileName: '/test/file.ts', languageId: 'typescript' }
      } as any);
    });
  });

  describe('Disposal', () => {
    it('should dispose all disposables', () => {
      assert.doesNotThrow(() => {
        monitor.dispose();
      });
    });

    it('should be safe to dispose multiple times', () => {
      assert.doesNotThrow(() => {
        monitor.dispose();
        monitor.dispose();
      });
    });
  });
});
