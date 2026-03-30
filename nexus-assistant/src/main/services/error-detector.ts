// =============================================================================
// NEXUS - Error Detector Service
// Detects errors from multiple sources: window titles, clipboard, text content.
//
// This service monitors for error patterns and emits events when errors are
// detected. It supports deduplication, severity classification, and multiple
// error categories for different programming languages and tools.
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { clipboard } from 'electron';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Error Detection Types
// =============================================================================

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory = 
  | 'syntax'        // Syntax errors (SyntaxError, IndentationError)
  | 'runtime'       // Runtime errors (TypeError, ReferenceError)
  | 'import'        // Import/module errors (ModuleNotFoundError, ImportError)
  | 'network'       // Network errors (ECONNREFUSED, fetch failed)
  | 'permission'    // Permission errors (EACCES, Permission denied)
  | 'filesystem'    // File system errors (ENOENT, file not found)
  | 'build'         // Build tool errors (webpack, vite, tsc)
  | 'git'           // Git errors (merge conflict, push rejected)
  | 'package'       // Package manager errors (npm ERR!, pip error)
  | 'database'      // Database errors (connection failed, query error)
  | 'general';      // General/unclassified errors

export type ErrorSource = 'window_title' | 'clipboard' | 'text' | 'screen_ocr';

export interface DetectedError {
  id: string;
  type: string;                    // Specific error type (e.g., "TypeError", "ENOENT")
  message: string;                 // Full error message
  source: ErrorSource;             // Where the error was detected
  severity: ErrorSeverity;         // Severity level
  category: ErrorCategory;         // Error category
  timestamp: number;               // When detected
  context: ErrorContext;           // Additional context
}

export interface ErrorContext {
  application?: string;            // Application where error occurred
  windowTitle?: string;            // Window title when detected
  technology?: string;             // Detected technology (JavaScript, Python, etc.)
  filePath?: string;               // File path if detected in error
  lineNumber?: number;             // Line number if available
  stackTrace?: string;             // Stack trace if available
  rawText?: string;                // Original text that matched
}

export interface ErrorPattern {
  pattern: RegExp;
  type: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  technology?: string;
  extractors?: {
    filePath?: RegExp;
    lineNumber?: RegExp;
    message?: RegExp;
  };
}

// =============================================================================
// Error Detector Configuration
// =============================================================================

export interface ErrorDetectorConfig {
  enabled: boolean;
  deduplicationWindowMs: number;     // Time window to consider errors as duplicates
  maxErrorHistorySize: number;       // Maximum errors to keep in history
  clipboardPollingIntervalMs: number; // How often to check clipboard
  minClipboardLength: number;        // Minimum clipboard text length to analyze
  maxClipboardLength: number;        // Maximum clipboard text length to analyze
}

export const DEFAULT_ERROR_DETECTOR_CONFIG: ErrorDetectorConfig = {
  enabled: true,
  deduplicationWindowMs: 30000,      // 30 seconds
  maxErrorHistorySize: 100,
  clipboardPollingIntervalMs: 2000,  // 2 seconds
  minClipboardLength: 10,
  maxClipboardLength: 10000,
};

// =============================================================================
// Error Patterns
// =============================================================================

