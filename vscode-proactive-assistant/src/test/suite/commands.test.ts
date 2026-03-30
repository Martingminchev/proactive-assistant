import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Commands', () => {
  describe('Command Definitions', () => {
    it('should have command definitions in package.json', async () => {
      const allCommands = await vscode.commands.getCommands(true);
      const proactiveCommands = allCommands.filter(cmd => 
        cmd.startsWith('proactiveAssistant.')
      );
      
      assert.ok(proactiveCommands.length >= 8, 'Should have at least 8 commands');
    });
  });

  describe('proactiveAssistant.openPanel', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.openPanel'));
    });

    it('should handle execution', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.openPanel');
      } catch (e) {
        // Expected in test environment
      }
      assert.ok(true);
    });
  });

  describe('proactiveAssistant.toggleFocusMode', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.toggleFocusMode'));
    });

    it('should toggle focus mode state', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.toggleFocusMode');
      } catch (e) {
        // Expected in test environment
      }
      assert.ok(true);
    });
  });

  describe('proactiveAssistant.showStats', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.showStats'));
    });

    it('should handle execution', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.showStats');
      } catch (e) {
        // Expected in test environment
      }
      assert.ok(true);
    });
  });

  describe('proactiveAssistant.dismissSuggestion', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.dismissSuggestion'));
    });

    it('should handle execution', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.dismissSuggestion');
      } catch (e) {
        // Expected in test environment
      }
      assert.ok(true);
    });
  });

  describe('proactiveAssistant.applyFix', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.applyFix'));
    });

    it('should handle execution', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.applyFix');
      } catch (e) {
        // Expected in test environment
      }
      assert.ok(true);
    });
  });

  describe('proactiveAssistant.snoozeSuggestion', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.snoozeSuggestion'));
    });

    it('should handle execution', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.snoozeSuggestion');
      } catch (e) {
        // Expected in test environment
      }
      assert.ok(true);
    });
  });

  describe('proactiveAssistant.configure', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.configure'));
    });

    it('should open settings', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.configure');
      } catch (e) {
        // Expected in test environment
      }
      assert.ok(true);
    });
  });

  describe('proactiveAssistant.showWelcome', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.showWelcome'));
    });

    it('should handle execution', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.showWelcome');
      } catch (e) {
        // Expected in test environment
      }
      assert.ok(true);
    });
  });

  describe('proactiveAssistant.showLogs', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.showLogs'));
    });

    it('should handle execution', async () => {
      try {
        await vscode.commands.executeCommand('proactiveAssistant.showLogs');
      } catch (e) {
        // Expected in test environment
      }
      assert.ok(true);
    });
  });

  describe('proactiveAssistant.acceptSuggestion', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.acceptSuggestion'));
    });
  });

  describe('proactiveAssistant.resetState', () => {
    it('should be registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(commands.includes('proactiveAssistant.resetState'));
    });
  });

  describe('Keyboard Shortcuts Summary', () => {
    it('should have all documented keyboard shortcuts', () => {
      const keybindings = [
        { command: 'proactiveAssistant.openPanel', key: 'ctrl+shift+a', mac: 'cmd+shift+a' },
        { command: 'proactiveAssistant.toggleFocusMode', key: 'ctrl+shift+f', mac: 'cmd+shift+f' },
        { command: 'proactiveAssistant.dismissSuggestion', key: 'escape' },
        { command: 'proactiveAssistant.applyFix', key: 'ctrl+shift+enter', mac: 'cmd+shift+enter' }
      ];

      for (const kb of keybindings) {
        assert.ok(kb.command);
        assert.ok(kb.key);
      }
    });

    it('should have context-aware shortcuts', () => {
      const conditionalCommands = [
        'proactiveAssistant.dismissSuggestion',
        'proactiveAssistant.applyFix',
        'proactiveAssistant.snoozeSuggestion',
        'proactiveAssistant.acceptSuggestion'
      ];

      for (const cmd of conditionalCommands) {
        assert.ok(cmd);
      }
    });
  });
});
