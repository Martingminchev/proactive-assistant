import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { ILogger, Suggestion, ActivityStats, FlowState, ActivityContext, ConnectionStatus } from '../types';
import { setActiveSuggestion } from '../commands/suggestionActions';

export type PanelViewState = 'welcome' | 'suggestions' | 'stats' | 'settings' | 'focus';

export interface AppState {
  view: PanelViewState;
  currentFile?: {
    path: string | null;
    name: string | null;
    duration: number;
  };
  suggestion?: Suggestion;
  stats?: ActivityStats;
  flowState?: FlowState;
  focusMode?: {
    active: boolean;
    timeRemaining?: number;
  };
  isPiecesConnected?: boolean;
}

export interface WebviewMessage {
  command?: string;
  type?: string;
  requestId?: string;
  [key: string]: unknown;
}

export class PanelProvider implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly logger: ILogger;
  private readonly extensionUri: vscode.Uri;
  private currentView: PanelViewState = 'welcome';
  private disposables: vscode.Disposable[] = [];
  private currentSuggestion: Suggestion | undefined;
  private currentContext: ActivityContext | undefined;
  private piecesConnectionStatus: ConnectionStatus = 'disconnected';

  constructor(extensionUri: vscode.Uri, logger: ILogger) {
    if (!extensionUri) {
      throw new Error('extensionUri is required for PanelProvider');
    }
    this.extensionUri = extensionUri;
    this.logger = logger;
  }

  /**
   * Update the Pieces OS connection status
   */
  updatePiecesConnectionStatus(status: ConnectionStatus): void {
    this.logger.debug(`PanelProvider: Pieces OS status updated to '${status}'`);
    this.piecesConnectionStatus = status;
    // Send updated status to webview if panel is visible
    if (this.panel) {
      this.sendStateToWebview();
    }
  }

  show(view: PanelViewState = 'welcome'): vscode.WebviewPanel {
    this.logger.info(`PanelProvider.show() called with view: ${view}`);
    
    if (this.panel) {
      this.logger.info('Panel already exists, revealing...');
      this.panel.reveal(vscode.ViewColumn.Beside);
      this.currentView = view;
      this.sendStateToWebview();
      this.logger.info(`Panel revealed successfully, view: ${view}`);
      return this.panel;
    }

    this.logger.info('Creating new webview panel...');
    this.logger.info(`Extension URI: ${this.extensionUri?.fsPath}`);
    
    this.panel = vscode.window.createWebviewPanel(
      'proactiveAssistant',
      'Proactive Assistant',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        enableCommandUris: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'out', 'webview'),
          vscode.Uri.joinPath(this.extensionUri, 'resources'),
        ],
      }
    );

    this.currentView = view;
    this.panel.webview.html = this.getWebviewContent(this.panel.webview);
    this.setupMessageHandling();
    this.panel.onDidDispose(() => { 
      this.logger.info('Panel disposed');
      this.panel = undefined; 
    }, null, this.disposables);
    this.logger.info('New panel created successfully');
    return this.panel;
  }

  toggle(view: PanelViewState = 'welcome'): vscode.WebviewPanel | undefined {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
      return undefined;
    }
    return this.show(view);
  }

  hide(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }

  isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  exists(): boolean {
    return this.panel !== undefined;
  }

  switchView(view: PanelViewState): void {
    if (!this.panel) {
      this.show(view);
      return;
    }

    this.currentView = view;
    this.sendStateToWebview();
    this.logger.debug(`Switched to view: ${view}`);
  }

  showSuggestion(suggestion: Suggestion): void {
    this.currentSuggestion = suggestion;
    setActiveSuggestion(suggestion); // Set as active for command handlers
    
    if (!this.panel) {
      this.show('suggestions');
    } else {
      this.currentView = 'suggestions';
      this.sendStateToWebview();
    }
    
    // ALSO send the suggestion in the format the webview expects
    this.sendSuggestionToWebview(suggestion);
  }

  updateSuggestion(suggestion: Suggestion): void {
    this.currentSuggestion = suggestion;
    setActiveSuggestion(suggestion); // Set as active for command handlers
    
    if (this.panel) {
      this.currentView = 'suggestions';
      this.sendStateToWebview();
    }
    
    // ALSO send the suggestion in the format the webview expects
    this.sendSuggestionToWebview(suggestion);
  }
  
  /**
   * Send suggestion to webview in the format it expects
   */
  private sendSuggestionToWebview(suggestion: Suggestion): void {
    if (!this.panel) {
      return;
    }
    
    // Map extension Suggestion to webview Suggestion format
    const webviewSuggestion = this.mapToWebviewSuggestion(suggestion);
    
    this.logger.info(`[PanelProvider] Sending suggestions message to webview:`, JSON.stringify(webviewSuggestion));
    
    this.panel.webview.postMessage({
      type: 'suggestions',
      payload: [webviewSuggestion], // Send as array
    });
  }
  
  /**
   * Map extension Suggestion type to webview Suggestion type
   */
  private mapToWebviewSuggestion(suggestion: Suggestion): unknown {
    // Map priority to type
    let type: 'error' | 'warning' | 'tip' | 'celebration';
    switch (suggestion.priority) {
      case 'urgent':
      case 'high':
        type = 'error';
        break;
      case 'medium':
        type = 'warning';
        break;
      case 'low':
      default:
        type = 'tip';
        break;
    }
    
    // If category indicates celebration, use that type
    if (suggestion.category === 'celebration') {
      type = 'celebration';
    }
    
    // Get message content from description field (extension Suggestion uses 'description',
    // webview Suggestion uses 'message')
    const message = suggestion.description?.trim() || 'No details provided';
    
    return {
      id: suggestion.id,
      type: type,
      title: suggestion.title?.trim() || 'Suggestion',
      message: message,
      code: suggestion.context?.content || '',
      language: suggestion.context?.language || '',
      confidence: suggestion.confidence ?? 0.8,
      filePath: suggestion.context?.file,
      lineNumber: suggestion.context?.line,
      timestamp: suggestion.timestamp instanceof Date ? suggestion.timestamp.getTime() : Date.now(),
      actions: suggestion.actions.map(action => ({
        id: action.id,
        label: action.label,
        type: action.type === 'apply' ? 'apply' : 
              action.type === 'dismiss' ? 'dismiss' : 
              action.type === 'show' ? 'view' : 'snooze'
      }))
    };
  }

  showStats(stats: ActivityStats): void {
    if (!this.panel) {
      this.show('stats');
    } else {
      this.currentView = 'stats';
      this.sendStateToWebview({ stats });
    }
  }

  updateContext(context: ActivityContext): void {
    this.currentContext = context;
    this.sendStateToWebview();
  }

  sendStateToWebview(extraState: Partial<AppState> = {}): void {
    if (!this.panel) {
      this.logger.debug('[PanelProvider] Cannot send state - panel not initialized');
      return;
    }

    const state: AppState = {
      view: this.currentView,
      currentFile: {
        path: this.currentContext?.file ?? null,
        name: this.currentContext?.file ? path.basename(this.currentContext.file) : null,
        duration: this.currentContext?.duration ?? 0,
      },
      suggestion: this.currentSuggestion,
      flowState: this.currentContext ? this.inferFlowState(this.currentContext) : undefined,
      isPiecesConnected: this.piecesConnectionStatus === 'connected',
      ...extraState,
    };

    this.logger.info(`[PanelProvider] Sending stateUpdate to webview:`, JSON.stringify(state));
    
    const success1 = this.panel.webview.postMessage({
      type: 'stateUpdate',
      payload: state,
    });
    
    this.logger.info(`[PanelProvider] postMessage (stateUpdate) result: ${success1}`);

    // ALSO send 'status' message in the format CurrentStatus component expects
    // This is critical for the Activity Monitor to show file/activity info
    const statusPayload = {
      watchedFile: this.currentContext?.file ?? null,
      activityDuration: this.currentContext?.duration ? Math.floor(this.currentContext.duration / 1000) : 0,
      flowState: this.mapFlowStateToWebview(this.currentContext ? this.inferFlowState(this.currentContext) : 'idle'),
      isPiecesConnected: this.piecesConnectionStatus === 'connected',
      lastActivityAt: this.currentContext?.capturedAt?.getTime() ?? Date.now(),
    };
    
    this.logger.info(`[PanelProvider] Sending status to webview:`, JSON.stringify(statusPayload));
    
    const success2 = this.panel.webview.postMessage({
      type: 'status',
      payload: statusPayload,
    });
    
    this.logger.info(`[PanelProvider] postMessage (status) result: ${success2}`);
  }

  updateCurrentFile(filePath: string | null, duration?: number): void {
    if (this.currentContext) {
      this.currentContext.file = filePath ?? undefined;
      this.currentContext.duration = duration ?? 0;
    } else {
      this.currentContext = {
        file: filePath ?? undefined,
        duration: duration ?? 0,
        capturedAt: new Date(),
      };
    }
    this.sendStateToWebview();
  }

  updateSuggestionStatus(id: string, status: 'pending' | 'accepted' | 'dismissed' | 'applied'): void {
    if (this.currentSuggestion?.id === id) {
      // Send status update to webview
      this.panel?.webview.postMessage({
        type: 'suggestionStatus',
        payload: { id, status },
      });
    }
  }

  /**
   * Clear the current suggestion from panel state
   * Called when suggestion is dismissed
   */
  clearSuggestion(id?: string): void {
    // Only clear if id matches (or if no id provided, clear anyway)
    if (!id || this.currentSuggestion?.id === id) {
      this.logger.info(`[PanelProvider] Clearing suggestion: ${this.currentSuggestion?.id}`);
      this.currentSuggestion = undefined;
      
      // Notify webview to clear suggestions
      this.panel?.webview.postMessage({
        type: 'suggestions',
        payload: [], // Send empty array to clear
      });
      
      // Also send state update
      this.sendStateToWebview();
    }
  }

  updateFocusMode(active: boolean, timeRemaining?: number): void {
    this.panel?.webview.postMessage({
      type: 'focusMode',
      payload: { active, timeRemaining },
    });
  }

  updateStats(stats: {
    suggestionsAccepted: number;
    suggestionsDismissed: number;
    timeInFocusMode: number;
    linesOptimized: number;
    currentStreak: number;
  }): void {
    this.panel?.webview.postMessage({
      type: 'stats',
      payload: stats,
    });
  }

  showCelebration(type: 'streak' | 'milestone' | 'achievement', message: string): void {
    this.panel?.webview.postMessage({
      type: 'celebration',
      payload: { type, message },
    });
  }

  reveal(): void {
    this.panel?.reveal(vscode.ViewColumn.Beside);
  }

  private getWebviewContent(webview: vscode.Webview): string {
    this.logger.info('Loading webview content...');
    const webviewPath = vscode.Uri.joinPath(this.extensionUri, 'out', 'webview');
    const indexPath = vscode.Uri.joinPath(webviewPath, 'index.html');
    
    this.logger.info(`Webview path: ${webviewPath.fsPath}`);
    this.logger.info(`Index path: ${indexPath.fsPath}`);

    try {
      // Read the built index.html
      let html = fs.readFileSync(indexPath.fsPath, 'utf8');

      // Replace resource paths with webview.asWebviewUri
      html = html.replace(
        /(href|src)="(.+?)"/g,
        (match, attr, resourcePath) => {
          // Skip external URLs
          if (resourcePath.startsWith('http') || resourcePath.startsWith('//')) {
            return match;
          }

          // Create resource URI and convert to webview URI
          const resource = vscode.Uri.joinPath(webviewPath, resourcePath);
          const uri = webview.asWebviewUri(resource);
          return `${attr}="${uri}"`;
        }
      );

      // Remove the original CSP meta tag (it has wrong scheme)
      html = html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        ''
      );

      // Inject VS Code API acquisition script
      const nonce = this.getNonce();
      html = html.replace(
        '<head>',
        `<head>
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      script-src ${webview.cspSource} 'nonce-${nonce}';
      style-src ${webview.cspSource} 'unsafe-inline';
      font-src ${webview.cspSource};
      img-src ${webview.cspSource} https: data:;
      connect-src 'none';
    ">`
      );

      // Add nonce to script tags
      html = html.replace(/<script/g, `<script nonce="${nonce}"`);

      this.logger.info('Webview content loaded successfully');
      return html;
    } catch (error) {
      this.logger.error('Failed to load webview content', error as Error);
      this.logger.error(`Index file path attempted: ${indexPath.fsPath}`);
      this.logger.error(`Extension URI: ${this.extensionUri?.fsPath}`);
      return this.getErrorHtml('Failed to load React app. Please rebuild the webview.');
    }
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proactive Assistant - Error</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      text-align: center;
    }
    .error {
      color: var(--vscode-errorForeground);
      margin: 20px 0;
    }
    code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <h1>⚠️ Error Loading Proactive Assistant</h1>
  <p class="error">${message}</p>
  <p>Run <code>npm run build:webview</code> to build the webview React app.</p>
