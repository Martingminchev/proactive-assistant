// =============================================================================
// NEXUS - Action Executor (V2 Framework)
// Framework for executing proactive actions with permission system
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { shell, Notification } from 'electron';
import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  ProactiveSuggestion,
  ActionType,
  ActionPermissionLevel,
  ActionPermission,
  ActionPayload,
  ActionResult,
  ProactiveAction,
  ActionExecutorConfig as SharedActionExecutorConfig,
} from '../../shared/types';

export type { ActionType, ActionPermissionLevel, ActionPermission, ActionPayload, ActionResult, ProactiveAction };

// =============================================================================
// Default Permissions
// =============================================================================

export const DEFAULT_ACTION_PERMISSIONS: ActionPermission[] = [
  // V1: Information actions - auto allowed
  { type: 'suggest', level: 'auto', description: 'Show suggestions to user' },
  { type: 'notify', level: 'auto', description: 'Show notifications' },
  { type: 'ask', level: 'auto', description: 'Ask questions' },
  { type: 'remind', level: 'auto', description: 'Set reminders' },
  
  // V2: Executable actions - require confirmation
  { type: 'open_file', level: 'confirm', description: 'Open files' },
  { type: 'open_url', level: 'confirm', description: 'Open URLs in browser' },
  { type: 'run_command', level: 'confirm', description: 'Run shell commands' },
  { type: 'create_file', level: 'confirm', description: 'Create new files' },
  { type: 'send_message', level: 'confirm', description: 'Send messages' },
  { type: 'create_reminder', level: 'confirm', description: 'Create system reminders' },
  { type: 'take_screenshot', level: 'auto', description: 'Capture screenshots' },
  { type: 'clipboard_copy', level: 'auto', description: 'Copy to clipboard' },
  { type: 'custom', level: 'confirm', description: 'Custom actions' },
];

// =============================================================================
// Action Executor Configuration
// =============================================================================

export type ActionExecutorConfig = SharedActionExecutorConfig;

export const DEFAULT_ACTION_EXECUTOR_CONFIG: ActionExecutorConfig = {
  enabled: true,
  permissions: DEFAULT_ACTION_PERMISSIONS,
  maxPendingActions: 10,
  confirmationTimeoutMs: 30000, // 30 seconds
  enableV2Actions: true, // V2 ACTIONS ENABLED
};

// =============================================================================
// Security: Dangerous Command Patterns
// =============================================================================

