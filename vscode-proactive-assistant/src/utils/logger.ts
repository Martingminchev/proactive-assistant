import * as vscode from 'vscode';
import type { ILogger } from '../types';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = typeof LOG_LEVELS[number];

export class Logger implements ILogger {
  private outputChannel: vscode.OutputChannel;
  private currentLevel: LogLevel;
  private levelIndex: number;

  constructor(channelName: string, level: LogLevel = 'info') {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
    this.currentLevel = level;
    this.levelIndex = LOG_LEVELS.indexOf(level);
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
    this.levelIndex = LOG_LEVELS.indexOf(level);
    this.outputChannel.appendLine(`Log level changed to: ${level}`);
  }

  getLevel(): LogLevel {
    return this.currentLevel;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS.indexOf(level) >= this.levelIndex;
  }

  private write(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message);
    const argsString = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') : '';

    this.outputChannel.appendLine(formattedMessage + argsString);
  }

  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.write('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, ...args);
  }

  error(message: string, error?: Error, ...args: unknown[]): void {
    let errorDetails = '';
    if (error) {
      errorDetails = `\n  Error: ${error.message}`;
      if (error.stack) {
        errorDetails += `\n  Stack: ${error.stack.split('\n').slice(1, 4).join('\n    ')}`;
      }
    }
    this.write('error', message + errorDetails, ...args);
  }

  show(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

export function createLogger(_context: vscode.ExtensionContext): Logger {
  const config = vscode.workspace.getConfiguration('proactiveAssistant.logging');
  const level = config.get<LogLevel>('level', 'info');
  return new Logger('Proactive AI Assistant', level);
}
