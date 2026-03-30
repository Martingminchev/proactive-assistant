import * as vscode from 'vscode';
import type { Services } from '../services';

// Import from combined command files
import * as suggestionActions from './suggestionActions';
import * as panelCommands from './panelCommands';
import * as settingsCommands from './settingsCommands';
import * as diagnosePiecesCmd from './diagnosePieces';

// Re-export for external use
export { suggestionActions, panelCommands, settingsCommands, diagnosePiecesCmd };

// ============================================================================
// Direct exports from suggestionActions
// ============================================================================
export const acceptSuggestion = suggestionActions.acceptSuggestion;
export const dismissSuggestion = suggestionActions.dismissSuggestion;
export const dismissSuggestionById = suggestionActions.dismissSuggestionById;
export const snoozeSuggestion = suggestionActions.snoozeSuggestions;
export const applyFix = suggestionActions.applyFix;
export const undoLastFix = suggestionActions.undoLastFix;
export const setActiveSuggestion = suggestionActions.setActiveSuggestion;
export const getActiveSuggestion = suggestionActions.getActiveSuggestion;
export const clearActiveSuggestion = suggestionActions.clearActiveSuggestion;
export const endSnooze = suggestionActions.endSnooze;
export const isSnoozed = suggestionActions.isSnoozed;
export const getSnoozeState = suggestionActions.getSnoozeState;
export const getRemainingSnoozeTime = suggestionActions.getRemainingSnoozeTime;
export const checkStrikeRule = suggestionActions.checkStrikeRule;
export const getDismissalStats = suggestionActions.getDismissalStats;
export const clearDismissalHistory = suggestionActions.clearDismissalHistory;
export const getDismissalHistory = suggestionActions.getDismissalHistory;
export const clearLastFix = suggestionActions.clearLastFix;
export const getLastAppliedFix = suggestionActions.getLastAppliedFix;
export const requestSuggestion = suggestionActions.requestSuggestion;
export type { CodeFix, FixResult, FixType } from './suggestionActions';

// ============================================================================
// Direct exports from panelCommands
// ============================================================================
export const openPanel = panelCommands.openPanel;
export const showStats = panelCommands.showStats;
export const showWelcome = panelCommands.showWelcome;
export const checkAndShowWelcome = panelCommands.checkAndShowWelcome;
export const showSuggestion = panelCommands.showSuggestion;
export const updatePanelContext = panelCommands.updatePanelContext;
export const updatePanelFile = panelCommands.updatePanelFile;
export const updatePanelSuggestionStatus = panelCommands.updatePanelSuggestionStatus;
export const updatePanelFocusMode = panelCommands.updatePanelFocusMode;
export const updatePanelStats = panelCommands.updatePanelStats;
export const showPanelCelebration = panelCommands.showPanelCelebration;
export const getPanel = panelCommands.getPanel;
export const isPanelVisible = panelCommands.isPanelVisible;
export const isFirstRun = panelCommands.isFirstRun;
export const markFirstRunComplete = panelCommands.markFirstRunComplete;

// ============================================================================
// Direct exports from settingsCommands
// ============================================================================
export const openSettings = settingsCommands.openSettings;
export const toggleFocusMode = settingsCommands.toggleFocusMode;
export const enableFocusMode = settingsCommands.enableFocusMode;
export const disableFocusMode = settingsCommands.disableFocusMode;
export const isFocusModeEnabled = settingsCommands.isFocusModeEnabled;
export const getRemainingFocusTime = settingsCommands.getRemainingFocusTime;
export const resetState = settingsCommands.resetState;

// ============================================================================
// Direct exports from diagnosePieces
// ============================================================================
export const diagnosePieces = diagnosePiecesCmd.diagnosePieces;

// ============================================================================
// Command Registration
// ============================================================================
export function registerCommands(
  context: vscode.ExtensionContext,
  services: Services
): vscode.Disposable[] {
  services.logger.info('Registering Proactive Assistant commands...');

  const disposables: vscode.Disposable[] = [
    // Panel commands
    panelCommands.registerOpenPanelCommand(services),
    panelCommands.registerShowStatsCommand(services),
    panelCommands.registerShowWelcomeCommand(services),
    
    // Settings commands
    settingsCommands.registerOpenSettingsCommand(services),
    settingsCommands.registerToggleFocusModeCommand(services),
    settingsCommands.registerResetStateCommand(services),
    
    // Suggestion action commands
    suggestionActions.registerAcceptSuggestionCommand(services),
    suggestionActions.registerDismissSuggestionCommand(services),
    suggestionActions.registerApplyFixCommand(services),
    suggestionActions.registerSnoozeSuggestionCommand(services),
    suggestionActions.registerRequestSuggestionCommand(services),
    
    // Diagnostic commands
    diagnosePiecesCmd.registerDiagnosePiecesCommand(services),
  ];

  context.subscriptions.push(...disposables);

  services.logger.info(`Registered ${disposables.length} commands successfully`);

  return disposables;
}

