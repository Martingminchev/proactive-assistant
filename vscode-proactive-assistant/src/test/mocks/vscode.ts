import { EventEmitter } from 'events';

export const mockVscode = {
  ExtensionMode: {
    Development: 1,
    Production: 2,
    Test: 3
  },
  
  ExtensionKind: {
    UI: 1,
    Workspace: 2
  },
  
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
  },
  
  EndOfLine: {
    LF: 1,
    CRLF: 2
  },
  
  TextEditorCursorStyle: {
    Line: 1,
    Block: 2,
    Underline: 3,
    LineThin: 4,
    BlockOutline: 5,
    UnderlineThin: 6
  },
  
  TextEditorLineNumbersStyle: {
    Off: 0,
    On: 1,
    Relative: 2
  },
  
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
    Active: -1,
    Beside: -2
  },
  
  EventEmitter,
  
  Position: class Position {
    constructor(public line: number, public character: number) {}
    
    isBefore(other: Position): boolean {
      return this.line < other.line || 
        (this.line === other.line && this.character < other.character);
    }
    
    isAfter(other: Position): boolean {
      return this.line > other.line || 
        (this.line === other.line && this.character > other.character);
    }
    
    isEqual(other: Position): boolean {
      return this.line === other.line && this.character === other.character;
    }
    
    translate(lineDelta?: number, characterDelta?: number): Position {
      return new Position(
        this.line + (lineDelta || 0),
        this.character + (characterDelta || 0)
      );
    }
    
    with(line?: number, character?: number): Position {
      return new Position(line ?? this.line, character ?? this.character);
    }
  },
  
  Range: class Range {
    start: Position;
    end: Position;
    
    constructor(
      startLine: number | Position,
      startCharacter: number | Position,
      endLine?: number,
      endCharacter?: number
    ) {
      if (startLine instanceof Position) {
        this.start = startLine;
        this.end = startCharacter as Position;
      } else {
        this.start = new mockVscode.Position(startLine, startCharacter as number);
        this.end = new mockVscode.Position(endLine!, endCharacter!);
      }
    }
    
    get isEmpty(): boolean {
      return this.start.isEqual(this.end);
    }
    
    get isSingleLine(): boolean {
      return this.start.line === this.end.line;
    }
    
    contains(positionOrRange: Position | Range): boolean {
      if (positionOrRange instanceof Range) {
        return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
      }
      return !positionOrRange.isBefore(this.start) && !positionOrRange.isAfter(this.end);
    }
    
    isEqual(other: Range): boolean {
      return this.start.isEqual(other.start) && this.end.isEqual(other.end);
    }
    
    intersection(other: Range): Range | undefined {
      const start = this.start.isAfter(other.start) ? this.start : other.start;
      const end = this.end.isBefore(other.end) ? this.end : other.end;
      if (start.isAfter(end)) {
        return undefined;
      }
      return new Range(start, end);
    }
    
    union(other: Range): Range {
      const start = this.start.isBefore(other.start) ? this.start : other.start;
      const end = this.end.isAfter(other.end) ? this.end : other.end;
      return new Range(start, end);
    }
    
    with(start?: Position, end?: Position): Range {
      return new Range(start ?? this.start, end ?? this.end);
    }
  },
  
  Selection: class Selection extends mockVscode.Range {
    anchor: Position;
    active: Position;
    
    constructor(
      anchorLine: number | Position,
      anchorCharacter: number | Position,
      activeLine?: number,
      activeCharacter?: number
    ) {
      if (anchorLine instanceof Position) {
        super(anchorLine, anchorCharacter as Position);
        this.anchor = anchorLine;
        this.active = anchorCharacter as Position;
      } else {
        super(anchorLine, anchorCharacter as number, activeLine!, activeCharacter!);
        this.anchor = new mockVscode.Position(anchorLine, anchorCharacter as number);
        this.active = new mockVscode.Position(activeLine!, activeCharacter!);
      }
    }
    
    get isReversed(): boolean {
      return this.anchor.isAfter(this.active);
    }
    
    get isEmpty(): boolean {
      return this.anchor.isEqual(this.active);
    }
  },
  
  Uri: {
    file: (path: string) => ({
      scheme: 'file',
      authority: '',
      path,
      query: '',
      fragment: '',
      fsPath: path,
      toString: () => `file://${path}`,
      toJSON: () => ({ $mid: 1, path, scheme: 'file' }),
      with: (change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }) => ({
        ...mockVscode.Uri.file(path),
        ...change
      })
    }),
    parse: (value: string) => {
      const match = value.match(/^([^:]+):\/\/([^\/]*)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
      if (!match) {
        throw new Error('Invalid URI');
      }
      return {
        scheme: match[1],
        authority: match[2],
        path: match[3] || '',
        query: match[4]?.substring(1) || '',
        fragment: match[5]?.substring(1) || '',
        fsPath: match[3] || '',
        toString: () => value,
        toJSON: () => ({ $mid: 1, path: match[3] || '', scheme: match[1] }),
        with: () => mockVscode.Uri.parse(value)
      };
    }
  },
  
  workspace: {
    fs: {
      readFile: async () => Buffer.from(''),
      writeFile: async () => {},
      delete: async () => {},
      rename: async () => {},
      copy: async () => {},
      createDirectory: async () => {},
      stat: async () => ({ type: 1, ctime: 0, mtime: 0, size: 0 }),
      readDirectory: async () => [],
      isWritableFileSystem: () => true
    },
    workspaceFolders: undefined as any,
    name: 'test-workspace',
    
    getConfiguration: (section?: string) => ({
      get: <T>(key: string, defaultValue?: T): T | undefined => defaultValue,
      has: () => true,
      inspect: () => undefined,
      update: async () => {},
      keys: () => []
    }),
    
    onDidChangeConfiguration: new EventEmitter().event as any,
    onDidChangeTextDocument: new EventEmitter().event as any,
    onDidOpenTextDocument: new EventEmitter().event as any,
    onDidCloseTextDocument: new EventEmitter().event as any,
    onDidSaveTextDocument: new EventEmitter().event as any,
    onWillSaveTextDocument: new EventEmitter().event as any,
    
    openTextDocument: async () => undefined,
    applyEdit: async () => true,
    saveAll: async () => true,
    
    createFileSystemWatcher: () => ({
      ignoreCreateEvents: false,
      ignoreChangeEvents: false,
      ignoreDeleteEvents: false,
      onDidCreate: new EventEmitter().event as any,
      onDidChange: new EventEmitter().event as any,
      onDidDelete: new EventEmitter().event as any,
      dispose: () => {}
    }),
    
    registerTextDocumentContentProvider: () => ({ dispose: () => {} }),
    
    asRelativePath: (pathOrUri: string | any, includeWorkspaceFolder?: boolean) => {
      return typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
    }
  },
  
  window: {
    activeTextEditor: undefined as any,
    visibleTextEditors: [] as any[],
    tabGroups: { all: [], activeTabGroup: undefined } as any,
    
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showInputBox: async () => undefined,
    showQuickPick: async () => undefined,
    showOpenDialog: async () => undefined,
    showSaveDialog: async () => undefined,
    showWorkspaceFolderPick: async () => undefined,
    
    createOutputChannel: (name: string) => ({
      name,
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      replace: () => {},
      onDidChangeVisibility: new EventEmitter().event as any
    }),
    
    createWebviewPanel: () => ({
      webview: {
        html: '',
        options: {},
        onDidReceiveMessage: new EventEmitter().event as any,
        postMessage: async () => true,
        asWebviewUri: (uri: any) => uri,
        cspSource: ''
      },
      onDidDispose: new EventEmitter().event as any,
      onDidChangeViewState: new EventEmitter().event as any,
      reveal: () => {},
      dispose: () => {},
      title: '',
      viewColumn: 1,
      active: true,
      visible: true,
      options: {},
      viewType: ''
    }),
    
    createTextEditorDecorationType: () => ({ key: '', dispose: () => {} }),
    
    onDidChangeActiveTextEditor: new EventEmitter().event as any,
    onDidChangeVisibleTextEditors: new EventEmitter().event as any,
    onDidChangeTextEditorSelection: new EventEmitter().event as any,
    onDidChangeTextEditorVisibleRanges: new EventEmitter().event as any,
    onDidChangeTextEditorOptions: new EventEmitter().event as any,
    onDidChangeTextEditorViewColumn: new EventEmitter().event as any,
    onDidChangeActiveColorTheme: new EventEmitter().event as any,
    onDidChangeWindowState: new EventEmitter().event as any,
    onDidChangeActiveNotebookEditor: new EventEmitter().event as any,
    onDidChangeVisibleNotebookEditors: new EventEmitter().event as any,
    onDidChangeNotebookEditorSelection: new EventEmitter().event as any,
    onDidChangeNotebookEditorVisibleRanges: new EventEmitter().event as any,
    
    setStatusBarMessage: () => ({ dispose: () => {} }),
    withProgress: async (_options: any, task: any) => task({ report: () => {} }, { isCancellationRequested: false, onCancellationRequested: new EventEmitter().event }),
    
    createStatusBarItem: () => ({
      alignment: 1,
      priority: 0,
      text: '',
      tooltip: '',
      color: '',
      backgroundColor: undefined,
      command: '',
      accessibilityInformation: undefined,
      show: () => {},
      hide: () => {},
      dispose: () => {}
    }),
    
    createTreeView: () => ({
      onDidExpandElement: new EventEmitter().event as any,
      onDidCollapseElement: new EventEmitter().event as any,
      onDidChangeSelection: new EventEmitter().event as any,
      onDidChangeVisibility: new EventEmitter().event as any,
      message: '',
      title: '',
      description: '',
      badge: undefined,
      reveal: async () => {},
      dispose: () => {}
    }),
    
    registerWebviewPanelSerializer: () => ({ dispose: () => {} }),
    registerTreeDataProvider: () => ({ dispose: () => {} }),
    registerFileDecorationProvider: () => ({ dispose: () => {} })
  },
  
  commands: {
    registerCommand: (_command: string, callback: (...args: any[]) => any) => {
      return { dispose: () => {} };
    },
    registerTextEditorCommand: () => ({ dispose: () => {} }),
    executeCommand: async () => undefined,
    getCommands: async () => [],
    onDidExecuteCommand: new EventEmitter().event as any
  },
  
  languages: {
    getDiagnostics: () => [],
    onDidChangeDiagnostics: new EventEmitter().event as any,
    createDiagnosticCollection: (name?: string) => ({
      name: name || '',
      set: () => {},
      delete: () => {},
      clear: () => {},
      forEach: () => {},
      get: () => [],
      has: () => false,
      dispose: () => {}
    }),
    registerCodeActionsProvider: () => ({ dispose: () => {} }),
    registerCodeLensProvider: () => ({ dispose: () => {} }),
    registerCompletionItemProvider: () => ({ dispose: () => {} }),
    registerDefinitionProvider: () => ({ dispose: () => {} }),
    registerDocumentFormattingEditProvider: () => ({ dispose: () => {} }),
    registerDocumentHighlightProvider: () => ({ dispose: () => {} }),
    registerDocumentLinkProvider: () => ({ dispose: () => {} }),
    registerDocumentSymbolProvider: () => ({ dispose: () => {} }),
    registerFoldingRangeProvider: () => ({ dispose: () => {} }),
    registerHoverProvider: () => ({ dispose: () => {} }),
    registerImplementationProvider: () => ({ dispose: () => {} }),
    registerInlayHintsProvider: () => ({ dispose: () => {} }),
    registerOnTypeFormattingEditProvider: () => ({ dispose: () => {} }),
    registerReferenceProvider: () => ({ dispose: () => {} }),
    registerRenameProvider: () => ({ dispose: () => {} }),
    registerSelectionRangeProvider: () => ({ dispose: () => {} }),
    registerSignatureHelpProvider: () => ({ dispose: () => {} }),
    registerTypeDefinitionProvider: () => ({ dispose: () => {} }),
    registerTypeHierarchyProvider: () => ({ dispose: () => {} }),
    registerWorkspaceSymbolProvider: () => ({ dispose: () => {} }),
    registerCallHierarchyProvider: () => ({ dispose: () => {} }),
    registerInlineCompletionItemProvider: () => ({ dispose: () => {} }),
    registerDocumentDropEditProvider: () => ({ dispose: () => {} })
  },
  
  extensions: {
    getExtension: () => undefined,
    all: [],
    onDidChange: new EventEmitter().event as any
  },
  
  env: {
    appName: 'VS Code Test',
    appRoot: '/test',
    appHost: 'desktop',
    uriScheme: 'vscode',
    language: 'en',
    clipboard: {
      readText: async () => '',
      writeText: async () => {}
    },
    machineId: 'test-machine-id',
    sessionId: 'test-session-id',
    remoteName: undefined,
    shell: '/bin/bash',
    uiKind: 1,
    onDidChangeShell: new EventEmitter().event as any,
    openExternal: async () => true,
    asExternalUri: async (uri: any) => uri,
    logLevel: 1,
    onDidChangeLogLevel: new EventEmitter().event as any
  },
  
  version: '1.74.0'
};

