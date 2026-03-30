import * as vscode from 'vscode';

/**
 * Inline suggestion decoration types
 */
export interface InlineSuggestion {
  id: string;
  lineNumber: number;
  type: 'optimization' | 'refactor' | 'bugfix' | 'style';
  title: string;
  description: string;
  originalCode?: string;
  suggestedCode?: string;
  confidence: number;
}

/**
 * Manages inline decorations and code lens for suggestions
 */
export class InlineDecorator {
  private decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
  private codeLensProvider: vscode.Disposable | null = null;
  private activeSuggestions: Map<string, InlineSuggestion> = new Map();
  private hoverProvider: vscode.Disposable | null = null;
  private readonly fileSuggestions: Map<string, Set<string>> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    this.initializeDecorations();
    this.registerCodeLensProvider();
    this.registerHoverProvider();
  }

  /**
   * Initialize all decoration types
   */
  private initializeDecorations(): void {
    // Optimization decoration - greenish glow
    this.decorationTypes.set('optimization', vscode.window.createTextEditorDecorationType({
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.infoForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: {
        before: {
          contentText: '🚀',
          margin: '0 0 0 10px',
        },
      },
      dark: {
        before: {
          contentText: '🚀',
          margin: '0 0 0 10px',
        },
      },
    }));

    // Refactor decoration - blue
    this.decorationTypes.set('refactor', vscode.window.createTextEditorDecorationType({
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.warningForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: {
        before: {
          contentText: '♻️',
          margin: '0 0 0 10px',
        },
      },
      dark: {
        before: {
          contentText: '♻️',
          margin: '0 0 0 10px',
        },
      },
    }));

    // Bugfix decoration - red
    this.decorationTypes.set('bugfix', vscode.window.createTextEditorDecorationType({
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.errorForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: {
        before: {
          contentText: '🐛',
          margin: '0 0 0 10px',
        },
      },
      dark: {
        before: {
          contentText: '🐛',
          margin: '0 0 0 10px',
        },
      },
    }));

    // Style decoration - yellow
    this.decorationTypes.set('style', vscode.window.createTextEditorDecorationType({
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.warningForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: {
        before: {
          contentText: '🎨',
          margin: '0 0 0 10px',
        },
      },
      dark: {
        before: {
          contentText: '🎨',
          margin: '0 0 0 10px',
        },
      },
    }));

    // Highlight decoration - for showing the specific code block
    this.decorationTypes.set('highlight', vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
      borderColor: new vscode.ThemeColor('editor.findMatchHighlightBorder'),
      borderStyle: 'solid',
      borderWidth: '1px',
      isWholeLine: false,
    }));
  }

  /**
   * Register code lens provider for inline actions
   */
  private registerCodeLensProvider(): void {
    this.codeLensProvider = vscode.languages.registerCodeLensProvider(
      { pattern: '**/*' },
      {
        provideCodeLenses: (document) => {
          const filePath = document.uri.toString();
          const suggestionIds = this.fileSuggestions.get(filePath);
          
          if (!suggestionIds) return [];

          const lenses: vscode.CodeLens[] = [];
          
          suggestionIds.forEach(id => {
            const suggestion = this.activeSuggestions.get(id);
            if (suggestion) {
              const range = new vscode.Range(
                new vscode.Position(suggestion.lineNumber - 1, 0),
                new vscode.Position(suggestion.lineNumber - 1, 0)
              );

              const lens = new vscode.CodeLens(range, {
                title: `$(lightbulb) ${suggestion.title}`,
                command: 'proactiveAssistant.showSuggestionDetail',
                arguments: [suggestion.id],
              });
              
              lenses.push(lens);

              // Add accept/dismiss actions
              const actionLens = new vscode.CodeLens(range, {
                title: '$(check) Accept',
                command: 'proactiveAssistant.applySuggestion',
                arguments: [suggestion.id],
              });
              lenses.push(actionLens);
            }
          });

          return lenses;
        },
      }
    );
  }

  /**
   * Register hover provider for showing suggestion details
   */
  private registerHoverProvider(): void {
    this.hoverProvider = vscode.languages.registerHoverProvider(
      { pattern: '**/*' },
      {
        provideHover: (document, position) => {
          const filePath = document.uri.toString();
          const suggestionIds = this.fileSuggestions.get(filePath);
          
          if (!suggestionIds) return null;

          for (const id of suggestionIds) {
            const suggestion = this.activeSuggestions.get(id);
            if (suggestion && suggestion.lineNumber === position.line + 1) {
              const hoverContent = new vscode.MarkdownString();
              hoverContent.isTrusted = true;
              hoverContent.supportHtml = true;

              const icon = this.getIconForType(suggestion.type);
              hoverContent.appendMarkdown(`### ${icon} ${suggestion.title}\n\n`);
              hoverContent.appendMarkdown(`${suggestion.description}\n\n`);
              
              if (suggestion.confidence) {
                const confidenceEmoji = suggestion.confidence > 0.9 ? '🟢' : 
                                       suggestion.confidence > 0.7 ? '🟡' : '🟠';
                hoverContent.appendMarkdown(`**Confidence:** ${confidenceEmoji} ${Math.round(suggestion.confidence * 100)}%\n\n`);
              }

              hoverContent.appendMarkdown(`---\n`);
              hoverContent.appendMarkdown(`[View Details](command:proactiveAssistant.showSuggestionDetail?"${suggestion.id}") | `);
              hoverContent.appendMarkdown(`[Apply](command:proactiveAssistant.applySuggestion?"${suggestion.id}") | `);
              hoverContent.appendMarkdown(`[Dismiss](command:proactiveAssistant.dismissSuggestion?"${suggestion.id}")`);

              return new vscode.Hover(
                hoverContent,
                new vscode.Range(
                  new vscode.Position(suggestion.lineNumber - 1, 0),
                  new vscode.Position(suggestion.lineNumber - 1, Number.MAX_SAFE_INTEGER)
                )
              );
            }
          }

          return null;
        },
      }
    );
  }

  /**
   * Add an inline suggestion decoration
   */
  addSuggestion(editor: vscode.TextEditor, suggestion: InlineSuggestion): void {
    const filePath = editor.document.uri.toString();
    
    // Store suggestion
    this.activeSuggestions.set(suggestion.id, suggestion);
    
    // Track by file
    if (!this.fileSuggestions.has(filePath)) {
      this.fileSuggestions.set(filePath, new Set());
    }
    this.fileSuggestions.get(filePath)!.add(suggestion.id);

    // Apply decoration
    const decorationType = this.decorationTypes.get(suggestion.type);
    if (!decorationType) return;

    const lineIndex = suggestion.lineNumber - 1;
    const line = editor.document.lineAt(lineIndex);
    
    const range = new vscode.Range(
      new vscode.Position(lineIndex, 0),
      new vscode.Position(lineIndex, line.text.length)
    );

    editor.setDecorations(decorationType, [{ range }]);

    // Add highlight decoration for the specific line
    const highlightDecoration = this.decorationTypes.get('highlight');
    if (highlightDecoration) {
      editor.setDecorations(highlightDecoration, [{ range }]);
    }

    // Trigger code lens refresh
    this.refreshCodeLens();
  }

  /**
   * Remove a specific suggestion decoration
   */
  removeSuggestion(editor: vscode.TextEditor, suggestionId: string): void {
    const suggestion = this.activeSuggestions.get(suggestionId);
    if (!suggestion) return;

    const filePath = editor.document.uri.toString();
    const decorationType = this.decorationTypes.get(suggestion.type);
    
    if (decorationType) {
      editor.setDecorations(decorationType, []);
    }

    // Clean up tracking
    this.activeSuggestions.delete(suggestionId);
    this.fileSuggestions.get(filePath)?.delete(suggestionId);

    this.refreshCodeLens();
  }

  /**
   * Clear all decorations for a file
   */
  clearFile(filePath: string): void {
    const suggestionIds = this.fileSuggestions.get(filePath);
    if (suggestionIds) {
      suggestionIds.forEach(id => {
        this.activeSuggestions.delete(id);
      });
      this.fileSuggestions.delete(filePath);
    }

    // Refresh code lens
    this.refreshCodeLens();
  }

  /**
   * Clear all decorations
   */
  clearAll(): void {
    // Clear all decoration types from all editors
    vscode.window.visibleTextEditors.forEach(editor => {
      this.decorationTypes.forEach(decorationType => {
        editor.setDecorations(decorationType, []);
      });
    });

    this.activeSuggestions.clear();
    this.fileSuggestions.clear();
    this.refreshCodeLens();
  }

  /**
   * Get active suggestion by ID
   */
  getSuggestion(id: string): InlineSuggestion | undefined {
    return this.activeSuggestions.get(id);
  }

  /**
   * Get all active suggestions for a file
   */
  getSuggestionsForFile(filePath: string): InlineSuggestion[] {
    const suggestionIds = this.fileSuggestions.get(filePath);
    if (!suggestionIds) return [];

    return Array.from(suggestionIds)
      .map(id => this.activeSuggestions.get(id))
      .filter((s): s is InlineSuggestion => s !== undefined);
  }

  /**
   * Highlight a specific line temporarily
   */
  highlightLine(editor: vscode.TextEditor, lineNumber: number, duration: number = 3000): void {
    const highlightDecoration = this.decorationTypes.get('highlight');
    if (!highlightDecoration) return;

    const range = new vscode.Range(
      new vscode.Position(lineNumber - 1, 0),
      new vscode.Position(lineNumber - 1, Number.MAX_SAFE_INTEGER)
    );

    editor.setDecorations(highlightDecoration, [{ range }]);

    // Remove highlight after duration
    setTimeout(() => {
      editor.setDecorations(highlightDecoration, []);
    }, duration);
  }

  /**
   * Refresh code lens
   */
  private refreshCodeLens(): void {
    // Trigger a refresh by updating the code lens provider
    this.codeLensProvider?.dispose();
    this.registerCodeLensProvider();
  }

  /**
   * Get icon for suggestion type
   */
  private getIconForType(type: string): string {
    switch (type) {
      case 'optimization':
        return '🚀';
      case 'refactor':
        return '♻️';
      case 'bugfix':
        return '🐛';
      case 'style':
        return '🎨';
      default:
        return '💡';
    }
  }

  /**
   * Dispose of all decorations and providers
   */
  dispose(): void {
    this.clearAll();
    this.decorationTypes.forEach(decoration => decoration.dispose());
    this.decorationTypes.clear();
    this.codeLensProvider?.dispose();
    this.hoverProvider?.dispose();
  }
}
