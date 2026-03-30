# NEXUS V2 Actions - Complete Implementation Plan

## Executive Summary

This document provides a comprehensive, production-ready implementation plan for enabling V2 Actions in the NEXUS AI assistant. V2 Actions are executable operations (open files, run commands, create files, etc.) that require user confirmation and proper security controls.

**Key Components:**
1. Action Executor Enhancements (Permission system, dangerous command filtering)
2. Action Confirmation System (IPC channels, modal UI, state management)
3. New Action Types (open_file, open_url, run_command, create_file, take_screenshot)
4. Integration Points (Main process registration, preload exposure, store integration)

---

## Part 1: Type Definitions (src/shared/types.ts)

### 1.1 Add Action-Related Types

Add these type definitions after line 540 (after the IPC_CHANNELS definition):

```typescript
// =============================================================================
// V2 Action System Types
// =============================================================================

export type ActionType =
  // V1: Information actions
  | 'suggest'
  | 'notify'
  | 'ask'
  | 'remind'
  // V2: Executable actions
  | 'open_file'
  | 'open_url'
  | 'run_command'
  | 'create_file'
  | 'send_message'
  | 'create_reminder'
  | 'take_screenshot'
  | 'clipboard_copy'
  | 'custom';

export type ActionPermissionLevel = 'auto' | 'confirm' | 'deny';

export interface ActionPermission {
  type: ActionType;
  level: ActionPermissionLevel;
  description: string;
}

export interface ActionPayload {
  // For suggestions/notifications
  suggestion?: ProactiveSuggestion;
  message?: string;
  title?: string;
  
  // For file operations
  filePath?: string;
  fileContent?: string;
  
  // For URL operations
  url?: string;
  
  // For command execution
  command?: string;
  args?: string[];
  workingDirectory?: string;
  
  // For reminders
  reminderTime?: number;
  reminderMessage?: string;
  
  // For clipboard
  clipboardContent?: string;
  
  // For custom actions
  customHandler?: string;
  customData?: Record<string, unknown>;
}

export type ActionStatus = 
  | 'pending' 
  | 'awaiting_confirmation' 
  | 'executing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export interface ProactiveAction {
  id: string;
  type: ActionType;
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
  payload: ActionPayload;
  requiresConfirmation: boolean;
  context?: {
    triggerType?: string;
    relatedSuggestionId?: string;
    source?: string;
  };
  status: ActionStatus;
  result?: ActionResult;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
  executedAt: number;
}

export interface ActionConfirmationRequest {
  actionId: string;
  actionType: ActionType;
  title: string;
  description: string;
  payload: ActionPayload;
  timestamp: number;
  timeoutMs: number;
}

export interface ActionExecutorConfig {
  enabled: boolean;
  permissions: ActionPermission[];
  maxPendingActions: number;
  confirmationTimeoutMs: number;
  enableV2Actions: boolean;
  allowDangerousCommands: boolean;
  dangerousCommandPatterns: string[];
}

export const DEFAULT_ACTION_EXECUTOR_CONFIG: ActionExecutorConfig = {
  enabled: true,
  permissions: [
    { type: 'suggest', level: 'auto', description: 'Show suggestions to user' },
    { type: 'notify', level: 'auto', description: 'Show notifications' },
    { type: 'ask', level: 'auto', description: 'Ask questions' },
    { type: 'remind', level: 'auto', description: 'Set reminders' },
    { type: 'open_file', level: 'confirm', description: 'Open files' },
    { type: 'open_url', level: 'confirm', description: 'Open URLs in browser' },
    { type: 'run_command', level: 'confirm', description: 'Run shell commands' },
    { type: 'create_file', level: 'confirm', description: 'Create new files' },
    { type: 'send_message', level: 'confirm', description: 'Send messages' },
    { type: 'create_reminder', level: 'confirm', description: 'Create system reminders' },
    { type: 'take_screenshot', level: 'auto', description: 'Capture screenshots' },
    { type: 'clipboard_copy', level: 'auto', description: 'Copy to clipboard' },
    { type: 'custom', level: 'confirm', description: 'Custom actions' },
  ],
  maxPendingActions: 10,
  confirmationTimeoutMs: 30000,
  enableV2Actions: false,
  allowDangerousCommands: false,
  dangerousCommandPatterns: [
    'rm -rf /',
    'rm -rf ~',
    'format',
    'mkfs',
    'dd if=',
    '>/dev/',
    'shutdown',
    'reboot',
  ],
};
```

### 1.2 Add IPC Channels

Add to the `IPC_CHANNELS` constant (around line 630):

```typescript
// Action Executor (V2)
ACTION_EXECUTE: 'action:execute',
ACTION_CONFIRM: 'action:confirm',
ACTION_DENY: 'action:deny',
ACTION_GET_PENDING: 'action:get-pending',
ACTION_GET_HISTORY: 'action:get-history',
ACTION_GET_CONFIG: 'action:get-config',
ACTION_UPDATE_CONFIG: 'action:update-config',
ACTION_SET_PERMISSION: 'action:set-permission',

// Action Events (main → renderer)
ACTION_CONFIRMATION_REQUIRED: 'action:confirmation-required',
ACTION_EXECUTED: 'action:executed',
ACTION_FAILED: 'action:failed',
ACTION_CANCELLED: 'action:cancelled',
```

---

## Part 2: Action Executor Enhancements (src/main/services/action-executor.ts)

### 2.1 Update Imports and Configuration

Replace the existing imports (lines 1-11) with:

```typescript
// =============================================================================
// NEXUS - Action Executor (V2 Framework)
// Framework for executing proactive actions with permission system
// =============================================================================

import { EventEmitter } from 'events';
import { shell, Notification, dialog, clipboard, nativeImage } from 'electron';
import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { ProactiveSuggestion, ProactiveAction, ActionType, ActionPermissionLevel, ActionPermission, ActionPayload, ActionResult, ActionExecutorConfig, DEFAULT_ACTION_EXECUTOR_CONFIG } from '../../shared/types';

const execAsync = promisify(exec);
```

### 2.2 Enhanced ActionExecutor Class

Replace the entire `ActionExecutor` class (lines 161-762) with:

