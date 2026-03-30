import * as vscode from 'vscode';

/**
 * Suggestion notification data
 */
export interface SuggestionNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'suggestion' | 'urgent';
  actions?: Array<{
    label: string;
    command: string;
    args?: any[];
  }>;
}

/**
 * Manages VS Code notifications for the Proactive AI Assistant
 */
export class NotificationManager {
  private activeNotifications: Map<string, vscode.Disposable> = new Map();
  private suppressedTypes: Set<string> = new Set();

  constructor(private context: vscode.ExtensionContext) {
    // Load suppressed notification types from storage
    const suppressed = context.globalState.get<string[]>('suppressedNotifications') || [];
    this.suppressedTypes = new Set(suppressed);
  }

  /**
   * Show a suggestion notification with rich actions
   */
  async showSuggestion(suggestion: {
    id: string;
    type: 'optimization' | 'refactor' | 'bugfix' | 'style' | 'performance';
    title: string;
    description: string;
    fileName?: string;
    lineNumber?: number;
    confidence: number;
  }): Promise<boolean> {
    // Check if this type is suppressed
    if (this.suppressedTypes.has(suggestion.type)) {
      return false;
    }

    const prefix = this.getSuggestionIcon(suggestion.type);
    const location = suggestion.fileName 
      ? ` in ${suggestion.fileName}${suggestion.lineNumber ? `:${suggestion.lineNumber}` : ''}` 
      : '';

    const message = `${prefix} ${suggestion.title}${location}`;
    
    // Determine notification type based on confidence and suggestion type
    const isUrgent = suggestion.type === 'bugfix' || suggestion.confidence > 0.9;
    
    if (isUrgent) {
      // Show urgent notification with modal option
      const result = await vscode.window.showInformationMessage(
        message,
        { modal: false, detail: suggestion.description },
        'View Suggestion',
        'Apply',
        'Dismiss'
      );

      this.handleSuggestionResult(result, suggestion.id);
      return result !== 'Dismiss' && result !== undefined;
    } else {
      // Show standard notification
      const result = await vscode.window.showInformationMessage(
        message,
        { detail: suggestion.description },
        'View',
        'Later'
      );

      if (result === 'View') {
        vscode.commands.executeCommand('proactiveAssistant.openPanel');
      }
      return result === 'View';
    }
  }

  /**
   * Show a progress notification for long operations
   */
  async withProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>,
    cancellable: boolean = false
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `$(sync~spin) ${title}`,
        cancellable,
      },
      async (progress, token) => {
        return task({
          report: (value: { message?: string; increment?: number }) => {
            progress.report(value);
          }
        } as vscode.Progress<{ message?: string; increment?: number }>);
      }
    );
  }

  /**
   * Show a status bar progress indicator
   */
  async withStatusBarProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title,
      },
      async (progress) => {
        return task(progress);
      }
    );
  }

  /**
   * Show a quick pick for multiple suggestions
   */
  async showSuggestionPicker(
    suggestions: Array<{
      id: string;
      label: string;
      description: string;
      detail?: string;
      type: string;
    }>
  ): Promise<string | undefined> {
    const items: vscode.QuickPickItem[] = suggestions.map(s => ({
      label: `${this.getSuggestionIcon(s.type)} ${s.label}`,
      description: s.description,
      detail: s.detail,
    }));

    const result = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a suggestion to view',
      title: 'AI Suggestions',
    });

    if (result) {
      const selected = suggestions.find(s => 
        result.label.includes(s.label)
      );
      return selected?.id;
    }

    return undefined;
  }

  /**
   * Show focus mode started notification
   */
  showFocusModeStarted(duration: number): void {
    const message = vscode.window.setStatusBarMessage(
      `$(target) Focus mode: ${duration} minutes`,
      5000
    );
    this.activeNotifications.set('focus', message);
  }

  /**
   * Show focus mode ended notification
   */
  showFocusModeEnded(interrupted: boolean): void {
    const icon = interrupted ? '$(circle-slash)' : '$(check)';
    const text = interrupted ? 'Focus mode interrupted' : 'Focus mode completed!';
    
    vscode.window.showInformationMessage(
      `${icon} ${text}`,
      'View Stats'
    ).then(result => {
      if (result === 'View Stats') {
        vscode.commands.executeCommand('proactiveAssistant.openPanel');
      }
    });
  }

  /**
   * Show achievement/milestone notification
   */
  showAchievement(title: string, description: string, icon: string = 'trophy'): void {
    vscode.window.showInformationMessage(
      `$(${icon}) ${title}`,
      { detail: description },
      'View Stats',
      'Dismiss'
    ).then(result => {
      if (result === 'View Stats') {
        vscode.commands.executeCommand('proactiveAssistant.openPanel');
      }
    });
  }

  /**
   * Show error notification
   */
  showError(message: string, detail?: string): void {
    vscode.window.showErrorMessage(
      `$(error) ${message}`,
      { detail },
      'Show Details',
      'Dismiss'
    ).then(result => {
      if (result === 'Show Details') {
        vscode.commands.executeCommand('proactiveAssistant.openPanel');
      }
    });
  }

  /**
   * Show warning notification
   */
  showWarning(message: string, actions?: string[]): Promise<string | undefined> {
    return vscode.window.showWarningMessage(
      `$(warning) ${message}`,
      ...(actions || [])
    );
  }

  /**
   * Show info notification
   */
  showInfo(message: string, ...actions: string[]): Promise<string | undefined> {
    return vscode.window.showInformationMessage(
      `$(info) ${message}`,
      ...actions
    );
  }

  /**
   * Suppress notifications of a specific type
   */
  suppressType(type: string): void {
    this.suppressedTypes.add(type);
    this.saveSuppressedTypes();
  }

  /**
   * Enable notifications of a specific type
   */
  enableType(type: string): void {
    this.suppressedTypes.delete(type);
    this.saveSuppressedTypes();
  }

  /**
   * Save suppressed types to storage
   */
  private saveSuppressedTypes(): void {
    this.context.globalState.update(
      'suppressedNotifications', 
      Array.from(this.suppressedTypes)
    );
  }

  /**
   * Clear all active notifications
   */
  clearAll(): void {
    this.activeNotifications.forEach(notification => {
      notification.dispose();
    });
    this.activeNotifications.clear();
  }

  /**
   * Handle suggestion notification result
   */
  private handleSuggestionResult(result: string | undefined, suggestionId: string): void {
    switch (result) {
      case 'View Suggestion':
      case 'View':
        vscode.commands.executeCommand('proactiveAssistant.openPanel');
        // Send message to panel to highlight this suggestion
        break;
      case 'Apply':
        vscode.commands.executeCommand('proactiveAssistant.applySuggestion', suggestionId);
        break;
      case 'Dismiss':
        vscode.commands.executeCommand('proactiveAssistant.dismissSuggestion', suggestionId);
        break;
    }
  }

  /**
   * Get icon for suggestion type
   */
  private getSuggestionIcon(type: string): string {
    switch (type) {
      case 'optimization':
      case 'performance':
        return '$(rocket)';
      case 'refactor':
        return '$(symbol-class)';
      case 'bugfix':
        return '$(bug)';
      case 'style':
        return '$(symbol-color)';
      default:
        return '$(lightbulb)';
    }
  }
}
