import * as vscode from 'vscode';
import { 
  ActivityContext, 
  Suggestion, 
  DiagnosticInfo,
  ILogger,
  ISuggestionProvider,
  SuggestionContext,
  UserSuggestionPreferences,
  Result,
  ok,
  err,
  SuggestionType
} from '../types';
import { SUGGESTION_ENGINE_CONFIG } from '../config/settings';
import { SUGGESTION_TEMPLATES, SuggestionTemplate } from './suggestionTemplates';

interface SuggestionEngineConfig {
  maxSuggestionLength: number;
  maxDescriptionLength: number;
  defaultTimeout: number;
  codeFixEnabled: boolean;
  aiEnhancementEnabled: boolean;
}

const DEFAULT_CONFIG: SuggestionEngineConfig = {
  maxSuggestionLength: SUGGESTION_ENGINE_CONFIG.MAX_SUGGESTION_LENGTH,
  maxDescriptionLength: SUGGESTION_ENGINE_CONFIG.MAX_DESCRIPTION_LENGTH,
  defaultTimeout: SUGGESTION_ENGINE_CONFIG.DEFAULT_TIMEOUT_MS,
  codeFixEnabled: SUGGESTION_ENGINE_CONFIG.CODE_FIX_ENABLED,
  aiEnhancementEnabled: SUGGESTION_ENGINE_CONFIG.AI_ENHANCEMENT_ENABLED,
};

export class SuggestionEngine implements ISuggestionProvider {
  public readonly name = 'SuggestionEngine';

  private config: SuggestionEngineConfig;
  private disposables: vscode.Disposable[] = [];
  private recentSuggestions: string[] = [];
  private userPreferences: UserSuggestionPreferences;
  private lastSuggestionTime: number = 0;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: ILogger,
    config?: Partial<SuggestionEngineConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Default preferences
    this.userPreferences = {
      preferredTypes: ['stuck', 'error_fix', 'wellness'],
      disabledTypes: [],
      maxSuggestionsPerHour: 10,
      preferredTone: 'casual'
    };

