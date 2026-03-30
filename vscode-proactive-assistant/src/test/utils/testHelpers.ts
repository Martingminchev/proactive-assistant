import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import type {
  ActivityContext,
  ActivityEvent,
  FlowState,
  ILogger,
  DiagnosticInfo,
  Suggestion,
  UserSettings
} from '../../types';

export function createMockExtensionContext(): vscode.ExtensionContext {
  const storage: Map<string, any> = new Map();
  const secretsStorage: Map<string, string> = new Map();

  return {
    subscriptions: [],
    workspaceState: {
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        return storage.has(key) ? storage.get(key) : defaultValue;
      },
      update: async (key: string, value: any): Promise<void> => {
        storage.set(key, value);
      },
      keys: (): string[] => Array.from(storage.keys())
    } as vscode.Memento,
    globalState: {
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        return storage.has(key) ? storage.get(key) : defaultValue;
      },
      update: async (key: string, value: any): Promise<void> => {
        storage.set(key, value);
      },
      keys: (): string[] => Array.from(storage.keys())
    } as vscode.Memento & { setKeysForSync(keys: string[]): void },
    secrets: {
      get: async (key: string): Promise<string | undefined> => {
        return secretsStorage.get(key);
      },
      store: async (key: string, value: string): Promise<void> => {
        secretsStorage.set(key, value);
      },
      delete: async (key: string): Promise<void> => {
        secretsStorage.delete(key);
      }
    } as vscode.SecretStorage,
    extensionUri: vscode.Uri.file('/test/extension'),
    extensionPath: '/test/extension',
    environmentVariableCollection: {
      persistent: true,
      replace: () => {},
      append: () => {},
      prepend: () => {},
      get: () => undefined,
      forEach: () => {},
      delete: () => {},
      clear: () => {},
      description: undefined,
      onDidChange: new EventEmitter().event as any
    } as vscode.GlobalEnvironmentVariableCollection,
    asAbsolutePath: (relativePath: string): string => {
      return `/test/extension/${relativePath}`;
    },
    storageUri: vscode.Uri.file('/test/storage'),
    storagePath: '/test/storage',
    globalStorageUri: vscode.Uri.file('/test/global-storage'),
    globalStoragePath: '/test/global-storage',
    logUri: vscode.Uri.file('/test/log'),
    logPath: '/test/log',
    extensionMode: vscode.ExtensionMode.Test,
    extension: {
      id: 'test.proactive-assistant',
      extensionUri: vscode.Uri.file('/test/extension'),
      extensionPath: '/test/extension',
      isActive: true,
      packageJSON: { version: '0.1.0' },
      exports: undefined,
      activate: () => Promise.resolve(),
      extensionKind: vscode.ExtensionKind.Workspace
    },
    languageModelAccessInformation: {
      onDidChange: new EventEmitter().event as any,
      canSendRequest: () => true
    }
  };
}

export function createMockTextEditor(
  content: string = '',
  language: string = 'typescript',
  fileName: string = 'test.ts'
): vscode.TextEditor {
  const lines = content.split('\n');
  const document = createMockTextDocument(content, language, fileName);

  return {
    document,
    selection: new vscode.Selection(0, 0, 0, 0),
    selections: [new vscode.Selection(0, 0, 0, 0)],
    visibleRanges: [new vscode.Range(0, 0, lines.length, 0)],
    options: {
      tabSize: 2,
      insertSpaces: true,
      cursorStyle: vscode.TextEditorCursorStyle.Line,
      lineNumbers: vscode.TextEditorLineNumbersStyle.On
    },
    viewColumn: vscode.ViewColumn.One,
    edit: async (callback: (editBuilder: vscode.TextEditorEdit) => void): Promise<boolean> => {
      return true;
    },
    insertSnippet: async (): Promise<boolean> => true,
    setDecorations: () => {},
    revealRange: () => {},
    show: () => {},
    hide: () => {}
  } as vscode.TextEditor;
}

function createMockTextDocument(
  content: string = '',
  language: string = 'typescript',
  fileName: string = 'test.ts'
): vscode.TextDocument {
  const lines = content.split('\n');
  const uri = vscode.Uri.file(`/test/workspace/${fileName}`);

  return {
    uri,
    fileName: uri.fsPath,
    isUntitled: false,
    languageId: language,
    version: 1,
    isDirty: false,
    isClosed: false,
    content,
    getText: (range?: vscode.Range): string => {
      if (!range) {
        return content;
      }
      const startLine = range.start.line;
      const endLine = range.end.line;
      return lines.slice(startLine, endLine + 1).join('\n');
    },
    getWordRangeAtPosition: (): vscode.Range | undefined => undefined,
    validateRange: (range: vscode.Range): vscode.Range => range,
    validatePosition: (position: vscode.Position): vscode.Position => position,
    lineAt: (line: number): vscode.TextLine => ({
      text: lines[line] || '',
      lineNumber: line,
      range: new vscode.Range(line, 0, line, (lines[line] || '').length),
      rangeIncludingLineBreak: new vscode.Range(line, 0, line, (lines[line] || '').length + 1),
      firstNonWhitespaceCharacterIndex: (lines[line] || '').search(/\S/) || 0,
      isEmptyOrWhitespace: !(lines[line] || '').trim()
    } as vscode.TextLine),
    offsetAt: (position: vscode.Position): number => {
      let offset = 0;
      for (let i = 0; i < position.line; i++) {
        offset += lines[i].length + 1;
      }
      return offset + position.character;
    },
    positionAt: (offset: number): vscode.Position => {
      let line = 0;
      let currentOffset = 0;
      while (line < lines.length && currentOffset + lines[line].length < offset) {
        currentOffset += lines[line].length + 1;
        line++;
      }
      return new vscode.Position(line, offset - currentOffset);
    },
    lineCount: lines.length,
    save: async (): Promise<boolean> => true,
    eol: vscode.EndOfLine.LF
  } as vscode.TextDocument;
}