```typescript
export class ActionExecutor extends EventEmitter {
  private config: ActionExecutorConfig;
  private pendingActions: Map<string, ProactiveAction> = new Map();
  private actionHistory: ProactiveAction[] = [];
  private confirmationTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private dangerousPatterns: RegExp[];

  constructor(config?: Partial<ActionExecutorConfig>) {
    super();
    this.config = { ...DEFAULT_ACTION_EXECUTOR_CONFIG, ...config };
    
    // Compile dangerous command patterns
    this.dangerousPatterns = this.config.dangerousCommandPatterns.map(
      pattern => new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    );
    
    // Additional regex patterns for dangerous commands
    this.dangerousPatterns.push(
      /rm\s+-rf\s+[\/~]/i,
      /format\s+[a-z]:/i,
      /del\s+\/f\s+/i,
      /mkfs\./i,
      /dd\s+if=.*of=\//i,
      />\s*\/dev\//i,
      /shutdown\s+/i,
      /reboot\s+/i,
      /reg\s+delete\s+/i,
      /regedit\s+/i
    );
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  updateConfig(config: Partial<ActionExecutorConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Recompile patterns if they changed
    if (config.dangerousCommandPatterns) {
      this.dangerousPatterns = this.config.dangerousCommandPatterns.map(
        pattern => new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      );
    }
    
    console.log('[ActionExecutor] Config updated:', {
      enabled: this.config.enabled,
      v2Enabled: this.config.enableV2Actions,
      pendingCount: this.pendingActions.size,
    });
  }

  getConfig(): ActionExecutorConfig {
    return { ...this.config };
  }

  setPermission(type: ActionType, level: ActionPermissionLevel): void {
    const existing = this.config.permissions.find(p => p.type === type);
    if (existing) {
      existing.level = level;
      console.log(`[ActionExecutor] Permission updated: ${type} -> ${level}`);
    } else {
      this.config.permissions.push({
        type,
        level,
        description: `Permission for ${type}`,
      });
    }
  }

  getPermission(type: ActionType): ActionPermissionLevel {
    const permission = this.config.permissions.find(p => p.type === type);
    return permission?.level ?? 'confirm';
  }

  // ===========================================================================
  // V2 Action Enablement
  // ===========================================================================

  enableV2Actions(): void {
    this.config.enableV2Actions = true;
    console.log('[ActionExecutor] V2 Actions enabled');
    this.emit('v2-enabled');
  }

  disableV2Actions(): void {
    this.config.enableV2Actions = false;
    console.log('[ActionExecutor] V2 Actions disabled');
    this.emit('v2-disabled');
  }

  isV2Enabled(): boolean {
    return this.config.enableV2Actions;
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

    // Validate action payload
    const validationError = this.validateActionPayload(action);
    if (validationError) {
      return this.createResult(false, validationError);
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

  private validateActionPayload(action: ProactiveAction): string | null {
    const { type, payload } = action;

    switch (type) {
      case 'open_file':
        if (!payload.filePath || typeof payload.filePath !== 'string') {
          return 'Missing or invalid filePath';
        }
        break;
      case 'open_url':
        if (!payload.url || typeof payload.url !== 'string') {
          return 'Missing or invalid url';
        }
        // Validate URL format
        try {
          const url = new URL(payload.url);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return 'Invalid URL protocol. Only http: and https: are allowed';
          }
        } catch {
          return 'Invalid URL format';
        }
        break;
      case 'run_command':
        if (!payload.command || typeof payload.command !== 'string') {
          return 'Missing or invalid command';
        }
        if (!this.config.allowDangerousCommands) {
          const fullCommand = payload.args 
            ? `${payload.command} ${payload.args.join(' ')}` 
            : payload.command;
          if (this.isDangerousCommand(fullCommand)) {
            return 'Command blocked: potentially dangerous operation detected';
          }
        }
        break;
      case 'create_file':
        if (!payload.filePath || typeof payload.filePath !== 'string') {
          return 'Missing or invalid filePath';
        }
        // Prevent path traversal attacks
        if (payload.filePath.includes('..')) {
          return 'Invalid filePath: path traversal detected';
        }
        break;
      case 'clipboard_copy':
        if (!payload.clipboardContent || typeof payload.clipboardContent !== 'string') {
          return 'Missing or invalid clipboardContent';
        }
        break;
    }

    return null;
  }

  private isDangerousCommand(command: string): boolean {
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        console.warn('[ActionExecutor] Dangerous command detected:', command);
        return true;
      }
    }
    return false;
  }

  // ===========================================================================
  // Action Implementations
  // ===========================================================================

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
        case 'run_command':
          result = await this.executeRunCommand(action);
          break;
        case 'create_file':
          result = await this.executeCreateFile(action);
          break;
        case 'create_reminder':
          result = await this.executeCreateReminder(action);
          break;
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

    setTimeout(() => {
      const notification = new Notification({
        title: 'NEXUS Reminder',
        body: reminderMessage,
        silent: false,
      });
      notification.show();
      this.emit('reminder-triggered', action);
    }, Math.min(delay, 2147483647)); // Max setTimeout delay

    return this.createResult(true, `Reminder scheduled for ${new Date(reminderTime).toLocaleString()}`);
  }

  private async executeOpenUrl(action: ProactiveAction): Promise<ActionResult> {
    const { url } = action.payload;
    
    if (!url) {
      return this.createResult(false, 'No URL in payload');
    }

    try {
      await shell.openExternal(url);
      return this.createResult(true, `Opened URL: ${url}`, { url });
    } catch (error) {
      return this.createResult(false, `Failed to open URL: ${error}`);
    }
  }

  private async executeOpenFile(action: ProactiveAction): Promise<ActionResult> {
    const { filePath } = action.payload;
    
    if (!filePath) {
      return this.createResult(false, 'No file path in payload');
    }

    try {
      // Check if file exists
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.resolve(filePath);
      
      await fs.access(absolutePath);
      
      const result = await shell.openPath(absolutePath);
      
      if (result === '') {
        return this.createResult(true, `Opened file: ${absolutePath}`, { path: absolutePath });
      } else {
        return this.createResult(false, `Failed to open file: ${result}`);
      }
    } catch (error) {
      return this.createResult(false, `File not found or cannot be accessed: ${filePath}`);
    }
  }

  private async executeClipboardCopy(action: ProactiveAction): Promise<ActionResult> {
    const { clipboardContent } = action.payload;
    
    if (!clipboardContent) {
      return this.createResult(false, 'No content to copy');
    }

    try {
      clipboard.writeText(clipboardContent);
      return this.createResult(true, 'Content copied to clipboard', { 
        length: clipboardContent.length 
      });
    } catch (error) {
      return this.createResult(false, `Failed to copy to clipboard: ${error}`);
    }
  }

  private async executeTakeScreenshot(action: ProactiveAction): Promise<ActionResult> {
    // Emit event for main process to handle using desktopCapturer
    this.emit('take-screenshot', action);
    return this.createResult(true, 'Screenshot request emitted');
  }

  private async executeRunCommand(action: ProactiveAction): Promise<ActionResult> {
    const { command, args, workingDirectory } = action.payload;
    
    if (!command) {
      return this.createResult(false, 'No command specified');
    }

    // Final safety check
    const fullCommand = args ? `${command} ${args.join(' ')}` : command;
    if (!this.config.allowDangerousCommands && this.isDangerousCommand(fullCommand)) {
      return this.createResult(false, 'Command blocked for safety reasons');
    }

    try {
      const options: { cwd?: string; timeout: number; maxBuffer: number } = {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 5, // 5MB
      };
      
      if (workingDirectory) {
        options.cwd = workingDirectory;
      }

      const { stdout, stderr } = await execAsync(fullCommand, options);
      
      return this.createResult(true, 'Command executed successfully', {
        stdout: stdout?.substring(0, 10000), // Limit output size
        stderr: stderr?.substring(0, 5000),
        command: fullCommand,
      });
    } catch (error) {
      if (error instanceof Error && 'killed' in error) {
        return this.createResult(false, 'Command timed out after 30 seconds');
      }
      
      return this.createResult(false, `Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async executeCreateFile(action: ProactiveAction): Promise<ActionResult> {
    const { filePath, fileContent } = action.payload;
    
    if (!filePath) {
      return this.createResult(false, 'No file path specified');
    }

    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
      
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
      const content = fileContent || '';
      await fs.writeFile(absolutePath, content, 'utf-8');

      return this.createResult(true, `File created: ${absolutePath}`, { 
        path: absolutePath,
        size: content.length,
      });
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

    const delay = reminderTime - Date.now();
    
    if (delay <= 0) {
      return this.createResult(false, 'Reminder time must be in the future');
    }

    // Maximum delay of 24 hours for in-memory timers
    const maxDelay = 24 * 60 * 60 * 1000;
    if (delay > maxDelay) {
      return this.createResult(false, 'Reminder cannot be more than 24 hours in the future');
    }

    const reminderId = `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setTimeout(() => {
      try {
        const notification = new Notification({
          title: title || 'NEXUS Reminder',
          body: reminderMessage,
          silent: false,
        });

        notification.on('click', () => {
          this.emit('reminder-clicked', { id: reminderId, action });
        });

        notification.show();
        this.emit('reminder-triggered', { id: reminderId, action });
      } catch (error) {
        console.error('[ActionExecutor] Failed to show reminder notification:', error);
      }
    }, delay);

    return this.createResult(true, `Reminder scheduled for ${new Date(reminderTime).toLocaleString()}`, {
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
    this.emit('confirmation-required', {
      actionId: action.id,
      actionType: action.type,
      title: this.getActionTitle(action),
      description: this.getActionDescription(action),
      payload: action.payload,
      timestamp: Date.now(),
      timeoutMs: this.config.confirmationTimeoutMs,
    });

    return this.createResult(true, 'Awaiting user confirmation', { pending: true, actionId: action.id });
  }

  async confirmAction(actionId: string): Promise<ActionResult> {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      return this.createResult(false, 'Action not found or already processed');
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
        return `Open file: ${path.basename(action.payload.filePath || 'unknown')}`;
      case 'open_url':
        return `Open URL: ${action.payload.url}`;
      case 'run_command':
        return `Run: ${action.payload.command?.split(' ')[0]}...`;
      case 'create_file':
        return `Create file: ${path.basename(action.payload.filePath || 'unknown')}`;
      case 'clipboard_copy':
        return `Copy to clipboard (${action.payload.clipboardContent?.length || 0} chars)`;
      case 'take_screenshot':
        return 'Take screenshot';
      default:
        return `Action: ${action.type}`;
    }
  }

  private getActionDescription(action: ProactiveAction): string {
    switch (action.type) {
      case 'open_file':
        return `Open "${action.payload.filePath}" in the default application.`;
      case 'open_url':
        return `Open "${action.payload.url}" in your browser.`;
      case 'run_command':
        return `Execute command: "${action.payload.command} ${action.payload.args?.join(' ') || ''}"`;
      case 'create_file':
        return `Create file at "${action.payload.filePath}" (${action.payload.fileContent?.length || 0} bytes).`;
      case 'clipboard_copy':
        return `Copy text to clipboard: "${action.payload.clipboardContent?.substring(0, 50)}${(action.payload.clipboardContent?.length || 0) > 50 ? '...' : ''}"`;
      default:
        return `Execute ${action.type} action`;
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
    this.actionHistory.push({ ...action });
    
    // Keep only last 100 actions
    if (this.actionHistory.length > 100) {
      this.actionHistory = this.actionHistory.slice(-100);
    }
  }

  // ===========================================================================
  // Public Status & History
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
    config: ActionExecutorConfig;
  } {
    return {
      enabled: this.config.enabled,
      pendingCount: this.pendingActions.size,
      historyCount: this.actionHistory.length,
      v2Enabled: this.config.enableV2Actions,
      config: this.getConfig(),
    };
  }

  // ===========================================================================
  // Factory Method
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
```

### 2.3 Update Singleton Export (lines 764-777)

Replace with:

```typescript
// =============================================================================
// Singleton Instance
// =============================================================================

let actionExecutorInstance: ActionExecutor | null = null;

export function getActionExecutor(config?: Partial<ActionExecutorConfig>): ActionExecutor {
  if (!actionExecutorInstance) {
    actionExecutorInstance = new ActionExecutor(config);
  }
  return actionExecutorInstance;
}

export function resetActionExecutor(): void {
  actionExecutorInstance = null;
}

export default ActionExecutor;
```

---

## Part 3: Main Process Integration (src/main/main.ts)

### 3.1 Import Action Executor

Add to imports at line 20:

```typescript
import { getActionExecutor, ActionExecutor, ProactiveAction, ActionType, ActionPayload, ActionResult } from './services/action-executor';
```

### 3.2 Add Action Executor to NexusApp Class

Add property at line 62 (after soulDocumentStore):

```typescript
private actionExecutor: ActionExecutor | null = null;
```

### 3.3 Initialize Action Executor in initializeServices()

Add at the end of `initializeServices()` method (after line 197):

```typescript
    // Initialize Action Executor
    const actionSettings = store.get('settings');
    this.actionExecutor = getActionExecutor({
      enabled: true,
      enableV2Actions: actionSettings.v2ActionsEnabled ?? false,
      maxPendingActions: 10,
      confirmationTimeoutMs: 30000,
    });
    
    // Set up action executor event listeners
    this.setupActionExecutorListeners();
```

### 3.4 Add Action Executor Event Listeners

Add new method to the `NexusApp` class (after `setupIpcHandlers`):

```typescript
  private setupActionExecutorListeners(): void {
    if (!this.actionExecutor) return;

    // Handle confirmation requests - forward to renderer
    this.actionExecutor.on('confirmation-required', (request) => {
      console.log('[ActionExecutor] Confirmation required:', request.actionType);
      this.broadcastToRenderers(IPC_CHANNELS.ACTION_CONFIRMATION_REQUIRED, request);
    });

    // Handle action completion
    this.actionExecutor.on('action-completed', (action) => {
      console.log('[ActionExecutor] Action completed:', action.type);
      this.broadcastToRenderers(IPC_CHANNELS.ACTION_EXECUTED, {
        actionId: action.id,
        type: action.type,
        success: true,
        result: action.result,
      });
    });

    // Handle action failures
    this.actionExecutor.on('action-failed', (action, error) => {
      console.error('[ActionExecutor] Action failed:', action.type, error);
      this.broadcastToRenderers(IPC_CHANNELS.ACTION_FAILED, {
        actionId: action.id,
        type: action.type,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    // Handle action cancellations
    this.actionExecutor.on('action-cancelled', (action, reason) => {
      console.log('[ActionExecutor] Action cancelled:', action.id, reason);
      this.broadcastToRenderers(IPC_CHANNELS.ACTION_CANCELLED, {
        actionId: action.id,
        type: action.type,
        reason,
      });
    });

    // Handle suggestions from action executor
    this.actionExecutor.on('suggestion', (suggestion: ProactiveSuggestion) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('proactive:suggestion', suggestion);
      }
    });

    // Handle screenshot requests
    this.actionExecutor.on('take-screenshot', async (action: ProactiveAction) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 }
        });
        
        if (sources.length === 0) {
          this.actionExecutor?.emit('action-failed', action, new Error('No screen sources found'));
          return;
        }
        
        const thumbnail = sources[0].thumbnail;
        const base64 = thumbnail.toDataURL();
        
        // Update action result
        action.result = {
          success: true,
          message: 'Screenshot captured',
          data: { screenshot: base64 },
          executedAt: Date.now(),
        };
        action.status = 'completed';
        
        this.broadcastToRenderers('screenshot:captured', { 
          actionId: action.id, 
          screenshot: base64 
        });
      } catch (error) {
        this.actionExecutor?.emit('action-failed', action, error);
      }
    });
  }
```

### 3.5 Add IPC Handlers for Actions

Add to `setupIpcHandlers()` method (after line 1076):

```typescript
    // Action Executor (V2)
    ipcMain.handle(IPC_CHANNELS.ACTION_EXECUTE, (_, action: ProactiveAction) => 
      wrapHandler('ACTION_EXECUTE', async () => {
        if (!this.actionExecutor) {
          throw new Error('Action executor not initialized');
        }
        return this.actionExecutor.execute(action);
      }));

    ipcMain.handle(IPC_CHANNELS.ACTION_CONFIRM, (_, actionId: string) => 
      wrapHandler('ACTION_CONFIRM', async () => {
        if (!this.actionExecutor) {
          throw new Error('Action executor not initialized');
        }
        return this.actionExecutor.confirmAction(actionId);
      }));

    ipcMain.handle(IPC_CHANNELS.ACTION_DENY, (_, actionId: string) => 
      wrapHandler('ACTION_DENY', () => {
        if (!this.actionExecutor) {
          throw new Error('Action executor not initialized');
        }
        return this.actionExecutor.denyAction(actionId);
      }));

    ipcMain.handle(IPC_CHANNELS.ACTION_GET_PENDING, () => 
      wrapHandler('ACTION_GET_PENDING', () => {
        if (!this.actionExecutor) return [];
        return this.actionExecutor.getPendingActions();
      }));

    ipcMain.handle(IPC_CHANNELS.ACTION_GET_HISTORY, (_, limit?: number) => 
      wrapHandler('ACTION_GET_HISTORY', () => {
        if (!this.actionExecutor) return [];
        return this.actionExecutor.getActionHistory(limit);
      }));

    ipcMain.handle(IPC_CHANNELS.ACTION_GET_CONFIG, () => 
      wrapHandler('ACTION_GET_CONFIG', () => {
        if (!this.actionExecutor) return null;
        return this.actionExecutor.getStatus().config;
      }));

    ipcMain.handle(IPC_CHANNELS.ACTION_UPDATE_CONFIG, (_, config: Partial<ActionExecutorConfig>) => 
      wrapHandler('ACTION_UPDATE_CONFIG', () => {
        if (!this.actionExecutor) {
          throw new Error('Action executor not initialized');
        }
        this.actionExecutor.updateConfig(config);
        
        // Persist to settings
        const currentSettings = store.get('settings');
        store.set('settings', {
          ...currentSettings,
          v2ActionsEnabled: config.enableV2Actions ?? currentSettings.v2ActionsEnabled,
        });
        
        return this.actionExecutor.getStatus().config;
      }));

    ipcMain.handle(IPC_CHANNELS.ACTION_SET_PERMISSION, (_, type: ActionType, level: 'auto' | 'confirm' | 'deny') => 
      wrapHandler('ACTION_SET_PERMISSION', () => {
        if (!this.actionExecutor) {
          throw new Error('Action executor not initialized');
        }
        this.actionExecutor.setPermission(type, level);
        return { type, level };
      }));
```

### 3.6 Add v2ActionsEnabled to Settings

Add to `AppSettings` interface in types.ts (line 506):

```typescript
// V2 Actions
v2ActionsEnabled: boolean;
```

Add to `DEFAULT_SETTINGS` (line 537):

```typescript
v2ActionsEnabled: false,
```

---

## Part 4: Preload Script Updates (src/main/preload.ts)

### 4.1 Update Imports

Add to imports at line 22:

```typescript
import {
  // ... existing imports
  ProactiveAction,
  ActionResult,
  ActionConfirmationRequest,
  ActionExecutorConfig,
  ActionType,
} from '../shared/types';
```

### 4.2 Update ElectronAPI Interface

Add to `ElectronAPI` interface (after line 129):

```typescript
  // Action Executor (V2)
  executeAction: (action: ProactiveAction) => Promise<ActionResult>;
  confirmAction: (actionId: string) => Promise<ActionResult>;
  denyAction: (actionId: string) => Promise<ActionResult>;
  getPendingActions: () => Promise<ProactiveAction[]>;
  getActionHistory: (limit?: number) => Promise<ProactiveAction[]>;
  getActionConfig: () => Promise<ActionExecutorConfig | null>;
  updateActionConfig: (config: Partial<ActionExecutorConfig>) => Promise<ActionExecutorConfig | null>;
  setActionPermission: (type: ActionType, level: 'auto' | 'confirm' | 'deny') => Promise<{ type: ActionType; level: string }>;
  onActionConfirmationRequired: (callback: (event: IpcRendererEvent, request: ActionConfirmationRequest) => void) => () => void;
  onActionExecuted: (callback: (event: IpcRendererEvent, result: { actionId: string; type: ActionType; success: boolean; result?: ActionResult }) => void) => () => void;
  onActionFailed: (callback: (event: IpcRendererEvent, result: { actionId: string; type: ActionType; success: false; error: string }) => void) => () => void;
  onActionCancelled: (callback: (event: IpcRendererEvent, result: { actionId: string; type: ActionType; reason: string }) => void) => () => void;
```

### 4.3 Update API Object

Add to `api` object (before line 248):

```typescript
  // Action Executor (V2)
  executeAction: createIpcInvoker(IPC_CHANNELS.ACTION_EXECUTE),
  confirmAction: createIpcInvoker(IPC_CHANNELS.ACTION_CONFIRM),
  denyAction: createIpcInvoker(IPC_CHANNELS.ACTION_DENY),
  getPendingActions: createIpcInvoker(IPC_CHANNELS.ACTION_GET_PENDING),
  getActionHistory: createIpcInvoker(IPC_CHANNELS.ACTION_GET_HISTORY),
  getActionConfig: createIpcInvoker(IPC_CHANNELS.ACTION_GET_CONFIG),
  updateActionConfig: createIpcInvoker(IPC_CHANNELS.ACTION_UPDATE_CONFIG),
  setActionPermission: createIpcInvoker(IPC_CHANNELS.ACTION_SET_PERMISSION),
  onActionConfirmationRequired: createIpcListener(IPC_CHANNELS.ACTION_CONFIRMATION_REQUIRED),
  onActionExecuted: createIpcListener(IPC_CHANNELS.ACTION_EXECUTED),
  onActionFailed: createIpcListener(IPC_CHANNELS.ACTION_FAILED),
  onActionCancelled: createIpcListener(IPC_CHANNELS.ACTION_CANCELLED),
```

---

## Part 5: Renderer Store (src/renderer/stores/actionStore.ts)

Create new file `src/renderer/stores/actionStore.ts`:

```typescript
// =============================================================================
// NEXUS - Action Store
// Zustand store for V2 action execution and confirmation
// =============================================================================

import { create } from 'zustand';
import { 
  ProactiveAction, 
  ActionResult, 
  ActionConfirmationRequest,
  ActionExecutorConfig,
  ActionType,
} from '../../shared/types';
import { showError, showSuccess, showInfo } from './toastStore';

interface ActionState {
  // State
  pendingActions: ActionConfirmationRequest[];
  actionHistory: ProactiveAction[];
  config: ActionExecutorConfig | null;
  isLoading: boolean;
  isV2Enabled: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  executeAction: (action: ProactiveAction) => Promise<ActionResult | null>;
  confirmAction: (actionId: string) => Promise<void>;
  denyAction: (actionId: string) => Promise<void>;
  loadPendingActions: () => Promise<void>;
  loadActionHistory: (limit?: number) => Promise<void>;
  addPendingAction: (request: ActionConfirmationRequest) => void;
  removePendingAction: (actionId: string) => void;
  updateConfig: (config: Partial<ActionExecutorConfig>) => Promise<boolean>;
  setPermission: (type: ActionType, level: 'auto' | 'confirm' | 'deny') => Promise<boolean>;
  enableV2: () => Promise<boolean>;
  disableV2: () => Promise<boolean>;
  clearHistory: () => void;
}

export const useActionStore = create<ActionState>((set, get) => ({
  pendingActions: [],
  actionHistory: [],
  config: null,
  isLoading: false,
  isV2Enabled: false,

  initialize: async () => {
    try {
      const config = await window.electronAPI?.getActionConfig();
      if (config) {
        set({ 
          config, 
          isV2Enabled: config.enableV2Actions 
        });
      }
      
      // Load pending and history
      await get().loadPendingActions();
      await get().loadActionHistory();
    } catch (error) {
      console.error('[ActionStore] Failed to initialize:', error);
    }
  },

  executeAction: async (action: ProactiveAction) => {
    set({ isLoading: true });
    try {
      const result = await window.electronAPI?.executeAction(action);
      set({ isLoading: false });
      
      if (result) {
        if (result.success) {
          showSuccess(result.message || 'Action executed');
        } else if (!result.message?.includes('Awaiting')) {
          // Don't show error for pending confirmations
          showError(result.message || 'Action failed');
        }
      }
      
      return result || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute action';
      showError(message);
      set({ isLoading: false });
      return null;
    }
  },

  confirmAction: async (actionId: string) => {
    set({ isLoading: true });
    try {
      const result = await window.electronAPI?.confirmAction(actionId);
      
      if (result?.success) {
        showSuccess(result.message || 'Action confirmed and executed');
        get().removePendingAction(actionId);
      } else {
        showError(result?.message || 'Failed to confirm action');
      }
      
      await get().loadActionHistory();
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to confirm action';
      showError(message);
      set({ isLoading: false });
    }
  },

  denyAction: async (actionId: string) => {
    try {
      const result = await window.electronAPI?.denyAction(actionId);
      
      if (result?.success !== false) {
        showInfo('Action cancelled');
        get().removePendingAction(actionId);
      }
    } catch (error) {
      console.error('[ActionStore] Failed to deny action:', error);
    }
  },

  loadPendingActions: async () => {
    try {
      const actions = await window.electronAPI?.getPendingActions();
      if (actions) {
        // Convert to confirmation requests format
        const requests: ActionConfirmationRequest[] = actions.map(a => ({
          actionId: a.id,
          actionType: a.type,
          title: `Action: ${a.type}`,
          description: JSON.stringify(a.payload),
          payload: a.payload,
          timestamp: a.timestamp,
          timeoutMs: 30000,
        }));
        set({ pendingActions: requests });
      }
    } catch (error) {
      console.error('[ActionStore] Failed to load pending actions:', error);
    }
  },

  loadActionHistory: async (limit = 20) => {
    try {
      const history = await window.electronAPI?.getActionHistory(limit);
      if (history) {
        set({ actionHistory: history });
      }
    } catch (error) {
      console.error('[ActionStore] Failed to load action history:', error);
    }
  },

  addPendingAction: (request: ActionConfirmationRequest) => {
    set((state) => ({
      pendingActions: [request, ...state.pendingActions.filter(a => a.actionId !== request.actionId)],
    }));
  },

  removePendingAction: (actionId: string) => {
    set((state) => ({
      pendingActions: state.pendingActions.filter(a => a.actionId !== actionId),
    }));
  },

  updateConfig: async (updates) => {
    const currentConfig = get().config;
    if (!currentConfig) return false;
    
    const newConfig = { ...currentConfig, ...updates };
    set({ config: newConfig });
    
    try {
      const updated = await window.electronAPI?.updateActionConfig(updates);
      if (updated) {
        set({ config: updated, isV2Enabled: updated.enableV2Actions });
        return true;
      }
      set({ config: currentConfig });
      return false;
    } catch (error) {
      console.error('[ActionStore] Failed to update config:', error);
      set({ config: currentConfig });
      return false;
    }
  },

  setPermission: async (type, level) => {
    try {
      await window.electronAPI?.setActionPermission(type, level);
      showSuccess(`Permission updated for ${type}`);
      return true;
    } catch (error) {
      showError('Failed to update permission');
      return false;
    }
  },

  enableV2: async () => {
    const success = await get().updateConfig({ enableV2Actions: true });
    if (success) {
      showSuccess('V2 Actions enabled');
      set({ isV2Enabled: true });
    }
    return success;
  },

  disableV2: async () => {
    const success = await get().updateConfig({ enableV2Actions: false });
    if (success) {
      showInfo('V2 Actions disabled');
      set({ isV2Enabled: false });
    }
    return success;
  },

  clearHistory: () => {
    set({ actionHistory: [] });
  },
}));

// Setup IPC listeners when in renderer environment
if (typeof window !== 'undefined' && window.electronAPI) {
  // Listen for confirmation requests
  window.electronAPI.onActionConfirmationRequired((_, request) => {
    useActionStore.getState().addPendingAction(request);
  });

  // Listen for action execution results
  window.electronAPI.onActionExecuted((_, result) => {
    useActionStore.getState().removePendingAction(result.actionId);
    useActionStore.getState().loadActionHistory();
    
    if (result.success) {
      showSuccess(`Action completed: ${result.type}`);
    }
  });

  // Listen for action failures
  window.electronAPI.onActionFailed((_, result) => {
    useActionStore.getState().removePendingAction(result.actionId);
    showError(`Action failed: ${result.error}`);
  });

  // Listen for action cancellations
  window.electronAPI.onActionCancelled((_, result) => {
    useActionStore.getState().removePendingAction(result.actionId);
    showInfo(`Action cancelled: ${result.reason}`);
  });
}

export default useActionStore;
```

---

## Part 6: Confirmation Modal Component (src/renderer/components/ActionConfirmationModal.tsx)

Create new file `src/renderer/components/ActionConfirmationModal.tsx`:

```typescript
// =============================================================================
// NEXUS - Action Confirmation Modal
// Modal for confirming V2 actions before execution
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  ExternalLink,
  Terminal,
  Plus,
  Camera,
  Clipboard,
  AlertTriangle,
  Check,
  X,
  Clock,
  Shield,
} from 'lucide-react';
import { useActionStore } from '../stores/actionStore';
import { ActionConfirmationRequest, ActionType } from '../../shared/types';

const actionIcons: Record<ActionType, React.ReactNode> = {
  suggest: <FileText className="w-5 h-5" />,
  notify: <FileText className="w-5 h-5" />,
  ask: <FileText className="w-5 h-5" />,
  remind: <Clock className="w-5 h-5" />,
  open_file: <FileText className="w-5 h-5" />,
  open_url: <ExternalLink className="w-5 h-5" />,
  run_command: <Terminal className="w-5 h-5" />,
  create_file: <Plus className="w-5 h-5" />,
  send_message: <FileText className="w-5 h-5" />,
  create_reminder: <Clock className="w-5 h-5" />,
  take_screenshot: <Camera className="w-5 h-5" />,
  clipboard_copy: <Clipboard className="w-5 h-5" />,
  custom: <FileText className="w-5 h-5" />,
};

const actionLabels: Record<ActionType, string> = {
  suggest: 'Show Suggestion',
  notify: 'Show Notification',
  ask: 'Ask Question',
  remind: 'Set Reminder',
  open_file: 'Open File',
  open_url: 'Open URL',
  run_command: 'Run Command',
  create_file: 'Create File',
  send_message: 'Send Message',
  create_reminder: 'Create Reminder',
  take_screenshot: 'Take Screenshot',
  clipboard_copy: 'Copy to Clipboard',
  custom: 'Custom Action',
};

export const ActionConfirmationModal: React.FC = () => {
  const { pendingActions, confirmAction, denyAction } = useActionStore();
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  // Countdown timer for auto-expiry
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newCountdowns: Record<string, number> = {};
      
      pendingActions.forEach((action) => {
        const elapsed = now - action.timestamp;
        const remaining = Math.max(0, Math.ceil((action.timeoutMs - elapsed) / 1000));
        newCountdowns[action.actionId] = remaining;
        
        // Auto-deny if timeout reached
        if (remaining === 0) {
          denyAction(action.actionId);
        }
      });
      
      setCountdowns(newCountdowns);
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingActions, denyAction]);

  const handleConfirm = useCallback((actionId: string) => {
    confirmAction(actionId);
  }, [confirmAction]);

  const handleDeny = useCallback((actionId: string) => {
    denyAction(actionId);
  }, [denyAction]);

  if (pendingActions.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        {pendingActions.map((action, index) => (
          <ConfirmationCard
            key={action.actionId}
            action={action}
            countdown={countdowns[action.actionId] || 0}
            onConfirm={() => handleConfirm(action.actionId)}
            onDeny={() => handleDeny(action.actionId)}
            index={index}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ConfirmationCardProps {
  action: ActionConfirmationRequest;
  countdown: number;
  onConfirm: () => void;
  onDeny: () => void;
  index: number;
}

const ConfirmationCard: React.FC<ConfirmationCardProps> = ({
  action,
  countdown,
  onConfirm,
  onDeny,
  index,
}) => {
  const isDangerous = action.actionType === 'run_command' || action.actionType === 'create_file';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      transition={{ delay: index * 0.1 }}
      className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 bg-slate-800/50">
        <div className={`p-2 rounded-lg ${isDangerous ? 'bg-amber-500/20 text-amber-400' : 'bg-nexus-cyan/20 text-nexus-cyan'}`}>
          {actionIcons[action.actionType] || <FileText className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-slate-200">
            {actionLabels[action.actionType] || 'Action Request'}
          </h3>
          <p className="text-xs text-slate-400">
            NEXUS wants to perform an action
          </p>
        </div>
        {isDangerous && (
          <div className="p-1.5 rounded-full bg-amber-500/20 text-amber-400" title="Potentially dangerous action">
            <AlertTriangle className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-sm text-slate-300 font-medium">
          {action.title}
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          {action.description}
        </p>

        {/* Payload Details */}
        <PayloadDetails action={action} />

        {/* Security Notice */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <Shield className="w-4 h-4 text-nexus-violet mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-400">
            This action will be executed with your user permissions. 
            Only confirm if you trust this request.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700 bg-slate-800/30">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Expires in {countdown}s</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onDeny}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={onConfirm}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDangerous
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                : 'bg-nexus-cyan/20 text-nexus-cyan hover:bg-nexus-cyan/30 border border-nexus-cyan/30'
            }`}
          >
            <Check className="w-4 h-4" />
            Confirm
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const PayloadDetails: React.FC<{ action: ActionConfirmationRequest }> = ({ action }) => {
  const { payload, actionType } = action;

  switch (actionType) {
    case 'run_command':
      return (
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
          <span className="text-nexus-violet">$</span> {payload.command} {payload.args?.join(' ')}
        </div>
      );
    
    case 'open_file':
    case 'create_file':
      return (
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
          <p className="text-xs text-slate-500 mb-1">Path:</p>
          <p className="text-xs text-slate-300 font-mono truncate">{payload.filePath}</p>
          {payload.fileContent && (
            <>
              <p className="text-xs text-slate-500 mt-2 mb-1">Content ({payload.fileContent.length} bytes):</p>
              <pre className="text-xs text-slate-400 max-h-24 overflow-y-auto">
                {payload.fileContent.substring(0, 200)}
                {payload.fileContent.length > 200 && '...'}
              </pre>
            </>
          )}
        </div>
      );
    
    case 'open_url':
      return (
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
          <p className="text-xs text-slate-500 mb-1">URL:</p>
          <a 
            href={payload.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-nexus-cyan hover:underline truncate block"
          >
            {payload.url}
          </a>
        </div>
      );
    
    case 'clipboard_copy':
      return (
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
          <p className="text-xs text-slate-500 mb-1">Content to copy:</p>
          <p className="text-xs text-slate-300">
            "{payload.clipboardContent?.substring(0, 100)}
            {(payload.clipboardContent?.length || 0) > 100 && '...'}"
          </p>
        </div>
      );
    
    default:
      return null;
  }
};

export default ActionConfirmationModal;
```

---

## Part 7: Settings Integration

### 7.1 Update SettingsModal.tsx

Add V2 Actions section to the settings modal. In `src/renderer/components/SettingsModal.tsx`, add:

```typescript
// Add to imports
import { useActionStore } from '../stores/actionStore';
import { 
  Zap, 
  Shield, 
  Terminal, 
  FileText, 
  ExternalLink, 
  Plus,
  AlertTriangle 
} from 'lucide-react';

// In the component
const { config, isV2Enabled, enableV2, disableV2, setPermission } = useActionStore();

// Add new section in the settings tabs
const renderV2ActionsSettings = () => (
  <div className="space-y-6">
    {/* Enable V2 Actions */}
    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-nexus-cyan/10 text-nexus-cyan">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-slate-200">Enable V2 Actions</h4>
          <p className="text-xs text-slate-400">
            Allow NEXUS to execute actions like opening files and running commands
          </p>
        </div>
      </div>
      <button
        onClick={() => isV2Enabled ? disableV2() : enableV2()}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          isV2Enabled ? 'bg-nexus-cyan' : 'bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            isV2Enabled ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>

    {isV2Enabled && (
      <>
        {/* Permission Settings */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-nexus-violet" />
            Action Permissions
          </h4>
          <p className="text-xs text-slate-400">
            Control which actions require confirmation before execution
          </p>

          <div className="space-y-2">
            {config?.permissions.map((perm) => (
              <PermissionRow
                key={perm.type}
                permission={perm}
                onChange={(level) => setPermission(perm.type, level)}
              />
            ))}
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-amber-400">Security Notice</h4>
              <p className="text-xs text-amber-400/80 mt-1">
                V2 Actions allow NEXUS to interact with your system. Always review 
                action requests carefully before confirming. Never confirm actions 
                you don't understand or trust.
              </p>
            </div>
          </div>
        </div>
      </>
    )}
  </div>
);

// Permission Row Component
interface PermissionRowProps {
  permission: ActionPermission;
  onChange: (level: 'auto' | 'confirm' | 'deny') => void;
}

const PermissionRow: React.FC<PermissionRowProps> = ({ permission, onChange }) => {
  const icons: Record<ActionType, React.ReactNode> = {
    open_file: <FileText className="w-4 h-4" />,
    open_url: <ExternalLink className="w-4 h-4" />,
    run_command: <Terminal className="w-4 h-4" />,
    create_file: <Plus className="w-4 h-4" />,
    // ... other icons
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className="text-slate-400">
          {icons[permission.type] || <Zap className="w-4 h-4" />}
        </div>
        <div>
          <p className="text-sm text-slate-300 capitalize">
            {permission.type.replace('_', ' ')}
          </p>
          <p className="text-xs text-slate-500">{permission.description}</p>
        </div>
      </div>
      <select
        value={permission.level}
        onChange={(e) => onChange(e.target.value as 'auto' | 'confirm' | 'deny')}
        className="px-3 py-1.5 rounded-lg bg-slate-700 text-sm text-slate-200 border border-slate-600 focus:outline-none focus:border-nexus-cyan"
      >
        <option value="auto">Auto</option>
        <option value="confirm">Confirm</option>
        <option value="deny">Deny</option>
      </select>
    </div>
  );
};
```

---

## Part 8: App.tsx Integration

### 8.1 Add Modal to Main App

In `src/renderer/App.tsx`:

```typescript
// Add import
import { ActionConfirmationModal } from './components/ActionConfirmationModal';
import { useActionStore } from './stores/actionStore';

// In the main App component
function App() {
  // ... existing hooks
  const { initialize: initializeActionStore } = useActionStore();

  // Initialize action store on mount
  useEffect(() => {
    initializeActionStore();
  }, [initializeActionStore]);

  return (
    <div className="app">
      {/* ... existing content */}
      
      {/* Action Confirmation Modal */}
      <ActionConfirmationModal />
    </div>
  );
}
```

---

## Part 9: Testing Checklist

### 9.1 Unit Tests for Action Executor

Create `src/main/services/__tests__/action-executor.test.ts`:

```typescript
import { ActionExecutor } from '../action-executor';
import { ProactiveAction, ActionPayload } from '../../../shared/types';

describe('ActionExecutor', () => {
  let executor: ActionExecutor;

  beforeEach(() => {
    executor = new ActionExecutor({
      enabled: true,
      enableV2Actions: true,
      allowDangerousCommands: false,
    });
  });

  describe('execute', () => {
    it('should execute auto-permission actions immediately', async () => {
      const action = ActionExecutor.createAction('notify', {
        message: 'Test',
        title: 'Test',
      });

      const result = await executor.execute(action);
      expect(result.success).toBe(true);
    });

    it('should block dangerous commands', async () => {
      const action = ActionExecutor.createAction('run_command', {
        command: 'rm -rf /',
      });

      const result = await executor.execute(action);
      expect(result.success).toBe(false);
      expect(result.message).toContain('blocked');
    });

    it('should request confirmation for V2 actions', async () => {
      const action = ActionExecutor.createAction('open_file', {
        filePath: '/test/file.txt',
      });

      const result = await executor.execute(action);
      expect(result.message).toContain('Awaiting');
      expect(executor.getPendingActions().length).toBe(1);
    });
  });

  describe('confirmAction', () => {
    it('should execute pending action on confirm', async () => {
      const action = ActionExecutor.createAction('clipboard_copy', {
        clipboardContent: 'test',
      });

      await executor.execute(action);
      const pending = executor.getPendingActions()[0];
      
      const result = await executor.confirmAction(pending.id);
      expect(result.success).toBe(true);
      expect(executor.getPendingActions().length).toBe(0);
    });
  });

  describe('validateActionPayload', () => {
    it('should reject invalid URLs', async () => {
      const action = ActionExecutor.createAction('open_url', {
        url: 'file:///etc/passwd',
      });

      const result = await executor.execute(action);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid URL protocol');
    });

    it('should reject path traversal', async () => {
      const action = ActionExecutor.createAction('create_file', {
        filePath: '../../../etc/passwd',
      });

      const result = await executor.execute(action);
      expect(result.success).toBe(false);
      expect(result.message).toContain('path traversal');
    });
  });
});
```

### 9.2 Manual Testing Scenarios

1. **Enable V2 Actions**
   - Toggle V2 Actions in settings
   - Verify toggle persists after restart

2. **Open File Action**
   - Trigger action with valid file path
   - Confirm modal appears
   - Confirm action → file opens
   - Deny action → nothing happens

3. **Run Command Action**
   - Trigger with safe command (e.g., `echo hello`)
   - Verify confirmation modal shows command
   - Confirm → command executes
   - Verify output captured

4. **Dangerous Command Blocking**
   - Try `rm -rf /`
   - Verify blocked without confirmation
   - Verify error message shown

5. **Timeout Handling**
   - Trigger action
   - Wait 30 seconds without confirming
   - Verify auto-cancelled
   - Verify notification shown

6. **Permission Levels**
   - Set action to 'auto' → executes immediately
   - Set action to 'confirm' → shows modal
   - Set action to 'deny' → blocked immediately

---

## Part 10: Security Considerations

### 10.1 Implemented Safeguards

1. **Dangerous Command Filtering**
   - Regex patterns for destructive operations
   - Cannot be bypassed without explicit config change
   - Blocks: `rm -rf /`, `format`, `mkfs`, `dd`, `shutdown`, etc.

2. **URL Validation**
   - Only `http:` and `https:` protocols allowed
   - Prevents `file://` access to sensitive files

3. **Path Traversal Protection**
   - Rejects paths containing `..`
   - All paths resolved to absolute before use

4. **Confirmation Requirements**
   - All V2 actions require confirmation by default
   - 30-second timeout prevents indefinite pending
   - User must explicitly confirm each action

5. **Permission System**
   - Granular per-action-type permissions
   - Can set to 'auto', 'confirm', or 'deny'
   - Persisted in settings

### 10.2 Additional Recommendations

1. **Audit Logging**
   - Log all executed actions to file
   - Include timestamp, action type, success/failure
   - Retain for 30 days

2. **Rate Limiting**
   - Limit actions per minute
   - Prevent spam/abuse

3. **Sandboxed Execution**
   - Consider running commands in restricted shell
   - Limit filesystem access

4. **User Education**
   - Clear warnings in UI
   - Documentation on safe usage
   - Prominent security notices

---

## Summary of Files Modified/Created

### Modified Files:
1. `src/shared/types.ts` - Add action types and IPC channels
2. `src/main/services/action-executor.ts` - Enhanced V2 implementation
3. `src/main/main.ts` - IPC handlers and initialization
4. `src/main/preload.ts` - Expose actions to renderer
5. `src/renderer/App.tsx` - Add confirmation modal
6. `src/renderer/components/SettingsModal.tsx` - Add V2 settings

### New Files:
1. `src/renderer/stores/actionStore.ts` - State management
2. `src/renderer/components/ActionConfirmationModal.tsx` - Confirmation UI
3. `src/main/services/__tests__/action-executor.test.ts` - Tests

---

## Implementation Order

1. **Phase 1: Types & Core (Day 1)**
   - Update types.ts
   - Update action-executor.ts
   - Write unit tests

2. **Phase 2: IPC Layer (Day 1-2)**
   - Update main.ts with handlers
   - Update preload.ts

3. **Phase 3: UI Layer (Day 2)**
   - Create actionStore.ts
   - Create ActionConfirmationModal.tsx
   - Integrate into App.tsx

4. **Phase 4: Settings (Day 2-3)**
   - Add V2 settings to SettingsModal
   - Add enable/disable toggle
   - Add permission controls

5. **Phase 5: Testing (Day 3)**
   - Manual testing of all action types
   - Security testing
   - Edge case testing

6. **Phase 6: Documentation (Day 3)**
   - Update user documentation
   - Add security guidelines
   - Create usage examples