export type Position = InstanceType<typeof mockVscode.Position>;
export type Range = InstanceType<typeof mockVscode.Range>;
export type Selection = InstanceType<typeof mockVscode.Selection>;

export function createMockTextDocument(
  content: string = '',
  languageId: string = 'typescript',
  fileName: string = 'test.ts'
): any {
  const lines = content.split('\n');
  const uri = mockVscode.Uri.file(`/workspace/${fileName}`);
  
  return {
    uri,
    fileName: uri.fsPath,
    isUntitled: false,
    languageId,
    version: 1,
    isDirty: false,
    isClosed: false,
    content,
    lineCount: lines.length,
    eol: mockVscode.EndOfLine.LF,
    
    getText: (range?: any) => {
      if (!range) return content;
      const startLine = range.start?.line ?? 0;
      const endLine = range.end?.line ?? lines.length - 1;
      return lines.slice(startLine, endLine + 1).join('\n');
    },
    
    lineAt: (line: number) => ({
      text: lines[line] || '',
      lineNumber: line,
      range: new mockVscode.Range(line, 0, line, (lines[line] || '').length),
      rangeIncludingLineBreak: new mockVscode.Range(line, 0, line, (lines[line] || '').length + 1),
      firstNonWhitespaceCharacterIndex: (lines[line] || '').search(/\S/) || 0,
      isEmptyOrWhitespace: !(lines[line] || '').trim()
    }),
    
    offsetAt: (position: any) => {
      let offset = 0;
      for (let i = 0; i < position.line; i++) {
        offset += lines[i].length + 1;
      }
      return offset + position.character;
    },
    
    positionAt: (offset: number) => {
      let line = 0;
      let currentOffset = 0;
      while (line < lines.length && currentOffset + lines[line].length < offset) {
        currentOffset += lines[line].length + 1;
        line++;
      }
      return new mockVscode.Position(line, offset - currentOffset);
    },
    
    getWordRangeAtPosition: () => undefined,
    validateRange: (range: any) => range,
    validatePosition: (position: any) => position,
    save: async () => true
  };
}

