import * as vscode from 'vscode';
import type { Services } from '../services';
import type { Suggestion, SuggestionAction, SuggestionContext, FlowState } from '../types';
import { withErrorHandling, ExtensionError, ErrorCodes } from '../utils/errors';
import * as panelCommands from './panelCommands';

// ============================================================================
// Constants and Types
// ============================================================================

const COMMAND_IDS = {
  ACCEPT_SUGGESTION: 'proactiveAssistant.acceptSuggestion',
  DISMISS_SUGGESTION: 'proactiveAssistant.dismissSuggestion',
  SNOOZE_SUGGESTION: 'proactiveAssistant.snoozeSuggestion',
  APPLY_FIX: 'proactiveAssistant.applyFix',
  REQUEST_SUGGESTION: 'proactiveAssistant.requestSuggestion',
} as const;

// --- Dismiss Suggestion Constants ---
const DISMISSAL_REASONS = [
  { label: '$(thumbsdown) Not helpful', value: 'not_helpful', description: 'Suggestion wasn\'t useful for my task' },
  { label: '$(clock) Wrong time', value: 'wrong_time', description: 'I\'m busy with something else' },
  { label: '$(error) Incorrect', value: 'incorrect', description: 'Suggestion is wrong or misleading' },
  { label: '$(circle-slash) Already done', value: 'already_done', description: 'I\'ve already addressed this' },
  { label: '$(x) No reason', value: 'no_reason', description: 'Just dismiss without feedback' }
];

const STRIKE_THRESHOLD = 3;
const STRIKE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
const ACTIVE_SUGGESTION_CONTEXT = 'proactiveAssistant.hasActiveSuggestion';

// --- Snooze Constants ---
const SNOOZE_OPTIONS = [
  { label: '$(clock) 15 minutes', value: 15, description: 'Quick snooze - back soon', icon: 'zap' },
  { label: '$(history) 30 minutes', value: 30, description: 'Short break from suggestions', icon: 'history' },
  { label: '$(watch) 1 hour', value: 60, description: 'Deep work session', icon: 'watch' },
  { label: '$(calendar) Until tomorrow', value: -1, description: 'Resume at 9:00 AM tomorrow', icon: 'calendar' },
  { label: '$(gear) Custom...', value: -2, description: 'Set your own duration', icon: 'gear' }
];

const SNOOZE_CONTEXT = 'proactiveAssistant.snoozed';

// --- Apply Fix Types ---
export type FixType = 'edit' | 'insert' | 'delete' | 'replace' | 'create_file';

export interface CodeFix {
  type: FixType;
  filePath?: string;
  range?: vscode.Range;
  content: string;
  description: string;
}

export interface FixResult {
  success: boolean;
  editApplied: boolean;
  documentUri?: vscode.Uri;
  error?: string;
}

// ============================================================================
// State Interfaces
// ============================================================================

interface DismissalRecord {
  suggestionId: string;
  timestamp: Date;
  reason: string;
  category?: string;
}

interface SnoozeState {
  isActive: boolean;
  endTime: Date | null;
  timer: NodeJS.Timeout | null;
  snoozedCategories: Set<string>;
  allSuggestions: boolean;
}

interface PendingFix {
  fix: CodeFix;
  documentVersion: number;
  originalContent: string;
  uri: vscode.Uri;
}

// ============================================================================
// Module-level State
// ============================================================================

let activeSuggestion: Suggestion | null = null;
const dismissalHistory: DismissalRecord[] = [];

let snoozeStatusBarItem: vscode.StatusBarItem | null = null;
// eslint-disable-next-line prefer-const
let snoozeState: SnoozeState = {
  isActive: false,
  endTime: null,
  timer: null,
  snoozedCategories: new Set(),
  allSuggestions: false
};

let lastAppliedFix: PendingFix | null = null;
let progressNotification: vscode.Disposable | null = null;