// ============================================================================
// Command ID Constants
// ============================================================================
export const CommandIds = {
  OPEN_PANEL: panelCommands.COMMAND_ID_OPEN_PANEL,
  SHOW_STATS: panelCommands.COMMAND_ID_SHOW_STATS,
  SHOW_WELCOME: panelCommands.COMMAND_ID_SHOW_WELCOME,
  OPEN_SETTINGS: settingsCommands.COMMAND_ID_OPEN_SETTINGS,
  TOGGLE_FOCUS_MODE: settingsCommands.COMMAND_ID_TOGGLE_FOCUS_MODE,
  RESET_STATE: settingsCommands.COMMAND_ID_RESET_STATE,
  ACCEPT_SUGGESTION: suggestionActions.COMMAND_ID_ACCEPT,
  DISMISS_SUGGESTION: suggestionActions.COMMAND_ID_DISMISS,
  SNOOZE_SUGGESTION: suggestionActions.COMMAND_ID_SNOOZE,
  APPLY_FIX: suggestionActions.COMMAND_ID_APPLY_FIX,
  REQUEST_SUGGESTION: suggestionActions.COMMAND_ID_REQUEST,
  DIAGNOSE_PIECES: diagnosePiecesCmd.COMMAND_ID,
} as const;

// ============================================================================
// Command Metadata (for package.json contributions)
// ============================================================================
export const CommandMetadata = [
  {
    command: panelCommands.COMMAND_ID_OPEN_PANEL,
    title: 'Open Assistant Panel',
    keybinding: 'ctrl+shift+a',
    macKeybinding: 'cmd+shift+a',
    category: 'Proactive Assistant'
  },
  {
    command: settingsCommands.COMMAND_ID_TOGGLE_FOCUS_MODE,
    title: 'Toggle Focus Mode',
    keybinding: 'ctrl+shift+f',
    macKeybinding: 'cmd+shift+f',
    category: 'Proactive Assistant'
  },
  {
    command: panelCommands.COMMAND_ID_SHOW_STATS,
    title: 'Show Activity Statistics',
    category: 'Proactive Assistant'
  },
  {
    command: suggestionActions.COMMAND_ID_DISMISS,
    title: 'Dismiss Current Suggestion',
    keybinding: 'escape',
    when: 'proactiveAssistant.hasActiveSuggestion',
    category: 'Proactive Assistant'
  },
  {
    command: suggestionActions.COMMAND_ID_APPLY_FIX,
    title: 'Apply Suggested Fix',
    category: 'Proactive Assistant'
  },
  {
    command: suggestionActions.COMMAND_ID_SNOOZE,
    title: 'Snooze Suggestions',
    category: 'Proactive Assistant'
  },
  {
    command: settingsCommands.COMMAND_ID_OPEN_SETTINGS,
    title: 'Configure Settings',
    category: 'Proactive Assistant'
  },
  {
    command: panelCommands.COMMAND_ID_SHOW_WELCOME,
    title: 'Show Welcome',
    category: 'Proactive Assistant'
  },
  {
    command: suggestionActions.COMMAND_ID_ACCEPT,
    title: 'Accept Suggestion',
    category: 'Proactive Assistant'
  },
  {
    command: settingsCommands.COMMAND_ID_RESET_STATE,
    title: 'Reset Flow State',
    category: 'Proactive Assistant'
  },
  {
    command: diagnosePiecesCmd.COMMAND_ID,
    title: 'Diagnose Pieces OS Connection',
    category: 'Proactive Assistant'
  },
  {
    command: suggestionActions.COMMAND_ID_REQUEST,
    title: 'Request Suggestion',
    category: 'Proactive Assistant'
  }
];

// ============================================================================
// Cleanup Functions
// ============================================================================
export function disposeCommands(): void {
  settingsCommands.disposeFocusMode();
  suggestionActions.disposeSnooze();
  suggestionActions.clearLastFix();
}