const DANGEROUS_COMMAND_PATTERNS = [
  // File deletion patterns
  /rm\s+-rf\s+[\/~]/i,
  /rm\s+-rf\s+\//i,
  /rmdir\s+\/s\s+\/q/i,
  /del\s+\/f\s+\/s\s+\/q/i,
  
  // Disk/format operations
  /format\s+[a-z]:/i,
  /mkfs/i,
  /dd\s+if=/i,
  />\s*\/dev\//i,
  /diskpart/i,
  
  // System shutdown/reboot
  /shutdown/i,
  /reboot/i,
  /init\s+0/i,
  /init\s+6/i,
  /systemctl\s+poweroff/i,
  /systemctl\s+reboot/i,
  
  // Fork bombs and resource exhaustion
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;\s*:/i,  // Bash fork bomb
  /while\s*\(\s*true\s*\)\s*;\s*do/i,       // Infinite loops
  /for\s*\(\s*;;\s*\)/i,                    // Infinite for loops
  
  // Encoded/Obfuscated commands
  /powershell\s+-enc/i,                     // Encoded PowerShell
  /powershell\s+-encodedcommand/i,
  /cmd\s+\/c\s+.*\|.*powershell/i,          // Pipeline to PowerShell
  /iex\s+\(/i,                              // Invoke-Expression
  /invoke-expression/i,
  /frombase64string/i,                      // Base64 decoding
  
  // Remote execution
  /curl\s+.*\|.*sh/i,                       // curl | sh patterns
  /wget\s+.*\|.*sh/i,
  /curl\s+.*\|.*bash/i,
  /wget\s+.*\|.*bash/i,
  
  // Network attacks
  /ping\s+-f/i,                             // Flood ping
  /ping\s+-t\s+255\.255\.255\.255/i,
  
  // Registry manipulation (Windows)
  /reg\s+delete\s+.*\/f/i,
  /reg\s+add\s+.*\/f/i,
  
  // Permission changes
  /chmod\s+777\s+\//i,
  /chmod\s+-r\s+777/i,
  /chown\s+-r\s+root/i,
  
  // Dangerous variables
  /\$path.*\/dev\/null/i,
  />\s*\/etc\/passwd/i,
  />\s*\/etc\/shadow/i,
];

// =============================================================================
// Action Executor Class
// =============================================================================

export class ActionExecutor extends EventEmitter {
  private config: ActionExecutorConfig;
  private pendingActions: Map<string, ProactiveAction> = new Map();
  private actionHistory: ProactiveAction[] = [];
  private confirmationTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<ActionExecutorConfig>) {
    super();
    this.config = { ...DEFAULT_ACTION_EXECUTOR_CONFIG, ...config };
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  updateConfig(config: Partial<ActionExecutorConfig>): void {
    this.config = { ...this.config, ...config };
    log.debug('[ActionExecutor] Config updated:', this.config);
  }

  setPermission(type: ActionType, level: ActionPermissionLevel): void {
    const existing = this.config.permissions.find(p => p.type === type);
    if (existing) {
      existing.level = level;
    }
  }

  getPermission(type: ActionType): ActionPermissionLevel {
    const permission = this.config.permissions.find(p => p.type === type);
    return permission?.level ?? 'confirm'; // Default to confirm if unknown
  }

  // ===========================================================================
  // Action Execution
  // ===========================================================================

  async execute(action: ProactiveAction): Promise<ActionResult> {
    // Check if executor is enabled
    if (!this.config.enabled) {
      return this.createResult(false, 'Action executor is disabled');
    }

    // Check if action type is allowed
    const permission = this.getPermission(action.type);
    if (permission === 'deny') {
      return this.createResult(false, `Action type '${action.type}' is not allowed`);
    }

    // Check if V2 actions are enabled
    if (this.isV2Action(action.type) && !this.config.enableV2Actions) {
      // Convert to suggestion for V1
      return this.convertToSuggestion(action);
    }

    // Check if confirmation is required
    if (permission === 'confirm' || action.requiresConfirmation) {
      return this.requestConfirmation(action);
    }

    // Execute immediately
    return this.executeAction(action);
  }

  private isV2Action(type: ActionType): boolean {
    const v2Actions: ActionType[] = [
      'open_file', 'open_url', 'run_command', 'create_file',
      'send_message', 'create_reminder', 'custom'
    ];
    return v2Actions.includes(type);
  }

  private async executeAction(action: ProactiveAction): Promise<ActionResult> {
    action.status = 'executing';
    this.emit('action-executing', action);

    try {
      let result: ActionResult;

      switch (action.type) {
        case 'suggest':
          result = await this.executeSuggest(action);
          break;
        case 'notify':
          result = await this.executeNotify(action);
          break;
        case 'ask':
          result = await this.executeAsk(action);
          break;
        case 'remind':
          result = await this.executeRemind(action);
          break;
        case 'open_url':
          result = await this.executeOpenUrl(action);
          break;
        case 'open_file':
          result = await this.executeOpenFile(action);
          break;
        case 'clipboard_copy':
          result = await this.executeClipboardCopy(action);
          break;
        case 'take_screenshot':
          result = await this.executeTakeScreenshot(action);
          break;
        // V2 Actions
        case 'run_command':
          result = await this.executeRunCommand(action);
          break;
        case 'create_file':
          result = await this.executeCreateFile(action);
          break;
        case 'create_reminder':
          result = await this.executeCreateReminder(action);
          break;
        // Not yet implemented
        case 'send_message':
        case 'custom':
          result = this.createResult(false, `Action type '${action.type}' is not yet implemented`);
          break;
        default:
          result = this.createResult(false, `Unknown action type: ${action.type}`);
      }

      action.status = result.success ? 'completed' : 'failed';
      action.result = result;
      this.recordAction(action);
      this.emit('action-completed', action);

      return result;
    } catch (error) {
      const result = this.createResult(false, error instanceof Error ? error.message : 'Unknown error');
      action.status = 'failed';
      action.result = result;
      this.recordAction(action);
      this.emit('action-failed', action, error);
      return result;
    }
  }

  // ===========================================================================
  // Action Implementations
  // ===========================================================================

  private async executeSuggest(action: ProactiveAction): Promise<ActionResult> {
    if (action.payload.suggestion) {
      this.emit('suggestion', action.payload.suggestion);
      return this.createResult(true, 'Suggestion emitted');
    }
    return this.createResult(false, 'No suggestion in payload');
  }

  private async executeNotify(action: ProactiveAction): Promise<ActionResult> {
    const { title, message } = action.payload;
    
    if (!message) {
      return this.createResult(false, 'No message in payload');
    }

    try {
      const notification = new Notification({
        title: title || 'NEXUS',
        body: message,
        silent: false,
      });

      notification.show();
      return this.createResult(true, 'Notification shown');
    } catch (error) {
      return this.createResult(false, `Failed to show notification: ${error}`);
    }
  }

  private async executeAsk(action: ProactiveAction): Promise<ActionResult> {
    // Emit an event for the UI to handle
    this.emit('ask', {
      id: action.id,
      question: action.payload.message,
      title: action.payload.title,
    });
    return this.createResult(true, 'Question emitted for UI handling');
  }

  private async executeRemind(action: ProactiveAction): Promise<ActionResult> {
    const { reminderTime, reminderMessage } = action.payload;
    
    if (!reminderTime || !reminderMessage) {
      return this.createResult(false, 'Missing reminder time or message');
    }

    const delay = reminderTime - Date.now();
    if (delay <= 0) {
      return this.createResult(false, 'Reminder time is in the past');
    }

    // Schedule the reminder
    setTimeout(() => {
      const notification = new Notification({
        title: 'NEXUS Reminder',
        body: reminderMessage,
        silent: false,
      });
      notification.show();
      this.emit('reminder-triggered', action);
    }, delay);

    return this.createResult(true, `Reminder scheduled for ${new Date(reminderTime).toLocaleString()}`);
  }

  private async executeOpenUrl(action: ProactiveAction): Promise<ActionResult> {
    const { url } = action.payload;
    
    if (!url) {
      return this.createResult(false, 'No URL in payload');
    }

    // Security: Validate URL
    try {
      const parsedUrl = new URL(url);
      const allowedProtocols = ['http:', 'https:', 'mailto:'];
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        return this.createResult(false, `Protocol '${parsedUrl.protocol}' is not allowed`);
      }
    } catch {
      return this.createResult(false, 'Invalid URL format');
    }

    try {
      await shell.openExternal(url);
      return this.createResult(true, `Opened URL: ${url}`);
    } catch (error) {
      return this.createResult(false, `Failed to open URL: ${error}`);
    }
  }

  private async executeOpenFile(action: ProactiveAction): Promise<ActionResult> {
    const { filePath } = action.payload;
    
    if (!filePath) {
      return this.createResult(false, 'No file path in payload');
    }

    // Security: Resolve and validate path
    const absolutePath = path.resolve(filePath);
    
    // Check for path traversal attempts
    if (absolutePath.includes('..')) {
      return this.createResult(false, 'Path traversal detected');
    }

    try {
      await shell.openPath(absolutePath);
      return this.createResult(true, `Opened file: ${absolutePath}`);
    } catch (error) {
      return this.createResult(false, `Failed to open file: ${error}`);
    }
  }

  private async executeClipboardCopy(action: ProactiveAction): Promise<ActionResult> {
    const { clipboardContent } = action.payload;
    
    if (!clipboardContent) {
      return this.createResult(false, 'No content to copy');
    }

    try {
      const { clipboard } = await import('electron');
      clipboard.writeText(clipboardContent);
      return this.createResult(true, 'Content copied to clipboard');
    } catch (error) {
      return this.createResult(false, `Failed to copy to clipboard: ${error}`);
    }
  }

  private async executeTakeScreenshot(action: ProactiveAction): Promise<ActionResult> {
    // Emit event for main process to handle
    this.emit('take-screenshot', action);
    return this.createResult(true, 'Screenshot request emitted');
  }

  // ===========================================================================
  // V2 Action Implementations
  // ===========================================================================

  private async executeRunCommand(action: ProactiveAction): Promise<ActionResult> {
    const { command, args, workingDirectory } = action.payload;
    
    if (!command) {
      return this.createResult(false, 'No command specified');
    }

    // Security: Block dangerous commands
    const fullCommand = args ? `${command} ${args.join(' ')}` : command;
    
    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(fullCommand)) {
        log.warn('[ActionExecutor] Dangerous command blocked:', fullCommand);
        return this.createResult(false, 'Command blocked for safety reasons');
      }
    }

    // Additional security: Block certain executable names
    const dangerousExecutables = [
      'format.com', 'format.exe', 'diskpart.exe', 'diskpart',
      'regedit.exe', 'regedit', 'reg.exe',
      'cmd.exe', 'cmd', '/bin/sh', '/bin/bash',
      'powershell.exe', 'powershell',
    ];
    
    const commandLower = command.toLowerCase();
    const baseCommand = path.basename(commandLower);
    
    if (dangerousExecutables.includes(baseCommand) || dangerousExecutables.includes(commandLower)) {
      // Allow these if they're just opening the shell (not executing commands)
      // But require explicit confirmation
      log.warn('[ActionExecutor] Shell execution attempted:', command);
    }

    return new Promise((resolve) => {
      const options: { cwd?: string; timeout: number; maxBuffer: number } = {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB output buffer
      };
      
      if (workingDirectory) {
        options.cwd = workingDirectory;
      }

      exec(fullCommand, options, (error, stdout, stderr) => {
        if (error) {
          // Check if it was a timeout
          if (error.killed) {
            resolve(this.createResult(false, 'Command timed out after 30 seconds'));
          } else {
            resolve(this.createResult(false, `Command failed: ${error.message}`, { 
              stdout: stdout?.toString(),
              stderr: stderr?.toString(),
              exitCode: error.code,
            }));
          }
        } else {
          resolve(this.createResult(true, 'Command executed successfully', {
            stdout: stdout?.toString(),
            stderr: stderr?.toString(),
          }));
        }
      });
    });
  }

  private async executeCreateFile(action: ProactiveAction): Promise<ActionResult> {
    const { filePath, fileContent } = action.payload;
    
    if (!filePath) {
      return this.createResult(false, 'No file path specified');
    }

    try {
      // Resolve to absolute path
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
      
      // Security: Check for path traversal
      if (absolutePath.includes('..')) {
        return this.createResult(false, 'Path traversal detected');
      }

      // Check if file already exists
      try {
        await fs.access(absolutePath);
        return this.createResult(false, `File already exists: ${absolutePath}`);
      } catch {
        // File doesn't exist, which is what we want
      }

      // Ensure directory exists
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });

      // Write the file
      await fs.writeFile(absolutePath, fileContent || '', 'utf-8');

      return this.createResult(true, `File created: ${absolutePath}`, { path: absolutePath });
    } catch (error) {
      return this.createResult(false, `Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeCreateReminder(action: ProactiveAction): Promise<ActionResult> {
    const { reminderTime, reminderMessage, title } = action.payload;
    
    if (!reminderTime) {
      return this.createResult(false, 'No reminder time specified');
    }
    
    if (!reminderMessage) {
      return this.createResult(false, 'No reminder message specified');
    }

    const now = Date.now();
    const delay = reminderTime - now;
    
    if (delay <= 0) {
      return this.createResult(false, 'Reminder time must be in the future');
    }

    // Maximum delay of 24 hours for in-memory timers
    const maxDelay = 24 * 60 * 60 * 1000;
    if (delay > maxDelay) {
      return this.createResult(false, 'Reminder cannot be more than 24 hours in the future');
    }

    // Schedule the reminder
    const reminderId = `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setTimeout(() => {
      try {
        const notification = new Notification({
          title: title || 'NEXUS Reminder',
          body: reminderMessage,
          silent: false,
          urgency: 'normal',
        });

        notification.on('click', () => {
          this.emit('reminder-clicked', { id: reminderId, action });
        });

        notification.show();
        this.emit('reminder-triggered', { id: reminderId, action });
      } catch (error) {
        log.error('[ActionExecutor] Failed to show reminder notification:', error);
      }
    }, delay);

    const reminderDate = new Date(reminderTime);
    return this.createResult(true, `Reminder scheduled for ${reminderDate.toLocaleString()}`, {
      reminderId,
      scheduledFor: reminderTime,
    });
  }

  // ===========================================================================
  // Confirmation Handling
  // ===========================================================================

  private async requestConfirmation(action: ProactiveAction): Promise<ActionResult> {
    if (this.pendingActions.size >= this.config.maxPendingActions) {
      return this.createResult(false, 'Too many pending actions');
    }

    action.status = 'awaiting_confirmation';
    this.pendingActions.set(action.id, action);

    // Set timeout for confirmation
    const timeout = setTimeout(() => {
      this.cancelAction(action.id, 'Confirmation timeout');
    }, this.config.confirmationTimeoutMs);
    this.confirmationTimeouts.set(action.id, timeout);

    // Emit event for UI to show confirmation dialog
    this.emit('confirmation-required', action);

    return this.createResult(true, 'Awaiting user confirmation', { pending: true });
  }

  confirmAction(actionId: string): Promise<ActionResult> {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      return Promise.resolve(this.createResult(false, 'Action not found'));
    }

    // Clear timeout
    const timeout = this.confirmationTimeouts.get(actionId);
    if (timeout) {
      clearTimeout(timeout);
      this.confirmationTimeouts.delete(actionId);
    }

    this.pendingActions.delete(actionId);
    return this.executeAction(action);
  }

  denyAction(actionId: string): ActionResult {
    return this.cancelAction(actionId, 'Denied by user');
  }

  private cancelAction(actionId: string, reason: string): ActionResult {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      return this.createResult(false, 'Action not found');
    }

    // Clear timeout
    const timeout = this.confirmationTimeouts.get(actionId);
    if (timeout) {
      clearTimeout(timeout);
      this.confirmationTimeouts.delete(actionId);
    }

    action.status = 'cancelled';
    action.result = this.createResult(false, reason);
    this.pendingActions.delete(actionId);
    this.recordAction(action);
    this.emit('action-cancelled', action, reason);

    return action.result;
  }

  // ===========================================================================
  // V1 Fallback
  // ===========================================================================

  private async convertToSuggestion(action: ProactiveAction): Promise<ActionResult> {
    // Convert V2 action to a suggestion for V1
    const suggestion: ProactiveSuggestion = {
      id: action.id,
      type: 'workflow',
      priority: action.priority,
      title: this.getActionTitle(action),
      content: this.getActionDescription(action),
      timestamp: Date.now(),
      actions: [
        { id: 'accept', label: 'Do it', action: 'accept' },
        { id: 'dismiss', label: 'Dismiss', action: 'dismiss' },
      ],
      context: {
        source: 'action_executor',
      },
    };

    this.emit('suggestion', suggestion);
    return this.createResult(true, 'Converted to suggestion (V2 actions disabled)');
  }

  private getActionTitle(action: ProactiveAction): string {
    switch (action.type) {
      case 'open_file':
        return `Open file: ${action.payload.filePath}`;
      case 'open_url':
        return `Open URL: ${action.payload.url}`;
      case 'run_command':
        return `Run command: ${action.payload.command}`;
      case 'create_file':
        return `Create file: ${action.payload.filePath}`;
      default:
        return `Action: ${action.type}`;
    }
  }

  private getActionDescription(action: ProactiveAction): string {
    switch (action.type) {
      case 'open_file':
        return `I can open "${action.payload.filePath}" for you.`;
      case 'open_url':
        return `I can open "${action.payload.url}" in your browser.`;
      case 'run_command':
        return `I can run the command "${action.payload.command}" for you.`;
      default:
        return `I can perform this action for you: ${action.type}`;
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private createResult(success: boolean, message?: string, data?: unknown): ActionResult {
    return {
      success,
      message,
      data,
      executedAt: Date.now(),
    };
  }

  private recordAction(action: ProactiveAction): void {
    this.actionHistory.push(action);
    
    // Keep only last 100 actions
    if (this.actionHistory.length > 100) {
      this.actionHistory = this.actionHistory.slice(-100);
    }
  }

  // ===========================================================================
  // Status & History
  // ===========================================================================

  getPendingActions(): ProactiveAction[] {
    return Array.from(this.pendingActions.values());
  }

  getActionHistory(limit: number = 20): ProactiveAction[] {
    return this.actionHistory.slice(-limit);
  }

  getStatus(): {
    enabled: boolean;
    pendingCount: number;
    historyCount: number;
    v2Enabled: boolean;
  } {
    return {
      enabled: this.config.enabled,
      pendingCount: this.pendingActions.size,
      historyCount: this.actionHistory.length,
      v2Enabled: this.config.enableV2Actions,
    };
  }

  // ===========================================================================
  // Factory Method for Creating Actions
  // ===========================================================================

  static createAction(
    type: ActionType,
    payload: ActionPayload,
    options?: {
      priority?: 'low' | 'medium' | 'high';
      requiresConfirmation?: boolean;
      context?: ProactiveAction['context'];
    }
  ): ProactiveAction {
    return {
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      priority: options?.priority ?? 'medium',
      timestamp: Date.now(),
      payload,
      requiresConfirmation: options?.requiresConfirmation ?? false,
      context: options?.context,
      status: 'pending',
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let actionExecutorInstance: ActionExecutor | null = null;

export function getActionExecutor(): ActionExecutor {
  if (!actionExecutorInstance) {
    actionExecutorInstance = new ActionExecutor();
  }
  return actionExecutorInstance;
}

export default ActionExecutor;