// ============================================================================
// Accept Suggestion Functions
// ============================================================================

export async function acceptSuggestion(
  services: Services,
  suggestionId?: string
): Promise<void> {
  services.logger.info(`Accepting suggestion: ${suggestionId || 'current'}`);

  try {
    const suggestion = suggestionId 
      ? { id: suggestionId, title: 'Suggestion' }
      : null;

    if (!suggestion) {
      services.logger.warn('No suggestion found to accept');
      vscode.window.showInformationMessage('No active suggestion to accept');
      return;
    }

    services.activityTracker?.getStats();
    vscode.window.showInformationMessage(`Accepted: ${suggestionId}`);
    services.logger.info(`Suggestion accepted: ${suggestionId}`);
  } catch (error) {
    services.logger.error(
      'Failed to accept suggestion',
      error instanceof Error ? error : new Error(String(error))
    );
    vscode.window.showErrorMessage('Couldn\'t accept that suggestion. Try again?');
  }
}

// ============================================================================
// Dismiss Suggestion Functions
// ============================================================================

export function setActiveSuggestion(suggestion: Suggestion | null): void {
  activeSuggestion = suggestion;
  
  void vscode.commands.executeCommand(
    'setContext',
    ACTIVE_SUGGESTION_CONTEXT,
    suggestion !== null
  );
}

export function getActiveSuggestion(): Suggestion | null {
  return activeSuggestion;
}

export function clearActiveSuggestion(): void {
  setActiveSuggestion(null);
}

function recordDismissal(suggestionId: string, reason: string): void {
  const record: DismissalRecord = {
    suggestionId,
    timestamp: new Date(),
    reason,
    category: activeSuggestion?.category
  };

  dismissalHistory.push(record);

  if (dismissalHistory.length > 100) {
    dismissalHistory.shift();
  }
}

export function checkStrikeRule(category?: string): boolean {
  const now = new Date();
  const windowStart = new Date(now.getTime() - STRIKE_WINDOW);

  const recentDismissals = dismissalHistory.filter(d => {
    const inWindow = d.timestamp >= windowStart;
    const sameCategory = !category || d.category === category;
    return inWindow && sameCategory;
  });

  return recentDismissals.length >= STRIKE_THRESHOLD;
}

export function getDismissalStats(): {
  total: number;
  byReason: Record<string, number>;
  byCategory: Record<string, number>;
} {
  const byReason: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  dismissalHistory.forEach(d => {
    byReason[d.reason] = (byReason[d.reason] || 0) + 1;
    if (d.category) {
      byCategory[d.category] = (byCategory[d.category] || 0) + 1;
    }
  });

  return {
    total: dismissalHistory.length,
    byReason,
    byCategory
  };
}

async function askDismissalReason(): Promise<string | null> {
  const config = vscode.workspace.getConfiguration('proactiveAssistant');
  const askReason = config.get<boolean>('askDismissalReason', true);

  if (!askReason) {
    return 'no_reason';
  }

  const selection = await vscode.window.showQuickPick(
    DISMISSAL_REASONS.map(r => ({
      label: r.label,
      description: r.description,
      value: r.value
    })),
    {
      placeHolder: 'Why are you dismissing this suggestion? (helps improve recommendations)',
      ignoreFocusOut: true
    }
  );

  return selection?.value ?? null;
}

async function handleStrikeRule(
  services: Services,
  category?: string
): Promise<void> {
  services.logger.warn(`3-strike rule triggered for category: ${category || 'all'}`);

  const message = category
    ? `You've dismissed ${STRIKE_THRESHOLD} suggestions in the "${category}" category recently. Should we adjust these recommendations?`
    : `You've dismissed ${STRIKE_THRESHOLD} suggestions recently. Should we adjust the recommendation settings?`;

  const selection = await vscode.window.showInformationMessage(
    message,
    'Adjust Settings',
    'Snooze Category',
    'Ignore'
  );

  switch (selection) {
    case 'Adjust Settings':
      await vscode.commands.executeCommand('proactiveAssistant.configure');
      break;
    case 'Snooze Category':
      if (category) {
        await vscode.commands.executeCommand('proactiveAssistant.snoozeSuggestion', category);
      }
      break;
    case 'Ignore':
      break;
  }
}

