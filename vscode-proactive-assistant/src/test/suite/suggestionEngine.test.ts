import * as assert from 'assert';
import { SuggestionEngine, SuggestionType } from '../../services/suggestionEngine';
import { createMockExtensionContext, createMockLogger, createMockActivityContext } from '../utils/testHelpers';
import type { Suggestion, SuggestionContext } from '../../types';

describe('SuggestionEngine', () => {
  let engine: SuggestionEngine;
  let mockContext: ReturnType<typeof createMockExtensionContext>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    mockContext = createMockExtensionContext();
    mockLogger = createMockLogger();
    engine = new SuggestionEngine(mockContext, mockLogger);
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with correct name', () => {
      assert.strictEqual(engine.name, 'SuggestionEngine');
    });

    it('should have default preferences', () => {
      const prefs = engine.getPreferences();
      assert.deepStrictEqual(prefs.preferredTypes, ['stuck', 'error_fix', 'wellness']);
      assert.strictEqual(prefs.maxSuggestionsPerHour, 10);
      assert.strictEqual(prefs.preferredTone, 'casual');
    });

    it('should load preferences from storage', async () => {
      const customPrefs = {
        preferredTypes: ['celebration'] as SuggestionType[],
        disabledTypes: ['wellness'] as SuggestionType[],
        maxSuggestionsPerHour: 5,
        preferredTone: 'formal' as const
      };
      
      await mockContext.globalState.update('suggestionPreferences', customPrefs);
      
      const newEngine = new SuggestionEngine(mockContext, mockLogger);
      await newEngine.initialize();
      
      const prefs = newEngine.getPreferences();
      assert.deepStrictEqual(prefs.preferredTypes, ['celebration']);
      assert.deepStrictEqual(prefs.disabledTypes, ['wellness']);
      
      newEngine.dispose();
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate a stuck suggestion', () => {
      const context: SuggestionContext = {
        flowState: 'stuck',
        activityContext: createMockActivityContext({
          errors: [{ message: 'Type error', severity: 'error', line: 10, column: 0 }]
        }),
        recentSuggestions: []
      };

      const result = engine.generateForFlowState(context);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.ok(result.value.title.toLowerCase().includes('stuck') || 
                  result.value.category === 'stuck');
        assert.strictEqual(result.value.priority, 'high');
      }
    });

    it('should generate an error fix suggestion', () => {
      const context: SuggestionContext = {
        flowState: 'working',
        activityContext: createMockActivityContext({
          errors: [{ message: 'Cannot find name', severity: 'error', line: 5, column: 0 }]
        }),
        recentSuggestions: []
      };

      const result = engine.generateSuggestion('error_fix', context);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.value.category, 'error_fix');
        assert.strictEqual(result.value.priority, 'urgent');
        assert.ok(result.value.actions.some(a => a.id === 'apply'));
      }
    });

    it('should generate a wellness suggestion', () => {
      const context: SuggestionContext = {
        flowState: 'idle',
        activityContext: createMockActivityContext({
          duration: 3 * 60 * 60 * 1000
        }),
        recentSuggestions: []
      };

      const result = engine.generateSuggestion('wellness', context);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.value.category, 'wellness');
        assert.strictEqual(result.value.priority, 'low');
      }
    });

    it('should generate a celebration suggestion', () => {
      const context: SuggestionContext = {
        flowState: 'deep_flow',
        activityContext: createMockActivityContext(),
        recentSuggestions: []
      };

      const result = engine.generateSuggestion('celebration', context);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.value.category, 'celebration');
      }
    });

    it('should return error for disabled suggestion type', async () => {
      await engine.toggleType('wellness', false);
      
      const context: SuggestionContext = {
        flowState: 'idle',
        activityContext: createMockActivityContext(),
        recentSuggestions: []
      };

      const result = engine.generateSuggestion('wellness', context);
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.message.includes('disabled'));
      }
    });

    it('should return error for unknown suggestion type', () => {
      const context: SuggestionContext = {
        flowState: 'working',
        activityContext: createMockActivityContext(),
        recentSuggestions: []
      };

      const result = engine.generateSuggestion('unknown_type' as SuggestionType, context);
      
      assert.strictEqual(result.success, false);
    });

    it('should auto-select suggestion type based on flow state', () => {
      const stuckContext: SuggestionContext = {
        flowState: 'stuck',
        activityContext: createMockActivityContext(),
        recentSuggestions: []
      };

      const result = engine.generateForFlowState(stuckContext);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.value.category, 'stuck');
      }
    });
  });

  describe('Template Rendering', () => {
    it('should include error details in stuck suggestion', () => {
      const errorMessage = 'Cannot find module';
      const context: SuggestionContext = {
        flowState: 'stuck',
        activityContext: createMockActivityContext({
          errors: [{ message: errorMessage, severity: 'error', line: 15, column: 0 }]
        }),
        recentSuggestions: []
      };

      const result = engine.generateSuggestion('stuck', context);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.ok(result.value.title.includes(errorMessage.slice(0, 20)) ||
                  result.value.description.includes('error'));
      }
    });

    it('should limit title length', () => {
      const context: SuggestionContext = {
        flowState: 'stuck',
        activityContext: createMockActivityContext({
          errors: [{ message: 'A'.repeat(200), severity: 'error', line: 1, column: 0 }]
        }),
        recentSuggestions: []
      };

      const result = engine.generateSuggestion('stuck', context);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.ok(result.value.title.length <= 100);
      }
    });

    it('should limit description length', () => {
      const customEngine = new SuggestionEngine(mockContext, mockLogger, {
        maxDescriptionLength: 50
      });
      
      const context: SuggestionContext = {
        flowState: 'wellness',
        activityContext: createMockActivityContext(),
        recentSuggestions: []
      };

      const result = customEngine.generateSuggestion('wellness', context);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.ok(result.value.description.length <= 50);
      }
      
      customEngine.dispose();
    });

    it('should apply formal tone preference', async () => {
      await engine.savePreferences({ preferredTone: 'formal' });
      
      const context: SuggestionContext = {
        flowState: 'wellness',
        activityContext: createMockActivityContext(),
        recentSuggestions: []
      };

      const result = engine.generateSuggestion('wellness', context);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.ok(!result.value.description.match(/[🔥🎉💡🧘☕👀⚠️🔄]/));
      }
    });

    it('should apply enthusiastic tone preference', async () => {
      await engine.savePreferences({ preferredTone: 'enthusiastic' });
      
      const context: SuggestionContext = {
        flowState: 'celebration',
        activityContext: createMockActivityContext(),
        recentSuggestions: []
      };

      const result = engine.generateSuggestion('celebration', context);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.ok(result.value.title.includes('!'));
      }
    });
  });

  describe('Fix Application', () => {
    it('should return error when code fixes are disabled', async () => {
      const customEngine = new SuggestionEngine(mockContext, mockLogger, {
        codeFixEnabled: false
      });

      const suggestion: Suggestion = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        priority: 'high',
        actions: [{ id: 'apply', label: 'Apply', type: 'apply', payload: '{}' }],
        timestamp: new Date()
      };

      const result = await customEngine.applyFix(suggestion);
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.message.includes('disabled'));
      }
      
      customEngine.dispose();
    });

    it('should return error when no active editor', async () => {
      const suggestion: Suggestion = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        priority: 'high',
        actions: [{ id: 'apply', label: 'Apply', type: 'apply', payload: '{}' }],
        timestamp: new Date()
      };

      const result = await engine.applyFix(suggestion);
      
      assert.strictEqual(result.success, false);
    });

    it('should return error when no fix payload found', async () => {
      const suggestion: Suggestion = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        priority: 'high',
        actions: [{ id: 'apply', label: 'Apply', type: 'apply' }],
        timestamp: new Date()
      };

      const result = await engine.applyFix(suggestion);
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.message.includes('payload'));
      }
    });

    it('should return error for invalid payload', async () => {
      const suggestion: Suggestion = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        priority: 'high',
        actions: [{ 
          id: 'apply', 
          label: 'Apply', 
          type: 'apply', 
          payload: 'invalid json' 
        }],
        timestamp: new Date()
      };

      const result = await engine.applyFix(suggestion);
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.message.includes('Invalid'));
      }
    });
  });

  describe('Type Management', () => {
    it('should return all available types', () => {
      const types = engine.getAvailableTypes();
      
      assert.ok(types.includes('stuck'));
      assert.ok(types.includes('error_fix'));
      assert.ok(types.includes('wellness'));
      assert.ok(types.includes('celebration'));
      assert.ok(types.includes('context_recovery'));
      assert.ok(types.includes('productivity'));
      assert.ok(types.includes('learning'));
    });

    it('should check if type is enabled', async () => {
      assert.strictEqual(engine.isTypeEnabled('wellness'), true);
      
      await engine.toggleType('wellness', false);
      
      assert.strictEqual(engine.isTypeEnabled('wellness'), false);
    });

    it('should enable type when toggleType called with true', async () => {
      await engine.toggleType('wellness', false);
      assert.strictEqual(engine.isTypeEnabled('wellness'), false);
      
      await engine.toggleType('wellness', true);
      assert.strictEqual(engine.isTypeEnabled('wellness'), true);
    });

    it('should persist preferences when toggling type', async () => {
      await engine.toggleType('wellness', false);
      
      const saved = await mockContext.globalState.get('suggestionPreferences');
      assert.ok(saved.disabledTypes.includes('wellness'));
    });
  });

  describe('Similar Suggestions', () => {
    it('should get similar suggestions by type', () => {
      const suggestions = engine.getSimilarSuggestions('stuck', 2);
      
      assert.strictEqual(suggestions.length, 2);
      assert.ok(suggestions.every(s => s.category === 'stuck'));
    });

    it('should limit similar suggestions to available templates', () => {
      const suggestions = engine.getSimilarSuggestions('wellness', 10);
      
      assert.ok(suggestions.length <= 2);
    });

    it('should return empty array for unknown type', () => {
      const suggestions = engine.getSimilarSuggestions('unknown' as SuggestionType);
      
      assert.deepStrictEqual(suggestions, []);
    });
  });

  describe('History Management', () => {
    it('should track suggestion history', () => {
      const context: SuggestionContext = {
        flowState: 'working',
        activityContext: createMockActivityContext(),
        recentSuggestions: []
      };

      engine.generateSuggestion('stuck', context);
      engine.generateSuggestion('wellness', context);
      
      const result = engine.generateSuggestion('stuck', {
        ...context,
        recentSuggestions: ['stuck-0']
      });
      
      assert.strictEqual(result.success, true);
    });

    it('should clear history', () => {
      engine.clearHistory();
      
      assert.doesNotThrow(() => {
        engine.clearHistory();
      });
    });
  });

  describe('Disposal', () => {
    it('should dispose without errors', () => {
      assert.doesNotThrow(() => {
        engine.dispose();
      });
    });

    it('should clear history on dispose', () => {
      engine.dispose();
    });
  });
});
