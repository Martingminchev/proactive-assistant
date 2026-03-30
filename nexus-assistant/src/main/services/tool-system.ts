// =============================================================================
// NEXUS - Tool System
// Tool registry and execution system for AI-powered operations
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import { desktopCapturer, clipboard, screen } from 'electron';
import { glob } from 'glob';
import {
  ToolDefinition,
  ToolCallRequest,
  ToolExecutionResult,
  SystemContext,
  ClipboardItem,
} from '../../shared/types';
import { PiecesContextProvider } from './pieces-context-provider';
import { registerAllTools } from '../tools';

// =============================================================================
// Tool Handler Type
// =============================================================================

type ToolHandler = (args: any, context: ToolExecutionContext) => Promise<ToolExecutionResult>;

interface ToolExecutionContext {
  systemContext?: SystemContext;
  conversationId?: string;
  messageId?: string;
  /** Called by display_message tool to show formatted output in chat */
  onDisplayMessage?: (message: string, title?: string, messageType?: 'info' | 'success' | 'warning' | 'error') => void;
  /** Called by ask_user tool to get user input; returns Promise that resolves with the user's answer */
  onAskUser?: (question: string, options?: string[], inputType?: 'text' | 'choice' | 'confirm') => Promise<string>;
}

export type ToolConfirmationHook = (
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<boolean>;

interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
  timeoutMs: number;
  requireConfirmation: boolean;
}

// =============================================================================
// Tool Registry Class
// =============================================================================

export class ToolRegistry extends EventEmitter {
  private tools: Map<string, RegisteredTool> = new Map();
  private clipboardHistory: ClipboardItem[] = [];
  private reminders: Map<string, NodeJS.Timeout> = new Map();
  private confirmationHook: ToolConfirmationHook | null = null;
  private piecesContextProvider: PiecesContextProvider | null = null;

  constructor() {
    super();
    this.registerDefaultTools();
    this.startClipboardMonitoring();
  }

  // ===========================================================================
  // Tool Registration
  // ===========================================================================

  registerTool(
    definition: ToolDefinition,
    handler: ToolHandler,
    options?: {
      timeoutMs?: number;
      requireConfirmation?: boolean;
    }
  ): void {
    this.tools.set(definition.function.name, {
      definition,
      handler,
      timeoutMs: options?.timeoutMs ?? 30000,
      requireConfirmation: options?.requireConfirmation ?? false,
    });
    log.debug(`[ToolRegistry] Registered tool: ${definition.function.name}`);
  }

  unregisterTool(name: string): void {
    this.tools.delete(name);
    log.debug(`[ToolRegistry] Unregistered tool: ${name}`);
  }

  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  setConfirmationHook(hook: ToolConfirmationHook | null): void {
    this.confirmationHook = hook;
  }

  setPiecesContextProvider(provider: PiecesContextProvider | null): void {
    this.piecesContextProvider = provider;
  }

  // ===========================================================================
  // Tool Execution
  // ===========================================================================

