import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Message types for webview communication
 */
export interface WebviewMessage {
  type: string;
  payload?: any;
}

export interface ExtensionMessage {
  type: string;
  payload?: any;
}

/**
 * Manages the webview panel for the Proactive AI Assistant
 */
export class AssistantPanel {
  public static readonly viewType = 'proactiveAssistant.panel';
  private static currentPanel: AssistantPanel | undefined;
  
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private messageHandlers: Map<string, ((payload: any) => void)[]> = new Map();

  /**
   * Create or show the assistant panel
   */
  public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext): AssistantPanel {
    const column = vscode.ViewColumn.Beside;

    // If panel exists, reveal it
    if (AssistantPanel.currentPanel) {
      AssistantPanel.currentPanel.panel.reveal(column);
      return AssistantPanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      AssistantPanel.viewType,
      'Proactive AI Assistant',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview', 'dist'),
          vscode.Uri.joinPath(extensionUri, 'media'),
        ],
      }
    );

    AssistantPanel.currentPanel = new AssistantPanel(panel, extensionUri, context);
    return AssistantPanel.currentPanel;
  }

  /**
   * Get the current panel instance if it exists
   */
  public static getCurrentPanel(): AssistantPanel | undefined {
    return AssistantPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private extensionUri: vscode.Uri,
    private context: vscode.ExtensionContext
  ) {
    this.panel = panel;

    // Set initial HTML content
    this.updateWebview();

    // Handle panel close
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        this.handleWebviewMessage(message);
      },
      null,
      this.disposables
    );

    // Update webview when visible
    this.panel.onDidChangeViewState(
      () => {
        if (this.panel.visible) {
          this.sendMessage('panelVisible', { visible: true });
        }
      },
      null,
      this.disposables
    );
  }

  /**
   * Generate and set the HTML content for the webview
   */
  private updateWebview(): void {
    const webview = this.panel.webview;
    webview.html = this.getHtmlForWebview(webview);
  }

  /**
   * Generate HTML content with VS Code theme integration
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'assets', 'index.css')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    // Get current VS Code theme
    const theme = this.getCurrentTheme();

    // Generate nonce for security
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      script-src 'nonce-${nonce}';
      style-src ${webview.cspSource} 'unsafe-inline';
      font-src ${webview.cspSource};
      img-src ${webview.cspSource} https: data:;
      connect-src 'none';
    ">
    <title>Proactive AI Assistant</title>
    <link rel="stylesheet" href="${codiconsUri}">
    <link rel="stylesheet" href="${styleUri}">
</head>
<body data-theme="${theme}">
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Determine current VS Code theme
   */
  private getCurrentTheme(): 'vs-dark' | 'vs-light' | 'hc-dark' | 'hc-light' {
    const theme = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') || '';
    
    if (theme.includes('High Contrast')) {
      return theme.includes('Light') ? 'hc-light' : 'hc-dark';
    }
    
    // Check editor background to determine if dark
    const isDark = vscode.window.activeColorTheme?.kind === vscode.ColorThemeKind.Dark;
    return isDark ? 'vs-dark' : 'vs-light';
  }

  /**
   * Generate a random nonce string
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Handle incoming messages from the webview
   */
  private handleWebviewMessage(message: WebviewMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.payload));
    }
  }

  /**
   * Register a handler for a specific message type from webview
   */
  onMessage(type: string, handler: (payload: any) => void): vscode.Disposable {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);

    return {
      dispose: () => {
        const handlers = this.messageHandlers.get(type);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      }
    };
  }

  /**
   * Send a message to the webview
   */
  sendMessage(type: string, payload?: any): void {
    if (this.panel.visible) {
      this.panel.webview.postMessage({ type, payload });
    }
  }

  /**
   * Update current file being watched
   */
  updateCurrentFile(filePath: string | null, duration?: number): void {
    this.sendMessage('currentFile', {
      path: filePath,
      name: filePath ? path.basename(filePath) : null,
      duration: duration || 0,
    });
  }

  /**
   * Add a suggestion to the panel
   */
  addSuggestion(suggestion: {
    id: string;
    type: 'optimization' | 'refactor' | 'bugfix' | 'style';
    title: string;
    description: string;
    code?: string;
    fileName?: string;
    lineNumber?: number;
    confidence: number;
  }): void {
    this.sendMessage('newSuggestion', suggestion);
  }

  /**
   * Update suggestion status
   */
  updateSuggestionStatus(id: string, status: 'pending' | 'accepted' | 'dismissed' | 'applied'): void {
    this.sendMessage('suggestionStatus', { id, status });
  }

  /**
   * Update focus mode state
   */
  updateFocusMode(active: boolean, timeRemaining?: number): void {
    this.sendMessage('focusMode', { active, timeRemaining });
  }

  /**
   * Update user statistics
   */
  updateStats(stats: {
    suggestionsAccepted: number;
    suggestionsDismissed: number;
    timeInFocusMode: number;
    linesOptimized: number;
    currentStreak: number;
  }): void {
    this.sendMessage('stats', stats);
  }

  /**
   * Trigger celebration animation
   */
  showCelebration(type: 'streak' | 'milestone' | 'achievement', message: string): void {
    this.sendMessage('celebration', { type, message });
  }

  /**
   * Reveal the panel
   */
  reveal(): void {
    this.panel.reveal(vscode.ViewColumn.Beside);
  }

  /**
   * Check if panel is visible
   */
  isVisible(): boolean {
    return this.panel.visible;
  }

  /**
   * Dispose of panel resources
   */
  dispose(): void {
    AssistantPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.messageHandlers.clear();
  }
}