export async function dismissSuggestion(
  services: Services,
  suggestionId?: string,
  reason?: string,
  silent = false
): Promise<boolean> {
  if (!activeSuggestion) {
    throw new ExtensionError(
      'No active suggestion to dismiss',
      ErrorCodes.NO_ACTIVE_SUGGESTION,
      'There is no active suggestion to dismiss'
    );
  }

  if (suggestionId && activeSuggestion.id !== suggestionId) {
    services.logger.warn(
      `Dismissal suggestion ID mismatch: expected ${activeSuggestion.id}, got ${suggestionId}`
    );
  }

  const suggestionToDismiss = activeSuggestion;
  
  const dismissalReason = reason ?? await askDismissalReason();
  
  if (dismissalReason === null) {
    return false;
  }

  recordDismissal(suggestionToDismiss.id, dismissalReason);
  setActiveSuggestion(null);
  
  // Also clear from panel state to prevent it reappearing on focus switch
  panelCommands.clearPanelSuggestion(suggestionToDismiss.id);

  services.logger.info(
    `Suggestion dismissed: ${suggestionToDismiss.id}, reason: ${dismissalReason}`
  );

  if (!silent) {
    vscode.window.showInformationMessage(
      'Suggestion dismissed',
      'Undo'
    ).then(selection => {
      if (selection === 'Undo') {
        setActiveSuggestion(suggestionToDismiss);
        vscode.window.showInformationMessage('Suggestion restored');
      }
    });
  }

  if (checkStrikeRule(suggestionToDismiss.category)) {
    await handleStrikeRule(services, suggestionToDismiss.category);
  }

  return true;
}

export async function dismissSuggestionById(
  services: Services,
  suggestionId: string,
  reason = 'no_reason'
): Promise<boolean> {
  if (activeSuggestion?.id === suggestionId) {
    return dismissSuggestion(services, suggestionId, reason);
  }

  recordDismissal(suggestionId, reason);
  services.logger.info(`Suggestion ${suggestionId} dismissed by ID`);
  return true;
}

export function clearDismissalHistory(): void {
  dismissalHistory.length = 0;
}

export function getDismissalHistory(): DismissalRecord[] {
  return [...dismissalHistory];
}

// ============================================================================
// Snooze Suggestion Functions
// ============================================================================

function getTomorrowMorning(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
}

function createSnoozeStatusBarItem(endTime: Date): vscode.StatusBarItem {
  if (snoozeStatusBarItem) {
    snoozeStatusBarItem.dispose();
  }

  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99
  );
  
  item.text = '$(bell-slash) Snoozed';
  item.tooltip = `Suggestions snoozed until ${endTime.toLocaleTimeString()}\nClick to end snooze early`;
  item.command = COMMAND_IDS.SNOOZE_SUGGESTION;
  item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
  item.show();

  return item;
}

function updateSnoozeStatus(): void {
  if (!snoozeState.isActive || !snoozeState.endTime || !snoozeStatusBarItem) {
    return;
  }

  const now = new Date();
  const remaining = snoozeState.endTime.getTime() - now.getTime();

  if (remaining <= 0) {
    endSnooze();
    return;
  }

  const minutes = Math.floor(remaining / 60000);
  snoozeStatusBarItem.text = `$(bell-slash) Snoozed (${minutes}m)`;
}

function startSnoozeTimer(endTime: Date): void {
  if (snoozeState.timer) {
    clearInterval(snoozeState.timer);
  }

  snoozeState.isActive = true;
  snoozeState.endTime = endTime;

  snoozeStatusBarItem = createSnoozeStatusBarItem(endTime);

  snoozeState.timer = setInterval(() => {
    updateSnoozeStatus();
  }, 60000);

  const delay = endTime.getTime() - Date.now();
  setTimeout(() => {
    endSnooze();
  }, Math.max(delay, 0));
}