  async executeTool(
    toolCall: ToolCallRequest,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolCall.function.name);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolCall.function.name}' not found`,
        duration: 0,
      };
    }

    const startTime = Date.now();
    
    try {
      // Parse arguments
      let args: any;
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch (e) {
        return {
          success: false,
          error: `Invalid JSON arguments: ${e instanceof Error ? e.message : 'Unknown error'}`,
          duration: Date.now() - startTime,
        };
      }

      // Check confirmation for tools that require it
      if (tool.requireConfirmation && this.confirmationHook) {
        const approved = await this.confirmationHook(toolCall.function.name, args, context);
        if (!approved) {
          return {
            success: false,
            error: 'User denied permission',
            duration: Date.now() - startTime,
          };
        }
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => tool.handler(args, context),
        tool.timeoutMs,
        toolCall.function.name
      );

      const duration = Date.now() - startTime;
      
      return {
        ...result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during tool execution',
        duration,
      };
    }
  }

  private executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    toolName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tool '${toolName}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  // ===========================================================================
  // Default Tool Registration
  // ===========================================================================

  private registerDefaultTools(): void {
    this.registerGetCurrentContextTool();
    this.registerTakeScreenshotTool();
    this.registerOpenFileTool();
    this.registerRunCommandTool();
    this.registerSearchFilesTool();
    this.registerSetReminderTool();
    this.registerGetClipboardHistoryTool();
    this.registerRequestExtraContextTool();
    this.registerDisplayMessageTool();
    this.registerAskUserTool();
    registerAllTools(this);
  }

  // ===========================================================================
  // Tool 1: get_current_context
  // ===========================================================================

  private registerGetCurrentContextTool(): void {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'get_current_context',
        description: 'Get the current system context including active window, system resources (CPU, memory, battery), and recent clipboard items. Use this to understand what the user is currently working on.',
        parameters: {
          type: 'object',
          properties: {
            includeClipboard: {
              type: 'boolean',
              description: 'Whether to include recent clipboard history',
              default: false,
            },
            includeResources: {
              type: 'boolean',
              description: 'Whether to include system resources (CPU, memory, battery)',
              default: true,
            },
          },
        },
      },
    };

    const handler: ToolHandler = async (args, context) => {
      const includeClipboard = args.includeClipboard ?? false;
      const includeResources = args.includeResources ?? true;

      const result: any = {};

      // Active window info from context
      if (context.systemContext?.activeWindow) {
        result.activeWindow = context.systemContext.activeWindow;
      }

      // System resources
      if (includeResources && context.systemContext?.systemResources) {
        result.systemResources = context.systemContext.systemResources;
      }

      // Clipboard history (more items, each truncated)
      if (includeClipboard) {
        const maxItems = 15;
        const maxPerItem = 150;
        result.clipboardHistory = this.clipboardHistory.slice(-maxItems).map((item: ClipboardItem) => ({
          ...item,
          content: typeof item.content === 'string' && item.content.length > maxPerItem
            ? item.content.substring(0, maxPerItem) + '...'
            : item.content,
        }));
      }

      return {
        success: true,
        data: result,
      };
    };

    this.registerTool(definition, handler, { timeoutMs: 5000 });
  }

  // ===========================================================================
  // Tool 2: take_screenshot
  // ===========================================================================

  private registerTakeScreenshotTool(): void {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'take_screenshot',
        description: 'Capture a screenshot of the primary display. Returns capture confirmation and dimensions (image data omitted for context limits).',
        parameters: {
          type: 'object',
          properties: {
            fullScreen: {
              type: 'boolean',
              description: 'Whether to capture the full screen (true) or just the active window (false, not yet supported)',
              default: true,
            },
          },
        },
      },
    };

    const handler: ToolHandler = async () => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: screen.getPrimaryDisplay().workAreaSize,
        });

        if (sources.length === 0) {
          return {
            success: false,
            error: 'No screen sources found',
          };
        }

        const primarySource = sources[0];
        const thumbnail = primarySource.thumbnail;
        const { width, height } = thumbnail.getSize();

        return {
          success: true,
          data: {
            captured: true,
            dimensions: `${width}x${height}`,
            note: 'Screenshot captured.',
            sourceName: primarySource.name,
            width,
            height,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    };

    this.registerTool(definition, handler, { timeoutMs: 10000 });
  }

  // ===========================================================================
  // Tool 3: open_file
  // ===========================================================================

  private registerOpenFileTool(): void {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'open_file',
        description: 'Open a file in its default application. Use this when the user wants to view or edit a file.',
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'The absolute or relative path to the file to open',
            },
            createIfNotExists: {
              type: 'boolean',
              description: 'Whether to create the file if it does not exist',
              default: false,
            },
          },
          required: ['filePath'],
        },
      },
    };

    const handler: ToolHandler = async (args) => {
      const { filePath, createIfNotExists = false } = args;

      if (!filePath) {
        return {
          success: false,
          error: 'File path is required',
        };
      }

      try {
        const absolutePath = path.resolve(filePath);

        // Security: Check for path traversal
        if (absolutePath.includes('..')) {
          return {
            success: false,
            error: 'Path traversal detected',
          };
        }

        // Check if file exists
        try {
          await fs.access(absolutePath);
        } catch {
          if (createIfNotExists) {
            // Create parent directories
            const dir = path.dirname(absolutePath);
            await fs.mkdir(dir, { recursive: true });
            // Create empty file
            await fs.writeFile(absolutePath, '', 'utf-8');
          } else {
            return {
              success: false,
              error: `File not found: ${absolutePath}`,
            };
          }
        }

        // Open the file
        const { shell } = await import('electron');
        const result = await shell.openPath(absolutePath);

        if (result) {
          return {
            success: false,
            error: `Failed to open file: ${result}`,
          };
        }

        return {
          success: true,
          data: { filePath: absolutePath },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to open file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    };

    this.registerTool(definition, handler, { 
      timeoutMs: 10000, 
      requireConfirmation: true 
    });
  }

  // ===========================================================================
  // Tool 4: run_command
  // ===========================================================================

  private registerRunCommandTool(): void {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'run_command',
        description: 'Execute a shell command. Use this for tasks like running tests, building projects, checking git status, etc.',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The command to execute',
            },
            workingDirectory: {
              type: 'string',
              description: 'The working directory for the command (defaults to current)',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 30000, max: 120000)',
              default: 30000,
            },
          },
          required: ['command'],
        },
      },
    };

    const handler: ToolHandler = async (args) => {
      const { command, workingDirectory, timeout = 30000 } = args;

      if (!command) {
        return {
          success: false,
          error: 'Command is required',
        };
      }

      // Security: Check for dangerous commands
      if (this.isDangerousCommand(command)) {
        return {
          success: false,
          error: 'Command blocked for security reasons',
        };
      }

      // Clamp timeout
      const effectiveTimeout = Math.min(Math.max(timeout, 1000), 120000);

      return new Promise((resolve) => {
        const options: any = {
          timeout: effectiveTimeout,
          maxBuffer: 1024 * 1024, // 1MB
        };

        if (workingDirectory) {
          options.cwd = workingDirectory;
        }

        const truncateStream = (s: string | undefined, maxTotal: number, lineMax: number, keepFirst: number, keepLast: number) => {
          const str = s?.toString() ?? '';
          if (str.length <= maxTotal) return str;
          const lines = str.split('\n');
          const truncateLine = (line: string) => line.length > lineMax ? line.substring(0, lineMax) + '...' : line;
          if (lines.length <= keepFirst + keepLast) {
            return lines.map(truncateLine).join('\n').substring(0, maxTotal) + '... [truncated]';
          }
          const first = lines.slice(0, keepFirst).map(truncateLine).join('\n');
          const last = lines.slice(-keepLast).map(truncateLine).join('\n');
          return first + '\n... [' + (lines.length - keepFirst - keepLast) + ' lines omitted]\n' + last;
        };
        const maxStream = 3000;
        const lineMax = 120;
        const keepFirst = 50;
        const keepLast = 20;

        exec(command, options, (error, stdout, stderr) => {
          if (error) {
            resolve({
              success: false,
              error: error.message,
              data: {
                stdout: truncateStream(stdout?.toString(), maxStream, lineMax, keepFirst, keepLast),
                stderr: truncateStream(stderr?.toString(), maxStream, lineMax, keepFirst, keepLast),
                exitCode: error.code,
              },
            });
          } else {
            resolve({
              success: true,
              data: {
                stdout: truncateStream(stdout?.toString(), maxStream, lineMax, keepFirst, keepLast),
                stderr: truncateStream(stderr?.toString(), maxStream, lineMax, keepFirst, keepLast),
                exitCode: 0,
              },
            });
          }
        });
      });
    };

    this.registerTool(definition, handler, { 
      timeoutMs: 120000, 
      requireConfirmation: true 
    });
  }

  // ===========================================================================
  // Tool 5: search_files
  // ===========================================================================

  private registerSearchFilesTool(): void {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'search_files',
        description: 'Search for files matching a glob pattern or containing specific text. Use this to find files in the project.',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Glob pattern to match files (e.g., "*.ts", "src/**/*.js")',
            },
            searchText: {
              type: 'string',
              description: 'Optional text to search for within files',
            },
            directory: {
              type: 'string',
              description: 'Directory to search in (defaults to current)',
              default: '.',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 30,
            },
          },
          required: ['pattern'],
        },
      },
    };

    const handler: ToolHandler = async (args) => {
      const { pattern, searchText, directory = '.', maxResults = 30 } = args;
      const maxPathLen = 120;

      try {
        const searchDir = path.resolve(directory);

        // Security: Check for path traversal
        if (searchDir.includes('..')) {
          return {
            success: false,
            error: 'Path traversal detected',
          };
        }

        // Find files matching pattern
        const files = await glob(pattern, {
          cwd: searchDir,
          absolute: true,
          nodir: true,
          maxdepth: 10,
        });

        let results = files.slice(0, maxResults);

        // If searchText is provided, filter files containing the text
        if (searchText) {
          const filteredResults: string[] = [];
          
          for (const file of results) {
            try {
              // Skip binary files
              const ext = path.extname(file).toLowerCase();
              const binaryExts = ['.exe', '.dll', '.bin', '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip'];
              if (binaryExts.includes(ext)) continue;

              const content = await fs.readFile(file, 'utf-8');
              if (content.includes(searchText)) {
                filteredResults.push(file);
              }
            } catch {
              // Skip files that can't be read
              continue;
            }
          }

          results = filteredResults;
        }

        const truncatedFiles = results.map(f => f.length > maxPathLen ? f.substring(0, maxPathLen) + '...' : f);

        return {
          success: true,
          data: {
            files: truncatedFiles,
            totalFound: files.length,
            returned: results.length,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    };

    this.registerTool(definition, handler, { timeoutMs: 30000 });
  }

  // ===========================================================================
  // Tool 6: set_reminder
  // ===========================================================================

  private registerSetReminderTool(): void {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'set_reminder',
        description: 'Set a reminder that will notify the user after a specified delay.',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The reminder message',
            },
            delayMinutes: {
              type: 'number',
              description: 'Number of minutes to wait before showing the reminder',
              minimum: 1,
              maximum: 1440, // 24 hours
            },
            title: {
              type: 'string',
              description: 'Optional title for the reminder',
              default: 'NEXUS Reminder',
            },
          },
          required: ['message', 'delayMinutes'],
        },
      },
    };

    const handler: ToolHandler = async (args) => {
      const { message, delayMinutes, title = 'NEXUS Reminder' } = args;

      if (!message || typeof delayMinutes !== 'number') {
        return {
          success: false,
          error: 'Message and delayMinutes are required',
        };
      }

      // Validate delay
      if (delayMinutes < 1 || delayMinutes > 1440) {
        return {
          success: false,
          error: 'delayMinutes must be between 1 and 1440 (24 hours)',
        };
      }

      const delayMs = delayMinutes * 60 * 1000;
      const reminderId = `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const timeout = setTimeout(async () => {
        try {
          const { Notification } = await import('electron');
          const notification = new Notification({
            title,
            body: message,
            silent: false,
          });
          notification.show();
          this.emit('reminder-triggered', { id: reminderId, message, title });
        } catch (error) {
          log.error('[ToolRegistry] Failed to show reminder:', error);
        }
        this.reminders.delete(reminderId);
      }, delayMs);

      this.reminders.set(reminderId, timeout);

      const scheduledTime = new Date(Date.now() + delayMs);

      return {
        success: true,
        data: {
          reminderId,
          scheduledFor: scheduledTime.toISOString(),
          message,
          delayMinutes,
        },
      };
    };

    this.registerTool(definition, handler, { timeoutMs: 5000 });
  }

  // ===========================================================================
  // Tool 7: get_clipboard_history
  // ===========================================================================

  private registerGetClipboardHistoryTool(): void {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'get_clipboard_history',
        description: 'Get the recent clipboard history including text items. Use this to help the user access previously copied content.',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of clipboard items to return (max 20)',
              default: 15,
              maximum: 20,
            },
            type: {
              type: 'string',
              description: 'Filter by type: "text", "image", "html", or "all"',
              enum: ['text', 'image', 'html', 'all'],
              default: 'all',
            },
          },
        },
      },
    };

    const handler: ToolHandler = async (args) => {
      const { limit = 15, type = 'all' } = args;
      const effectiveLimit = Math.min(Math.max(limit, 1), 20);
      const maxPerItem = 150;

      let items = this.clipboardHistory;

      // Filter by type if specified
      if (type !== 'all') {
        items = items.filter(item => item.type === type);
      }

      // Return most recent items first, truncate each for context limits
      const result = items.slice(-effectiveLimit).reverse().map(item => ({
        ...item,
        content: typeof item.content === 'string' && item.content.length > maxPerItem
          ? item.content.substring(0, maxPerItem) + '...'
          : item.content,
      }));

      return {
        success: true,
        data: {
          items: result,
          total: this.clipboardHistory.length,
        },
      };
    };

    this.registerTool(definition, handler, { timeoutMs: 1000 });
  }

  // ===========================================================================
  // Tool: request_extra_context
  // ===========================================================================

  private registerRequestExtraContextTool(): void {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'request_extra_context',
        description: 'Request additional context from Pieces (QGPT, LTM, saved snippets) when you need more information to answer accurately. Use this before responding when initial context seems insufficient. You can call it multiple times with different types.',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Type of context to fetch',
              enum: ['qgpt', 'ltm', 'ltm_debug', 'ltm_browsing', 'ltm_topic', 'ltm_coding', 'pieces_assets'],
            },
            query: {
              type: 'string',
              description: 'Query/question for qgpt, ltm, or pieces_assets',
            },
            topic: {
              type: 'string',
              description: 'Topic for ltm_topic',
            },
            hoursBack: {
              type: 'number',
              description: 'Hours to look back for ltm_coding (default 24)',
              default: 24,
            },
            maxAssets: {
              type: 'number',
              description: 'Max assets for pieces_assets (default 5)',
              default: 5,
            },
          },
        },
      },
    };

    const handler: ToolHandler = async (args) => {
      const provider = this.piecesContextProvider;
      if (!provider) {
        return { success: false, error: 'Pieces integration not available' };
      }

      const type = args.type || 'ltm';
      const query = args.query || '';
      const topic = args.topic || '';
      const hoursBack = args.hoursBack ?? 24;
      const maxAssets = Math.min(Math.max(args.maxAssets ?? 5, 1), 10);

      let result;
      switch (type) {
        case 'qgpt':
          result = await provider.queryQGPT(query || 'What is relevant to the user\'s current question?');
          break;
        case 'ltm':
          result = await provider.queryLTM(query || 'What context from my recent work is relevant?');
          break;
        case 'ltm_debug':
          result = await provider.queryLTMDebug();
          break;
        case 'ltm_browsing':
          result = await provider.queryLTMBrowsing();
          break;
        case 'ltm_topic':
          result = await provider.queryLTMTopic(topic || query || 'recent work');
          break;
        case 'ltm_coding':
          result = await provider.queryLTMCoding(hoursBack);
          break;
        case 'pieces_assets':
          result = await provider.getRelevantAssets(query || topic || 'code', maxAssets);
          break;
        default:
          return { success: false, error: `Unknown context type: ${type}` };
      }

      if (!result.success) {
        return { success: false, error: result.error || 'Context fetch failed' };
      }

      return {
        success: true,
        data: result.data,
      };
    };

    this.registerTool(definition, handler, { timeoutMs: 15000 });
  }

  // ===========================================================================
  // Tool: display_message
  // ===========================================================================

  private registerDisplayMessageTool(): void {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'display_message',
        description: 'Display a formatted message to the user in the chat. Use when you want to show output, status, or structured information (e.g. lists, code snippets) directly to the user.',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Markdown content to display',
            },
            title: {
              type: 'string',
              description: 'Optional short title',
            },
            type: {
              type: 'string',
              description: 'Message style',
              enum: ['info', 'success', 'warning', 'error'],
              default: 'info',
            },
          },
          required: ['message'],
        },
      },
    };

    const handler: ToolHandler = async (args, context) => {
      const message = String(args.message ?? '');
      const title = args.title != null ? String(args.title) : undefined;
      const messageType = (['info', 'success', 'warning', 'error'] as const).includes(args.type as any)
        ? (args.type as 'info' | 'success' | 'warning' | 'error')
        : 'info';
      context.onDisplayMessage?.(message, title, messageType);
      return { success: true, data: { displayed: true } };
    };

    this.registerTool(definition, handler, { timeoutMs: 2000, requireConfirmation: false });
  }

  // ===========================================================================
  // Tool: ask_user
  // ===========================================================================

  private registerAskUserTool(): void {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'ask_user',
        description: 'Ask the user a question and wait for their response. Use when you need clarification, confirmation, or a choice before continuing (e.g. "Which file?", "Proceed with overwrite?").',
        parameters: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question to ask the user',
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional multiple choice options; user picks one',
            },
            inputType: {
              type: 'string',
              enum: ['text', 'choice', 'confirm'],
              description: 'text = free text, choice = pick from options, confirm = yes/no',
              default: 'text',
            },
          },
          required: ['question'],
        },
      },
    };

    const handler: ToolHandler = async (args, context) => {
      const question = String(args.question ?? '');
      const options = Array.isArray(args.options) ? (args.options as string[]).filter((o) => typeof o === 'string') : undefined;
      const inputType = (['text', 'choice', 'confirm'] as const).includes(args.inputType as any)
        ? (args.inputType as 'text' | 'choice' | 'confirm')
        : 'text';
      if (!context.onAskUser) {
        return { success: false, error: 'User input not available in this context' };
      }
      try {
        const answer = await context.onAskUser(question, options, inputType);
        return { success: true, data: { answer } };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'User did not respond',
        };
      }
    };

    this.registerTool(definition, handler, { timeoutMs: 300000, requireConfirmation: false });
  }

  // ===========================================================================
  // Security Helpers
  // ===========================================================================

  private isDangerousCommand(command: string): boolean {
    const dangerousPatterns = [
      // File deletion patterns
      /rm\s+-rf\s+[\/~]/i,
      /rm\s+-rf\s+\//i,
      /rmdir\s+\/s\s+\/q/i,
      /del\s+\/f\s+\/s\s+\/q/i,
      
      // Disk/format operations
      /format\s+[a-z]:/i,
      /mkfs/i,
      /dd\s+if=/i,
      />\s*\/dev\//i,
      /diskpart/i,
      
      // System shutdown/reboot
      /shutdown/i,
      /reboot/i,
      /init\s+0/i,
      /init\s+6/i,
      /systemctl\s+poweroff/i,
      /systemctl\s+reboot/i,
      
      // Fork bombs and resource exhaustion
      /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;\s*:/i,
      /while\s*\(\s*true\s*\)\s*;\s*do/i,
      /for\s*\(\s*;;\s*\)/i,
      
      // Encoded/Obfuscated commands
      /powershell\s+-enc/i,
      /powershell\s+-encodedcommand/i,
      /iex\s+\(/i,
      /invoke-expression/i,
      /frombase64string/i,
      
      // Remote execution
      /curl\s+.*\|.*sh/i,
      /wget\s+.*\|.*sh/i,
      /curl\s+.*\|.*bash/i,
      /wget\s+.*\|.*bash/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        log.warn('[ToolRegistry] Dangerous command detected:', command);
        return true;
      }
    }

    return false;
  }

  // ===========================================================================
  // Clipboard Monitoring
  // ===========================================================================

  private clipboardInterval: NodeJS.Timeout | null = null;

  private startClipboardMonitoring(): void {
    // Check clipboard every second
    this.clipboardInterval = setInterval(() => {
      this.checkClipboard();
    }, 1000);
  }

  private lastClipboardText = '';

  private async checkClipboard(): Promise<void> {
    try {
      const text = clipboard.readText();
      
      if (text && text !== this.lastClipboardText) {
        this.lastClipboardText = text;
        
        // Create hash for deduplication
        const hash = Buffer.from(text).toString('base64').slice(0, 16);
        
        // Check if this content is already in history
        const exists = this.clipboardHistory.some(item => item.hash === hash);
        
        if (!exists) {
          this.clipboardHistory.push({
            type: 'text',
            content: text.length > 1000 ? text.slice(0, 1000) + '...' : text,
            timestamp: Date.now(),
            hash,
          });

          // Keep only last 50 items
          if (this.clipboardHistory.length > 50) {
            this.clipboardHistory = this.clipboardHistory.slice(-50);
          }

          this.emit('clipboard-updated', { type: 'text', hash });
        }
      }
    } catch (error) {
      // Ignore clipboard errors
    }
  }

  stopClipboardMonitoring(): void {
    if (this.clipboardInterval) {
      clearInterval(this.clipboardInterval);
      this.clipboardInterval = null;
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  cleanup(): void {
    this.stopClipboardMonitoring();
    
    // Clear all reminders
    for (const [id, timeout] of this.reminders) {
      clearTimeout(timeout);
    }
    this.reminders.clear();
    
    this.removeAllListeners();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let toolRegistryInstance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistryInstance) {
    toolRegistryInstance = new ToolRegistry();
  }
  return toolRegistryInstance;
}

export default ToolRegistry;