const ERROR_PATTERNS: ErrorPattern[] = [
  // ===========================================================================
  // JavaScript/TypeScript Errors
  // ===========================================================================
  {
    pattern: /TypeError:\s*(.+)/i,
    type: 'TypeError',
    category: 'runtime',
    severity: 'high',
    technology: 'JavaScript',
    extractors: { message: /TypeError:\s*(.+)/ },
  },
  {
    pattern: /ReferenceError:\s*(.+)/i,
    type: 'ReferenceError',
    category: 'runtime',
    severity: 'high',
    technology: 'JavaScript',
    extractors: { message: /ReferenceError:\s*(.+)/ },
  },
  {
    pattern: /SyntaxError:\s*(.+)/i,
    type: 'SyntaxError',
    category: 'syntax',
    severity: 'high',
    technology: 'JavaScript',
    extractors: { message: /SyntaxError:\s*(.+)/ },
  },
  {
    pattern: /RangeError:\s*(.+)/i,
    type: 'RangeError',
    category: 'runtime',
    severity: 'medium',
    technology: 'JavaScript',
    extractors: { message: /RangeError:\s*(.+)/ },
  },
  {
    pattern: /URIError:\s*(.+)/i,
    type: 'URIError',
    category: 'runtime',
    severity: 'medium',
    technology: 'JavaScript',
    extractors: { message: /URIError:\s*(.+)/ },
  },
  {
    pattern: /EvalError:\s*(.+)/i,
    type: 'EvalError',
    category: 'runtime',
    severity: 'high',
    technology: 'JavaScript',
    extractors: { message: /EvalError:\s*(.+)/ },
  },
  {
    pattern: /Cannot read propert(?:y|ies) (?:of|'[^']+' of) (undefined|null)/i,
    type: 'TypeError',
    category: 'runtime',
    severity: 'high',
    technology: 'JavaScript',
  },
  {
    pattern: /is not a function/i,
    type: 'TypeError',
    category: 'runtime',
    severity: 'high',
    technology: 'JavaScript',
  },
  {
    pattern: /is not defined/i,
    type: 'ReferenceError',
    category: 'runtime',
    severity: 'high',
    technology: 'JavaScript',
  },
  {
    pattern: /Unexpected token/i,
    type: 'SyntaxError',
    category: 'syntax',
    severity: 'high',
    technology: 'JavaScript',
  },

  // ===========================================================================
  // TypeScript Specific Errors
  // ===========================================================================
  {
    pattern: /TS\d+:\s*(.+)/,
    type: 'TypeScriptError',
    category: 'syntax',
    severity: 'high',
    technology: 'TypeScript',
    extractors: { message: /TS\d+:\s*(.+)/ },
  },
  {
    pattern: /Type '([^']+)' is not assignable to type '([^']+)'/,
    type: 'TypeScriptError',
    category: 'syntax',
    severity: 'medium',
    technology: 'TypeScript',
  },
  {
    pattern: /Property '([^']+)' does not exist on type/,
    type: 'TypeScriptError',
    category: 'syntax',
    severity: 'medium',
    technology: 'TypeScript',
  },
  {
    pattern: /Cannot find module '([^']+)'/,
    type: 'ModuleNotFoundError',
    category: 'import',
    severity: 'high',
    technology: 'TypeScript',
  },

  // ===========================================================================
  // Node.js Errors
  // ===========================================================================
  {
    pattern: /npm ERR!/i,
    type: 'NpmError',
    category: 'package',
    severity: 'high',
    technology: 'Node.js',
  },
  {
    pattern: /ENOENT[:\s]+no such file or directory/i,
    type: 'ENOENT',
    category: 'filesystem',
    severity: 'high',
    technology: 'Node.js',
    extractors: { filePath: /ENOENT[:\s]+no such file or directory[,\s]+(?:open\s+)?['"]?([^'"]+)['"]?/i },
  },
  {
    pattern: /EACCES[:\s]+permission denied/i,
    type: 'EACCES',
    category: 'permission',
    severity: 'high',
    technology: 'Node.js',
    extractors: { filePath: /EACCES[:\s]+permission denied[,\s]+(?:access\s+)?['"]?([^'"]+)['"]?/i },
  },
  {
    pattern: /ECONNREFUSED/i,
    type: 'ECONNREFUSED',
    category: 'network',
    severity: 'high',
    technology: 'Node.js',
  },
  {
    pattern: /EADDRINUSE/i,
    type: 'EADDRINUSE',
    category: 'network',
    severity: 'medium',
    technology: 'Node.js',
  },
  {
    pattern: /ETIMEDOUT/i,
    type: 'ETIMEDOUT',
    category: 'network',
    severity: 'medium',
    technology: 'Node.js',
  },
  {
    pattern: /ENOTFOUND/i,
    type: 'ENOTFOUND',
    category: 'network',
    severity: 'medium',
    technology: 'Node.js',
  },
  {
    pattern: /ERR_MODULE_NOT_FOUND/i,
    type: 'ModuleNotFoundError',
    category: 'import',
    severity: 'high',
    technology: 'Node.js',
  },
  {
    pattern: /Error: Cannot find module '([^']+)'/,
    type: 'ModuleNotFoundError',
    category: 'import',
    severity: 'high',
    technology: 'Node.js',
  },
  {
    pattern: /UnhandledPromiseRejection/i,
    type: 'UnhandledPromiseRejection',
    category: 'runtime',
    severity: 'high',
    technology: 'Node.js',
  },

  // ===========================================================================
  // Python Errors
  // ===========================================================================
  {
    pattern: /ImportError:\s*(.+)/i,
    type: 'ImportError',
    category: 'import',
    severity: 'high',
    technology: 'Python',
    extractors: { message: /ImportError:\s*(.+)/ },
  },
  {
    pattern: /ModuleNotFoundError:\s*No module named '([^']+)'/i,
    type: 'ModuleNotFoundError',
    category: 'import',
    severity: 'high',
    technology: 'Python',
  },
  {
    pattern: /AttributeError:\s*(.+)/i,
    type: 'AttributeError',
    category: 'runtime',
    severity: 'high',
    technology: 'Python',
    extractors: { message: /AttributeError:\s*(.+)/ },
  },
  {
    pattern: /IndentationError:\s*(.+)/i,
    type: 'IndentationError',
    category: 'syntax',
    severity: 'high',
    technology: 'Python',
    extractors: { message: /IndentationError:\s*(.+)/ },
  },
  {
    pattern: /NameError:\s*(.+)/i,
    type: 'NameError',
    category: 'runtime',
    severity: 'high',
    technology: 'Python',
    extractors: { message: /NameError:\s*(.+)/ },
  },
  {
    pattern: /KeyError:\s*(.+)/i,
    type: 'KeyError',
    category: 'runtime',
    severity: 'medium',
    technology: 'Python',
    extractors: { message: /KeyError:\s*(.+)/ },
  },
  {
    pattern: /ValueError:\s*(.+)/i,
    type: 'ValueError',
    category: 'runtime',
    severity: 'medium',
    technology: 'Python',
    extractors: { message: /ValueError:\s*(.+)/ },
  },
  {
    pattern: /IndexError:\s*(.+)/i,
    type: 'IndexError',
    category: 'runtime',
    severity: 'medium',
    technology: 'Python',
    extractors: { message: /IndexError:\s*(.+)/ },
  },
  {
    pattern: /ZeroDivisionError:\s*(.+)/i,
    type: 'ZeroDivisionError',
    category: 'runtime',
    severity: 'medium',
    technology: 'Python',
  },
  {
    pattern: /FileNotFoundError:\s*(.+)/i,
    type: 'FileNotFoundError',
    category: 'filesystem',
    severity: 'high',
    technology: 'Python',
    extractors: { message: /FileNotFoundError:\s*(.+)/ },
  },
  {
    pattern: /PermissionError:\s*(.+)/i,
    type: 'PermissionError',
    category: 'permission',
    severity: 'high',
    technology: 'Python',
  },
  {
    pattern: /pip install failed/i,
    type: 'PipError',
    category: 'package',
    severity: 'high',
    technology: 'Python',
  },
  {
    pattern: /Traceback \(most recent call last\)/i,
    type: 'PythonTraceback',
    category: 'runtime',
    severity: 'high',
    technology: 'Python',
  },

  // ===========================================================================
  // Build Tool Errors - Webpack
  // ===========================================================================
  {
    pattern: /webpack.*error/i,
    type: 'WebpackError',
    category: 'build',
    severity: 'high',
    technology: 'Webpack',
  },
  {
    pattern: /Module build failed/i,
    type: 'WebpackBuildError',
    category: 'build',
    severity: 'high',
    technology: 'Webpack',
  },
  {
    pattern: /Module not found: Error: Can't resolve/i,
    type: 'WebpackModuleError',
    category: 'build',
    severity: 'high',
    technology: 'Webpack',
  },
  {
    pattern: /ERROR in .*\.(?:js|ts|jsx|tsx)/i,
    type: 'WebpackCompileError',
    category: 'build',
    severity: 'high',
    technology: 'Webpack',
  },

  // ===========================================================================
  // Build Tool Errors - Vite
  // ===========================================================================
  {
    pattern: /\[vite\].*error/i,
    type: 'ViteError',
    category: 'build',
    severity: 'high',
    technology: 'Vite',
  },
  {
    pattern: /vite:.*failed to resolve/i,
    type: 'ViteResolveError',
    category: 'build',
    severity: 'high',
    technology: 'Vite',
  },
  {
    pattern: /Pre-transform error/i,
    type: 'ViteTransformError',
    category: 'build',
    severity: 'high',
    technology: 'Vite',
  },

  // ===========================================================================
  // Build Tool Errors - TypeScript Compiler
  // ===========================================================================
  {
    pattern: /tsc.*error/i,
    type: 'TscError',
    category: 'build',
    severity: 'high',
    technology: 'TypeScript',
  },
  {
    pattern: /error TS\d+:/,
    type: 'TscCompileError',
    category: 'build',
    severity: 'high',
    technology: 'TypeScript',
    extractors: { 
      lineNumber: /:(\d+):\d+/,
      filePath: /^([^(]+)\(/,
    },
  },

  // ===========================================================================
  // Build Tool Errors - ESLint
  // ===========================================================================
  {
    pattern: /eslint.*error/i,
    type: 'ESLintError',
    category: 'build',
    severity: 'medium',
    technology: 'ESLint',
  },
  {
    pattern: /\d+ error(?:s)? and \d+ warning(?:s)?/i,
    type: 'LintSummary',
    category: 'build',
    severity: 'medium',
    technology: 'ESLint',
  },

  // ===========================================================================
  // Build Tool Errors - Rollup/esbuild
  // ===========================================================================
  {
    pattern: /\[rollup\].*error/i,
    type: 'RollupError',
    category: 'build',
    severity: 'high',
    technology: 'Rollup',
  },
  {
    pattern: /esbuild.*error/i,
    type: 'EsbuildError',
    category: 'build',
    severity: 'high',
    technology: 'esbuild',
  },

  // ===========================================================================
  // Git Errors
  // ===========================================================================
  {
    pattern: /CONFLICT \(content\): Merge conflict in/i,
    type: 'MergeConflict',
    category: 'git',
    severity: 'high',
    technology: 'Git',
    extractors: { filePath: /Merge conflict in (.+)/ },
  },
  {
    pattern: /Automatic merge failed/i,
    type: 'MergeConflict',
    category: 'git',
    severity: 'high',
    technology: 'Git',
  },
  {
    pattern: /! \[rejected\].*\(fetch first\)/i,
    type: 'PushRejected',
    category: 'git',
    severity: 'high',
    technology: 'Git',
  },
  {
    pattern: /! \[rejected\].*\(non-fast-forward\)/i,
    type: 'PushRejected',
    category: 'git',
    severity: 'high',
    technology: 'Git',
  },
  {
    pattern: /fatal: not a git repository/i,
    type: 'NotAGitRepo',
    category: 'git',
    severity: 'medium',
    technology: 'Git',
  },
  {
    pattern: /error: pathspec .* did not match any file/i,
    type: 'GitPathspecError',
    category: 'git',
    severity: 'medium',
    technology: 'Git',
  },
  {
    pattern: /Your branch is behind/i,
    type: 'BranchBehind',
    category: 'git',
    severity: 'low',
    technology: 'Git',
  },
  {
    pattern: /You have unmerged paths/i,
    type: 'UnmergedPaths',
    category: 'git',
    severity: 'high',
    technology: 'Git',
  },
  {
    pattern: /fatal: refusing to merge unrelated histories/i,
    type: 'UnrelatedHistories',
    category: 'git',
    severity: 'high',
    technology: 'Git',
  },
  {
    pattern: /error: failed to push some refs/i,
    type: 'PushFailed',
    category: 'git',
    severity: 'high',
    technology: 'Git',
  },

  // ===========================================================================
  // General Error Patterns
  // ===========================================================================
  {
    pattern: /Error:\s*(.+)/i,
    type: 'GeneralError',
    category: 'general',
    severity: 'medium',
    extractors: { message: /Error:\s*(.+)/ },
  },
  {
    pattern: /Exception:\s*(.+)/i,
    type: 'Exception',
    category: 'general',
    severity: 'medium',
    extractors: { message: /Exception:\s*(.+)/ },
  },
  {
    pattern: /Failed to\s+(.+)/i,
    type: 'OperationFailed',
    category: 'general',
    severity: 'medium',
    extractors: { message: /Failed to\s+(.+)/ },
  },
  {
    pattern: /Cannot find\s+(.+)/i,
    type: 'NotFound',
    category: 'general',
    severity: 'medium',
    extractors: { message: /Cannot find\s+(.+)/ },
  },
  {
    pattern: /Permission denied/i,
    type: 'PermissionDenied',
    category: 'permission',
    severity: 'high',
  },
  {
    pattern: /Access denied/i,
    type: 'AccessDenied',
    category: 'permission',
    severity: 'high',
  },
  {
    pattern: /Connection refused/i,
    type: 'ConnectionRefused',
    category: 'network',
    severity: 'high',
  },
  {
    pattern: /Connection timed out/i,
    type: 'ConnectionTimeout',
    category: 'network',
    severity: 'medium',
  },
  {
    pattern: /FATAL ERROR/i,
    type: 'FatalError',
    category: 'general',
    severity: 'critical',
  },
  {
    pattern: /Segmentation fault/i,
    type: 'SegmentationFault',
    category: 'runtime',
    severity: 'critical',
  },
  {
    pattern: /Out of memory/i,
    type: 'OutOfMemory',
    category: 'runtime',
    severity: 'critical',
  },
  {
    pattern: /Stack overflow/i,
    type: 'StackOverflow',
    category: 'runtime',
    severity: 'critical',
  },

  // ===========================================================================
  // Database Errors
  // ===========================================================================
  {
    pattern: /SQLITE_ERROR/i,
    type: 'SQLiteError',
    category: 'database',
    severity: 'high',
    technology: 'SQLite',
  },
  {
    pattern: /ER_ACCESS_DENIED_ERROR/i,
    type: 'MySQLAccessDenied',
    category: 'database',
    severity: 'high',
    technology: 'MySQL',
  },
  {
    pattern: /connection.*refused.*(?:5432|postgres)/i,
    type: 'PostgresConnectionError',
    category: 'database',
    severity: 'high',
    technology: 'PostgreSQL',
  },
  {
    pattern: /MongoError/i,
    type: 'MongoError',
    category: 'database',
    severity: 'high',
    technology: 'MongoDB',
  },
  {
    pattern: /Redis.*connection.*error/i,
    type: 'RedisConnectionError',
    category: 'database',
    severity: 'high',
    technology: 'Redis',
  },

  // ===========================================================================
  // React/Vue/Angular Errors
  // ===========================================================================
  {
    pattern: /React.*Error/i,
    type: 'ReactError',
    category: 'runtime',
    severity: 'high',
    technology: 'React',
  },
  {
    pattern: /Invalid hook call/i,
    type: 'ReactHookError',
    category: 'runtime',
    severity: 'high',
    technology: 'React',
  },
  {
    pattern: /Maximum update depth exceeded/i,
    type: 'ReactInfiniteLoop',
    category: 'runtime',
    severity: 'high',
    technology: 'React',
  },
  {
    pattern: /\[Vue warn\]/i,
    type: 'VueWarning',
    category: 'runtime',
    severity: 'medium',
    technology: 'Vue',
  },
  {
    pattern: /NG\d+:/i,
    type: 'AngularError',
    category: 'runtime',
    severity: 'high',
    technology: 'Angular',
  },

  // ===========================================================================
  // Docker/Container Errors
  // ===========================================================================
  {
    pattern: /docker.*error/i,
    type: 'DockerError',
    category: 'build',
    severity: 'high',
    technology: 'Docker',
  },
  {
    pattern: /Error response from daemon/i,
    type: 'DockerDaemonError',
    category: 'build',
    severity: 'high',
    technology: 'Docker',
  },
  {
    pattern: /container.*exited with code/i,
    type: 'ContainerExitError',
    category: 'runtime',
    severity: 'high',
    technology: 'Docker',
  },
];

// =============================================================================
// Window Title Error Patterns (less strict, for IDE titles)
// =============================================================================

const WINDOW_TITLE_ERROR_PATTERNS: RegExp[] = [
  /error/i,
  /failed/i,
  /exception/i,
  /crash/i,
  /\(\d+ error/i,           // "(5 errors)" in IDE title
  /\(\d+ problem/i,         // "(5 problems)" in IDE title
  /Debug Console/i,
  /Terminal.*error/i,
];

// =============================================================================
// Error Detector Class
// =============================================================================

export class ErrorDetector extends EventEmitter {
  private config: ErrorDetectorConfig;
  private isRunning: boolean = false;
  private errorHistory: DetectedError[] = [];
  private recentErrorHashes: Map<string, number> = new Map(); // hash -> timestamp
  private clipboardPollingInterval: NodeJS.Timeout | null = null;
  private lastClipboardContent: string = '';

  constructor(config?: Partial<ErrorDetectorConfig>) {
    super();
    this.config = { ...DEFAULT_ERROR_DETECTOR_CONFIG, ...config };
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  start(): void {
    if (this.isRunning || !this.config.enabled) return;

    this.isRunning = true;
    this.startClipboardPolling();

    log.info('[ErrorDetector] Started');
    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.stopClipboardPolling();

    log.info('[ErrorDetector] Stopped');
    this.emit('stopped');
  }

  // ===========================================================================
  // Clipboard Monitoring
  // ===========================================================================

  private startClipboardPolling(): void {
    this.clipboardPollingInterval = setInterval(() => {
      try {
        const content = clipboard.readText();
        if (content && content !== this.lastClipboardContent) {
          this.lastClipboardContent = content;
          this.detectFromClipboard(content);
        }
      } catch (error) {
        log.debug('[ErrorDetector] Clipboard read error:', error);
      }
    }, this.config.clipboardPollingIntervalMs);
  }

  private stopClipboardPolling(): void {
    if (this.clipboardPollingInterval) {
      clearInterval(this.clipboardPollingInterval);
      this.clipboardPollingInterval = null;
    }
  }

  // ===========================================================================
  // Detection Methods
  // ===========================================================================

  /**
   * Detect errors from window title
   * Returns detected error or null
   */
  detectFromWindowTitle(title: string, application?: string): DetectedError | null {
    if (!title || !this.config.enabled) return null;

    // First check if title indicates an error context
    const hasErrorIndicator = WINDOW_TITLE_ERROR_PATTERNS.some(p => p.test(title));
    if (!hasErrorIndicator) return null;

    // Try to detect specific error patterns
    const detectedError = this.detectFromText(title, 'window_title', {
      application,
      windowTitle: title,
    });

    if (detectedError) {
      return detectedError;
    }

    // If we have an error indicator but no specific pattern,
    // create a generic error for IDE error indicators
    const problemMatch = title.match(/\((\d+)\s*(?:error|problem)/i);
    if (problemMatch) {
      const error: DetectedError = {
        id: uuidv4(),
        type: 'IDEProblems',
        message: `${problemMatch[1]} problems detected in ${application || 'editor'}`,
        source: 'window_title',
        severity: 'medium',
        category: 'general',
        timestamp: Date.now(),
        context: {
          application,
          windowTitle: title,
          rawText: title,
        },
      };

      return this.processAndEmitError(error);
    }

    return null;
  }

  /**
   * Detect errors from clipboard content
   * Automatically called by clipboard polling, but can be called manually
   */
  detectFromClipboard(content: string): DetectedError | null {
    if (!content || !this.config.enabled) return null;

    // Check content length bounds
    if (content.length < this.config.minClipboardLength ||
        content.length > this.config.maxClipboardLength) {
      return null;
    }

    return this.detectFromText(content, 'clipboard', {
      rawText: content.substring(0, 500), // Limit stored raw text
    });
  }

  /**
   * Detect errors from arbitrary text content
   * Can be used for screen OCR, log files, etc.
   */
  detectFromText(
    text: string, 
    source: ErrorSource = 'text',
    additionalContext?: Partial<ErrorContext>
  ): DetectedError | null {
    if (!text || !this.config.enabled) return null;

    // Find the first matching pattern
    for (const pattern of ERROR_PATTERNS) {
      const match = text.match(pattern.pattern);
      if (match) {
        // Extract additional information if extractors are defined
        let filePath: string | undefined;
        let lineNumber: number | undefined;
        let extractedMessage: string | undefined;

        if (pattern.extractors) {
          if (pattern.extractors.filePath) {
            const fpMatch = text.match(pattern.extractors.filePath);
            filePath = fpMatch?.[1];
          }
          if (pattern.extractors.lineNumber) {
            const lnMatch = text.match(pattern.extractors.lineNumber);
            lineNumber = lnMatch ? parseInt(lnMatch[1], 10) : undefined;
          }
          if (pattern.extractors.message) {
            const msgMatch = text.match(pattern.extractors.message);
            extractedMessage = msgMatch?.[1];
          }
        }

        // Try to extract file path and line from common patterns
        if (!filePath) {
          const commonFileMatch = text.match(/(?:at\s+|in\s+|file:\s*)?([\/\\]?[\w\-\.\/\\]+\.(?:js|ts|jsx|tsx|py|java|go|rs|cpp|c|h))/i);
          filePath = commonFileMatch?.[1];
        }

        if (!lineNumber) {
          const commonLineMatch = text.match(/:(\d+)(?::\d+)?/);
          lineNumber = commonLineMatch ? parseInt(commonLineMatch[1], 10) : undefined;
        }

        // Extract stack trace if present
        let stackTrace: string | undefined;
        const stackMatch = text.match(/(?:at\s+.+\n?)+/);
        if (stackMatch) {
          stackTrace = stackMatch[0].substring(0, 1000); // Limit stack trace size
        }

        const error: DetectedError = {
          id: uuidv4(),
          type: pattern.type,
          message: extractedMessage || match[0].substring(0, 200),
          source,
          severity: pattern.severity,
          category: pattern.category,
          timestamp: Date.now(),
          context: {
            technology: pattern.technology,
            filePath,
            lineNumber,
            stackTrace,
            ...additionalContext,
          },
        };

        return this.processAndEmitError(error);
      }
    }

    return null;
  }

  // ===========================================================================
  // Error Processing
  // ===========================================================================

  private processAndEmitError(error: DetectedError): DetectedError | null {
    // Check for duplicates
    if (this.isDuplicate(error)) {
      log.debug(`[ErrorDetector] Duplicate error skipped: ${error.type}`);
      return null;
    }

    // Add to history
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.config.maxErrorHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.config.maxErrorHistorySize);
    }

    // Track for deduplication
    const hash = this.computeErrorHash(error);
    this.recentErrorHashes.set(hash, error.timestamp);
    this.cleanupOldHashes();

    // Emit event
    log.info(`[ErrorDetector] Error detected: ${error.type} (${error.severity}) from ${error.source}`);
    this.emit('errorDetected', error);

    return error;
  }

  private isDuplicate(error: DetectedError): boolean {
    const hash = this.computeErrorHash(error);
    const lastSeen = this.recentErrorHashes.get(hash);
    
    if (lastSeen && (Date.now() - lastSeen) < this.config.deduplicationWindowMs) {
      return true;
    }

    return false;
  }

  private computeErrorHash(error: DetectedError): string {
    // Create a hash based on error type, category, and partial message
    const messagePrefix = error.message.substring(0, 50);
    return `${error.type}:${error.category}:${error.source}:${messagePrefix}`;
  }

  private cleanupOldHashes(): void {
    const now = Date.now();
    const expiry = this.config.deduplicationWindowMs;

    // Convert to array to avoid iterator issues with older TypeScript targets
    const entries = Array.from(this.recentErrorHashes.entries());
    for (const [hash, timestamp] of entries) {
      if (now - timestamp > expiry) {
        this.recentErrorHashes.delete(hash);
      }
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Get recent error history
   */
  getErrorHistory(limit?: number): DetectedError[] {
    const errors = [...this.errorHistory];
    return limit ? errors.slice(-limit) : errors;
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): DetectedError[] {
    return this.errorHistory.filter(e => e.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): DetectedError[] {
    return this.errorHistory.filter(e => e.severity === severity);
  }

  /**
   * Get errors by technology
   */
  getErrorsByTechnology(technology: string): DetectedError[] {
    return this.errorHistory.filter(
      e => e.context.technology?.toLowerCase() === technology.toLowerCase()
    );
  }

  /**
   * Get recent high-severity errors
   */
  getRecentCriticalErrors(windowMs: number = 300000): DetectedError[] {
    const cutoff = Date.now() - windowMs;
    return this.errorHistory.filter(
      e => e.timestamp >= cutoff && 
           (e.severity === 'high' || e.severity === 'critical')
    );
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
    this.recentErrorHashes.clear();
    log.info('[ErrorDetector] History cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorDetectorConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    // Handle enable/disable
    if (config.enabled !== undefined) {
      if (config.enabled && !wasEnabled && this.isRunning) {
        this.startClipboardPolling();
      } else if (!config.enabled && wasEnabled) {
        this.stopClipboardPolling();
      }
    }

    // Update clipboard polling interval if changed
    if (config.clipboardPollingIntervalMs !== undefined && this.clipboardPollingInterval) {
      this.stopClipboardPolling();
      this.startClipboardPolling();
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    errorCount: number;
    recentErrorCount: number;
    config: ErrorDetectorConfig;
  } {
    const now = Date.now();
    const recentWindow = 300000; // 5 minutes
    
    return {
      isRunning: this.isRunning,
      errorCount: this.errorHistory.length,
      recentErrorCount: this.errorHistory.filter(e => now - e.timestamp < recentWindow).length,
      config: { ...this.config },
    };
  }

  /**
   * Manually analyze text for errors (useful for testing or one-off analysis)
   */
  analyzeText(text: string): DetectedError[] {
    const errors: DetectedError[] = [];
    
    // Split into lines and analyze each
    const lines = text.split('\n');
    for (const line of lines) {
      const error = this.detectFromText(line, 'text');
      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Get supported error patterns (useful for debugging/documentation)
   */
  getSupportedPatterns(): Array<{
    type: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    technology?: string;
  }> {
    return ERROR_PATTERNS.map(p => ({
      type: p.type,
      category: p.category,
      severity: p.severity,
      technology: p.technology,
    }));
  }
}

export default ErrorDetector;