export async function endSnooze(): Promise<void> {
  if (!snoozeState.isActive) {
    return;
  }

  if (snoozeState.timer) {
    clearInterval(snoozeState.timer);
    snoozeState.timer = null;
  }

  if (snoozeStatusBarItem) {
    snoozeStatusBarItem.dispose();
    snoozeStatusBarItem = null;
  }

  snoozeState.isActive = false;
  snoozeState.endTime = null;
  snoozeState.snoozedCategories.clear();
  snoozeState.allSuggestions = false;

  await vscode.commands.executeCommand('setContext', SNOOZE_CONTEXT, false);

  vscode.window.showInformationMessage('🔔 Suggestions are now enabled');
}

export async function snoozeSuggestions(
  services: Services,
  minutes: number,
  category?: string
): Promise<void> {
  if (snoozeState.isActive) {
    const choice = await vscode.window.showQuickPick(
      [
        { label: '$(add) Extend snooze', value: 'extend' },
        { label: '$(circle-slash) End snooze now', value: 'end' },
        { label: '$(x) Cancel', value: 'cancel' }
      ],
      { placeHolder: 'Snooze is already active. What would you like to do?' }
    );

    if (!choice || choice.value === 'cancel') {
      return;
    }

    if (choice.value === 'end') {
      await endSnooze();
      return;
    }
  }

  let endTime: Date;
  let durationDescription: string;

  if (minutes === -1) {
    endTime = getTomorrowMorning();
    durationDescription = 'until 9:00 AM tomorrow';
  } else if (minutes === -2) {
    const customInput = await vscode.window.showInputBox({
      prompt: 'Enter custom snooze duration in minutes',
      value: '45',
      validateInput: (value) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a positive number';
        }
        if (num > 1440) {
          return 'Maximum is 1440 minutes (24 hours)';
        }
        return null;
      }
    });

    if (!customInput) {
      return;
    }

    minutes = parseInt(customInput, 10);
    endTime = new Date(Date.now() + minutes * 60000);
    durationDescription = `for ${minutes} minutes`;
  } else {
    endTime = new Date(Date.now() + minutes * 60000);
    durationDescription = `for ${minutes} minutes`;
  }

  snoozeState.allSuggestions = !category;
  if (category) {
    snoozeState.snoozedCategories.add(category);
  }

  await vscode.commands.executeCommand('setContext', SNOOZE_CONTEXT, true);

  startSnoozeTimer(endTime);

  const categoryText = category ? ` for "${category}"` : '';
  vscode.window.showInformationMessage(
    `🔕 Suggestions${categoryText} snoozed ${durationDescription}`,
    'End Early'
  ).then(selection => {
    if (selection === 'End Early') {
      endSnooze();
    }
  });

  services.logger.info(`Snoozed suggestions${categoryText} ${durationDescription}`);
}

export async function showSnoozePicker(
  services: Services,
  category?: string
): Promise<void> {
  const selection = await vscode.window.showQuickPick(
    SNOOZE_OPTIONS.map(o => ({
      label: o.label,
      description: o.description,
      value: o.value
    })),
    {
      placeHolder: category 
        ? `Snooze "${category}" suggestions for...`
        : 'Snooze suggestions for...',
      ignoreFocusOut: true
    }
  );

  if (!selection) {
    return;
  }

  await snoozeSuggestions(services, selection.value, category);
}

export function isSnoozed(category?: string): boolean {
  if (!snoozeState.isActive) {
    return false;
  }

  if (category) {
    return snoozeState.snoozedCategories.has(category) || snoozeState.allSuggestions;
  }

  return snoozeState.allSuggestions || snoozeState.snoozedCategories.size > 0;
}