export async function simulateTyping(
  editor: vscode.TextEditor,
  text: string,
  delayMs: number = 0
): Promise<void> {
  for (const char of text) {
    const currentContent = editor.document.getText();
    const newContent = currentContent + char;
    
    (editor.document as any).content = newContent;
    (editor.document as any).lineCount = newContent.split('\n').length;

    if (delayMs > 0) {
      await waitFor(delayMs);
    }
  }
}

export function simulateError(
  editor: vscode.TextEditor,
  message: string,
  line: number = 0,
  severity: 'error' | 'warning' | 'info' = 'error'
): DiagnosticInfo {
  return {
    message,
    line,
    column: 0,
    severity,
    code: 'TEST_ERROR',
    source: 'test'
  };
}

export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForCondition(
  condition: () => boolean,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (condition()) {
      return true;
    }
    await waitFor(intervalMs);
  }
  return false;
}

export function createMockLogger(): ILogger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}

export function createCapturingLogger(): ILogger & { logs: string[] } {
  const logs: string[] = [];
  return {
    logs,
    debug: (msg: string) => logs.push(`[DEBUG] ${msg}`),
    info: (msg: string) => logs.push(`[INFO] ${msg}`),
    warn: (msg: string) => logs.push(`[WARN] ${msg}`),
    error: (msg: string) => logs.push(`[ERROR] ${msg}`)
  };
}

export function createMockActivityContext(
  overrides: Partial<ActivityContext> = {}
): ActivityContext {
  return {
    file: '/test/file.ts',
    language: 'typescript',
    line: 10,
    column: 5,
    content: 'const x = 1;',
    errors: [],
    warnings: [],
    duration: 1000,
    capturedAt: new Date(),
    ...overrides
  };
}

export function createMockActivityEvent(
  type: ActivityEvent['type'] = 'edit',
  overrides: Partial<ActivityEvent> = {}
): ActivityEvent {
  return {
    type,
    timestamp: new Date(),
    file: '/test/file.ts',
    metadata: {},
    ...overrides
  };
}

export function createMockSuggestion(
  overrides: Partial<Suggestion> = {}
): Suggestion {
  return {
    id: `test-${Date.now()}`,
    title: 'Test Suggestion',
    description: 'This is a test suggestion',
    priority: 'medium',
    actions: [
      { id: 'apply', label: 'Apply', type: 'apply', isPrimary: true },
      { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
    ],
    timestamp: new Date(),
    confidence: 0.8,
    category: 'test',
    ...overrides
  };
}

export function createDefaultSettings(): UserSettings {
  return {
    enabled: true,
    focusMode: false,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    },
    interruptionThreshold: 0.7,
    snoozeDuration: 30,
    piecesOs: {
      enabled: true,
      host: 'localhost',
      port: 5323
    },
    logging: {
      level: 'info'
    },
    activityTracking: {
      enabled: true,
      sampleInterval: 5000
    }
  };
}

export function generateTypingSequence(
  charCount: number,
  startTime: number = Date.now(),
  charsPerMinute: number = 300
): Array<{ char: string; timestamp: number }> {
  const msPerChar = 60000 / charsPerMinute;
  const sequence: Array<{ char: string; timestamp: number }> = [];
  
  for (let i = 0; i < charCount; i++) {
    sequence.push({
      char: String.fromCharCode(97 + (i % 26)),
      timestamp: startTime + (i * msPerChar)
    });
  }
  
  return sequence;
}

export function createFlowStateSequence(
  states: FlowState[] = ['idle', 'working', 'deep_flow', 'working', 'stuck']
): Array<{ state: FlowState; timestamp: number }> {
  const now = Date.now();
  return states.map((state, index) => ({
    state,
    timestamp: now + (index * 60000)
  }));
}

export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function isRecent(date: Date, seconds: number = 5): boolean {
  const diff = Math.abs(Date.now() - date.getTime());
  return diff <= seconds * 1000;
}

export function deepEqual(obj1: any, obj2: any): boolean {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}
