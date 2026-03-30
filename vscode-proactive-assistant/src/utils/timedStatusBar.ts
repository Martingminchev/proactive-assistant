import * as vscode from 'vscode';
import type { ILogger } from '../types';

export interface TimedStatusBarOptions {
  /** Command ID to associate with the status bar item */
  commandId: string;
  /** VS Code context key to set when active */
  contextKey: string;
  /** Icon to display in status bar (e.g., '$(eye-closed)') */
  icon: string;
  /** Label shown when active (e.g., 'Focus') */
  label: string;
  /** Status bar priority (lower = further right) */
  priority: number;
  /** Update interval in milliseconds (default: 1000) */
  updateIntervalMs?: number;
  /** Color for the status bar item */
  color?: vscode.ThemeColor;
  /** Background color for the status bar item */
  backgroundColor?: vscode.ThemeColor;
  /** Logger instance */
  logger?: ILogger;
}

export interface TimedStatusBarState {
  enabled: boolean;
  endTime: Date | null;
  remainingMs: number;
}

/**
 * Shared utility class for features that need:
 * - Status bar item with countdown timer
 * - VS Code context key management
 * - Automatic cleanup on expiration
 * - Start/Stop functionality
 */
export class TimedStatusBarFeature {
  private readonly options: Required<TimedStatusBarOptions>;
  protected statusBarItem: vscode.StatusBarItem | null = null;
  private timerInterval: NodeJS.Timeout | null = null;
  private endTime: Date | null = null;
  private enabled = false;

  constructor(options: TimedStatusBarOptions) {
    this.options = {
      updateIntervalMs: 1000,
      color: undefined as unknown as vscode.ThemeColor,
      backgroundColor: undefined as unknown as vscode.ThemeColor,
      logger: undefined as unknown as ILogger,
      ...options
    };
  }

  /**
   * Check if the feature is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the current state of the feature
   */
  getState(): TimedStatusBarState {
    return {
      enabled: this.enabled,
      endTime: this.endTime,
      remainingMs: this.getRemainingMs()
    };
  }

  /**
   * Get remaining time in milliseconds
   */
  getRemainingMs(): number {
    if (!this.enabled || !this.endTime) {
      return 0;
    }
    return Math.max(0, this.endTime.getTime() - Date.now());
  }

  /**
   * Start the timed feature
   * @param endTime When the feature should expire
   * @param onExpire Callback when timer expires
   */
  async start(endTime: Date, onExpire?: () => void): Promise<void> {
    // Clean up any existing state
    this.stop();

    this.enabled = true;
    this.endTime = endTime;

    // Set VS Code context key
    await vscode.commands.executeCommand('setContext', this.options.contextKey, true);

    // Create and show status bar item
    this.createStatusBarItem(endTime);

    // Start timer for countdown updates
    this.timerInterval = setInterval(() => {
      this.updateCountdown();
      
      // Check for expiration
      if (this.endTime && new Date() >= this.endTime) {
        this.stop();
        onExpire?.();
      }
    }, this.options.updateIntervalMs);

    this.options.logger?.debug(`${this.options.label} started, expires at ${endTime.toLocaleTimeString()}`);
  }

  /**
   * Stop the timed feature and clean up
   */
  async stop(): Promise<void> {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem = null;
    }

    this.enabled = false;
    this.endTime = null;

    await vscode.commands.executeCommand('setContext', this.options.contextKey, false);

    this.options.logger?.debug(`${this.options.label} stopped`);
  }

  /**
   * Update the status bar countdown display
   * Override this method for custom formatting
   */
  protected updateCountdown(): void {
    if (!this.enabled || !this.endTime || !this.statusBarItem) {
      return;
    }

    const remaining = this.formatRemainingTime(this.endTime);
    this.statusBarItem.text = `${this.options.icon} ${this.options.label} (${remaining})`;
  }

  /**
   * Format the remaining time for display
   * Override for custom formatting
   */
  protected formatRemainingTime(endTime: Date): string {
    const now = new Date();
    const diff = endTime.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Ending...';
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
  }

  /**
   * Create the status bar item
   */
  private createStatusBarItem(endTime: Date): void {
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
    }

    const item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      this.options.priority
    );

    item.text = `${this.options.icon} ${this.options.label}`;
    item.tooltip = `${this.options.label} Active\nEnds at ${endTime.toLocaleTimeString()}\nClick to end early`;
    item.command = this.options.commandId;

    if (this.options.color) {
      item.color = this.options.color;
    }
    if (this.options.backgroundColor) {
      item.backgroundColor = this.options.backgroundColor;
    }

    item.show();
    this.statusBarItem = item;

    this.options.logger?.debug(`${this.options.label} status bar item created`);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
    }
  }
}

/**
 * Format remaining time as minutes only (for snooze feature)
 */
export function formatRemainingMinutes(endTime: Date): string {
  const now = new Date();
  const diff = endTime.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Ending...';
  }

  const minutes = Math.floor(diff / 60000);
  return `${minutes}m`;
}
