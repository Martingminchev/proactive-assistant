import * as vscode from 'vscode';
import {
  IActivityTracker,
  ISuggestionProvider,
  IPiecesClient,
  ILogger,
  IInterruptionManager,
  IStorageManager,
  IStatusBarManager
} from '../types';

export { PiecesOSClient, type PiecesHealthResponse } from './piecesClient';
export { ActivityMonitor } from './activityMonitor';
export { InterruptionManager } from './interruptionManager';
export { SuggestionEngine } from './suggestionEngine';
export { StorageManager } from './storageManager';
export { StatusBarManager } from './statusBarManager';
export { SuggestionOrchestrator } from './suggestionOrchestrator';
export type { SuggestionType } from '../types';

export type {
  IActivityTracker,
  ISuggestionProvider,
  IPiecesClient,
  IInterruptionManager,
  IStorageManager,
  IStatusBarManager
} from '../types';

export type {
  InterruptionLevel,
  InterruptionStats,
  InterruptionDecision,
  DismissalRecord,
  UsagePatterns,
  StorageKey,
  StatusBarState,
  StatusBarConfig,
  SuggestionContext,
  UserSuggestionPreferences,
  TypingMetrics,
  ErrorTracking
} from '../types';

export interface Services {
  activityTracker: IActivityTracker;
  suggestionProvider: ISuggestionProvider;
  piecesClient: IPiecesClient;
  logger: ILogger;
  context: vscode.ExtensionContext;
  interruptionManager?: IInterruptionManager;
  storageManager?: IStorageManager;
  statusBarManager?: IStatusBarManager;
}

export { default as piecesClientDefault } from './piecesClient';
export { default as activityMonitorDefault } from './activityMonitor';
export { default as interruptionManagerDefault } from './interruptionManager';
export { default as suggestionEngineDefault } from './suggestionEngine';
export { default as storageManagerDefault } from './storageManager';
export { default as statusBarManagerDefault } from './statusBarManager';
