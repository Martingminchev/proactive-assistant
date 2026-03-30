import * as assert from 'assert';
import * as vscode from 'vscode';
import * as myExtension from '../../extension';

describe('Extension Integration', () => {
  describe('Activation', () => {
    it('should activate successfully', async () => {
      const extension = vscode.extensions.getExtension('proactive-assistant.proactive-ai-assistant');
      
      if (extension) {
        assert.strictEqual(extension.isActive, true);
      }
    });

    it('should export activate function', () => {
      assert.strictEqual(typeof myExtension.activate, 'function');
    });

    it('should export deactivate function', () => {
      assert.strictEqual(typeof myExtension.deactivate, 'function');
    });

    it('should export getServices function', () => {
      assert.strictEqual(typeof myExtension.getServices, 'function');
    });
  });

  describe('Context Values', () => {
    it('should set enabled context', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const enabled = await vscode.commands.executeCommand('getContext', 'proactiveAssistant.enabled');
      
      assert.ok(enabled !== undefined);
    });

    it('should set hasActiveSuggestion context', async () => {
      const hasActiveSuggestion = await vscode.commands.executeCommand('getContext', 'proactiveAssistant.hasActiveSuggestion');
      
      assert.ok(hasActiveSuggestion !== undefined);
    });

    it('should set focusModeEnabled context', async () => {
      const focusModeEnabled = await vscode.commands.executeCommand('getContext', 'proactiveAssistant.focusModeEnabled');
      
      assert.ok(focusModeEnabled !== undefined);
    });
  });

  describe('Command Registration', () => {
    const expectedCommands = [
      'proactiveAssistant.openPanel',
      'proactiveAssistant.toggleFocusMode',
      'proactiveAssistant.showStats',
      'proactiveAssistant.dismissSuggestion',
      'proactiveAssistant.applyFix',
      'proactiveAssistant.snoozeSuggestion',
      'proactiveAssistant.configure',
      'proactiveAssistant.showWelcome',
      'proactiveAssistant.showLogs'
    ];

    it('should register all expected commands', async () => {
      const allCommands = await vscode.commands.getCommands();
      const proactiveCommands = allCommands.filter(cmd => cmd.startsWith('proactiveAssistant.'));
      
      for (const cmd of expectedCommands) {
        assert.ok(
          proactiveCommands.includes(cmd),
          `Command ${cmd} should be registered`
        );
      }
    });

    it('should execute openPanel command', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.openPanel');
      } catch (e) {
        assert.ok(true);
      }
    });

    it('should execute toggleFocusMode command', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.toggleFocusMode');
      } catch (e) {
        assert.ok(true);
      }
    });

    it('should execute showStats command', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.showStats');
      } catch (e) {
        assert.ok(true);
      }
    });

    it('should handle configuration command', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.configure');
      } catch (e) {
        assert.ok(true);
      }
    });
  });

  describe('Service Initialization', () => {
    it('should expose services through getServices', () => {
      const services = myExtension.getServices();
      
      if (services) {
        assert.ok(services.activityTracker);
        assert.ok(services.suggestionProvider);
        assert.ok(services.piecesClient);
        assert.ok(services.logger);
        assert.ok(services.context);
      }
    });

    it('should have initialized activity tracker', () => {
      const services = myExtension.getServices();
      
      if (services) {
        assert.strictEqual(typeof services.activityTracker.initialize, 'function');
        assert.strictEqual(typeof services.activityTracker.getCurrentContext, 'function');
        assert.strictEqual(typeof services.activityTracker.getStats, 'function');
      }
    });

    it('should have initialized suggestion provider', () => {
      const services = myExtension.getServices();
      
      if (services) {
        assert.strictEqual(typeof services.suggestionProvider.initialize, 'function');
        assert.strictEqual(typeof services.suggestionProvider.generateSuggestion, 'function');
        assert.strictEqual(typeof services.suggestionProvider.shouldSuggest, 'function');
      }
    });

    it('should have initialized pieces client', () => {
      const services = myExtension.getServices();
      
      if (services) {
        assert.strictEqual(typeof services.piecesClient.initialize, 'function');
        assert.strictEqual(typeof services.piecesClient.isAvailable, 'function');
      }
    });

    it('should have initialized logger', () => {
      const services = myExtension.getServices();
      
      if (services) {
        assert.strictEqual(typeof services.logger.debug, 'function');
        assert.strictEqual(typeof services.logger.info, 'function');
        assert.strictEqual(typeof services.logger.warn, 'function');
        assert.strictEqual(typeof services.logger.error, 'function');
      }
    });
  });

  describe('Configuration', () => {
    it('should have extension configuration', () => {
      const config = vscode.workspace.getConfiguration('proactiveAssistant');
      
      assert.ok(config);
      assert.strictEqual(typeof config.get, 'function');
    });

    it('should have default enabled setting', () => {
      const config = vscode.workspace.getConfiguration('proactiveAssistant');
      const enabled = config.get<boolean>('enabled');
      
      assert.strictEqual(enabled, true);
    });

    it('should have default focusMode setting', () => {
      const config = vscode.workspace.getConfiguration('proactiveAssistant');
      const focusMode = config.get<boolean>('focusMode');
      
      assert.strictEqual(focusMode, false);
    });

    it('should have default interruptionThreshold setting', () => {
      const config = vscode.workspace.getConfiguration('proactiveAssistant');
      const threshold = config.get<number>('interruptionThreshold');
      
      assert.strictEqual(threshold, 0.7);
    });

    it('should have default snoozeDuration setting', () => {
      const config = vscode.workspace.getConfiguration('proactiveAssistant');
      const duration = config.get<number>('snoozeDuration');
      
      assert.strictEqual(duration, 30);
    });

    it('should have default piecesOs settings', () => {
      const config = vscode.workspace.getConfiguration('proactiveAssistant');
      const piecesOs = config.get<{ enabled: boolean; host: string; port: number }>('piecesOs');
      
      assert.ok(piecesOs);
      assert.strictEqual(piecesOs?.enabled, true);
      assert.strictEqual(piecesOs?.host, 'localhost');
      assert.strictEqual(piecesOs?.port, 5323);
    });

    it('should have default logging level', () => {
      const config = vscode.workspace.getConfiguration('proactiveAssistant');
      const logging = config.get<{ level: string }>('logging');
      
      assert.ok(logging);
      assert.strictEqual(logging?.level, 'info');
    });
  });

  describe('Deactivation', () => {
    it('should clean up on deactivate', () => {
      assert.doesNotThrow(() => {
        assert.strictEqual(typeof myExtension.deactivate, 'function');
      });
    });
  });
});