export function getRemainingSnoozeTime(): number {
  if (!snoozeState.isActive || !snoozeState.endTime) {
    return 0;
  }
  return Math.max(0, snoozeState.endTime.getTime() - Date.now());
}

export function getSnoozeState(): SnoozeState {
  return { ...snoozeState };
}

export function disposeSnooze(): void {
  if (snoozeState.timer) {
    clearInterval(snoozeState.timer);
  }
  if (snoozeStatusBarItem) {
    snoozeStatusBarItem.dispose();
  }
}

// ============================================================================
// Apply Fix Functions
// ============================================================================

export function parseFix(payload: string | CodeFix): CodeFix {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as CodeFix;
    } catch {
      return {
        type: 'insert',
        content: payload,
        description: 'Insert suggested code'
      };
    }
  }
  return payload;
}

function showProgressNotification(title: string): vscode.Disposable {
  hideProgressNotification();

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `$(sync~spin) ${title}`,
      cancellable: false
    },
    async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  ) as unknown as vscode.Disposable;
}

function hideProgressNotification(): void {
  if (progressNotification) {
    progressNotification.dispose();
    progressNotification = null;
  }
}

async function getTargetDocument(
  filePath?: string
): Promise<{ document: vscode.TextDocument; editor: vscode.TextEditor }> {
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor;

  if (filePath) {
    const uri = vscode.Uri.file(filePath);
    
    const existingEditor = vscode.window.visibleTextEditors.find(
      e => e.document.uri.fsPath === uri.fsPath
    );

    if (existingEditor) {
      editor = existingEditor;
      document = existingEditor.document;
    } else {
      document = await vscode.workspace.openTextDocument(uri);
      editor = await vscode.window.showTextDocument(document);
    }
  } else {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      throw new ExtensionError(
        'No active editor',
        ErrorCodes.NO_ACTIVE_EDITOR,
        'Open a file first'
      );
    }
    editor = activeEditor;
    document = activeEditor.document;
  }

  return { document, editor };
}

function createEdit(fix: CodeFix, document: vscode.TextDocument): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();
  const uri = document.uri;

  switch (fix.type) {
    case 'insert': {
      const position = fix.range?.start 
        ? new vscode.Position(fix.range.start.line, fix.range.start.character)
        : document.positionAt(document.getText().length);
      edit.insert(uri, position, fix.content);
      break;
    }
    
    case 'delete': {
      if (fix.range) {
        const range = new vscode.Range(
          fix.range.start.line,
          fix.range.start.character,
          fix.range.end.line,
          fix.range.end.character
        );
        edit.delete(uri, range);
      }
      break;
    }
    
    case 'replace':
    case 'edit': {
      if (fix.range) {
        const range = new vscode.Range(
          fix.range.start.line,
          fix.range.start.character,
          fix.range.end.line,
          fix.range.end.character
        );
        edit.replace(uri, range, fix.content);
      } else {
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        edit.replace(uri, fullRange, fix.content);
      }
      break;
    }
    
    case 'create_file': {
      if (fix.filePath) {
        const newUri = vscode.Uri.file(fix.filePath);
        edit.createFile(newUri, { overwrite: false });
        edit.insert(newUri, new vscode.Position(0, 0), fix.content);
      }
      break;
    }
  }

  return edit;
}

async function saveUndoState(fix: CodeFix, document: vscode.TextDocument): Promise<void> {
  lastAppliedFix = {
    fix,
    documentVersion: document.version,
    originalContent: document.getText(),
    uri: document.uri
  };
}