    this.logger.info('SuggestionEngine initialized');
  }

  async initialize(): Promise<void> {
    await this.loadPreferences();
  }

  private async loadPreferences(): Promise<void> {
    const prefs = this.context.globalState.get<UserSuggestionPreferences>('suggestionPreferences');
    if (prefs) {
      this.userPreferences = { ...this.userPreferences, ...prefs };
    }
  }

  async savePreferences(prefs: Partial<UserSuggestionPreferences>): Promise<void> {
    this.userPreferences = { ...this.userPreferences, ...prefs };
    await this.context.globalState.update('suggestionPreferences', this.userPreferences);
  }

  generateSuggestion(
    type: SuggestionType, 
    context: SuggestionContext
  ): Result<Suggestion> {
    try {
      // Check if type is disabled
      if (this.userPreferences.disabledTypes.includes(type)) {
        return err(new Error(`Suggestion type ${type} is disabled`));
      }

      // Get templates for this type
      const templates = SUGGESTION_TEMPLATES[type];
      if (!templates || templates.length === 0) {
        return err(new Error(`No templates found for type ${type}`));
      }

      // Select appropriate template based on context
      const template = this.selectTemplate(templates, context);
      if (!template) {
        return err(new Error('No suitable template found'));
      }

      // Generate suggestion
      const data = this.extractDataForTemplate(type, context);
      const suggestion = template(context.activityContext, data);

      if (!suggestion) {
        return err(new Error('Template returned null suggestion'));
      }

      // Enhance with user preferences
      this.enhanceSuggestion(suggestion);

      // Track suggestion
      this.trackSuggestion(suggestion.id);

      this.logger.debug('Generated suggestion', { 
        id: suggestion.id, 
        type, 
        priority: suggestion.priority 
      });

      return ok(suggestion);
    } catch (error) {
      this.logger.error('Failed to generate suggestion', error as Error);
      return err(error as Error);
    }
  }

  generateForFlowState(context: SuggestionContext): Result<Suggestion> {
    const type = this.selectSuggestionType(context);
    console.log(`[SuggestionEngine] Generating suggestion for flowState: ${context.flowState}, selected type: ${type}`);
    const result = this.generateSuggestion(type, context);
    if (result.success) {
      console.log(`[SuggestionEngine] Successfully generated suggestion: ${result.value.title}`);
    } else {
      console.log(`[SuggestionEngine] Failed to generate suggestion: ${result.error.message}`);
    }
    return result;
  }

  shouldSuggest(context: ActivityContext): boolean {
    // Check if suggestions are enabled
    const config = vscode.workspace.getConfiguration('proactiveAssistant');
    if (!config.get<boolean>('enabled', true)) {
      console.log('[SuggestionEngine] shouldSuggest: false - extension disabled');
      return false;
    }

    // Check rate limiting
    const now = Date.now();
    const timeSinceLast = now - this.lastSuggestionTime;
    const minInterval = SUGGESTION_ENGINE_CONFIG.RATE_LIMIT_INTERVAL_MS; // 30 minutes

    if (timeSinceLast < minInterval) {
      console.log(`[SuggestionEngine] shouldSuggest: false - rate limited (${Math.round((minInterval - timeSinceLast) / 60000)} min remaining)`);
      return false;
    }

    // Check if we have enough context
    if (!context.file && !context.language) {
      console.log('[SuggestionEngine] shouldSuggest: false - no file or language context');
      return false;
    }

    console.log('[SuggestionEngine] shouldSuggest: true');
    return true;
  }

  private selectSuggestionType(context: SuggestionContext): SuggestionType {
    const { flowState, activityContext } = context;

    // Priority based on flow state
    switch (flowState) {
      case 'stuck':
        return 'stuck';
      case 'frustrated':
        return activityContext.errors && activityContext.errors.length > 0 
          ? 'error_fix' 
          : 'stuck';
      case 'idle':
        // Check if we should suggest context recovery
        if (activityContext.previousFile) {
          return 'context_recovery';
        }
        return 'wellness';
      case 'deep_flow':
        // Minimal interruptions in deep flow
        return 'celebration';
      case 'working':
        // Normal suggestions
        if (activityContext.errors && activityContext.errors.length > 0) {
          return 'error_fix';
        }
        // Random productivity or learning
        return Math.random() > 0.7 ? 'productivity' : 'learning';
      default:
        return 'wellness';
    }
  }

  private selectTemplate(
    templates: SuggestionTemplate[], 
    context: SuggestionContext
  ): SuggestionTemplate | null {
    // Filter out recently used templates
    const available = templates.filter((_, index) => {
      const templateId = `${context.flowState}-${index}`;
      return !context.recentSuggestions.includes(templateId);
    });

    if (available.length === 0) {
      return templates[0] ?? null; // Fall back to first
    }

    // Random selection from available
    return available[Math.floor(Math.random() * available.length)] ?? null;
  }

  private extractDataForTemplate(
    type: SuggestionType, 
    context: SuggestionContext
  ): unknown {
    switch (type) {
      case 'stuck':
      case 'error_fix':
        return context.activityContext.errors;
      case 'wellness':
        return context.activityContext.duration;
      case 'celebration':
        // Would come from stats service
        return 3; // streak days
      default:
        return undefined;
    }
  }

  private enhanceSuggestion(suggestion: Suggestion): void {
    // Adjust tone based on preference
    switch (this.userPreferences.preferredTone) {
      case 'formal':
        suggestion.description = suggestion.description
          .replace(/!/g, '.')
          .replace(/🔥|🎉|💡|🧘|☕|👀|⚠️|🔄/g, '');
        break;
      case 'enthusiastic':
        if (!suggestion.title.includes('!')) {
          suggestion.title += '!';
        }
        break;
      case 'casual':
      default:
        // Keep as is
        break;
    }

    // Ensure title length
    if (suggestion.title.length > this.config.maxSuggestionLength) {
      suggestion.title = suggestion.title.slice(0, this.config.maxSuggestionLength - 3) + '...';
    }

    // Ensure description length
    if (suggestion.description.length > this.config.maxDescriptionLength) {
      suggestion.description = suggestion.description.slice(0, this.config.maxDescriptionLength - 3) + '...';
    }
  }

  async applyFix(suggestion: Suggestion): Promise<Result<void>> {
    try {
      if (!this.config.codeFixEnabled) {
        return err(new Error('Code fixes are disabled'));
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return err(new Error('No active editor'));
      }

      // Extract error info from payload
      const payload = suggestion.actions.find(a => a.id === 'apply')?.payload;
      if (!payload) {
        return err(new Error('No fix payload found'));
      }

      // Parse error info
      let errorInfo: DiagnosticInfo;
      try {
        errorInfo = JSON.parse(payload);
      } catch {
        return err(new Error('Invalid fix payload'));
      }

      this.logger.info('Applying fix', { error: errorInfo.message, line: errorInfo.line });

      // Try VS Code's built-in code actions first
      const codeActionResult = await this.tryApplyCodeAction(editor, errorInfo);
      if (codeActionResult.success) {
        await this.saveDocument(editor.document);
        return ok(undefined);
      }

      // Fall back to AI-based fix application
      const aiFixResult = await this.applyAIFix(editor, errorInfo);
      if (aiFixResult.success) {
        await this.saveDocument(editor.document);
        return ok(undefined);
      }

      return err(new Error(aiFixResult.error || 'Failed to apply fix'));
    } catch (error) {
      this.logger.error('Failed to apply fix', error as Error);
      return err(error as Error);
    }
  }

  private async tryApplyCodeAction(
    editor: vscode.TextEditor,
    errorInfo: DiagnosticInfo
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const document = editor.document;
      const errorLine = Math.max(0, errorInfo.line - 1); // Convert to 0-based
      const errorColumn = Math.max(0, errorInfo.column - 1);

      // Create a range around the error position
      const errorPosition = new vscode.Position(errorLine, errorColumn);
      const errorRange = new vscode.Range(
        errorPosition,
        errorPosition.translate(0, 1) // Extend by 1 character
      );

      // Get code actions from VS Code
      const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        document.uri,
        errorRange
      );

      if (!codeActions || codeActions.length === 0) {
        this.logger.debug('No built-in code actions available');
        return { success: false, error: 'No built-in code actions available' };
      }

      // Find the first fix action (usually the most relevant)
      const fixAction = codeActions.find(action => 
        action.kind?.value.includes('quickfix') || 
        action.kind?.value.includes('refactor') ||
        action.title.toLowerCase().includes('fix') ||
        action.title.toLowerCase().includes('import')
      ) ?? codeActions[0];

      if (!fixAction) {
        return { success: false, error: 'No suitable code action found' };
      }

      this.logger.info('Applying built-in code action', { title: fixAction.title });

      // Apply the code action
      if (fixAction.edit) {
        const success = await vscode.workspace.applyEdit(fixAction.edit);
        if (success) {
          this.logger.info('Built-in code action applied successfully');
          return { success: true };
        }
      }

      // Try to execute the command if available
      if (fixAction.command) {
        await vscode.commands.executeCommand(
          fixAction.command.command,
          ...(fixAction.command.arguments || [])
        );
        return { success: true };
      }

      return { success: false, error: 'Code action has no edit or command' };
    } catch (error) {
      this.logger.warn('Failed to apply built-in code action', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async applyAIFix(
    editor: vscode.TextEditor,
    errorInfo: DiagnosticInfo
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const document = editor.document;
      const language = document.languageId;

      // Determine fix type based on error message and context
      const fixType = this.detectFixType(errorInfo.message, language);
      
      this.logger.info('Applying AI-based fix', { type: fixType, message: errorInfo.message });

      switch (fixType) {
        case 'import':
          return await this.applyImportFix(editor, errorInfo, language);
        case 'syntax':
          return await this.applySyntaxFix(editor, errorInfo, language);
        case 'undefined_variable':
          return await this.applyUndefinedVariableFix(editor, errorInfo, language);
        case 'missing_semicolon':
          return await this.applyMissingSemicolonFix(editor, errorInfo);
        case 'type_error':
          return await this.applyTypeErrorFix(editor, errorInfo, language);
        default:
          return await this.applyGenericFix(editor, errorInfo);
      }
    } catch (error) {
      this.logger.error('Failed to apply AI fix', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  private detectFixType(errorMessage: string, _language: string): string {
    const msg = errorMessage.toLowerCase();
    
    // Import-related errors
    if (msg.includes('cannot find') || msg.includes('module') || 
        msg.includes('cannot resolve') || msg.includes('import') ||
        msg.includes("cannot find name '")) {
      return 'import';
    }

    // Undefined variable errors
    if (msg.includes('is not defined') || msg.includes('undefined') ||
        msg.includes('cannot find name') || msg.includes('undeclared')) {
      return 'undefined_variable';
    }

    // Missing semicolon
    if (msg.includes('semicolon') || msg.includes('expected') && msg.includes(';')) {
      return 'missing_semicolon';
    }

    // Type errors
    if (msg.includes('type') && (msg.includes('not assignable') || 
        msg.includes('incompatible') || msg.includes('expected'))) {
      return 'type_error';
    }

    // Syntax errors
    if (msg.includes('syntax') || msg.includes('unexpected') || 
        msg.includes('expected') || msg.includes('missing')) {
      return 'syntax';
    }

    return 'generic';
  }

  private async applyImportFix(
    editor: vscode.TextEditor,
    errorInfo: DiagnosticInfo,
    language: string
  ): Promise<{ success: boolean; error?: string }> {
    const document = editor.document;
    const text = document.getText();
    
    // Extract the missing module/identifier name from error message
    const moduleMatch = errorInfo.message.match(/["']([^"']+)["']/);
    const identifierMatch = errorInfo.message.match(/cannot find name ['"](\w+)['"]/i);
    const missingName = moduleMatch?.[1] || identifierMatch?.[1];

    if (!missingName) {
      return { success: false, error: 'Could not determine missing import' };
    }

    const edit = new vscode.WorkspaceEdit();

    // Find the best insertion point for import
    const lines = text.split('\n');
    let insertLine = 0;
    let lastImportLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (line.startsWith('import ') || line.startsWith('using ') || 
          line.startsWith('require(') || line.startsWith('#include')) {
        lastImportLine = i;
      }
      // Stop at first non-comment, non-import line
      if (lastImportLine >= 0 && line && !line.startsWith('//') && 
          !line.startsWith('/*') && !line.startsWith('*') && !line.startsWith('import')) {
        break;
      }
    }

    insertLine = lastImportLine >= 0 ? lastImportLine + 1 : 0;

    // Generate appropriate import statement based on language
    let importStatement = '';
    switch (language) {
      case 'typescript':
      case 'javascript': {
        // Check if it's likely a node module or local import
        const moduleName = missingName.split('/').pop() ?? missingName;
        if (missingName.includes('/') || missingName.startsWith('.')) {
          importStatement = `import { ${moduleName} } from '${missingName}';\n`;
        } else if (['fs', 'path', 'http', 'https', 'os', 'crypto'].includes(missingName)) {
          importStatement = `import ${missingName} from '${missingName}';\n`;
        } else {
          importStatement = `import { ${missingName} } from '${missingName.toLowerCase()}';\n`;
        }
        break;
      }
      case 'python':
        importStatement = `import ${missingName}\n`;
        break;
      case 'java':
        importStatement = `import ${missingName};\n`;
        break;
      case 'csharp':
      case 'c#':
        importStatement = `using ${missingName};\n`;
        break;
      case 'rust':
        importStatement = `use ${missingName};\n`;
        break;
      case 'go':
        importStatement = `import "${missingName}"\n`;
        break;
      default:
        importStatement = `// TODO: Add import for ${missingName}\n`;
    }

    edit.insert(document.uri, new vscode.Position(insertLine, 0), importStatement);
    
    const success = await vscode.workspace.applyEdit(edit);
    if (success) {
      this.logger.info('Import fix applied', { module: missingName, line: insertLine });
    }
    
    return { success, error: success ? undefined : 'Failed to apply import fix' };
  }

  private async applySyntaxFix(
    editor: vscode.TextEditor,
    errorInfo: DiagnosticInfo,
    _language: string
  ): Promise<{ success: boolean; error?: string }> {
    const document = editor.document;
    const errorLine = Math.max(0, errorInfo.line - 1);
    const lineText = document.lineAt(errorLine).text;
    const edit = new vscode.WorkspaceEdit();

    const msg = errorInfo.message.toLowerCase();

    // Handle specific syntax errors
    if (msg.includes('missing') && msg.includes(')')) {
      // Missing closing parenthesis
      edit.insert(document.uri, new vscode.Position(errorLine, lineText.length), ')');
    } else if (msg.includes('missing') && msg.includes('}')) {
      // Missing closing brace
      edit.insert(document.uri, new vscode.Position(errorLine, lineText.length), '}');
    } else if (msg.includes('missing') && msg.includes(']')) {
      // Missing closing bracket
      edit.insert(document.uri, new vscode.Position(errorLine, lineText.length), ']');
    } else if (msg.includes('missing') && msg.includes('"')) {
      // Missing closing quote
      edit.insert(document.uri, new vscode.Position(errorLine, lineText.length), '"');
    } else if (msg.includes('missing') && msg.includes("'")) {
      // Missing closing single quote
      edit.insert(document.uri, new vscode.Position(errorLine, lineText.length), "'");
    } else if (msg.includes('unexpected') && msg.includes('token')) {
      // Generic unexpected token - try to identify and remove
      const match = lineText.match(/\s+([)}\];,])/);
      if (match && match[1]) {
        const idx = lineText.indexOf(match[1]);
        edit.delete(document.uri, new vscode.Range(
          new vscode.Position(errorLine, idx),
          new vscode.Position(errorLine, idx + 1)
        ));
      }
    } else {
      return { success: false, error: 'Unrecognized syntax error pattern' };
    }

    const success = await vscode.workspace.applyEdit(edit);
    return { success, error: success ? undefined : 'Failed to apply syntax fix' };
  }

  private async applyUndefinedVariableFix(
    editor: vscode.TextEditor,
    errorInfo: DiagnosticInfo,
    language: string
  ): Promise<{ success: boolean; error?: string }> {
    const match = errorInfo.message.match(/['"](\w+)['"]/);
    if (!match) {
      return { success: false, error: 'Could not extract variable name' };
    }

    const varName = match[1];
    const document = editor.document;
    const edit = new vscode.WorkspaceEdit();

    // Find a good place to declare the variable (beginning of function/block)
    const errorLine = Math.max(0, errorInfo.line - 1);
    let insertLine = errorLine;

    // Simple heuristic: find the start of the current indentation block
    for (let i = errorLine; i >= 0; i--) {
      const line = document.lineAt(i).text;
      if (line.includes('{') || line.includes('function') || line.includes('=>')) {
        insertLine = i + 1;
        break;
      }
    }

    let declaration = '';
    const safeVarName = varName ?? 'unknownVariable';
    switch (language) {
      case 'typescript':
      case 'javascript':
        declaration = `const ${safeVarName} = null; // TODO: Initialize ${safeVarName}\n`;
        break;
      case 'python':
        declaration = `${safeVarName} = None  # TODO: Initialize ${safeVarName}\n`;
        break;
      case 'java':
      case 'csharp':
      case 'c#':
        declaration = `Object ${safeVarName} = null; // TODO: Initialize ${safeVarName}\n`;
        break;
      default:
        declaration = `// TODO: Declare variable ${safeVarName}\n`;
    }

    // Add proper indentation
    const targetLine = document.lineAt(Math.min(insertLine, document.lineCount - 1));
    const indentation = targetLine.text.match(/^(\s*)/)?.[1] || '';
    
    edit.insert(document.uri, new vscode.Position(insertLine, 0), indentation + declaration);

    const success = await vscode.workspace.applyEdit(edit);
    return { success, error: success ? undefined : 'Failed to apply variable declaration' };
  }

  private async applyMissingSemicolonFix(
    editor: vscode.TextEditor,
    errorInfo: DiagnosticInfo
  ): Promise<{ success: boolean; error?: string }> {
    const document = editor.document;
    const errorLine = Math.max(0, errorInfo.line - 1);
    const lineText = document.lineAt(errorLine).text;
    
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(errorLine, lineText.length), ';');
    
    const success = await vscode.workspace.applyEdit(edit);
    return { success, error: success ? undefined : 'Failed to add semicolon' };
  }

  private async applyTypeErrorFix(
    editor: vscode.TextEditor,
    errorInfo: DiagnosticInfo,
    language: string
  ): Promise<{ success: boolean; error?: string }> {
    if (language !== 'typescript') {
      return { success: false, error: 'Type fixes only supported for TypeScript' };
    }

    const document = editor.document;
    const errorLine = Math.max(0, errorInfo.line - 1);
    const lineText = document.lineAt(errorLine).text;

    const edit = new vscode.WorkspaceEdit();

    // Extract type information from error message
    const expectedTypeMatch = errorInfo.message.match(/type ['"]([^'"]+)['"]/);
    const expectedType = expectedTypeMatch?.[1] || 'any';

    // Check if this is a variable assignment without type
    const assignmentMatch = lineText.match(/(const|let|var)\s+(\w+)\s*=/);
    if (assignmentMatch && assignmentMatch[2] && !lineText.includes(':')) {
      const varName = assignmentMatch[2];
      const insertPos = lineText.indexOf(varName) + varName.length;
      edit.insert(document.uri, new vscode.Position(errorLine, insertPos), `: ${expectedType}`);
    } else {
      // Add type assertion as fallback
      const trimmed = lineText.trim();
      if (trimmed) {
        const lineStart = lineText.indexOf(trimmed);
        edit.insert(document.uri, new vscode.Position(errorLine, lineStart), `(${trimmed} as ${expectedType})`);
        edit.delete(document.uri, new vscode.Range(
          new vscode.Position(errorLine, lineStart),
          new vscode.Position(errorLine, lineStart + trimmed.length)
        ));
      }
    }

    const success = await vscode.workspace.applyEdit(edit);
    return { success, error: success ? undefined : 'Failed to apply type fix' };
  }

  private async applyGenericFix(
    editor: vscode.TextEditor,
    errorInfo: DiagnosticInfo
  ): Promise<{ success: boolean; error?: string }> {
    const document = editor.document;
    const errorLine = Math.max(0, errorInfo.line - 1);
    
    const edit = new vscode.WorkspaceEdit();
    
    // As a last resort, add a comment with the fix suggestion
    const lineText = document.lineAt(errorLine).text;
    const indentation = lineText.match(/^(\s*)/)?.[1] || '';
    
    const fixComment = `${indentation}// FIXME: ${errorInfo.message}\n`;
    edit.insert(document.uri, new vscode.Position(errorLine, 0), fixComment);
    
    const success = await vscode.workspace.applyEdit(edit);
    if (success) {
      this.logger.info('Generic fix comment added');
    }
    
    return { success, error: success ? undefined : 'Failed to apply generic fix' };
  }

  private async saveDocument(document: vscode.TextDocument): Promise<void> {
    try {
      await document.save();
      this.logger.debug('Document saved after fix');
    } catch (saveError) {
      this.logger.warn('Failed to save document after fix', saveError as Error);
      // Don't fail the entire operation if save fails
    }
  }

  getSimilarSuggestions(
    type: SuggestionType, 
    limit: number = 3
  ): Suggestion[] {
    const templates = SUGGESTION_TEMPLATES[type];
    if (!templates) return [];

    const suggestions: Suggestion[] = [];
    const mockContext: SuggestionContext = {
      flowState: 'working',
      activityContext: {
        capturedAt: new Date(),
        file: 'example.ts',
        language: 'typescript',
        line: 10
      },
      recentSuggestions: []
    };

    for (let i = 0; i < Math.min(limit, templates.length); i++) {
      const templateFunc = templates[i];
      if (templateFunc) {
        const suggestion = templateFunc(mockContext.activityContext, undefined);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions;
  }

  getAvailableTypes(): SuggestionType[] {
    return Object.keys(SUGGESTION_TEMPLATES) as SuggestionType[];
  }

  isTypeEnabled(type: SuggestionType): boolean {
    return !this.userPreferences.disabledTypes.includes(type);
  }

  async toggleType(type: SuggestionType, enabled: boolean): Promise<void> {
    if (enabled) {
      this.userPreferences.disabledTypes = 
        this.userPreferences.disabledTypes.filter(t => t !== type);
    } else {
      if (!this.userPreferences.disabledTypes.includes(type)) {
        this.userPreferences.disabledTypes.push(type);
      }
    }
    await this.savePreferences(this.userPreferences);
  }

  private trackSuggestion(id: string): void {
    this.recentSuggestions.push(id);
    this.lastSuggestionTime = Date.now();
    
    // Keep only last 100
    if (this.recentSuggestions.length > SUGGESTION_ENGINE_CONFIG.MAX_SUGGESTIONS_HISTORY) {
      this.recentSuggestions = this.recentSuggestions.slice(-SUGGESTION_ENGINE_CONFIG.MAX_SUGGESTIONS_HISTORY);
    }
  }

  getPreferences(): UserSuggestionPreferences {
    return { ...this.userPreferences };
  }

  clearHistory(): void {
    this.recentSuggestions = [];
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.clearHistory();
  }
}

export default SuggestionEngine;
