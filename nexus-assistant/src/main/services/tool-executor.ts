// =============================================================================
// NEXUS - Tool Executor
// Multi-turn tool execution system for AI interactions
// =============================================================================

import { EventEmitter } from 'events';
import {
  ToolDefinition,
  ToolCall,
  ToolExecutionEvent,
  Message,
  MessageRole,
} from '../../shared/types';
import { ToolRegistry } from './tool-system';
import { KimiClient } from './kimi-client';
import { SystemContext } from '../../shared/types';

// =============================================================================
// Types
// =============================================================================

interface ToolExecutionState {
  conversationId: string;
  messageId: string;
  isExecuting: boolean;
  toolCalls: ToolCall[];
  results: Map<string, any>;
  startTime: number;
  aborted: boolean;
}

interface ToolExecutorOptions {
  maxIterations: number;
  defaultModel: string;
  timeoutMs: number;
}

interface StreamCallbacks {
  onToolStart?: (toolName: string, toolCallId: string, args?: string) => void;
  onToolComplete?: (toolName: string, toolCallId: string, result: any) => void;
  onToolError?: (toolName: string, toolCallId: string, error: string) => void;
  onContent?: (content: string) => void;
  onThinking?: (thinking: string) => void;
  onComplete?: (message: Message) => void;
  onError?: (error: string) => void;
  onDisplayMessage?: (message: string, title?: string, messageType?: 'info' | 'success' | 'warning' | 'error') => void;
  onAskUser?: (question: string, options?: string[], inputType?: 'text' | 'choice' | 'confirm') => Promise<string>;
}

// =============================================================================
// Tool Executor Class
// =============================================================================

export class ToolExecutor extends EventEmitter {
  private toolRegistry: ToolRegistry;
  private kimiClient: KimiClient;
  private state: Map<string, ToolExecutionState> = new Map();
  private options: ToolExecutorOptions;