export async function applyFix(
  services: Services,
  fix: CodeFix | Suggestion | SuggestionAction | unknown,
  _source = 'command'
): Promise<FixResult> {
  let codeFix: CodeFix;
  
  const fixTyped = fix as CodeFix | Suggestion | SuggestionAction;

  if (fixTyped && 'actions' in fixTyped) {
    const applyAction = fixTyped.actions.find((a: { type: string; payload?: string }) => a.type === 'apply');
    if (!applyAction?.payload) {
      return {
        success: false,
        editApplied: false,
        error: 'No apply action found'
      };
    }
    codeFix = parseFix(applyAction.payload);
  } else if (fixTyped && 'type' in fixTyped && fixTyped.type === 'apply') {
    if (!fixTyped.payload) {
      return {
        success: false,
        editApplied: false,
        error: 'Action has no payload'
      };
    }
    codeFix = parseFix(fixTyped.payload);
  } else {
    codeFix = fixTyped as CodeFix;
  }

  services.logger.info(`Applying fix: ${codeFix.description || codeFix.type}`);

  const progressTitle = codeFix.description || 'Applying fix...';
  showProgressNotification(progressTitle);

  try {
    const { document } = await getTargetDocument(codeFix.filePath);
    await saveUndoState(codeFix, document);

    const edit = createEdit(codeFix, document);
    const success = await vscode.workspace.applyEdit(edit);

    if (!success) {
      return {
        success: false,
        editApplied: false,
        error: 'Failed to apply edit'
      };
    }

    if (codeFix.type !== 'create_file') {
      try {
        await document.save();
      } catch {
        // Ignore save errors
      }
    }

    vscode.window.showInformationMessage(
      `✅ ${codeFix.description || 'Fix applied'}`,
      'Undo',
      'Dismiss'
    ).then(selection => {
      if (selection === 'Undo') {
        undoLastFix(services);
      }
    });

    services.logger.info('Fix applied successfully');

    return {
      success: true,
      editApplied: true,
      documentUri: document.uri
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    services.logger.error('Failed to apply fix', error instanceof Error ? error : undefined);
    
    return {
      success: false,
      editApplied: false,
      error: errorMessage
    };
  } finally {
    hideProgressNotification();
  }
}

export async function undoLastFix(services: Services): Promise<boolean> {
  if (!lastAppliedFix) {
    vscode.window.showWarningMessage('Nothing to undo');
    return false;
  }

  try {
    const { uri, originalContent } = lastAppliedFix;
    
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );

    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, fullRange, originalContent);
    
    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
      vscode.window.showInformationMessage('✅ Undone!');
      services.logger.info('Fix undone');
      lastAppliedFix = null;
      return true;
    } else {
      throw new Error('Apply edit failed');
    }
  } catch (error) {
    services.logger.error('Failed to undo', error instanceof Error ? error : undefined);
    vscode.window.showErrorMessage('Couldn\'t undo that change');
    return false;
  }
}

export function clearLastFix(): void {
  lastAppliedFix = null;
}

export function getLastAppliedFix(): PendingFix | null {
  return lastAppliedFix;
}

// ============================================================================
// Command Registration
// ============================================================================

export function registerAcceptSuggestionCommand(services: Services): vscode.Disposable {
  return vscode.commands.registerCommand(
    COMMAND_IDS.ACCEPT_SUGGESTION,
    (suggestionId?: string) => acceptSuggestion(services, suggestionId)
  );
}

export function registerDismissSuggestionCommand(services: Services): vscode.Disposable {
  const command = withErrorHandling(
    async (...args: unknown[]) => {
      const suggestionId = args[0] as string | undefined;
      const reason = args[1] as string | undefined;
      return dismissSuggestion(services, suggestionId, reason);
    },
    services.logger,
    COMMAND_IDS.DISMISS_SUGGESTION
  );

  return vscode.commands.registerCommand(COMMAND_IDS.DISMISS_SUGGESTION, command);
}

export function registerSnoozeSuggestionCommand(services: Services): vscode.Disposable {
  const command = withErrorHandling(
    async (...args: unknown[]) => {
      const category = args[0] as string | undefined;
      return showSnoozePicker(services, category);
    },
    services.logger,
    COMMAND_IDS.SNOOZE_SUGGESTION
  );

  return vscode.commands.registerCommand(COMMAND_IDS.SNOOZE_SUGGESTION, command);
}