export function createMockTextEditor(
  content: string = '',
  languageId: string = 'typescript',
  fileName: string = 'test.ts'
): any {
  const document = createMockTextDocument(content, languageId, fileName);
  const lines = content.split('\n');
  
  return {
    document,
    selection: new mockVscode.Selection(0, 0, 0, 0),
    selections: [new mockVscode.Selection(0, 0, 0, 0)],
    visibleRanges: [new mockVscode.Range(0, 0, lines.length, 0)],
    options: {
      tabSize: 2,
      insertSpaces: true,
      cursorStyle: mockVscode.TextEditorCursorStyle.Line,
      lineNumbers: mockVscode.TextEditorLineNumbersStyle.On
    },
    viewColumn: mockVscode.ViewColumn.One,
    
    edit: async (callback: any) => {
      callback({
        insert: () => {},
        delete: () => {},
        replace: () => {},
        setEndOfLine: () => {}
      });
      return true;
    },
    
    insertSnippet: async () => true,
    setDecorations: () => {},
    revealRange: () => {},
    show: () => {},
    hide: () => {}
  };
}

export function createMockExtensionContext(): any {
  const storage = new Map<string, any>();
  const secrets = new Map<string, string>();
  
  return {
    subscriptions: [],
    
    workspaceState: {
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        return storage.has(key) ? storage.get(key) : defaultValue;
      },
      update: async (key: string, value: any) => {
        storage.set(key, value);
      },
      keys: () => Array.from(storage.keys())
    },
    
    globalState: {
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        return storage.has(key) ? storage.get(key) : defaultValue;
      },
      update: async (key: string, value: any) => {
        storage.set(key, value);
      },
      keys: () => Array.from(storage.keys()),
      setKeysForSync: () => {}
    },
    
    secrets: {
      get: async (key: string) => secrets.get(key),
      store: async (key: string, value: string) => secrets.set(key, value),
      delete: async (key: string) => secrets.delete(key)
    },
    
    extensionUri: mockVscode.Uri.file('/test/extension'),
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
      onDidChange: new EventEmitter().event
    },
    
    asAbsolutePath: (relativePath: string) => `/test/extension/${relativePath}`,
    storageUri: mockVscode.Uri.file('/test/storage'),
    storagePath: '/test/storage',
    globalStorageUri: mockVscode.Uri.file('/test/global-storage'),
    globalStoragePath: '/test/global-storage',
    logUri: mockVscode.Uri.file('/test/log'),
    logPath: '/test/log',
    extensionMode: mockVscode.ExtensionMode.Test,
    extension: {
      id: 'test.proactive-assistant',
      extensionUri: mockVscode.Uri.file('/test/extension'),
      extensionPath: '/test/extension',
      isActive: true,
      packageJSON: { version: '0.1.0' },
      exports: undefined,
      activate: () => Promise.resolve(),
      extensionKind: mockVscode.ExtensionKind.Workspace
    },
    languageModelAccessInformation: {
      onDidChange: new EventEmitter().event,
      canSendRequest: () => true
    },
    
    getStorage: () => new Map(storage),
    getSecrets: () => new Map(secrets)
  };
}

export default mockVscode;