  constructor(
    toolRegistry: ToolRegistry,
    kimiClient: KimiClient,
    options?: Partial<ToolExecutorOptions>
  ) {
    super();
    this.toolRegistry = toolRegistry;
    this.kimiClient = kimiClient;
    this.options = {
      maxIterations: 15,
      defaultModel: 'kimi-k2.5',
      timeoutMs: 120000,
      ...options,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Execute a chat with potential tool calls (multi-turn)
   */
  async executeWithTools(
    conversationId: string,
    messages: Message[],
    systemContext?: SystemContext,
    callbacks?: StreamCallbacks,
    abortSignal?: AbortSignal
  ): Promise<Message> {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize state
    const state: ToolExecutionState = {
      conversationId,
      messageId,
      isExecuting: true,
      toolCalls: [],
      results: new Map(),
      startTime: Date.now(),
      aborted: false,
    };
    
    this.state.set(messageId, state);

    try {
      // Get available tools
      const tools = this.toolRegistry.getAllTools();
      
      // Prepare messages for API
      const apiMessages = this.prepareMessages(messages);

      let iteration = 0;
      let finalMessage: Message | null = null;
      let lastToolCalls: ToolCall[] = [];
      let lastToolResults: Array<{ toolCallId: string; success: boolean; data?: any; error?: string }> = [];

      while (iteration < this.options.maxIterations) {
        // Check for abort
        if (abortSignal?.aborted || state.aborted) {
          throw new Error('Execution aborted');
        }

        // Stream the completion
        const streamResult = await this.streamCompletion(
          apiMessages,
          tools,
          messageId,
          callbacks,
          abortSignal
        );

        // If no tool calls, we're done
        if (!streamResult.toolCalls || streamResult.toolCalls.length === 0) {
          finalMessage = this.createFinalMessage(streamResult, messageId);
          break;
        }

        // Execute tool calls
        const toolResults = await this.executeToolCalls(
          streamResult.toolCalls,
          systemContext,
          messageId,
          callbacks
        );

        lastToolCalls = streamResult.toolCalls;
        lastToolResults = toolResults;

        // Add assistant message with tool calls to history
        // reasoning_content required for Kimi thinking-enabled models when message has tool_calls
        apiMessages.push({
          role: 'assistant',
          content: streamResult.content || '',
          tool_calls: streamResult.toolCalls,
          reasoning_content: streamResult.thinking ?? '',
        });

        // Add tool results to history (truncated to stay within token limits)
        for (let i = 0; i < toolResults.length; i++) {
          const result = toolResults[i];
          const toolName = streamResult.toolCalls[i]?.function?.name ?? 'unknown';
          const content = this.truncateToolResult(toolName, result);
          apiMessages.push({
            role: 'tool',
            content,
            tool_call_id: result.toolCallId,
          });
        }

        iteration++;
      }

      // Graceful degradation: if we hit the limit, synthesize a summary from the last tool results
      if (!finalMessage && lastToolCalls.length > 0) {
        finalMessage = this.createSummaryFromToolResults(
          messageId,
          lastToolCalls,
          lastToolResults
        );
      }

      if (!finalMessage) {
        throw new Error('Max iterations reached without final response');
      }

      state.isExecuting = false;
      callbacks?.onComplete?.(finalMessage);
      return finalMessage;

    } catch (error) {
      state.isExecuting = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      callbacks?.onError?.(errorMessage);
      throw error;
    } finally {
      this.state.delete(messageId);
    }
  }

  /**
   * Handle tool calls from a streaming response
   */
  async handleToolCalls(
    toolCalls: ToolCall[],
    systemContext?: SystemContext,
    conversationId?: string
  ): Promise<Array<{ toolCallId: string; success: boolean; data?: any; error?: string }>> {
    const results: Array<{ toolCallId: string; success: boolean; data?: any; error?: string }> = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.toolRegistry.executeTool(
          {
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          },
          {
            systemContext,
            conversationId,
          }
        );

        results.push({
          toolCallId: toolCall.id,
          success: result.success,
          data: result.data,
          error: result.error,
        });

        // Emit event
        this.emit('tool-executed', {
          toolName: toolCall.function.name,
          toolCallId: toolCall.id,
          result,
        } as ToolExecutionEvent);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          toolCallId: toolCall.id,
          success: false,
          error: errorMessage,
        });

        this.emit('tool-error', {
          toolName: toolCall.function.name,
          toolCallId: toolCall.id,
          error: errorMessage,
        } as ToolExecutionEvent);
      }
    }

    return results;
  }

  /**
   * Get the final response after all tool calls have been executed
   */
  async getFinalResponse(
    messages: Message[],
    toolResults: Array<{ toolCallId: string; success: boolean; data?: any; error?: string }>,
    callbacks?: StreamCallbacks,
    abortSignal?: AbortSignal
  ): Promise<Message> {
    const apiMessages = this.prepareMessages(messages);
    
    // Add tool results as tool role messages
    for (const result of toolResults) {
      apiMessages.push({
        role: 'tool',
        content: JSON.stringify({
          success: result.success,
          data: result.data,
          error: result.error,
        }),
        tool_call_id: result.toolCallId,
      });
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const stream = this.kimiClient.streamChatCompletion({
      model: this.options.defaultModel,
      messages: apiMessages,
      max_tokens: 4096,
    });

    let content = '';
    let thinking = '';

    try {
      for await (const chunk of stream) {
        if (abortSignal?.aborted) {
          throw new Error('Execution aborted');
        }

        const delta = chunk.choices[0]?.delta;

        if (delta?.reasoning_content) {
          thinking += delta.reasoning_content;
          callbacks?.onThinking?.(delta.reasoning_content);
        }

        if (delta?.content) {
          content += delta.content;
          callbacks?.onContent?.(delta.content);
        }
      }

      const finalMessage: Message = {
        id: messageId,
        role: 'assistant',
        content: content || 'No response',
        timestamp: Date.now(),
        metadata: thinking ? { thinking } : undefined,
      };

      callbacks?.onComplete?.(finalMessage);
      return finalMessage;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      callbacks?.onError?.(errorMessage);
      throw error;
    }
  }

  /**
   * Cancel an ongoing execution
   */
  cancel(messageId: string): boolean {
    const state = this.state.get(messageId);
    if (state && state.isExecuting) {
      state.aborted = true;
      return true;
    }
    return false;
  }

  /**
   * Get current execution state
   */
  getState(messageId: string): ToolExecutionState | undefined {
    return this.state.get(messageId);
  }

  /**
   * Check if an execution is in progress
   */
  isExecuting(messageId: string): boolean {
    const state = this.state.get(messageId);
    return state?.isExecuting ?? false;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private static readonly MAX_TOOL_RESULT_CHARS = 4000;
  private static readonly MAX_STREAM_CHARS = 2500;
  private static readonly MAX_ITEM_CHARS = 150;

  private truncateToolResult(
    toolName: string,
    result: { toolCallId: string; success: boolean; data?: any; error?: string }
  ): string {
    const { success, data, error } = result;

    if (!success && error) {
      return JSON.stringify({ success: false, error });
    }

    if (toolName === 'take_screenshot' && data) {
      const w = data.width ?? 0;
      const h = data.height ?? 0;
      return JSON.stringify({ captured: true, dimensions: `${w}x${h}`, note: 'Screenshot captured.' });
    }

    if (toolName === 'run_command' && data) {
      const truncateStream = (s: string | undefined, max: number) => {
        if (!s || typeof s !== 'string') return s ?? '';
        if (s.length <= max) return s;
        const lines = s.split('\n');
        const keepFirst = 15;
        const keepLast = 10;
        const lineMax = 100;
        const truncateLine = (line: string) =>
          line.length > lineMax ? line.substring(0, lineMax) + '...' : line;
        if (lines.length <= keepFirst + keepLast) {
          return lines.map(truncateLine).join('\n').substring(0, max) + '... [truncated]';
        }
        const first = lines.slice(0, keepFirst).map(truncateLine).join('\n');
        const last = lines.slice(-keepLast).map(truncateLine).join('\n');
        return first + '\n... [' + (lines.length - keepFirst - keepLast) + ' lines omitted]\n' + last;
      };
      return JSON.stringify({
        stdout: truncateStream(data.stdout, ToolExecutor.MAX_STREAM_CHARS),
        stderr: truncateStream(data.stderr, ToolExecutor.MAX_STREAM_CHARS),
        exitCode: data.exitCode,
      });
    }

    if ((toolName === 'get_clipboard_history' || toolName === 'get_current_context') && data) {
      const truncateItems = (items: any[], maxPer: number) => {
        if (!Array.isArray(items)) return items;
        return items.slice(0, 15).map((item: any) => {
          if (typeof item === 'string') {
            return item.length > maxPer ? item.substring(0, maxPer) + '...' : item;
          }
          if (item && typeof item.content === 'string') {
            return { ...item, content: item.content.length > maxPer ? item.content.substring(0, maxPer) + '...' : item.content };
          }
          return item;
        });
      };
      const out = { ...data };
      if (out.clipboardHistory) out.clipboardHistory = truncateItems(out.clipboardHistory, ToolExecutor.MAX_ITEM_CHARS);
      if (out.items) out.items = truncateItems(out.items, ToolExecutor.MAX_ITEM_CHARS);
      return JSON.stringify(out);
    }

    let content = JSON.stringify(data);
    if (content.length > ToolExecutor.MAX_TOOL_RESULT_CHARS) {
      content = content.substring(0, ToolExecutor.MAX_TOOL_RESULT_CHARS) + '... [truncated]';
    }
    return content;
  }

  private prepareMessages(messages: Message[]): Array<{ role: MessageRole; content: string | any[]; tool_calls?: any[]; tool_call_id?: string; reasoning_content?: string }> {
    return messages.map(m => {
      const base: any = {
        role: m.role,
        content: m.content,
      };
      
      if (m.tool_calls) {
        base.tool_calls = m.tool_calls;
      }
      
      if (m.tool_call_id) {
        base.tool_call_id = m.tool_call_id;
      }

      if (m.role === 'assistant' && m.tool_calls) {
        base.reasoning_content = m.metadata?.thinking ?? '';
      }

      return base;
    });
  }

  private async streamCompletion(
    messages: Array<{ role: MessageRole; content: string | any[]; tool_calls?: any[]; tool_call_id?: string; reasoning_content?: string }>,
    tools: ToolDefinition[],
    messageId: string,
    callbacks?: StreamCallbacks,
    abortSignal?: AbortSignal
  ): Promise<{ content: string; thinking: string; toolCalls?: ToolCall[] }> {
    const stream = this.kimiClient.streamChatCompletion({
      model: this.options.defaultModel,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 4096,
    });

    let content = '';
    let thinking = '';
    let toolCalls: ToolCall[] = [];
    let currentToolCall: Partial<ToolCall> | null = null;

    for await (const chunk of stream) {
      if (abortSignal?.aborted) {
        throw new Error('Execution aborted');
      }

      const delta = chunk.choices[0]?.delta;

      if (delta?.reasoning_content) {
        thinking += delta.reasoning_content;
        callbacks?.onThinking?.(delta.reasoning_content);
      }

      if (delta?.content) {
        content += delta.content;
        callbacks?.onContent?.(delta.content);
      }

      // Handle tool calls in streaming
      if (delta?.tool_calls) {
        for (const toolCallDelta of delta.tool_calls) {
          if (toolCallDelta.id) {
            // New tool call
            if (currentToolCall) {
              toolCalls.push(currentToolCall as ToolCall);
            }
            currentToolCall = {
              id: toolCallDelta.id,
              type: 'function',
              function: {
                name: toolCallDelta.function?.name || '',
                arguments: toolCallDelta.function?.arguments || '',
              },
            };
          } else if (currentToolCall && toolCallDelta.function) {
            // Continue existing tool call
            if (toolCallDelta.function.name) {
              currentToolCall.function!.name += toolCallDelta.function.name;
            }
            if (toolCallDelta.function.arguments) {
              currentToolCall.function!.arguments += toolCallDelta.function.arguments;
            }
          }
        }
      }

      // Check for finish reason
      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        if (currentToolCall) {
          toolCalls.push(currentToolCall as ToolCall);
        }
      }
    }

    // Add any remaining tool call
    if (currentToolCall && !toolCalls.find(tc => tc.id === currentToolCall!.id)) {
      toolCalls.push(currentToolCall as ToolCall);
    }

    return {
      content,
      thinking,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private async executeToolCalls(
    toolCalls: ToolCall[],
    systemContext: SystemContext | undefined,
    messageId: string,
    callbacks?: StreamCallbacks
  ): Promise<Array<{ toolCallId: string; success: boolean; data?: any; error?: string }>> {
    const results: Array<{ toolCallId: string; success: boolean; data?: any; error?: string }> = [];

    for (const toolCall of toolCalls) {
      const state = this.state.get(messageId);
      if (state?.aborted) {
        throw new Error('Execution aborted');
      }

      callbacks?.onToolStart?.(toolCall.function.name, toolCall.id, toolCall.function.arguments);

      try {
        const result = await this.toolRegistry.executeTool(
          {
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          },
          {
            systemContext,
            messageId,
            onDisplayMessage: callbacks?.onDisplayMessage,
            onAskUser: callbacks?.onAskUser,
          }
        );

        results.push({
          toolCallId: toolCall.id,
          success: result.success,
          data: result.data,
          error: result.error,
        });

        callbacks?.onToolComplete?.(toolCall.function.name, toolCall.id, result.data);

        this.emit('tool-executed', {
          type: 'tool_complete',
          toolName: toolCall.function.name,
          toolCallId: toolCall.id,
          result: result.data,
          timestamp: Date.now(),
        } as ToolExecutionEvent);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({
          toolCallId: toolCall.id,
          success: false,
          error: errorMessage,
        });

        callbacks?.onToolError?.(toolCall.function.name, toolCall.id, errorMessage);

        this.emit('tool-error', {
          type: 'tool_error',
          toolName: toolCall.function.name,
          toolCallId: toolCall.id,
          error: errorMessage,
          timestamp: Date.now(),
        } as ToolExecutionEvent);
      }
    }

    return results;
  }

  private createFinalMessage(
    streamResult: { content: string; thinking: string; toolCalls?: ToolCall[] },
    messageId: string
  ): Message {
    // This is only called when there are no tool calls (per line 133),
    // so we explicitly don't include tool_calls to avoid API errors
    return {
      id: messageId,
      role: 'assistant',
      content: streamResult.content || 'No response',
      timestamp: Date.now(),
      metadata: streamResult.thinking ? { thinking: streamResult.thinking } : undefined,
    };
  }

  private createSummaryFromToolResults(
    messageId: string,
    toolCalls: ToolCall[],
    toolResults: Array<{ toolCallId: string; success: boolean; data?: any; error?: string }>
  ): Message {
    const lines: string[] = ['I completed the requested actions:'];
    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i];
      const result = toolResults[i];
      const name = call.function?.name ?? 'unknown';
      const status = result?.success ? 'succeeded' : 'failed';
      lines.push(`- **${name}**: ${status}`);
      if (result?.error) {
        lines.push(`  ${result.error}`);
      }
    }
    lines.push('\nIf you need more details or follow-up actions, ask me.');
    return {
      id: messageId,
      role: 'assistant',
      content: lines.join('\n'),
      timestamp: Date.now(),
      // Don't include tool_calls - they were already executed and responded to internally.
      // Including them would cause API errors since the tool response messages aren't in
      // the conversation history (they're only in the internal apiMessages loop).
    };
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  getActiveExecutions(): string[] {
    return Array.from(this.state.entries())
      .filter(([_, state]) => state.isExecuting)
      .map(([id, _]) => id);
  }

  cleanup(): void {
    // Cancel all active executions
    for (const [messageId, state] of this.state) {
      if (state.isExecuting) {
        this.cancel(messageId);
      }
    }
    this.state.clear();
    this.removeAllListeners();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createToolExecutor(
  toolRegistry: ToolRegistry,
  kimiClient: KimiClient,
  options?: Partial<ToolExecutorOptions>
): ToolExecutor {
  return new ToolExecutor(toolRegistry, kimiClient, options);
}

export default ToolExecutor;