export function registerApplyFixCommand(services: Services): vscode.Disposable {
  const command = withErrorHandling(
    async (...args: unknown[]) => {
      const fix = args[0] as CodeFix | Suggestion | undefined;
      if (!fix) {
        const activeSuggestion = getActiveSuggestion();
        
        if (activeSuggestion) {
          await applyFix(services, activeSuggestion, 'active_suggestion');
        } else {
          vscode.window.showWarningMessage('No fix to apply');
        }
        return;
      }
      
      await applyFix(services, fix);
    },
    services.logger,
    COMMAND_IDS.APPLY_FIX
  );

  return vscode.commands.registerCommand(COMMAND_IDS.APPLY_FIX, command);
}

// ============================================================================
// Request Suggestion Functions
// ============================================================================

export async function requestSuggestion(services: Services): Promise<void> {
  services.logger.info('Manual suggestion request initiated');

  // Check if there's an active editor
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showInformationMessage('Open a file to get context-aware suggestions');
    return;
  }

  try {
    // Show progress notification
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '$(sync~spin) Analyzing your context...',
        cancellable: false
      },
      async () => {
        // Get current activity context
        const activityContext = services.activityTracker?.getCurrentContext();
        
        if (!activityContext) {
          vscode.window.showWarningMessage('Could not gather context. Try again in a moment.');
          return;
        }

        // Determine flow state based on context
        const flowState: FlowState = 'working'; // Manual requests are always treated as "working"

        // Build suggestion context
        const context: SuggestionContext = {
          flowState,
          activityContext,
          recentSuggestions: activeSuggestion ? [activeSuggestion.id] : []
        };

        // Try to generate a suggestion
        const result = services.suggestionProvider?.generateForFlowState(context);

        if (!result || !result.success) {
          services.logger.info('No suggestion generated for manual request');
          vscode.window.showInformationMessage(
            'No suggestions right now. You\'re doing great! 🎉',
            'OK'
          );
          return;
        }

        const suggestion = result.value;

        // Set as active suggestion
        setActiveSuggestion(suggestion);

        // Show the suggestion in the panel
        await panelCommands.showSuggestion(services, suggestion);

        // Show success message
        vscode.window.showInformationMessage(
          `💡 Suggestion: ${suggestion.title}`,
          'View Details',
          'Dismiss'
        ).then(selection => {
          if (selection === 'Dismiss') {
            setActiveSuggestion(null);
          }
        });

        services.logger.info(`Manual suggestion shown: ${suggestion.id}`);
      }
    );
  } catch (error) {
    services.logger.error(
      'Failed to generate manual suggestion',
      error instanceof Error ? error : undefined
    );
    vscode.window.showErrorMessage(
      'Couldn\'t generate a suggestion right now. Please try again later.'
    );
  }
}

export function registerRequestSuggestionCommand(services: Services): vscode.Disposable {
  const command = withErrorHandling(
    async () => requestSuggestion(services),
    services.logger,
    COMMAND_IDS.REQUEST_SUGGESTION
  );

  return vscode.commands.registerCommand(COMMAND_IDS.REQUEST_SUGGESTION, command);
}

// ============================================================================
// Export Command IDs for index.ts
// ============================================================================

export const COMMAND_ID_ACCEPT = COMMAND_IDS.ACCEPT_SUGGESTION;
export const COMMAND_ID_DISMISS = COMMAND_IDS.DISMISS_SUGGESTION;
export const COMMAND_ID_SNOOZE = COMMAND_IDS.SNOOZE_SUGGESTION;
export const COMMAND_ID_APPLY_FIX = COMMAND_IDS.APPLY_FIX;
export const COMMAND_ID_REQUEST = COMMAND_IDS.REQUEST_SUGGESTION;