</body>
</html>`;
  }

  private setupMessageHandling(): void {
    if (!this.panel) return;

    this.panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        // Support both 'type' and 'command' properties for compatibility
        const msgType = message.type || message.command;
        if (!msgType) {
          this.logger.warn('[PanelProvider] Received message without type or command');
          return;
        }
        
        this.logger.info(`[PanelProvider] Received message from webview: ${msgType}`);
        this.logger.debug(`[PanelProvider] Full message: ${JSON.stringify(message)}`);

        try {
          switch (msgType) {
            case 'applySuggestion':
              await this.handleApplySuggestion(message.suggestionId as string);
              break;

            case 'dismissSuggestion':
              await this.handleDismissSuggestion(
                message.suggestionId as string,
                message.reason as string | undefined
              );
              break;

            case 'snoozeSuggestion':
              await this.handleSnoozeSuggestion(message.duration as number);
              break;

            case 'enableFocusMode':
              await this.handleEnableFocusMode(message.duration as number | undefined);
              break;

            case 'disableFocusMode':
              await this.handleDisableFocusMode();
              break;

            case 'openSettings':
              await vscode.commands.executeCommand('proactiveAssistant.configure');
              break;

            case 'showStats':
              await vscode.commands.executeCommand('proactiveAssistant.showStats');
              break;

            case 'getCurrentState':
              this.sendStateToWebview();
              break;

            case 'acceptSuggestion':
              await this.handleAcceptSuggestion(message.id as string);
              break;

            case 'viewSuggestion':
              await this.handleViewSuggestion(message.id as string);
              break;

            case 'toggleFocusMode':
              await vscode.commands.executeCommand('proactiveAssistant.toggleFocusMode');
              break;

            case 'ready':
            case 'panelReady':
              // Webview is ready, send initial state
              this.logger.info('[PanelProvider] Webview is ready, sending initial state');
              // Send both the status response and trigger state updates
              this.panel?.webview.postMessage({
                type: 'status',
                requestId: message.requestId,
                payload: {
                  watchedFile: this.currentContext?.file ?? null,
                  activityDuration: Math.floor((this.currentContext?.duration ?? 0) / 1000),
                  flowState: this.mapFlowStateToWebview(this.currentContext ? this.inferFlowState(this.currentContext) : 'idle'),
                  isPiecesConnected: this.piecesConnectionStatus === 'connected',
                  lastActivityAt: Date.now(),
                },
              });
              this.sendStateToWebview();
              break;

            case 'request-status': {
              this.logger.info(`[PanelProvider] Handling request-status, requestId: ${message.requestId}`);
              
              // Get file path for display
              const filePath = this.currentContext?.file ?? null;
              const durationMs = this.currentContext?.duration ?? 0;
              const durationSeconds = Math.floor(durationMs / 1000);
              
              // Map extension FlowState to webview FlowState
              const extFlowState = this.currentContext ? this.inferFlowState(this.currentContext) : 'idle';
              const webviewFlowState = this.mapFlowStateToWebview(extFlowState);
              
              this.logger.info(`[PanelProvider] Sending status: file=${filePath}, duration=${durationSeconds}s, flowState=${webviewFlowState}`);
              
              this.panel?.webview.postMessage({
                type: 'status',
                requestId: message.requestId,
                payload: {
                  watchedFile: filePath,
                  activityDuration: durationSeconds,
                  flowState: webviewFlowState,
                  isPiecesConnected: this.piecesConnectionStatus === 'connected',
                  lastActivityAt: Date.now(),
                },
              });
              break;
            }

            case 'request-stats':
              this.panel?.webview.postMessage({
                type: 'stats',
                requestId: message.requestId,
                payload: await this.getStats(),
              });
              break;

            case 'request-settings':
              this.panel?.webview.postMessage({
                type: 'settings',
                requestId: message.requestId,
                payload: await this.getSettings(),
              });
              break;

            default:
              this.logger.warn(`Unknown message command: ${msgType}`);
          }
        } catch (error) {
          this.logger.error(
            `Error handling message ${msgType}`,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      },
      undefined,
      this.disposables
    );
  }

  private async handleApplySuggestion(suggestionId: string): Promise<void> {
    // Validate the suggestion ID matches the current suggestion
    if (this.currentSuggestion?.id === suggestionId) {
      // Set as active suggestion so applyFix can use it
      const { setActiveSuggestion } = await import('../commands/suggestionActions');
      setActiveSuggestion(this.currentSuggestion);
      
      // Execute command without passing suggestion - let applyFix use active suggestion
      await vscode.commands.executeCommand('proactiveAssistant.applyFix');
    }
  }

  private async handleDismissSuggestion(
    suggestionId: string,
    reason?: string
  ): Promise<void> {
    await vscode.commands.executeCommand(
      'proactiveAssistant.dismissSuggestion',
      suggestionId,
      reason
    );
    
    // Also clear from panel state (in case dismissSuggestion doesn't clear it)
    this.clearSuggestion(suggestionId);
  }

  private async handleSnoozeSuggestion(duration: number): Promise<void> {
    await vscode.commands.executeCommand(
      'proactiveAssistant.snoozeSuggestion',
      duration
    );
  }

  private async handleEnableFocusMode(duration?: number): Promise<void> {
    await vscode.commands.executeCommand('proactiveAssistant.toggleFocusMode', duration);
  }

  private async handleDisableFocusMode(): Promise<void> {
    await vscode.commands.executeCommand('proactiveAssistant.toggleFocusMode');
  }

  private async handleAcceptSuggestion(id: string): Promise<void> {
    await vscode.commands.executeCommand('proactiveAssistant.acceptSuggestion', id);
  }

  private async handleViewSuggestion(id: string): Promise<void> {
    // Navigate to the file and position of the suggestion
    if (this.currentSuggestion?.id === id) {
      const context = this.currentSuggestion.context;
      if (context?.file) {
        const document = await vscode.workspace.openTextDocument(context.file);
        const editor = await vscode.window.showTextDocument(document);
        if (context.line) {
          const position = new vscode.Position(context.line - 1, context.column ?? 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
          );
        }
      }
    }
  }

  private async getStats(): Promise<Record<string, unknown>> {
    // Get stats from storage if available, otherwise return default stats
    // Note: In a real implementation, we would inject storageManager via constructor
    // For now, return default stats
    return {
      suggestionsAccepted: 0,
      suggestionsDismissed: 0,
      timeInFocusMode: 0,
      linesOptimized: 0,
      currentStreak: 0,
    };
  }

  private async getSettings(): Promise<Record<string, unknown>> {
    // Get settings from storage if available, otherwise return default settings
    // Note: In a real implementation, we would inject storageManager via constructor
    // For now, return default settings
    return {
      enabled: true,
      focusMode: false,
      quietHours: { enabled: false, start: '22:00', end: '08:00' },
      interruptionThreshold: 3,
      snoozeDuration: 30,
      piecesOs: { enabled: true, host: 'localhost', port: 39300 },
      logging: { level: 'info' },
      activityTracking: { enabled: true, sampleInterval: 30000 },
    };
  }

  private inferFlowState(context: ActivityContext): FlowState {
    // Simple heuristic - can be enhanced with ML models
    if (context.errors && context.errors.length > 3) {
      return 'frustrated';
    }
    if (context.duration && context.duration > 30 * 60 * 1000) {
      return 'deep_flow';
    }
    if (!context.file) {
      return 'idle';
    }
    return 'working';
  }

  private mapFlowStateToWebview(flowState: FlowState): 'deep' | 'focused' | 'scattered' | 'idle' {
    // Map extension FlowState to webview FlowState
    switch (flowState) {
      case 'deep_flow':
        return 'deep';
      case 'working':
      case 'stuck':
        return 'focused';
      case 'frustrated':
        return 'scattered';
      case 'idle':
      default:
        return 'idle';
    }
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  dispose(): void {
    this.hide();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
