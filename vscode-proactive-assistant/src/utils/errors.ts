import * as vscode from 'vscode';
import type { ILogger } from '../types';

export const ErrorCodes = {
  PIECES_NOT_CONNECTED: 'PIECES_NOT_CONNECTED',
  PIECES_CONNECTION_FAILED: 'PIECES_CONNECTION_FAILED',
  NO_ACTIVE_EDITOR: 'NO_ACTIVE_EDITOR',
  NO_ACTIVE_SUGGESTION: 'NO_ACTIVE_SUGGESTION',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',
  COMMAND_FAILED: 'COMMAND_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Custom error class for extension-specific errors
 */
export class ExtensionError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly userMessage?: string
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  [ErrorCodes.PIECES_NOT_CONNECTED]: 'Pieces OS is not connected. Please ensure Pieces OS is running.',
  [ErrorCodes.PIECES_CONNECTION_FAILED]: 'Failed to connect to Pieces OS. Please check your settings.',
  [ErrorCodes.NO_ACTIVE_EDITOR]: 'No active editor. Please open a file first.',
  [ErrorCodes.NO_ACTIVE_SUGGESTION]: 'No active suggestion to dismiss.',
  [ErrorCodes.INVALID_CONFIGURATION]: 'Invalid configuration. Please check your settings.',
  [ErrorCodes.COMMAND_FAILED]: 'Command failed. Please try again.',
  [ErrorCodes.NETWORK_ERROR]: 'Network error. Please check your connection.'
};

export async function handleError(
  error: unknown,
  logger: ILogger,
  fallbackMessage = 'An unexpected error occurred'
): Promise<void> {
  let errorCode: ErrorCode = ErrorCodes.UNKNOWN_ERROR;
  let message = fallbackMessage;
  let userMessage: string | undefined;

  if (error instanceof ExtensionError) {
    errorCode = error.code;
    message = error.message;
    userMessage = error.userMessage || ERROR_MESSAGES[errorCode];
  } else if (error instanceof Error) {
    message = error.message;
    
    // Try to determine error code from message
    if (message.includes(' Pieces ') || message.includes('pieces')) {
      errorCode = ErrorCodes.PIECES_NOT_CONNECTED;
      userMessage = ERROR_MESSAGES[errorCode];
    } else if (message.includes('network') || message.includes('ECONNREFUSED')) {
      errorCode = ErrorCodes.NETWORK_ERROR;
      userMessage = ERROR_MESSAGES[errorCode];
    }
  }

  // Log the error
  logger.error(`[${errorCode}] ${message}`, error instanceof Error ? error : undefined);

  // Show user-friendly message
  const displayMessage = userMessage || message;
  const selection = await vscode.window.showErrorMessage(
    displayMessage,
    'View Logs',
    'Dismiss'
  );

  if (selection === 'View Logs') {
    vscode.commands.executeCommand('proactiveAssistant.showLogs');
  }
}

export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  logger: ILogger,
  commandName: string
): T {
  return (async (...args: unknown[]) => {
    try {
      logger.debug(`Executing command: ${commandName}`);
      const result = await fn(...args);
      logger.debug(`Command completed: ${commandName}`);
      return result;
    } catch (error) {
      await handleError(error, logger, `Command "${commandName}" failed`);
      throw error;
    }
  }) as T;
}


